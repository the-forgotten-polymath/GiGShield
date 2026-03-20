import axios from 'axios';
import { config } from '../config';
import { query } from '../db/client';
import { redis, zoneKey } from '../db/redis';
import { logger } from '../utils/logger';
import { payoutEngine } from './payoutEngine';

const TRIGGER_THRESHOLDS = {
  WEATHER: { rainfallMm3h: 100, windSpeedKmh: 60 },
  AQI: { aqiThreshold: 400, minHours: 4 },
  HEAT: { tempCelsius: 45 },
};

/**
 * EventAggregator — polls external APIs every 15 minutes
 * and fires parametric triggers when thresholds are crossed.
 */
export function startEventAggregator() {
  logger.info('Starting Event Aggregator service');
  // Run immediately on startup, then every 15 minutes
  runAggregation().catch((e) => logger.error('Aggregation run failed', e));
  setInterval(
    () => runAggregation().catch((e) => logger.error('Aggregation run failed', e)),
    15 * 60 * 1000
  );
}

async function runAggregation() {
  const zones = await query<{ id: string; lat: number; lng: number; display_name: string }>(
    'SELECT id, lat, lng, display_name FROM zones WHERE lat IS NOT NULL AND lng IS NOT NULL'
  );

  await Promise.allSettled(zones.map((zone) => checkZone(zone)));
}

async function checkZone(zone: { id: string; lat: number; lng: number; display_name: string }) {
  try {
    const [weatherResult, aqiResult] = await Promise.allSettled([
      checkWeather(zone),
      checkAQI(zone),
    ]);

    if (weatherResult.status === 'fulfilled' && weatherResult.value) {
      await fireTrigger(zone.id, 'WEATHER', 'high', 'OpenWeatherMap', weatherResult.value);
    }

    if (aqiResult.status === 'fulfilled' && aqiResult.value) {
      await fireTrigger(zone.id, 'AQI', 'extreme', 'CPCB/IQAir', aqiResult.value);
    }
  } catch (err) {
    logger.error(`Zone check failed for ${zone.display_name}`, err);
  }
}

async function checkWeather(zone: { id: string; lat: number; lng: number }) {
  if (!config.owm.apiKey) {
    return null; // Skip if not configured
  }

  const url = `${config.owm.baseUrl}?lat=${zone.lat}&lon=${zone.lng}&exclude=minutely,daily,alerts&appid=${config.owm.apiKey}&units=metric`;
  const response = await axios.get<{
    current: { rain?: { '1h': number }; wind_speed: number };
    hourly: Array<{ rain?: { '1h': number }; wind_speed: number }>;
  }>(url);

  const { current } = response.data;
  const rainfall1h = current.rain?.['1h'] ?? 0;
  const windSpeed = current.wind_speed * 3.6; // m/s to km/h

  // Approximate 3h rainfall from 1h
  const rainfall3h = rainfall1h * 3;

  if (
    rainfall3h > TRIGGER_THRESHOLDS.WEATHER.rainfallMm3h ||
    windSpeed > TRIGGER_THRESHOLDS.WEATHER.windSpeedKmh
  ) {
    // Store in Redis for real-time dashboard
    await redis.setex(zoneKey(zone.id, 'weather_alert'), 3600, JSON.stringify({ rainfall3h, windSpeed }));
    return { rainfall3h: Math.round(rainfall3h * 10) / 10, windSpeed: Math.round(windSpeed) };
  }

  return null;
}

async function checkAQI(zone: { id: string; lat: number; lng: number }) {
  if (!config.cpcb.iqairKey) {
    return null;
  }

  try {
    const url = `https://api.airvisual.com/v2/nearest_city?lat=${zone.lat}&lon=${zone.lng}&key=${config.cpcb.iqairKey}`;
    const response = await axios.get<{ data: { current: { pollution: { aqius: number } } } }>(url);
    const aqi = response.data.data.current.pollution.aqius;

    if (aqi > TRIGGER_THRESHOLDS.AQI.aqiThreshold) {
      await redis.setex(zoneKey(zone.id, 'aqi_alert'), 3600, JSON.stringify({ aqi }));
      return { aqi };
    }
  } catch {
    // IQAir rate limiting — graceful skip
  }

  return null;
}

async function fireTrigger(
  zoneId: string,
  triggerType: string,
  severity: string,
  apiSource: string,
  triggerData: Record<string, unknown>
) {
  // Check for already active trigger of same type in this zone
  const existing = await query<{ id: string }>(
    `SELECT id FROM trigger_events WHERE zone_id = $1 AND trigger_type = $2 AND is_active = true`,
    [zoneId, triggerType]
  );

  if (existing.length > 0) {
    return; // Already processing this trigger
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO trigger_events (zone_id, trigger_type, severity, api_source, trigger_data, started_at, is_active)
     VALUES ($1, $2, $3, $4, $5, NOW(), true) RETURNING id`,
    [zoneId, triggerType, severity, apiSource, JSON.stringify(triggerData)]
  );

  const triggerEventId = rows[0].id;
  logger.info(`Trigger fired: ${triggerType} in zone ${zoneId}, event ${triggerEventId}`);

  // Process affected workers immediately
  const affectedWorkers = await query<{ worker_id: string; policy_id: string }>(
    `SELECT p.worker_id, p.id as policy_id
     FROM policies p JOIN workers w ON p.worker_id = w.id
     WHERE w.zone_id = $1 AND p.status = 'active' AND p.week_end > NOW()`,
    [zoneId]
  );

  await Promise.allSettled(
    affectedWorkers.map(({ worker_id, policy_id }) =>
      payoutEngine.processClaim({ workerId: worker_id, policyId: policy_id, triggerEventId })
    )
  );
}

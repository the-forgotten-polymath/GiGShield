import axios from 'axios';
import cron from 'node-cron';
import { query, queryOne } from '../db/client';
import { config } from '../config';
import { notificationService } from './notificationService';
import { logger } from '../utils/logger';

const TIER_CONFIG: Record<string, { base: number; dailyCap: number; maxDays: number }> = {
  lite: { base: 29, dailyCap: 300, maxDays: 2 },
  standard: { base: 49, dailyCap: 500, maxDays: 4 },
  pro: { base: 79, dailyCap: 800, maxDays: 5 },
};

export interface PremiumCalculation {
  basePremium: number;
  finalPremium: number;
  factors: Record<string, number>;
  tier: string;
}

/**
 * Calculate final premium for a worker using zone risk + forecast data.
 * Runs on Sunday 11pm via cron, pre-notifies workers before Monday debit.
 */
export const premiumEngineService = {
  async calculateForWorker(workerId: string): Promise<PremiumCalculation> {
    const worker = await queryOne<{
      id: string; zone_id: string; current_tier: string;
      avg_daily_earning: number; platform_tenure_months: number;
    }>(
      `SELECT w.id, w.zone_id, w.current_tier, w.avg_daily_earning, w.platform_tenure_months,
              z.flood_history_score, z.aqi_frequency_score, z.lat, z.lng, z.city
       FROM workers w JOIN zones z ON w.zone_id = z.id WHERE w.id = $1`,
      [workerId]
    );

    if (!worker) throw new Error(`Worker ${workerId} not found`);

    const tier = (worker as Record<string, unknown>).current_tier as string || 'standard';
    const base = TIER_CONFIG[tier]?.base || 49;
    const factors: Record<string, number> = {};

    // Factor 1: Zone flood history
    const floodScore = parseFloat(String((worker as Record<string, unknown>).flood_history_score || '0'));
    if (floodScore > 0.6) { factors.zone_flood_history = 10; }
    else if (floodScore > 0.3) { factors.zone_flood_history = 5; }
    else { factors.zone_flood_history = -3; }

    // Factor 2: Seasonal risk (monsoon June–September)
    const month = new Date().getMonth() + 1;
    const city = String((worker as Record<string, unknown>).city || '');
    if ([6, 7, 8, 9].includes(month)) {
      factors.seasonal_monsoon = city === 'Mumbai' ? 12 : 8;
    }

    // Factor 3: 7-day weather forecast
    const forecastScore = await getWeatherForecastScore(
      (worker as Record<string, unknown>).lat as number,
      (worker as Record<string, unknown>).lng as number
    );
    factors.weather_forecast = forecastScore;

    // Factor 4: Worker reliability
    const tenureMonths = (worker as Record<string, unknown>).platform_tenure_months as number || 0;
    if (tenureMonths > 12) { factors.worker_reliability = -3; }

    // Summer/heat peak
    if ([4, 5, 6].includes(month) && ['Delhi', 'Lucknow'].includes(city)) {
      factors.heat_season = 5;
    }

    const adjustment = Object.values(factors).reduce((a, b) => a + b, 0);
    const rawFinal = base + adjustment;

    // Floor: 70% of base, Cap: 200% of base
    const finalPremium = Math.max(
      Math.round(base * 0.7),
      Math.min(Math.round(base * 2), Math.round(rawFinal))
    );

    return { basePremium: base, finalPremium, factors, tier };
  },
};

async function getWeatherForecastScore(lat: number, lng: number): Promise<number> {
  if (!config.owm.apiKey || !lat || !lng) return 0;

  try {
    const url = `${config.owm.baseUrl}?lat=${lat}&lon=${lng}&exclude=current,minutely,hourly,alerts&appid=${config.owm.apiKey}&units=metric`;
    const response = await axios.get<{ daily: Array<{ rain?: number; pop: number }> }>(url);
    const { daily } = response.data;

    const next7 = daily.slice(0, 7);
    const avgPrecipProb = next7.reduce((sum, d) => sum + (d.pop || 0), 0) / next7.length;
    const totalRain = next7.reduce((sum, d) => sum + (d.rain || 0), 0);

    if (avgPrecipProb > 0.7 || totalRain > 50) return 10;
    if (avgPrecipProb > 0.4 || totalRain > 20) return 5;
    if (avgPrecipProb < 0.1) return -2;
    return 3;
  } catch {
    return 0;
  }
}

/**
 * Runs every Sunday at 11 PM — recalculates premiums and pre-notifies workers
 */
export function startPremiumCron() {
  // Every Sunday at 23:00
  cron.schedule('0 23 * * 0', async () => {
    logger.info('Premium recalculation cron started');

    const activeWorkers = await query<{ id: string; phone: string }>(
      `SELECT DISTINCT w.id, w.phone FROM workers w
       JOIN policies p ON p.worker_id = w.id
       WHERE p.status = 'active' AND p.week_end > NOW()`
    );

    logger.info(`Recalculating premiums for ${activeWorkers.length} workers`);

    await Promise.allSettled(
      activeWorkers.map(async (w) => {
        try {
          const premiumInfo = await premiumEngineService.calculateForWorker(w.id);
          // Pre-notify worker of next week's premium before Monday debit
          await notificationService.sendPremiumPreNotification(w.id, premiumInfo);
        } catch (err) {
          logger.error(`Premium calc failed for worker ${w.id}`, err);
        }
      })
    );
  });

  // Monday 6 AM — debit premium via Razorpay AutoPay
  cron.schedule('0 6 * * 1', async () => {
    logger.info('Monday premium debit cron started');
    // Razorpay AutoPay mandates auto-debit — this cron creates next week's policy
    const activeWorkers = await query<{ id: string; current_tier: string }>(
      `SELECT DISTINCT w.id, w.current_tier FROM workers w
       JOIN policies p ON p.worker_id = w.id
       WHERE p.status = 'active' AND p.week_end <= NOW() + INTERVAL '1 day'`
    );

    await Promise.allSettled(
      activeWorkers.map(async (w) => {
        const premiumInfo = await premiumEngineService.calculateForWorker(w.id);
        const tc = TIER_CONFIG[w.current_tier] || TIER_CONFIG.standard;
        const weekStart = new Date();
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() + 7);

        await query(
          `INSERT INTO policies (worker_id, tier, week_start, week_end, base_premium, final_premium,
            premium_factors, daily_cap, max_covered_days, status, premium_paid_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW())`,
          [w.id, w.current_tier, weekStart, weekEnd, tc.base, premiumInfo.finalPremium,
           JSON.stringify(premiumInfo.factors), tc.dailyCap, tc.maxDays]
        );

        await notificationService.sendCoverageActivated(w.id, premiumInfo.finalPremium, w.current_tier);
      })
    );
  });

  logger.info('Premium cron jobs scheduled');
}

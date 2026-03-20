import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('connect', () => logger.info('Redis client connected'));
redis.on('error', (err) => logger.error('Redis error', err));

export async function setFeature(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function getFeature<T>(key: string): Promise<T | null> {
  const val = await redis.get(key);
  if (!val) return null;
  return JSON.parse(val) as T;
}

export function featureKey(workerId: string, signal: string): string {
  return `bcs:worker:${workerId}:${signal}`;
}

export function zoneKey(zoneId: string, signal: string): string {
  return `zone:${zoneId}:${signal}`;
}

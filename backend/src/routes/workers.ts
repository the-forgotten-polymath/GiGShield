import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../db/client';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/workers/register
 * Complete worker profile: zone + platform ID + earnings
 */
router.post('/register', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, zoneId, platform, platformWorkerId, avgDailyEarning, platformTenureMonths, language } = req.body;

  if (!name || !zoneId || !platform) {
    res.status(400).json({ error: 'name, zoneId and platform are required' });
    return;
  }

  try {
    const zone = await queryOne<{ id: string }>('SELECT id FROM zones WHERE id = $1', [zoneId]);
    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    await query(
      `UPDATE workers SET
        name = $1, zone_id = $2, platform = $3,
        platform_worker_id = $4, avg_daily_earning = $5,
        platform_tenure_months = $6, language = $7, updated_at = NOW()
       WHERE id = $8`,
      [name, zoneId, platform, platformWorkerId || null,
       avgDailyEarning || 720, platformTenureMonths || 0,
       language || 'hi', req.workerId]
    );

    const worker = await queryOne<Record<string, unknown>>(
      `SELECT w.*, z.display_name as zone_name, z.city
       FROM workers w JOIN zones z ON w.zone_id = z.id WHERE w.id = $1`,
      [req.workerId]
    );

    res.json({ worker });
  } catch (err) {
    logger.error('Worker register error', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * GET /api/workers/:id/coverage
 * Returns active policy + current trigger status for the worker's zone
 */
router.get('/:id/coverage', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.params.id !== req.workerId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const policy = await queryOne<Record<string, unknown>>(
      `SELECT p.*, z.display_name as zone_name, z.city,
              w.current_tier, w.avg_daily_earning, w.avg_daily_hours, w.upi_id
       FROM policies p
       JOIN workers w ON p.worker_id = w.id
       JOIN zones z ON w.zone_id = z.id
       WHERE p.worker_id = $1 AND p.status = 'active'
         AND p.week_end > NOW()
       ORDER BY p.created_at DESC LIMIT 1`,
      [req.workerId]
    );

    const activeTrigger = await queryOne<Record<string, unknown>>(
      `SELECT te.trigger_type, te.severity, te.started_at
       FROM trigger_events te
       JOIN workers w ON w.zone_id = te.zone_id
       WHERE w.id = $1 AND te.is_active = true
       ORDER BY te.created_at DESC LIMIT 1`,
      [req.workerId]
    );

    res.json({ policy, activeTrigger, isCovered: !!policy });
  } catch (err) {
    logger.error('Coverage fetch error', err);
    res.status(500).json({ error: 'Failed to fetch coverage' });
  }
});

/**
 * GET /api/workers/:id/payouts
 * Returns last 10 payouts for the worker
 */
router.get('/:id/payouts', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.params.id !== req.workerId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const payouts = await query<Record<string, unknown>>(
      `SELECT c.id, c.payout_amount, c.status, c.created_at, c.track,
              te.trigger_type, te.severity, te.started_at as event_started,
              t.utr, t.completed_at
       FROM claims c
       JOIN trigger_events te ON c.trigger_event_id = te.id
       LEFT JOIN transactions t ON t.claim_id = c.id AND t.transaction_type = 'payout'
       WHERE c.worker_id = $1 AND c.payout_amount IS NOT NULL
       ORDER BY c.created_at DESC LIMIT 10`,
      [req.workerId]
    );

    res.json({ payouts });
  } catch (err) {
    logger.error('Payouts fetch error', err);
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

/**
 * GET /api/workers/:id/premium
 * Returns current week premium + factor breakdown
 */
router.get('/:id/premium', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.params.id !== req.workerId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const policy = await queryOne<Record<string, unknown>>(
      `SELECT final_premium, base_premium, premium_factors, tier, week_start, week_end
       FROM policies WHERE worker_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [req.workerId]
    );

    res.json({ premium: policy });
  } catch (err) {
    logger.error('Premium fetch error', err);
    res.status(500).json({ error: 'Failed to fetch premium' });
  }
});

/**
 * GET /api/workers/zones
 * List all available zones for onboarding
 */
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const zones = await query<Record<string, unknown>>(
    'SELECT id, city, display_name, flood_history_score, aqi_frequency_score FROM zones ORDER BY city, display_name'
  );
  res.json({ zones });
});

export default router;

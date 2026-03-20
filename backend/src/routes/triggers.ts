import { Router, Request, Response } from 'express';
import { adminMiddleware } from '../middleware/auth';
import { query } from '../db/client';
import { payoutEngine } from '../services/payoutEngine';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/triggers/admin/zones/:zoneId/fire
 * Admin: manually fire a trigger event (for demo / testing)
 */
router.post('/admin/zones/:zoneId/fire', adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { zoneId } = req.params;
  const { triggerType = 'WEATHER', severity = 'high', triggerData = {} } = req.body;

  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO trigger_events (zone_id, trigger_type, severity, api_source, trigger_data, started_at, is_active)
       VALUES ($1, $2, $3, 'MANUAL_DEMO', $4, NOW(), true)
       RETURNING id`,
      [zoneId, triggerType, severity, JSON.stringify(triggerData)]
    );

    const triggerEventId = rows[0].id;
    logger.info(`Manual trigger fired: ${triggerType} in zone ${zoneId}, event ${triggerEventId}`);

    // Process payouts for all workers in this zone with active policies
    const affectedWorkers = await query<{ worker_id: string; policy_id: string }>(
      `SELECT DISTINCT p.worker_id, p.id as policy_id
       FROM policies p
       JOIN workers w ON p.worker_id = w.id
       WHERE w.zone_id = $1 AND p.status = 'active' AND p.week_end > NOW()`,
      [zoneId]
    );

    logger.info(`Processing payouts for ${affectedWorkers.length} workers`);

    // Process each worker asynchronously
    const results = await Promise.allSettled(
      affectedWorkers.map(({ worker_id, policy_id }) =>
        payoutEngine.processClaim({ workerId: worker_id, policyId: policy_id, triggerEventId })
      )
    );

    const processed = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    res.json({
      triggerEventId,
      workersProcessed: processed,
      workersFailed: failed,
      totalWorkers: affectedWorkers.length,
    });
  } catch (err) {
    logger.error('Trigger fire error', err);
    res.status(500).json({ error: 'Failed to fire trigger' });
  }
});

/**
 * GET /api/triggers/active
 * Returns currently active trigger events (for dashboard banner)
 */
router.get('/active', async (req: Request, res: Response): Promise<void> => {
  const zoneId = req.query.zoneId as string;

  const triggers = await query<Record<string, unknown>>(
    `SELECT te.*, z.display_name as zone_name
     FROM trigger_events te JOIN zones z ON te.zone_id = z.id
     WHERE te.is_active = true
       ${zoneId ? 'AND te.zone_id = $1' : ''}
     ORDER BY te.started_at DESC`,
    zoneId ? [zoneId] : []
  );

  res.json({ triggers });
});

export default router;

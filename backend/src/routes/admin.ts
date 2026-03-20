import { Router, Request, Response } from 'express';
import { adminMiddleware } from '../middleware/auth';
import { query, queryOne } from '../db/client';
import { logger } from '../utils/logger';

const router = Router();
router.use(adminMiddleware);

/**
 * GET /api/admin/dashboard
 * Returns loss ratios, zone summaries, ring alerts, liquidity estimate
 */
router.get('/dashboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [premiumStats, payoutStats, ringAlerts, zoneSummary, claimsQueue] = await Promise.all([
      // Total premiums this week
      query<{ total_premium: string; policy_count: string }>(
        `SELECT SUM(final_premium) as total_premium, COUNT(*) as policy_count
         FROM policies WHERE status = 'active' AND week_start >= date_trunc('week', NOW())`
      ),
      // Total payouts this week
      query<{ total_payout: string; claim_count: string }>(
        `SELECT SUM(payout_amount) as total_payout, COUNT(*) as claim_count
         FROM claims WHERE status = 'paid' AND created_at >= date_trunc('week', NOW())`
      ),
      // Active ring flags
      query<{ id: string; confidence_score: number; worker_count: number; created_at: string }>(
        `SELECT id, confidence_score, array_length(worker_ids, 1) as worker_count, created_at
         FROM ring_flags WHERE reviewed = false ORDER BY created_at DESC LIMIT 10`
      ),
      // Zone-level summary
      query<Record<string, unknown>>(
        `SELECT z.id, z.display_name, z.city,
                COUNT(DISTINCT w.id) as enrolled_workers,
                COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_policies,
                COALESCE(SUM(CASE WHEN c.status = 'paid' AND c.created_at > NOW() - INTERVAL '7 days' THEN c.payout_amount ELSE 0 END), 0) as week_payouts,
                bool_or(te.is_active) as has_active_trigger
         FROM zones z
         LEFT JOIN workers w ON w.zone_id = z.id
         LEFT JOIN policies p ON p.worker_id = w.id
         LEFT JOIN claims c ON c.worker_id = w.id
         LEFT JOIN trigger_events te ON te.zone_id = z.id AND te.is_active = true
         GROUP BY z.id, z.display_name, z.city`
      ),
      // Claims needing review (Track C/D)
      query<Record<string, unknown>>(
        `SELECT c.id, c.worker_id, c.bcs_score, c.track, c.status, c.payout_amount, c.created_at,
                w.phone, w.name, te.trigger_type
         FROM claims c JOIN workers w ON c.worker_id = w.id
         JOIN trigger_events te ON c.trigger_event_id = te.id
         WHERE c.track IN ('C', 'D') AND c.status NOT IN ('paid', 'rejected')
         ORDER BY c.created_at DESC LIMIT 20`
      ),
    ]);

    const totalPremium = parseFloat(premiumStats[0]?.total_premium || '0');
    const totalPayout = parseFloat(payoutStats[0]?.total_payout || '0');
    const lossRatio = totalPremium > 0 ? (totalPayout / totalPremium) * 100 : 0;

    res.json({
      summary: {
        weeklyPremium: totalPremium,
        weeklyPayout: totalPayout,
        lossRatioPercent: Math.round(lossRatio * 100) / 100,
        activePolicies: parseInt(premiumStats[0]?.policy_count || '0'),
        weekClaims: parseInt(payoutStats[0]?.claim_count || '0'),
        liquidityHealth: lossRatio < 120 ? 'healthy' : lossRatio < 180 ? 'warning' : 'critical',
      },
      ringAlerts,
      zoneSummary,
      claimsQueue,
    });
  } catch (err) {
    logger.error('Admin dashboard error', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/admin/claims/:id
 * View single claim details + BCS breakdown
 */
router.get('/claims/:id', async (req: Request, res: Response): Promise<void> => {
  const claim = await queryOne<Record<string, unknown>>(
    `SELECT c.*, w.name, w.phone, w.bcs_trust_reserve, z.display_name as zone_name,
            te.trigger_type, te.severity, te.trigger_data
     FROM claims c
     JOIN workers w ON c.worker_id = w.id
     JOIN workers wr ON wr.id = w.id
     JOIN zones z ON wr.zone_id = z.id
     JOIN trigger_events te ON c.trigger_event_id = te.id
     WHERE c.id = $1`,
    [req.params.id]
  );

  if (!claim) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }

  res.json({ claim });
});

/**
 * POST /api/admin/claims/:id/review
 * Manual review decision for Track C/D claims
 */
router.post('/claims/:id/review', async (req: Request, res: Response): Promise<void> => {
  const { outcome, notes, reviewerEmail } = req.body;

  if (!['approved', 'rejected'].includes(outcome)) {
    res.status(400).json({ error: 'outcome must be approved or rejected' });
    return;
  }

  try {
    await query(
      `UPDATE claims SET status = $1, review_notes = $2, reviewed_by = $3, updated_at = NOW()
       WHERE id = $4`,
      [outcome, notes, reviewerEmail, req.params.id]
    );

    res.json({ success: true, outcome });
  } catch (err) {
    logger.error('Claim review error', err);
    res.status(500).json({ error: 'Review failed' });
  }
});

/**
 * GET /api/admin/zones
 * All zones with trigger + worker count
 */
router.get('/zones', async (_req: Request, res: Response): Promise<void> => {
  const zones = await query<Record<string, unknown>>(
    `SELECT z.*, COUNT(DISTINCT w.id) as worker_count,
            bool_or(te.is_active) as has_active_trigger
     FROM zones z
     LEFT JOIN workers w ON w.zone_id = z.id
     LEFT JOIN trigger_events te ON te.zone_id = z.id AND te.is_active = true
     GROUP BY z.id ORDER BY z.city, z.display_name`
  );
  res.json({ zones });
});

export default router;

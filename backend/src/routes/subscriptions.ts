import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { queryOne, query } from '../db/client';
import { razorpayService } from '../integrations/razorpay';
import { premiumEngineService } from '../services/premiumEngine';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/subscriptions/mandate
 * Set up Razorpay UPI AutoPay mandate for the worker
 */
router.post('/mandate', async (req: AuthRequest, res: Response): Promise<void> => {
  const { upiId, tier = 'standard' } = req.body;

  if (!upiId) {
    res.status(400).json({ error: 'upiId is required' });
    return;
  }

  try {
    const worker = await queryOne<{ id: string; phone: string; name: string; razorpay_customer_id: string }>(
      'SELECT id, phone, name, razorpay_customer_id FROM workers WHERE id = $1',
      [req.workerId]
    );

    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    // Create or retrieve Razorpay customer
    let customerId = worker.razorpay_customer_id;
    if (!customerId) {
      const customer = await razorpayService.createCustomer({
        name: worker.name || 'GigShield Worker',
        contact: worker.phone,
      });
      customerId = customer.id;
      await query('UPDATE workers SET razorpay_customer_id = $1 WHERE id = $2', [customerId, worker.id]);
    }

    // Create UPI AutoPay mandate (NACH)
    const mandate = await razorpayService.createMandate({
      customerId,
      upiId,
      maxAmount: 10000, // ₹100 weekly cap — safety net
      description: 'GigShield Weekly Insurance Premium',
    });

    await query(
      'UPDATE workers SET upi_id = $1, razorpay_mandate_id = $2, current_tier = $3 WHERE id = $4',
      [upiId, mandate.id, tier, worker.id]
    );

    // Calculate + create first week's policy
    const premiumInfo = await premiumEngineService.calculateForWorker(worker.id);
    const policy = await createActivePolicy(worker.id, tier, premiumInfo);

    // Send welcome push + WhatsApp
    await notificationService.sendCoverageActivated(worker.id, premiumInfo.finalPremium, tier);

    res.json({
      success: true,
      mandateId: mandate.id,
      policy,
      premium: premiumInfo,
      message: 'AutoPay mandate set up. You are now covered! ✅',
    });
  } catch (err) {
    logger.error('Mandate setup error', err);
    res.status(500).json({ error: 'Failed to set up AutoPay mandate' });
  }
});

async function createActivePolicy(
  workerId: string,
  tier: string,
  premiumInfo: { basePremium: number; finalPremium: number; factors: Record<string, number> }
) {
  const tierConfig: Record<string, { dailyCap: number; maxDays: number; base: number }> = {
    lite: { dailyCap: 300, maxDays: 2, base: 29 },
    standard: { dailyCap: 500, maxDays: 4, base: 49 },
    pro: { dailyCap: 800, maxDays: 5, base: 79 },
  };

  const tc = tierConfig[tier] || tierConfig.standard;
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const rows = await query<{ id: string }>(
    `INSERT INTO policies (worker_id, tier, week_start, week_end, base_premium, final_premium,
      premium_factors, daily_cap, max_covered_days, status, premium_paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW())
     RETURNING id`,
    [workerId, tier, weekStart, weekEnd, tc.base, premiumInfo.finalPremium,
     JSON.stringify(premiumInfo.factors), tc.dailyCap, tc.maxDays]
  );

  return rows[0];
}

export default router;

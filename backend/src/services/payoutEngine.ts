import axios from 'axios';
import { query, queryOne } from '../db/client';
import { config } from '../config';
import { razorpayService } from '../integrations/razorpay';
import { notificationService } from './notificationService';
import { logger } from '../utils/logger';

const BCS_TRACK_THRESHOLDS = {
  A: 80, // Auto-approve <5 min
  B: 50, // 2-hour passive monitoring
  C: 30, // 24-hr hold + transparent appeal
  D: 0,  // Block + ring investigation
};

// Storm Exception: lower BCS threshold by 15pts when external API confirms event
const STORM_EXCEPTION_BONUS = 15;

export interface ProcessClaimParams {
  workerId: string;
  policyId: string;
  triggerEventId: string;
}

export const payoutEngine = {
  async processClaim({ workerId, policyId, triggerEventId }: ProcessClaimParams): Promise<void> {
    // 1. Validate active policy
    const policy = await queryOne<{
      id: string; tier: string; daily_cap: number; max_covered_days: number;
    }>(
      `SELECT id, tier, daily_cap, max_covered_days FROM policies
       WHERE id = $1 AND worker_id = $2 AND status = 'active' AND week_end > NOW()`,
      [policyId, workerId]
    );

    if (!policy) {
      logger.warn(`No active policy for worker ${workerId} — skipping claim`);
      return;
    }

    // 2. Check for duplicate claim on same trigger
    const existingClaim = await queryOne<{ id: string }>(
      'SELECT id FROM claims WHERE worker_id = $1 AND trigger_event_id = $2',
      [workerId, triggerEventId]
    );
    if (existingClaim) return;

    // 3. Call ML microservice for BCS
    const workerData = await queryOne<Record<string, unknown>>(
      `SELECT w.*, z.lat, z.lng FROM workers w JOIN zones z ON w.zone_id = z.id WHERE w.id = $1`,
      [workerId]
    );
    if (!workerData) return;

    let bcsScore = 75; // Default for demo
    let bcsSignals: Record<string, unknown> = {};

    try {
      const mlResponse = await axios.post<{ bcs_score: number; signals: Record<string, unknown> }>(
        `${config.mlService.url}/bcs/evaluate`,
        {
          worker_id: workerId,
          zone_lat: workerData.lat,
          zone_lng: workerData.lng,
          avg_daily_earning: workerData.avg_daily_earning,
          platform_tenure_months: workerData.platform_tenure_months,
          bcs_trust_reserve: workerData.bcs_trust_reserve,
        },
        { timeout: 5000 }
      );
      bcsScore = mlResponse.data.bcs_score;
      bcsSignals = mlResponse.data.signals;
    } catch {
      logger.warn(`ML service unavailable for worker ${workerId} — using default BCS`);
    }

    // 4. Apply Storm Exception Protocol
    // (external API already confirmed event = lower individual threshold by 15)
    const adjustedScore = bcsScore + STORM_EXCEPTION_BONUS;

    // 5. Ring detection scan
    let ringFlagged = false;
    try {
      const ringResponse = await axios.post<{ ring_detected: boolean; confidence: number }>(
        `${config.mlService.url}/ring/detect`,
        { worker_id: workerId, trigger_event_id: triggerEventId },
        { timeout: 5000 }
      );
      ringFlagged = ringResponse.data.ring_detected;
    } catch {
      logger.warn('Ring detection unavailable — proceeding without ring scan');
    }

    // 6. Determine track
    const track = determineTrack(adjustedScore, ringFlagged);

    // 7. Calculate payout amount
    const triggerEvent = await queryOne<{ started_at: string; severity: string }>(
      'SELECT started_at, severity FROM trigger_events WHERE id = $1',
      [triggerEventId]
    );

    const disruptedHours = calculateDisruptedHours(
      new Date(triggerEvent?.started_at || new Date()),
      triggerEvent?.severity || 'high'
    );

    const avgDailyEarning = parseFloat(String(workerData.avg_daily_earning)) || 720;
    const avgDailyHours = parseFloat(String(workerData.avg_daily_hours)) || 8;
    const hourlyRate = avgDailyEarning / avgDailyHours;
    const rawPayout = disruptedHours * hourlyRate * 0.85;
    const payoutAmount = Math.min(rawPayout, policy.daily_cap);

    // 8. Create claim record
    const claimRows = await query<{ id: string }>(
      `INSERT INTO claims (worker_id, policy_id, trigger_event_id, bcs_score, bcs_signals, track,
        disrupted_hours, hourly_rate, payout_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [workerId, policyId, triggerEventId, bcsScore, JSON.stringify(bcsSignals), track,
       disruptedHours, hourlyRate, payoutAmount,
       track === 'A' ? 'approved' : track === 'B' ? 'soft_flagged' : track === 'C' ? 'held' : 'blocked']
    );

    const claimId = claimRows[0].id;

    // 9. Route by track
    switch (track) {
      case 'A':
        await executePayout(claimId, workerId, payoutAmount);
        await notificationService.sendPayoutSuccess(workerId, payoutAmount);
        break;

      case 'B':
        await notificationService.sendSoftFlag(workerId, payoutAmount);
        // Schedule 2hr passive monitoring job (in a real system, use Bull queue)
        setTimeout(
          async () => {
            await executePayout(claimId, workerId, payoutAmount);
            await notificationService.sendPayoutSuccess(workerId, payoutAmount);
          },
          2 * 60 * 60 * 1000
        );
        break;

      case 'C':
        await notificationService.sendHoldNotification(workerId, claimId);
        break;

      case 'D':
        await notificationService.sendBlockedNotification(workerId, claimId);
        logger.warn(`Track D claim ${claimId} for worker ${workerId} — BCS: ${bcsScore}, ring: ${ringFlagged}`);
        break;
    }

    logger.info(
      `Claim ${claimId}: worker ${workerId}, BCS ${bcsScore} → Track ${track}, payout ₹${payoutAmount.toFixed(0)}`
    );
  },
};

function determineTrack(adjustedBcs: number, ringFlagged: boolean): 'A' | 'B' | 'C' | 'D' {
  if (ringFlagged) return 'D';
  if (adjustedBcs >= BCS_TRACK_THRESHOLDS.A) return 'A';
  if (adjustedBcs >= BCS_TRACK_THRESHOLDS.B) return 'B';
  if (adjustedBcs >= BCS_TRACK_THRESHOLDS.C) return 'C';
  return 'D';
}

function calculateDisruptedHours(triggerStart: Date, severity: string): number {
  const DISRUPTION_HOURS: Record<string, number> = {
    low: 2, moderate: 3, high: 4.5, extreme: 6,
  };
  return DISRUPTION_HOURS[severity] ?? 4.5;
}

async function executePayout(claimId: string, workerId: string, amount: number) {
  try {
    const worker = await queryOne<{ upi_id: string; name: string }>(
      'SELECT upi_id, name FROM workers WHERE id = $1',
      [workerId]
    );

    if (!worker?.upi_id) {
      logger.error(`No UPI ID for worker ${workerId}`);
      return;
    }

    const payout = await razorpayService.initiatePayout({
      amount: Math.round(amount * 100), // paise
      upiId: worker.upi_id,
      workerName: worker.name || 'Delivery Partner',
      narration: `GigShield Protection Payout`,
    });

    // Create transaction record
    await query(
      `INSERT INTO transactions (claim_id, worker_id, amount, transaction_type, status, razorpay_payout_id, utr)
       VALUES ($1, $2, $3, 'payout', 'completed', $4, $5)`,
      [claimId, workerId, amount, payout.id, payout.utr || '']
    );

    await query(
      `UPDATE claims SET status = 'paid', razorpay_payout_id = $1, payout_utr = $2, updated_at = NOW()
       WHERE id = $3`,
      [payout.id, payout.utr || '', claimId]
    );

    // Update trust reserve for legitimate claimers
    await query(
      `UPDATE workers SET bcs_trust_reserve = LEAST(bcs_trust_reserve + 2, 20) WHERE id = $1`,
      [workerId]
    );
  } catch (err) {
    logger.error(`Payout execution failed for claim ${claimId}`, err);
  }
}

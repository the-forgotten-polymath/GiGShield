import { Router, Request, Response } from 'express';
import { queryOne } from '../db/client';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

const router = Router();

const COMMANDS: Record<string, string> = {
  STATUS: 'status',
  PAYOUT: 'payout',
  HELP: 'help',
  STOP: 'stop',
  CONFIRM: 'confirm_stop',
};

/**
 * POST /api/whatsapp/webhook
 * Twilio WhatsApp webhook — receives inbound messages
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const { Body, From } = req.body;

  if (!Body || !From) {
    res.status(200).send('OK');
    return;
  }

  const phone = From.replace('whatsapp:', '');
  const command = Body.trim().toUpperCase();

  logger.info(`WhatsApp command from ${phone}: ${command}`);

  try {
    const worker = await queryOne<{
      id: string; name: string; current_tier: string; language: string
    }>(
      `SELECT w.id, w.name, w.current_tier, w.language FROM workers w WHERE w.phone = $1`,
      [phone]
    );

    if (!worker) {
      await notificationService.sendWhatsApp(From,
        'Aapka number GigShield mein registered nahi hai.\nRegister karein: gigshield.in\n\n' +
        'Your number is not registered with GigShield.\nRegister at: gigshield.in'
      );
      res.status(200).send('OK');
      return;
    }

    const isHindi = worker.language === 'hi';

    switch (COMMANDS[command] || 'unknown') {
      case 'status': {
        const policy = await queryOne<{ tier: string; week_end: string; final_premium: number; zone_name: string }>(
          `SELECT p.tier, p.week_end, p.final_premium, z.display_name as zone_name
           FROM policies p JOIN workers w ON p.worker_id = w.id
           JOIN zones z ON w.zone_id = z.id
           WHERE p.worker_id = $1 AND p.status = 'active' AND p.week_end > NOW()
           LIMIT 1`,
          [worker.id]
        );

        if (policy) {
          const tierLabels: Record<string, string> = { lite: 'Kavach Lite', standard: 'Kavach Standard', pro: 'Kavach Pro' };
          const endDate = new Date(policy.week_end).toLocaleDateString('en-IN');
          await notificationService.sendWhatsApp(From,
            isHindi
              ? `🛡️ *GigShield Status*\nCoverage: ACTIVE ✅\nTier: ${tierLabels[policy.tier]}\nZone: ${policy.zone_name}\nCoverage tak: ${endDate}\nAgle premium: ₹${policy.final_premium} (Somwar)`
              : `🛡️ *GigShield Status*\nCoverage: ACTIVE ✅\nTier: ${tierLabels[policy.tier]}\nZone: ${policy.zone_name}\nCovered until: ${endDate}\nNext premium: ₹${policy.final_premium} (Monday)`
          );
        } else {
          await notificationService.sendWhatsApp(From,
            isHindi
              ? '⚠️ Abhi aap covered nahi hain. Premium pay karein: gigshield.in'
              : '⚠️ You are not currently covered. Pay premium at: gigshield.in'
          );
        }
        break;
      }

      case 'payout': {
        const payouts = await queryOne<{ payout_amount: number; completed_at: string; utr: string }>(
          `SELECT c.payout_amount, t.completed_at, t.utr
           FROM claims c JOIN transactions t ON t.claim_id = c.id
           WHERE c.worker_id = $1 AND c.status = 'paid'
           ORDER BY c.created_at DESC LIMIT 1`,
          [worker.id]
        );

        if (payouts) {
          const date = new Date(payouts.completed_at).toLocaleDateString('en-IN');
          await notificationService.sendWhatsApp(From,
            isHindi
              ? `💰 *Last Payout*\nAmount: ₹${payouts.payout_amount}\nDate: ${date}\nUTR: ${payouts.utr || 'Processing'}`
              : `💰 *Last Payout*\nAmount: ₹${payouts.payout_amount}\nDate: ${date}\nUTR: ${payouts.utr || 'Processing'}`
          );
        } else {
          await notificationService.sendWhatsApp(From,
            isHindi ? 'Abhi tak koi payout nahi hua.' : 'No payouts yet.'
          );
        }
        break;
      }

      case 'help': {
        await notificationService.sendWhatsApp(From,
          '🛡️ *GigShield Help*\n\n' +
          '*STATUS* — Apni coverage check karein\n' +
          '*PAYOUT* — Last payout dekhein\n' +
          '*STOP* — Subscription band karein\n' +
          '*HELP* — Yeh menu\n\n' +
          '_Check your coverage_\n_View last payout_\n_Cancel subscription_'
        );
        break;
      }

      case 'stop': {
        await notificationService.sendWhatsApp(From,
          isHindi
            ? '⚠️ Kya aap GigShield band karna chahte hain?\nConfirm karne ke liye *CONFIRM* reply karein.\n\nDo you want to cancel GigShield?\nReply *CONFIRM* to confirm.'
            : 'Do you want to cancel GigShield? Reply *CONFIRM* to confirm.'
        );
        break;
      }

      case 'confirm_stop': {
        await queryOne(
          `UPDATE policies SET status = 'cancelled' WHERE worker_id = $1 AND status = 'active'`,
          [worker.id]
        );
        await notificationService.sendWhatsApp(From,
          isHindi
            ? '✅ Aapka subscription cancel ho gaya. Hum aapko miss karenge, Raju bhai! Wapas aayein jab chahein: gigshield.in'
            : '✅ Subscription cancelled. We\'ll miss you! Come back anytime: gigshield.in'
        );
        break;
      }

      default: {
        await notificationService.sendWhatsApp(From,
          isHindi
            ? 'Command samajh nahi aya. *HELP* type karein menu ke liye.'
            : 'Command not recognized. Type *HELP* for the menu.'
        );
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error('WhatsApp webhook error', err);
    res.status(200).send('OK');
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { verifyFirebaseToken, issueJwt } from '../middleware/auth';
import { queryOne, query } from '../db/client';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/otp-verify
 * Verify Firebase OTP token, create worker if new, return JWT
 */
router.post('/otp-verify', async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }

  try {
    const verified = await verifyFirebaseToken(idToken);
    if (!verified) {
      res.status(401).json({ error: 'Invalid Firebase token' });
      return;
    }

    const { phone, uid } = verified;

    // Upsert worker record on first login
    let worker = await queryOne<{ id: string; phone: string; name: string | null; current_tier: string }>(
      'SELECT id, phone, name, current_tier FROM workers WHERE phone = $1',
      [phone]
    );

    if (!worker) {
      const rows = await query<{ id: string; phone: string; name: string | null; current_tier: string }>(
        `INSERT INTO workers (phone, firebase_uid) VALUES ($1, $2) RETURNING id, phone, name, current_tier`,
        [phone, uid]
      );
      worker = rows[0];
      logger.info(`New worker registered: ${phone}`);
    }

    const token = issueJwt(worker.id, phone);

    res.json({
      token,
      worker: {
        id: worker.id,
        phone: worker.phone,
        name: worker.name,
        tier: worker.current_tier,
        isNewUser: !worker.name,
      },
    });
  } catch (err) {
    logger.error('OTP verify error', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as admin from 'firebase-admin';
import { config } from '../config';
import { queryOne } from '../db/client';
import { logger } from '../utils/logger';

// Initialize Firebase Admin once
if (!admin.apps.length) {
  if (config.firebase.projectId) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
    });
  }
}

export interface AuthRequest extends Request {
  workerId?: string;
  phone?: string;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { workerId: string; phone: string };
    req.workerId = decoded.workerId;
    req.phone = decoded.phone;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<{ phone: string; uid: string } | null> {
  try {
    if (!admin.apps.length) {
      // Mock for dev without Firebase credentials
      logger.warn('Firebase not configured — using mock token verification');
      return { phone: '+91' + idToken.replace(/\D/g, '').slice(-10), uid: 'mock-uid-' + Date.now() };
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { phone: decoded.phone_number || '', uid: decoded.uid };
  } catch (err) {
    logger.error('Firebase token verification failed', err);
    return null;
  }
}

export function issueJwt(workerId: string, phone: string): string {
  return jwt.sign({ workerId, phone }, config.jwtSecret, { expiresIn: '30d' });
}

export function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // Simple API key auth for admin routes — replace with proper RBAC in prod
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

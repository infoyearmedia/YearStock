// Demo JWT auth middleware. DEMO ONLY: any email + password >= 6 chars can
// sign up / log in, users live in the local store, and the JWT secret falls
// back to 'demo-secret-change-me' when JWT_SECRET is not set. Do not use in
// production without a real user table, bcrypt and a strong secret.

import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { findUserById } from '../lib/store';
import type { PlanId } from '../lib/plans';

export const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-change-me';

if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET not set — using demo secret. Set JWT_SECRET in production.');
}

export interface AuthUser {
  id: string;
  email: string;
  plan: PlanId;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function signToken(user: { id: string; email: string; plan: PlanId }): string {
  return jwt.sign({ sub: user.id, email: user.email, plan: user.plan }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing Bearer token' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string; plan: PlanId };
    const user = findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'unauthorized', message: 'User not found' });
      return;
    }
    // Always read the current plan from the store, not the stale token claim.
    req.user = { id: user.id, email: user.email, plan: user.plan };
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
  }
}

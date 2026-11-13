// Auth middleware: verifies the Bearer token and loads the current plan.
// Supabase mode (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set): the token is
// a Supabase Auth access token, verified with supabase.auth.getUser(); the
// plan comes from public.profiles. Local/demo mode (no keys): the old local
// JWT path with the JSON-file store. signToken is kept for the local mode.

import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { findUserById } from '../lib/store';
import { getProfile } from '../lib/db';
import { getUserFromToken, SUPABASE_CONFIGURED } from '../lib/supabase';
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

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing Bearer token' });
    return;
  }

  if (SUPABASE_CONFIGURED) {
    try {
      const sbUser = await getUserFromToken(token);
      if (!sbUser) {
        res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
        return;
      }
      // Always read the current plan from profiles, not the token.
      const profile = await getProfile(sbUser.id);
      req.user = {
        id: sbUser.id,
        email: profile?.email ?? sbUser.email ?? '',
        plan: profile?.plan ?? 'free',
      };
      next();
    } catch (err) {
      console.error('[auth] Supabase token verification failed:', (err as Error).message);
      res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
    }
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

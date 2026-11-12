import { Router, type Request, type Response } from 'express';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth';
import {
  createUser,
  findUserByEmail,
  publicUser,
  setUserPlan,
  verifyPassword,
} from '../lib/store';
import { PLAN_ORDER, type PlanId } from '../lib/plans';

const router = Router();

function validCredentials(body: any): { email: string; password: string } | null {
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (password.length < 6) return null;
  return { email, password };
}

// POST /api/auth/signup — demo: any email + password >= 6 chars, plan 'free'.
router.post('/signup', (req: Request, res: Response) => {
  const creds = validCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: 'invalid_input', message: 'Valid email and password (>= 6 chars) required.' });
    return;
  }
  if (findUserByEmail(creds.email)) {
    res.status(409).json({ error: 'email_exists', message: 'An account with this email already exists.' });
    return;
  }
  const user = createUser(creds.email, creds.password);
  res.status(201).json({ user: publicUser(user), token: signToken(user) });
});

// POST /api/auth/login — demo: any registered email + password >= 6 chars.
router.post('/login', (req: Request, res: Response) => {
  const creds = validCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: 'invalid_input', message: 'Valid email and password (>= 6 chars) required.' });
    return;
  }
  const user = findUserByEmail(creds.email);
  if (!user || !verifyPassword(user, creds.password)) {
    res.status(401).json({ error: 'invalid_credentials', message: 'Email or password is incorrect.' });
    return;
  }
  res.json({ user: publicUser(user), token: signToken(user) });
});

// POST /api/auth/plan — DEMO ONLY: change the signed-in user's plan.
// Labelled demo; in production plan changes must come from a payment webhook.
router.post('/plan', requireAuth, (req: AuthRequest, res: Response) => {
  const plan = req.body?.plan as PlanId | undefined;
  const periodMonths =
    typeof req.body?.periodMonths === 'number' ? req.body.periodMonths : null;
  if (!plan || !(plan in PLAN_ORDER)) {
    res.status(400).json({ error: 'invalid_input', message: "plan must be one of 'free', 'pro', 'premium'." });
    return;
  }
  const updated = setUserPlan(req.user!.id, plan, periodMonths);
  if (!updated) {
    res.status(404).json({ error: 'not_found', message: 'User not found.' });
    return;
  }
  res.json({ user: publicUser(updated), demo: true, note: 'Demo-only plan change; no payment involved.' });
});

export default router;

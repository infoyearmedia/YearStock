import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { getProfile, getSubscriptionStatus } from '../lib/db';
import { SUPABASE_CONFIGURED } from '../lib/supabase';
import { PLANS, PERIODS_MONTHS } from '../lib/plans';

const router = Router();

// GET /api/subscription/plans — tiers + periods + features. Prices are null/TBD.
router.get('/plans', (_req, res: Response) => {
  res.json({
    plans: PLANS,
    periodsMonths: [...PERIODS_MONTHS],
    currency: 'USD (planned)',
    note: 'Prices are TBD — Boss has not set subscription prices yet.',
  });
});

// GET /api/subscription/me — current user's plan. Supabase mode reads the
// real profiles + subscriptions rows; local mode returns the demo values.
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  if (SUPABASE_CONFIGURED) {
    const profile = await getProfile(req.user!.id);
    const sub = await getSubscriptionStatus(req.user!.id);
    res.json({
      userId: req.user!.id,
      email: profile?.email ?? req.user!.email,
      plan: profile?.plan ?? req.user!.plan,
      periodMonths: sub.periodMonths,
      status: sub.status,
      note: 'No payment provider connected — plan managed manually.',
    });
    return;
  }
  res.json({
    userId: req.user!.id,
    email: req.user!.email,
    plan: req.user!.plan,
    status: 'demo',
    note: 'Demo subscription — no payment provider connected.',
  });
});

// POST /api/subscription/checkout — demo only, payments not connected.
router.post('/checkout', requireAuth, (req: AuthRequest, res: Response) => {
  const plan = req.body?.plan as string | undefined;
  const periodMonths = req.body?.periodMonths as number | undefined;
  if (!plan || !['pro', 'premium'].includes(plan)) {
    res.status(400).json({ error: 'invalid_input', message: "plan must be 'pro' or 'premium' for checkout." });
    return;
  }
  if (periodMonths !== undefined && ![1, 6, 12, 60].includes(periodMonths)) {
    res.status(400).json({ error: 'invalid_input', message: 'periodMonths must be one of 1, 6, 12, 60.' });
    return;
  }
  res.json({
    status: 'demo',
    plan,
    periodMonths: periodMonths ?? 1,
    message: 'Payments not connected — pricing TBD',
  });
});

export default router;

import { Router, type Request, type Response } from 'express';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth';
import {
  createUser,
  findUserByEmail,
  publicUser,
  setUserPlan,
  verifyPassword,
} from '../lib/store';
import { createProfile, getProfile, setPlan } from '../lib/db';
import { getSupabase, getSupabaseAdmin, SUPABASE_CONFIGURED } from '../lib/supabase';
import { PLAN_ORDER, type PlanId } from '../lib/plans';

const router = Router();

function validCredentials(body: any): { email: string; password: string } | null {
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (password.length < 6) return null;
  return { email, password };
}

function publicUserShape(profile: { id: string; email: string; plan: PlanId; periodMonths: number | null }) {
  return { id: profile.id, email: profile.email, plan: profile.plan, periodMonths: profile.periodMonths };
}

// POST /api/auth/signup — Supabase mode: creates the Auth user (confirmed
// immediately via email_confirm, so the signup response carries a usable
// session) + a profiles row, then signs in for the access token. Local mode:
// the old JSON-store signup. Same {user, token} shape either way.
router.post('/signup', async (req: Request, res: Response) => {
  const creds = validCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: 'invalid_input', message: 'Valid email and password (>= 6 chars) required.' });
    return;
  }

  if (SUPABASE_CONFIGURED) {
    const admin = getSupabaseAdmin()!;
    const { data, error } = await admin.auth.admin.createUser({
      email: creds.email,
      password: creds.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      if (error && /already registered|already exists/i.test(error.message)) {
        res.status(409).json({ error: 'email_exists', message: 'An account with this email already exists.' });
        return;
      }
      console.error('[auth] Supabase signup failed:', error?.message);
      res.status(500).json({ error: 'internal_error', message: 'Signup failed. Please try again.' });
      return;
    }
    const userId = data.user.id;
    try {
      await createProfile(userId, creds.email);
    } catch (err) {
      // Keep Auth + profiles in sync: no profile row, no account.
      console.error('[auth] profiles insert failed, rolling back signup:', (err as Error).message);
      await admin.auth.admin.deleteUser(userId);
      res.status(500).json({ error: 'internal_error', message: 'Signup failed. Please try again.' });
      return;
    }
    const pub = getSupabase()!;
    const { data: sessionData, error: signInError } = await pub.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    if (signInError || !sessionData.session) {
      console.error('[auth] Supabase sign-in after signup failed:', signInError?.message);
      res.status(500).json({ error: 'internal_error', message: 'Account created but sign-in failed. Please log in.' });
      return;
    }
    res.status(201).json({
      user: publicUserShape({ id: userId, email: creds.email.toLowerCase(), plan: 'free', periodMonths: null }),
      token: sessionData.session.access_token,
    });
    return;
  }

  if (findUserByEmail(creds.email)) {
    res.status(409).json({ error: 'email_exists', message: 'An account with this email already exists.' });
    return;
  }
  const user = createUser(creds.email, creds.password);
  res.status(201).json({ user: publicUser(user), token: signToken(user) });
});

// POST /api/auth/login — Supabase mode: signInWithPassword, token is the
// Supabase session access_token. Local mode: the old store check.
router.post('/login', async (req: Request, res: Response) => {
  const creds = validCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: 'invalid_input', message: 'Valid email and password (>= 6 chars) required.' });
    return;
  }

  if (SUPABASE_CONFIGURED) {
    const pub = getSupabase()!;
    const { data, error } = await pub.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    if (error || !data.session || !data.user) {
      res.status(401).json({ error: 'invalid_credentials', message: 'Email or password is incorrect.' });
      return;
    }
    const profile = await getProfile(data.user.id);
    res.json({
      user: publicUserShape({
        id: data.user.id,
        email: profile?.email ?? data.user.email ?? creds.email,
        plan: profile?.plan ?? 'free',
        periodMonths: profile?.periodMonths ?? null,
      }),
      token: data.session.access_token,
    });
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
router.post('/plan', requireAuth, async (req: AuthRequest, res: Response) => {
  const plan = req.body?.plan as PlanId | undefined;
  const periodMonths =
    typeof req.body?.periodMonths === 'number' ? req.body.periodMonths : null;
  if (!plan || !(plan in PLAN_ORDER)) {
    res.status(400).json({ error: 'invalid_input', message: "plan must be one of 'free', 'pro', 'premium'." });
    return;
  }
  if (SUPABASE_CONFIGURED) {
    const updated = await setPlan(req.user!.id, plan, periodMonths);
    if (!updated) {
      res.status(404).json({ error: 'not_found', message: 'User not found.' });
      return;
    }
    res.json({ user: publicUserShape(updated), demo: true, note: 'Demo-only plan change; no payment involved.' });
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

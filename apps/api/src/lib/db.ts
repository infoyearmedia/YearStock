// Data layer: Supabase tables when configured, local JSON store otherwise.
// Every function here is async and returns the SAME shapes the routes (and
// the web app) already use, so switching backends changes no API contract.
// Supabase tables (sql/001_schema.sql): public.profiles, subscriptions,
// history, jobs. Column names are snake_case in Postgres, camelCase here.

import { getSupabaseAdmin, SUPABASE_CONFIGURED } from './supabase';
import * as store from './store';
import type { HistoryEntry, Job } from './store';
import type { PlanId } from './plans';

export interface Profile {
  id: string;
  email: string;
  plan: PlanId;
  periodMonths: number | null;
}

function publicProfile(id: string, email: string, plan: PlanId, periodMonths: number | null): Profile {
  return { id, email, plan, periodMonths };
}

// ---------------------------------------------------------------------------
// Profiles + subscriptions
// ---------------------------------------------------------------------------

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!SUPABASE_CONFIGURED) {
    const user = store.findUserById(userId);
    return user ? store.publicUser(user) : null;
  }
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, plan')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  const { data: sub } = await admin
    .from('subscriptions')
    .select('period_months, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return publicProfile(
    data.id as string,
    data.email as string,
    data.plan as PlanId,
    sub ? (sub.period_months as number) : null,
  );
}

/** Insert the profiles row for a freshly created Auth user. */
export async function createProfile(id: string, email: string): Promise<Profile> {
  if (!SUPABASE_CONFIGURED) {
    throw new Error('createProfile is only used in Supabase mode');
  }
  const admin = getSupabaseAdmin()!;
  const { error } = await admin.from('profiles').insert({ id, email: email.toLowerCase(), plan: 'free' });
  if (error) throw new Error(`profiles insert failed: ${error.message}`);
  return publicProfile(id, email.toLowerCase(), 'free', null);
}

/** Change plan (+ optional billing period). Writes profiles and, when a valid
 *  period is given, upserts the active subscriptions row. */
export async function setPlan(
  userId: string,
  plan: PlanId,
  periodMonths?: number | null,
): Promise<Profile | null> {
  if (!SUPABASE_CONFIGURED) {
    const updated = store.setUserPlan(userId, plan, periodMonths);
    return updated ? store.publicUser(updated) : null;
  }
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin
    .from('profiles')
    .update({ plan })
    .eq('id', userId)
    .select('id, email, plan')
    .single();
  if (error || !data) return null;

  let period: number | null = null;
  if (periodMonths !== undefined && periodMonths !== null) {
    // Upsert the active subscription for this plan + period.
    const { data: existing } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      await admin
        .from('subscriptions')
        .update({ plan, period_months: periodMonths, status: 'active' })
        .eq('id', (existing as { id: string }).id);
    } else {
      await admin.from('subscriptions').insert({
        user_id: userId,
        plan,
        period_months: periodMonths,
        status: 'active',
      });
    }
    period = periodMonths;
  } else {
    // No period given: report the period of the current active subscription.
    const { data: sub } = await admin
      .from('subscriptions')
      .select('period_months')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    period = sub ? (sub.period_months as number) : null;
  }
  return publicProfile(data.id as string, data.email as string, data.plan as PlanId, period);
}

/** Current subscription status for /api/subscription/me. */
export async function getSubscriptionStatus(userId: string): Promise<{ status: string; periodMonths: number | null }> {
  if (!SUPABASE_CONFIGURED) {
    return { status: 'demo', periodMonths: store.findUserById(userId)?.periodMonths ?? null };
  }
  const admin = getSupabaseAdmin()!;
  const { data } = await admin
    .from('subscriptions')
    .select('status, period_months')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { status: 'active', periodMonths: null };
  return { status: data.status as string, periodMonths: (data.period_months as number) ?? null };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

interface HistoryRow {
  id: string;
  user_id: string;
  asset_name: string;
  tool: string;
  marketplace: string | null;
  result_summary: string | null;
  created_at: string;
}

function toHistoryEntry(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    assetName: row.asset_name,
    tool: row.tool,
    marketplace: row.marketplace ?? undefined,
    resultSummary: row.result_summary ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listHistory(userId: string): Promise<HistoryEntry[]> {
  if (!SUPABASE_CONFIGURED) return store.listHistory(userId);
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin
    .from('history')
    .select('id, user_id, asset_name, tool, marketplace, result_summary, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`history list failed: ${error.message}`);
  return (data as HistoryRow[]).map(toHistoryEntry);
}

export async function addHistory(
  entry: Omit<HistoryEntry, 'id' | 'createdAt'>,
): Promise<HistoryEntry> {
  if (!SUPABASE_CONFIGURED) return store.addHistory(entry);
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin
    .from('history')
    .insert({
      user_id: entry.userId,
      asset_name: entry.assetName,
      tool: entry.tool,
      marketplace: entry.marketplace ?? null,
      result_summary: entry.resultSummary ?? null,
    })
    .select('id, user_id, asset_name, tool, marketplace, result_summary, created_at')
    .single();
  if (error || !data) throw new Error(`history insert failed: ${error?.message ?? 'no row returned'}`);
  return toHistoryEntry(data as HistoryRow);
}

export async function deleteHistory(userId: string, id: string): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return store.deleteHistory(userId, id);
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin
    .from('history')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(`history delete failed: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

// ---------------------------------------------------------------------------
// Jobs (tool runs; used for the free-plan monthly metadata cap)
// ---------------------------------------------------------------------------

interface JobRow {
  id: string;
  user_id: string;
  tool: string;
  status: string;
  created_at: string;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    userId: row.user_id,
    tool: row.tool,
    status: row.status as Job['status'],
    createdAt: row.created_at,
  };
}

export async function addJob(
  userId: string,
  tool: string,
  status: Job['status'] = 'done',
): Promise<Job> {
  if (!SUPABASE_CONFIGURED) return store.addJob(userId, tool, status);
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin
    .from('jobs')
    .insert({ user_id: userId, tool, status, input: {} })
    .select('id, user_id, tool, status, created_at')
    .single();
  if (error || !data) throw new Error(`jobs insert failed: ${error?.message ?? 'no row returned'}`);
  return toJob(data as JobRow);
}

/** Count of a user's jobs for a tool in the current calendar month (UTC). */
export async function countJobsThisMonth(userId: string, tool: string): Promise<number> {
  if (!SUPABASE_CONFIGURED) return store.countJobsThisMonth(userId, tool);
  const admin = getSupabaseAdmin()!;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count, error } = await admin
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('tool', tool)
    .gte('created_at', start);
  if (error) throw new Error(`jobs count failed: ${error.message}`);
  return count ?? 0;
}

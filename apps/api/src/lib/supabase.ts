// Supabase clients for the YearMedia API.
// - Admin client (service_role key): server-side only. Bypasses RLS, so it
//   is the only client that reads/writes public.profiles, subscriptions,
//   history and jobs directly.
// - Public client (anon key): user-facing Auth calls — signInWithPassword
//   and getUser (token verification). Never expose the service_role key.
// When SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set, both getters
// return null and the API falls back to the local JSON store (lib/store.ts).

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/** True only when the API can actually talk to Supabase (URL + service key). */
export const SUPABASE_CONFIGURED = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

if (process.env.SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[supabase] SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is missing — falling back to the local store.',
  );
}

let adminClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;

/** Service-role client (bypasses RLS). Server-side only. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  if (!adminClient) {
    adminClient = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return adminClient;
}

/** Anon-key client for user-facing Auth (sign-in, token verification). */
export function getSupabase(): SupabaseClient | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  if (!publicClient) {
    publicClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return publicClient;
}

/** Verify a Supabase access token and return the Auth user, or null. */
export async function getUserFromToken(token: string): Promise<User | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

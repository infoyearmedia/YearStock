// Vercel serverless entry for the YearMedia API.
//
// Vercel's Node runtime accepts an Express app as the handler: a request
// to /api/* (rewritten to this function in vercel.json) is passed to the
// app with its original URL, so the /api/auth, /api/metadata, /api/quality,
// /api/tools, /api/history and /api/subscription routes work unchanged.
//
// This module MUST NOT start a server on import — it only re-exports the
// app from apps/api/src/app. Vercel invokes the exported handler per
// request; app.listen() lives only in apps/api/src/index.ts (local dev).
//
// Env vars are read from the Vercel dashboard at runtime (SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
// AI_SERVICE_URL). The Python AI service does not run on Vercel, so
// /api/tools/* and AI-dependent routes answer an honest 503 there.

import app from '../apps/api/src/app';

export default app;

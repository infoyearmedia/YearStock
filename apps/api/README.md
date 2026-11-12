# YearMedia API

Express + TypeScript API for the YearMedia AI microstock creator platform.
Runs with **no real keys** — local/demo mode by default.

## Run

```bash
cd apps/api
cp .env.example .env   # optional; all values may stay empty
npm install
npm run dev            # tsx watch, http://localhost:4000
# or
npm run build && npm start
```

On startup the server logs `running in local/demo mode` when `SUPABASE_URL`
is not set. In that mode users/history/jobs live in memory + a JSON file at
`apps/api/data/store.json` (gitignored). No database connection is required.

## Environment

| Var | Purpose |
| --- | --- |
| `PORT` | default `4000` |
| `JWT_SECRET` | demo fallback `demo-secret-change-me` — set a real secret in production |
| `GEMINI_API_KEY` | if set, metadata calls Gemini (`gemini-2.0-flash`); if empty, honest filename-only fallback |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | not wired yet; schema is in `sql/001_schema.sql` |
| `AI_SERVICE_URL` | Python AI service, default `http://localhost:8000` |

## Endpoints

| Method | Route | Auth | Plan | Notes |
| --- | --- | --- | --- | --- |
| GET | `/health` | — | — | status, mode, Gemini/AI config |
| POST | `/api/auth/signup` | — | — | any email + password ≥ 6 chars (demo), returns `{user, token}`, plan `free` |
| POST | `/api/auth/login` | — | — | demo login |
| POST | `/api/auth/plan` | JWT | — | **demo only** — change own plan |
| POST | `/api/metadata` | JWT | free* | multipart image or JSON `{filename, marketplace, keywordCount}`; *free capped at 5/month |
| GET | `/api/metadata/presets` | — | — | marketplace presets (keyword limits, CSV columns) |
| POST | `/api/metadata/csv` | JWT | pro+ | marketplace-specific CSV |
| POST | `/api/metadata/embed` | JWT | — | **501** — embedding not implemented yet (see below) |
| POST | `/api/quality` | JWT | free | proxies to AI service if reachable, else honest local analysis (sharp) |
| POST | `/api/tools/remove-bg` | JWT | pro+ | proxies to AI service; **503** if unavailable |
| POST | `/api/tools/upscale` | JWT | pro (2x) / premium (4x) | proxies to AI service; **503** if unavailable |
| POST | `/api/tools/convert` | JWT | svg free, eps pro, psd premium | proxies to AI service; **503** if unavailable |
| GET/POST/DELETE | `/api/history` | JWT | free | list / save / delete history entries |
| GET | `/api/subscription/plans` | — | — | tiers + periods (1/6/12/60 mo); prices `null` = TBD |
| GET | `/api/subscription/me` | JWT | — | current plan |
| POST | `/api/subscription/checkout` | JWT | — | demo: `{status:'demo', message:'Payments not connected — pricing TBD'}` |

All uploads: multipart, memory storage, 50 MB limit. Locked features return
`403 {error:'upgrade_required', feature, requiredPlan}`.

## What is real vs demo fallback

- **Real:** Express routing, JWT auth (demo secret), plan gating enforced
  server-side, marketplace keyword/title limits, CSV generation, local
  quality analysis with sharp (measured resolution, file size, bytes-per-pixel
  compression estimate, mean brightness, Laplacian-stddev sharpness proxy —
  documented in `src/routes/quality.ts`; no invented 0–100 score).
- **Demo fallback:** metadata without `GEMINI_API_KEY` is derived from the
  filename only and labelled `source:'demo-fallback'` with a warning.
- **Not implemented yet:** metadata embedding (`501` — sharp cannot write
  IPTC/XMP; exiftool planned; EPS/AI/PSD/PDF unsupported), payments
  (checkout is a demo stub, prices TBD), Supabase wiring (schema ready in
  `sql/001_schema.sql`, RLS policies marked TODO to review).
- **AI service:** remove-bg / upscale / convert / quality proxy to
  `AI_SERVICE_URL` with a 60 s timeout; if unreachable the API answers
  `503 {error:'ai_unavailable'}` (quality falls back to local analysis).

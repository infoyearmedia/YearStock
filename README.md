# YearMedia — AI-Powered Microstock Creator Platform

All-in-one AI platform for microstock contributors, graphic designers and
stock asset creators. Built for Boss (Arafat / Year Media) — target audience
is mainly **Adobe Stock Contributor, Freepik Contributor and Shutterstock
Contributor**, plus Dreamstime, 123RF, iStock and Alamy.

> **Status (2026-11-13): production scaffold + all 9 modules built and
> verified locally. Runs without any real keys in demo/local mode.**
> Nothing has been pushed to GitHub yet — Boss to provide a repo link.

## The 9 modules

1. **AI Metadata Generator** — Gemini visual analysis → title, description,
   category, content type, keywords (default 30, adjustable 5–50),
   marketplace-specific presets + CSV export, SEO filenames.
2. **Image Quality Checker** — separate module. Real measured metrics only
   (resolution, sharpness/blur, noise, exposure, colour, compression) with
   rejection-risk reports. **No fabricated approval scores.**
3. **AI Background Remover** — BiRefNet (proper inference; rembg fallback).
4. **Image Upscaler** — Real-ESRGAN `RealESRGAN_x4plus` (2x = x4 then clean
   Lanczos downscale; 4x = native). Anime model deliberately NOT used.
5. **JPG/PNG → SVG** — Potrace tracing.
6. **SVG → EPS** — Inkscape.
7. **EPS → JPG** — Ghostscript.
8. **JPG/PNG → PSD** — Pillow (flattened, single raster layer).
9. **Asset History & Workflow** — temporary working sessions (sessionStorage,
   never auto-shown in a fresh session) + separate permanent History
   (explicit load only), direct asset transfer between tools.

## Monorepo layout

```
yearstock/
├── apps/web/          React + TypeScript + Vite + Tailwind (dark/light, responsive)
├── apps/api/          Node + Express + TypeScript (auth, plan gating, proxy to AI service)
├── services/ai/       Python FastAPI + Uvicorn (Gemini, BiRefNet, Real-ESRGAN, converters)
├── sql/               Supabase/PostgreSQL schema (001_schema.sql)
├── .env.example       All env vars, placeholders only — no real keys
└── README.md          This file
```

## How to run locally (no keys needed)

```bash
# 1. AI service (port 8000)
cd services/ai
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. API (port 4000) — new terminal
cd apps/api
npm install
npm run build && npm start        # or: npm run dev

# 3. Web (port 5173 dev, or 4173 preview) — new terminal
cd apps/web
npm install
VITE_API_URL=http://127.0.0.1:4000 npm run dev
# Demo mode (no backend): just `npm run dev` — banner says "Demo mode".
# For a preview of the production build: npm run build && npm run preview
```

Then open http://localhost:5173 — landing page → Sign up (any email +
password ≥ 6 chars; in connected mode this creates a real API account) →
dashboard with all 9 tools in the sidebar.

## What is REAL vs placeholder / fallback

| Feature | Status without keys | With keys / proper host |
|---|---|---|
| Metadata generation | **Honest filename-only fallback**, labelled `demo-fallback` | Real Gemini (`gemini-2.0-flash`) visual analysis |
| Quality check | **Real** — Sharp (API) / Pillow+numpy (AI service) measured metrics, no fake score | Same, plus AI-service path |
| Background removal | 503 `birefnet_not_available` + install instructions | Real BiRefNet after `pip install torch transformers` + `python scripts/download_models.py` |
| Upscaling | 503 `realesrgan_not_available` + install instructions | Real Real-ESRGAN after torch + `realesrgan` + weights download |
| JPG/PNG → SVG | 503 `potrace_not_available` | Real, after `apt install potrace` |
| SVG → EPS | 503 (inkscape missing) | Real, after installing Inkscape |
| EPS → JPG | 503 (ghostscript missing) | Real, after installing Ghostscript |
| JPG/PNG → PSD | **Real** (Pillow, flattened) | Same |
| Auth / subscriptions | Demo JWT + local JSON store (`apps/api/data/`, gitignored); plan change is demo-only | Supabase schema in `sql/` — wiring is a later step |
| CSV export | Real, marketplace-specific columns | Same |
| Metadata embedding (JPG/PNG) | **Not implemented** — returns 501 honestly (Sharp can't write IPTC/XMP; exiftool planned) | exiftool integration planned |

**Nothing is faked.** Every unavailable service returns an honest error
with how to fix it, and the UI shows that state instead of inventing a result.

## Subscriptions (enforced backend AND frontend)

- **Free (Trial)** — metadata 5/month, quality checker, JPG/PNG→SVG, history.
- **Pro** — unlimited metadata, background remover, upscaler up to 2x, SVG→EPS, CSV export.
- **Premium** — everything, upscaler 4x, JPG/PNG→PSD.
- Periods: 1 / 6 / 12 / 60 months. **Prices are TBD — no prices invented.**
  Checkout currently returns a demo "payments not connected" response.

## Marketplace presets (verified against contributor guides)

Adobe Stock: title ≤ 200 chars, description ≤ 200, **keywords ≤ 200**.
Shutterstock / Freepik / Dreamstime / 123RF / iStock / Alamy:
title ≤ 200, **keywords ≤ 50**. Limits are enforced in web, API and AI
service — keep the three in sync; re-verify against the live guides before
launch.

## Production hosting notes (BiRefNet / Real-ESRGAN)

Both heavy models need a real host — this VM is too small and has no GPU:
install `torch` (CPU), `transformers`, `realesrgan`, download weights with
`services/ai/scripts/download_models.py` (downloads are NOT run here).
On CPU, BiRefNet takes seconds per image and Real-ESRGAN x4 is slow;
for production use a GPU host (or a dedicated inference service) and keep
the API/AI-service split as built — only `AI_SERVICE_URL` changes.

## What Boss still needs to provide to go live

1. **Gemini API key** (`GEMINI_API_KEY`) — for real AI metadata.
2. **Supabase project** (URL + anon/service keys) — schema is ready in `sql/`.
3. **GitHub repo link + approval** — code is local only, never pushed.
4. **Subscription prices** (Pro/Premium × 1/6/12/60 months, USD/BDT) + payment provider.
5. Re-verify marketplace keyword/title limits against live contributor guides.

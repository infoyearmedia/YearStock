# YearMedia AI Service

Python 3.12 + FastAPI service for the YearMedia microstock platform.
Background removal, upscaling, metadata, quality checks, converters.

## Run

```bash
cd services/ai
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then set GEMINI_API_KEY
uvicorn app.main:app --port 8000
```

Docs: http://localhost:8000/docs — Health: `GET /health`

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Model/tool availability (honest status) |
| POST | `/metadata` | Gemini title/description/category/keywords |
| POST | `/quality` | Real measured quality metrics + risks |
| POST | `/remove-bg` | BiRefNet background removal → PNG with alpha |
| POST | `/upscale` | Real-ESRGAN upscale, `scale` 2 or 4 |
| POST | `/convert` | JPG/PNG→SVG, SVG→EPS, EPS→JPG, JPG/PNG→PSD |

`/metadata` takes multipart `image` + form fields `marketplace`
(adobe/shutterstock/freepik/dreamstime/istock/generic) and `keywordCount`
(5–50, default 30).

## What is real vs fallback

| Feature | Real path | Fallback / honest failure |
|---|---|---|
| Metadata | Gemini REST API (`gemini-2.0-flash`) with the image | No key → **503** `gemini_not_configured`. Gemini error → **502**. Output is never faked or templated. |
| Quality | Pillow + numpy measurements (brightness, contrast, saturation, Laplacian sharpness, noise, compression); cv2 Laplacian when opencv is installed, numpy gradient proxy otherwise | No fake 0–100 score — only measured metrics + threshold-based risks + `overall_risk` low/medium/high. |
| Remove-bg | **BiRefNet** via transformers (`ZhengPeng7/BiRefNet`) | rembg (u2net) if installed — response header `X-Background-Engine: rembg-fallback`. Neither available → **503** `birefnet_not_available` with install instructions. |
| Upscale | **Real-ESRGAN x4plus** | Not installed / weights missing → **503** with install instructions. Never a plain Pillow resize pretending to be AI. |
| Convert | potrace / inkscape / ghostscript CLIs; a minimal PSD writer in `convert.py` (Pillow cannot write PSD) | Missing binary → **503** with install note. PSD is **flattened, no layers**. Potrace SVG is a **single-colour trace**, not full-colour vectorisation. |

## Model choices (decided)

- **Background removal = BiRefNet.** Best current matting quality for
  product/people cutouts; rembg is only a fallback.
- **Upscaling = Real-ESRGAN x4plus.** Chosen for stock photos (real-world
  photo model). Alternatives considered and rejected for now:
  - `RealESRGAN_x4plus-anime` — trained for anime/illustration, NOT used.
  - `SwinIR` — slower, higher quality, much heavier — documented as a
    future option, not used now.
- **Metadata = Gemini API.** No local model; needs `GEMINI_API_KEY`.
- **Converters = CLI wrappers** (potrace / inkscape / ghostscript) +
  a minimal flattened-PSD writer in `app/routers/convert.py` (Pillow
  cannot write PSD). Sharp lives in `apps/api` (Node), not here.

## GPU / hosting notes

BiRefNet and Real-ESRGAN need **torch + downloaded weights** and run
much faster on GPU. This small VM does **not** have them installed and
the weights are **not** downloaded here — the endpoints return honest
503s until a proper host is set up.

Production recommendation: run this service on a GPU host (or a CPU
host with plenty of RAM and patience), install torch from the CPU/GPU
index, and download weights once:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install transformers realesrgan basicsr facexlib gfpgan rembg huggingface_hub
python3 scripts/download_models.py
```

Check status anytime with `GET /health` — it reports
`birefnet` / `realesrgan` as `available` / `not-installed`,
`gemini` as `configured` / `not-configured`, and potrace / inkscape /
ghostscript as `found` / `missing`.

"""YearMedia AI service — FastAPI app.

Endpoints:
  GET  /            service info
  GET  /health      model/tool availability (honest, no fake "ready")
  POST /metadata    Gemini metadata generation
  POST /quality     real image quality analysis
  POST /remove-bg   BiRefNet background removal (rembg fallback)
  POST /upscale     Real-ESRGAN upscaling
  POST /convert     potrace / inkscape / ghostscript / Pillow converters

Heavy deps (torch, transformers, realesrgan, rembg, cv2) are never
imported at module level anywhere in this service — see each router.
"""
from __future__ import annotations

import os
import shutil

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import HealthModels, HealthResponse
from .routers import convert, metadata, quality, remove_bg, upscale

load_dotenv()

app = FastAPI(
    title="YearMedia AI Service",
    description="AI microstock tools: metadata (Gemini), quality check, "
                "background removal (BiRefNet), upscaling (Real-ESRGAN), "
                "format conversion.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metadata.router, tags=["metadata"])
app.include_router(quality.router, tags=["quality"])
app.include_router(remove_bg.router, tags=["remove-bg"])
app.include_router(upscale.router, tags=["upscale"])
app.include_router(convert.router, tags=["convert"])


def _heavy_available(module: str) -> bool:
    """True if a heavy optional module can be imported (no side effects)."""
    try:
        __import__(module)
        return True
    except ImportError:
        return False


@app.get("/", tags=["health"])
async def root():
    return {
        "service": "yearmedia-ai",
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": [
            "POST /metadata",
            "POST /quality",
            "POST /remove-bg",
            "POST /upscale",
            "POST /convert",
        ],
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health():
    # BiRefNet needs torch + transformers; Real-ESRGAN needs torch +
    # realesrgan. "available" here means the packages import — the
    # weights may still need downloading (see scripts/download_models.py).
    birefnet = (
        "available"
        if _heavy_available("torch") and _heavy_available("transformers")
        else "not-installed"
    )
    realesrgan = (
        "available"
        if _heavy_available("torch") and _heavy_available("realesrgan")
        else "not-installed"
    )
    return HealthResponse(
        status="ok",
        models=HealthModels(
            birefnet=birefnet,
            realesrgan=realesrgan,
            gemini=(
                "configured"
                if os.environ.get("GEMINI_API_KEY", "").strip()
                else "not-configured"
            ),
            potrace="found" if shutil.which("potrace") else "missing",
            inkscape="found" if shutil.which("inkscape") else "missing",
            ghostscript="found" if shutil.which("gs") else "missing",
        ),
    )

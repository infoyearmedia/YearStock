"""POST /quality — real image quality analysis (Pillow + numpy, cv2 optional).

Measures real properties of the uploaded image and reports risks against
documented thresholds. There is NO 0-100 approval score and NO hardcoded
report — every number comes from the uploaded file.

Method:
- brightness / contrast / saturation: numpy statistics on the pixels.
- sharpness: variance of the Laplacian. cv2.Laplacian when opencv is
  installed; otherwise a gradient-magnitude proxy computed with numpy.
- noise: standard deviation of the high-frequency (Laplacian) response.
- compression: file bytes per megapixel, plus the JPEG quality value
  stored in the file when Pillow can read it.

Thresholds used for risks (documented in the response's `methods`):
- underexposed: mean brightness < 40 (0-255 scale)
- overexposed:  mean brightness > 215
- low contrast: pixel stddev < 30
- low saturation: mean saturation < 25 (0-255 HSV scale)
- blurry: Laplacian variance < 100 (cv2) / gradient proxy < 8 (numpy)
- noisy: high-frequency stddev > 12
- heavy compression: < 60 KB per megapixel (JPEG)
"""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

from ..models import QualityMetrics, QualityResponse, QualityRisk
from ..utils.image import ImageValidationError, load_image

router = APIRouter()

# --- Thresholds (see module docstring) ---
UNDEREXPOSED_BRIGHTNESS = 40.0
OVEREXPOSED_BRIGHTNESS = 215.0
LOW_CONTRAST_STDDEV = 30.0
LOW_SATURATION_MEAN = 25.0
BLURRY_LAPLACIAN_VAR = 100.0
BLURRY_GRADIENT_PROXY = 8.0
NOISY_HF_STDDEV = 12.0
HEAVY_COMPRESSION_KB_PER_MP = 60.0


def _laplacian_stats(gray: np.ndarray) -> tuple[float, float]:
    """Return (laplacian variance, high-frequency stddev).

    Prefers cv2.Laplacian; falls back to a numpy gradient-magnitude
    proxy so the endpoint works with no opencv installed.
    Returns (value, method_flag) via the module-level flag set here.
    """
    try:
        import cv2  # lazy: optional dependency

        lap = cv2.Laplacian(gray, cv2.CV_64F)
        return float(lap.var()), float(lap.std()), "cv2.Laplacian"
    except ImportError:
        # Numpy fallback: gradient magnitude (Sobel-like via np.gradient).
        gy, gx = np.gradient(gray.astype(np.float64))
        grad = np.sqrt(gx * gx + gy * gy)
        # Variance of the gradient as a sharpness proxy; its stddev as
        # the high-frequency (noise) estimate.
        return float(grad.var()), float(grad.std()), "numpy-gradient"


@router.post("/quality", response_model=QualityResponse)
async def analyse_quality(image: UploadFile = File(...)):
    raw = await image.read()
    try:
        img = load_image(raw)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    width, height = img.size
    megapixels = (width * height) / 1_000_000
    file_size = len(raw)
    kb_per_mp = (file_size / 1024) / megapixels if megapixels else 0.0

    rgb = img.convert("RGB")
    arr = np.asarray(rgb, dtype=np.float64)
    gray = np.asarray(img.convert("L"), dtype=np.float64)

    mean_brightness = float(gray.mean())
    contrast = float(gray.std())

    hsv = np.asarray(img.convert("HSV"), dtype=np.float64)
    mean_saturation = float(hsv[:, :, 1].mean())

    sharpness, noise, method = _laplacian_stats(gray)

    jpeg_quality = None
    if img.format == "JPEG":
        # Pillow exposes the stored JPEG quality when available.
        jpeg_quality = img.info.get("quality")

    if mean_brightness < UNDEREXPOSED_BRIGHTNESS:
        exposure = "underexposed"
    elif mean_brightness > OVEREXPOSED_BRIGHTNESS:
        exposure = "overexposed"
    else:
        exposure = "ok"

    risks: list[QualityRisk] = []
    if exposure == "underexposed":
        risks.append(QualityRisk(
            metric="mean_brightness",
            threshold=f"< {UNDEREXPOSED_BRIGHTNESS} (0-255)",
            message="Image looks underexposed — mean brightness is very low; "
                    "microstock reviewers often reject dark images.",
            severity="high",
        ))
    if exposure == "overexposed":
        risks.append(QualityRisk(
            metric="mean_brightness",
            threshold=f"> {OVEREXPOSED_BRIGHTNESS} (0-255)",
            message="Image looks overexposed — highlights may be blown out.",
            severity="high",
        ))
    if contrast < LOW_CONTRAST_STDDEV:
        risks.append(QualityRisk(
            metric="contrast_stddev",
            threshold=f"< {LOW_CONTRAST_STDDEV}",
            message="Low contrast — the image looks flat / washed out.",
            severity="medium",
        ))
    if mean_saturation < LOW_SATURATION_MEAN:
        risks.append(QualityRisk(
            metric="mean_saturation",
            threshold=f"< {LOW_SATURATION_MEAN} (0-255 HSV)",
            message="Very low colour saturation — the image looks desaturated.",
            severity="low",
        ))
    blurry_threshold = (
        BLURRY_LAPLACIAN_VAR if method == "cv2.Laplacian" else BLURRY_GRADIENT_PROXY
    )
    if sharpness < blurry_threshold:
        risks.append(QualityRisk(
            metric="sharpness_laplacian_variance",
            threshold=f"< {blurry_threshold} ({method})",
            message="Image looks blurry / out of focus — sharpness is below "
                    "the threshold.",
            severity="high",
        ))
    if noise > NOISY_HF_STDDEV:
        risks.append(QualityRisk(
            metric="noise_estimate",
            threshold=f"> {NOISY_HF_STDDEV} high-frequency stddev",
            message="Visible noise / grain detected in high-frequency detail.",
            severity="medium",
        ))
    if img.format == "JPEG" and kb_per_mp < HEAVY_COMPRESSION_KB_PER_MP:
        risks.append(QualityRisk(
            metric="file_size_kb_per_megapixel",
            threshold=f"< {HEAVY_COMPRESSION_KB_PER_MP} KB/MP (JPEG)",
            message="Heavy compression for the resolution — JPEG artefacts "
                    "are likely at 100% zoom.",
            severity="medium",
        ))
    if megapixels < 4:
        risks.append(QualityRisk(
            metric="megapixels",
            threshold="< 4 MP",
            message="Resolution below 4 MP — most microstock sites require "
                    "at least 4 MP.",
            severity="high",
        ))

    high = sum(1 for r in risks if r.severity == "high")
    medium = sum(1 for r in risks if r.severity == "medium")
    if high >= 1:
        overall: str = "high"
    elif medium >= 2:
        overall = "medium"
    elif medium == 1 or risks:
        overall = "medium" if medium == 1 else "low"
    else:
        overall = "low"
    # Any single high-severity risk means high overall; a lone low risk
    # (e.g. desaturation) stays low.
    if high == 0 and medium == 0:
        overall = "low"

    methods = [
        "brightness/contrast: numpy mean/stddev of grayscale pixels (0-255)",
        "saturation: numpy mean of HSV saturation channel (0-255)",
        f"sharpness: variance of Laplacian ({method}); "
        f"blurry below {blurry_threshold}",
        "noise: stddev of high-frequency (Laplacian/gradient) response; "
        f"noisy above {NOISY_HF_STDDEV}",
        "compression: file bytes per megapixel; JPEG quality read from "
        "file metadata when present",
        "NO 0-100 approval score is computed; overall_risk is derived "
        "only from the risks above (any high-severity risk -> high).",
    ]

    return QualityResponse(
        metrics=QualityMetrics(
            width=width,
            height=height,
            megapixels=round(megapixels, 3),
            format=img.format,
            file_size_bytes=file_size,
            file_size_kb_per_megapixel=round(kb_per_mp, 1),
            mean_brightness=round(mean_brightness, 2),
            exposure=exposure,  # type: ignore[arg-type]
            contrast_stddev=round(contrast, 2),
            mean_saturation=round(mean_saturation, 2),
            sharpness_laplacian_variance=round(sharpness, 2),
            noise_estimate=round(noise, 2),
            jpeg_quality=jpeg_quality,
        ),
        risks=risks,
        overall_risk=overall,  # type: ignore[arg-type]
        methods=methods,
    )

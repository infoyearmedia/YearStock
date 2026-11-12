"""POST /upscale — upscaling with Real-ESRGAN (RealESRGAN_x4plus).

Real integration, lazy imports only. If realesrgan/torch is not
installed (or weights are missing) the endpoint returns an honest 503
with install instructions — it never returns a plain Pillow resize
pretending to be AI upscaling.

Model choice (documented, decided for stock photos):
- RealESRGAN_x4plus is the chosen model: trained for real-world photos,
  which is what microstock contributors upload.
- RealESRGAN_x4plus-anime is for anime/illustration — NOT used.
- SwinIR is slower and higher quality but much heavier — documented as
  a future option, not used now.

Weights: download with `python3 scripts/download_models.py` (downloads
RealESRGAN_x4plus.pth into MODEL_CACHE). Runs on CPU if no GPU, but is
slow — in production run this on a GPU host.
"""
from __future__ import annotations

import io
import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image

from ..utils.image import ImageValidationError, load_image

router = APIRouter()

INSTALL_HELP = (
    "Install: pip install torch --index-url "
    "https://download.pytorch.org/whl/cpu ; pip install realesrgan basicsr "
    "facexlib gfpgan ; then download weights with: "
    "python3 scripts/download_models.py"
)


def _upscale_realesrgan(img: Image.Image, scale: int) -> Image.Image:
    """Real-ESRGAN x4plus. Raises ImportError/RuntimeError on failure."""
    import numpy as np  # noqa: F401  (used by realesrgan internals path)
    import torch  # lazy: heavy, optional
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    cache_dir = os.environ.get("MODEL_CACHE", "./models") or "./models"
    weights = os.path.join(cache_dir, "RealESRGAN_x4plus.pth")
    if not os.path.exists(weights):
        raise RuntimeError(
            f"Real-ESRGAN weights not found at {weights}. Run: "
            "python3 scripts/download_models.py"
        )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    # RealESRGAN_x4plus is a x4 model; for scale=2 we upscale x4 then
    # downscale cleanly with Lanczos (still AI-enhanced detail).
    model = RRDBNet(
        num_in_ch=3, num_out_ch=3, num_feat=64,
        num_block=23, num_grow_ch=32, scale=4,
    )
    upsampler = RealESRGANer(
        scale=4,
        model_path=weights,
        model=model,
        tile=0,
        tile_pad=10,
        pre_pad=0,
        half=False,
        device=device,
    )
    rgb = img.convert("RGB")
    arr = np.asarray(rgb)
    output, _ = upsampler.enhance(arr, outscale=4)
    out = Image.fromarray(output)
    if scale == 2:
        out = out.resize(
            (rgb.width * 2, rgb.height * 2), Image.LANCZOS,
        )
    return out


@router.post("/upscale")
async def upscale_image(
    image: UploadFile = File(...),
    scale: int = Form(2),
):
    if scale not in (2, 4):
        raise HTTPException(status_code=422, detail="scale must be 2 or 4.")
    raw = await image.read()
    try:
        img = load_image(raw)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        out = _upscale_realesrgan(img, scale)
    except ImportError as exc:
        return JSONResponse(
            status_code=503,
            content={
                "error": "realesrgan_not_available",
                "message": "Real-ESRGAN is not installed.",
                "detail": str(exc),
                "how_to_fix": INSTALL_HELP,
            },
        )
    except Exception as exc:
        # Weights missing or inference failed — say so honestly.
        if "weights not found" in str(exc):
            return JSONResponse(
                status_code=503,
                content={
                    "error": "realesrgan_weights_missing",
                    "message": str(exc),
                    "how_to_fix": "python3 scripts/download_models.py",
                },
            )
        return JSONResponse(
            status_code=502,
            content={
                "error": "upscale_failed",
                "message": f"Real-ESRGAN failed: {exc}",
            },
        )

    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    headers = {
        "X-Upscale-Engine": "realesrgan-x4plus",
        "X-Upscale-Scale": str(scale),
    }
    return Response(content=buf.getvalue(), media_type="image/png", headers=headers)

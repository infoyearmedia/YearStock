"""POST /remove-bg — background removal with BiRefNet (primary).

Real integration, lazy imports only:
1. BiRefNet via transformers (model id from BIREFNET_MODEL, default
   'ZhengPeng7/BiRefNet', weights cached under MODEL_CACHE).
   Needs torch + transformers installed AND the weights downloaded
   (see scripts/download_models.py). Runs on CPU if no GPU is present,
   but is slow on CPU — in production run this on a GPU host.
2. Fallback: rembg (u2net) if installed — response header
   X-Background-Engine: rembg-fallback so callers know which engine ran.
3. If neither is available: honest 503 birefnet_not_available with
   install/download instructions. Output is never faked.

On success returns a PNG with an alpha channel.
"""
from __future__ import annotations

import io
import os

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image

from ..utils.image import ImageValidationError, load_image

router = APIRouter()

INSTALL_HELP = (
    "Install torch (CPU): pip install torch --index-url "
    "https://download.pytorch.org/whl/cpu ; then pip install transformers "
    "huggingface_hub ; then download weights with: "
    "python3 scripts/download_models.py"
)


def _remove_bg_birefnet(img: Image.Image) -> Image.Image:
    """BiRefNet via transformers. Raises ImportError/RuntimeError."""
    import torch  # lazy: heavy, optional
    from transformers import AutoModelForImageSegmentation

    model_id = os.environ.get("BIREFNET_MODEL", "ZhengPeng7/BiRefNet").strip()
    cache_dir = os.environ.get("MODEL_CACHE", "./models") or "./models"
    device = "cuda" if torch.cuda.is_available() else "cpu"

    model = AutoModelForImageSegmentation.from_pretrained(
        model_id, trust_remote_code=True, cache_dir=cache_dir,
    )
    model.to(device)
    model.eval()

    # BiRefNet preprocessing: resize to 1024, normalise like the model expects.
    from torchvision.transforms import functional as TF  # lazy, ships with torch

    orig_size = img.size
    rgb = img.convert("RGB")
    resized = TF.resize(rgb, (1024, 1024))
    tensor = TF.to_tensor(resized)
    tensor = TF.normalize(tensor, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    tensor = tensor.unsqueeze(0).to(device)

    with torch.no_grad():
        result = model(tensor)
    # transformers BiRefNet returns a list of logits or a tensor.
    logits = result[-1] if isinstance(result, (list, tuple)) else result
    mask = torch.sigmoid(logits).squeeze().cpu()
    mask_img = TF.to_pil_image(mask)
    mask_img = mask_img.resize(orig_size, Image.LANCZOS)

    out = rgb.copy()
    out.putalpha(mask_img)
    return out


def _remove_bg_rembg(img: Image.Image) -> Image.Image:
    """rembg (u2net) fallback. Raises ImportError if rembg is absent."""
    from rembg import remove  # lazy: optional

    buf = io.BytesIO()
    img.convert("RGBA").save(buf, format="PNG")
    result_bytes = remove(buf.getvalue())
    return Image.open(io.BytesIO(result_bytes)).convert("RGBA")


@router.post("/remove-bg")
async def remove_background(image: UploadFile = File(...)):
    raw = await image.read()
    try:
        img = load_image(raw)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    engine: str | None = None
    last_error: str | None = None
    try:
        out = _remove_bg_birefnet(img)
        engine = "birefnet"
    except ImportError as exc:
        last_error = f"BiRefNet unavailable (torch/transformers not installed): {exc}"
    except Exception as exc:  # model weights missing, OOM, bad weights, ...
        last_error = f"BiRefNet failed: {exc}"

    if engine is None:
        try:
            out = _remove_bg_rembg(img)
            engine = "rembg-fallback"
        except ImportError as exc:
            last_error = (
                f"{last_error}; rembg fallback also unavailable: {exc}"
            )
            return JSONResponse(
                status_code=503,
                content={
                    "error": "birefnet_not_available",
                    "message": "BiRefNet is not installed and no model weights "
                               "are downloaded, and the rembg fallback is also "
                               "not installed.",
                    "detail": last_error,
                    "how_to_fix": INSTALL_HELP
                    + " — or install the fallback with: pip install rembg",
                },
            )
        except Exception as exc:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "background_removal_failed",
                    "message": f"Both BiRefNet and rembg failed: {exc}",
                },
            )

    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    headers = {"X-Background-Engine": engine}
    return Response(content=buf.getvalue(), media_type="image/png", headers=headers)

"""Shared image helpers for the YearMedia AI service.

Light deps only (Pillow + numpy). No torch / cv2 / transformers here.
"""
from __future__ import annotations

import io

from PIL import Image

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "BMP", "TIFF"}
ALLOWED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
}
# Hard guard against absurd uploads on a small VM (50 MB).
MAX_FILE_BYTES = 50 * 1024 * 1024
# Refuse to process images larger than this on a side (memory guard).
MAX_DIMENSION = 12000


class ImageValidationError(ValueError):
    """Raised when an uploaded file is not a usable image."""


def load_image(data: bytes) -> Image.Image:
    """Validate raw upload bytes and return a loaded Pillow image.

    Raises ImageValidationError on: empty/oversized data, unknown or
    disallowed format, corrupt data, or absurd dimensions.
    The returned image is fully loaded (``img.load()``) so the caller's
    buffer can be closed.
    """
    if not data:
        raise ImageValidationError("Uploaded file is empty.")
    if len(data) > MAX_FILE_BYTES:
        raise ImageValidationError(
            f"File too large: {len(data)} bytes (max {MAX_FILE_BYTES})."
        )
    try:
        img = Image.open(io.BytesIO(data))
    except Exception as exc:  # corrupt / not an image at all
        raise ImageValidationError(f"Could not read image file: {exc}") from exc
    if img.format not in ALLOWED_FORMATS:
        raise ImageValidationError(
            f"Unsupported image format: {img.format!r}. "
            f"Allowed: {sorted(ALLOWED_FORMATS)}."
        )
    try:
        img.load()
    except Exception as exc:
        raise ImageValidationError(f"Corrupt image data: {exc}") from exc
    if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
        raise ImageValidationError(
            f"Image too large: {img.width}x{img.height} "
            f"(max dimension {MAX_DIMENSION}px)."
        )
    return img


def image_to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    """Encode a Pillow image to bytes (default PNG, preserves alpha)."""
    buf = io.BytesIO()
    save_kwargs: dict = {}
    if fmt.upper() == "PNG":
        save_kwargs["optimize"] = True
    img.save(buf, format=fmt.upper(), **save_kwargs)
    return buf.getvalue()

"""POST /convert — format conversion via CLI wrappers.

Each conversion checks the required binary with shutil.which first and
returns an honest 503 with install notes when it is missing. Nothing
is faked: a missing binary is never silently replaced by a different
conversion.

Supported:
- JPG/PNG -> SVG : potrace (raster -> PGM -> potrace). autotrace is used
  if present instead; both are optional. NOTE: potrace traces to a
  black-and-white (single-colour) vector — this is a traced silhouette,
  not a full-colour vectorisation.
- SVG -> EPS     : inkscape CLI.
- EPS -> JPG     : ghostscript (gs -sDEVICE=jpeg).
- JPG/PNG -> PSD : a minimal flattened-PSD writer in this module
  (Pillow cannot write PSD — see _raster_to_psd). Flattened RGB 8-bit,
  no layers.
"""
from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image

from ..utils.image import ImageValidationError, load_image

router = APIRouter()

INSTALL_NOTES = {
    "potrace": "Install potrace: apt install potrace (Debian/Ubuntu) or "
               "brew install potrace (macOS).",
    "autotrace": "Install autotrace: apt install autotrace (Debian/Ubuntu).",
    "inkscape": "Install Inkscape: apt install inkscape or download from "
                "https://inkscape.org/release/",
    "gs": "Install Ghostscript: apt install ghostscript (Debian/Ubuntu) or "
          "brew install ghostscript (macOS).",
}

SUPPORTED = {
    ("jpg", "svg"), ("jpeg", "svg"), ("png", "svg"),
    ("svg", "eps"),
    ("eps", "jpg"), ("eps", "jpeg"),
    ("jpg", "psd"), ("jpeg", "psd"), ("png", "psd"),
}


def _missing(binary: str, friendly: str):
    return JSONResponse(
        status_code=503,
        content={
            "error": f"{friendly}_not_available",
            "message": f"Required tool '{binary}' is not installed on this host.",
            "how_to_fix": INSTALL_NOTES[binary],
        },
    )


def _run(cmd: list[str], timeout: int = 120) -> None:
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=502, detail=f"Conversion timed out: {exc}") from exc
    if proc.returncode != 0:
        raise HTTPException(
            status_code=502,
            detail=f"Conversion failed ({' '.join(cmd[:2])}): "
                   f"{(proc.stderr or proc.stdout or '').strip()[:500]}",
        )


class _MissingBinary(Exception):
    def __init__(self, binary: str):
        super().__init__(binary)
        self.binary = binary


def _raster_to_svg(data: bytes, img: Image.Image) -> bytes:
    """Raster -> SVG via potrace (or autotrace). Returns SVG bytes."""
    binary = "potrace" if shutil.which("potrace") else None
    if binary is None and shutil.which("autotrace"):
        binary = "autotrace"
    if binary is None:
        raise _MissingBinary("potrace")

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "in.png")
        img.convert("RGB").save(src, format="PNG")
        out = os.path.join(tmp, "out.svg")
        if binary == "potrace":
            # potrace needs a bitmap: Pillow writes a P5 (PGM) file when a
            # grayscale image is saved with format "PPM".
            pgm = os.path.join(tmp, "in.pgm")
            Image.open(src).convert("L").save(pgm, format="PPM")
            _run(["potrace", pgm, "-s", "-o", out])
        else:  # autotrace
            _run(["autotrace", "-output-format", "svg", "-o", out, src])
        with open(out, "rb") as fh:
            return fh.read()


def _svg_to_eps(data: bytes) -> bytes:
    if not shutil.which("inkscape"):
        raise _MissingBinary("inkscape")
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "in.svg")
        out = os.path.join(tmp, "out.eps")
        with open(src, "wb") as fh:
            fh.write(data)
        _run(["inkscape", src, "--export-type=eps", f"--export-filename={out}"])
        with open(out, "rb") as fh:
            return fh.read()


def _eps_to_jpg(data: bytes) -> bytes:
    if not shutil.which("gs"):
        raise _MissingBinary("gs")
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "in.eps")
        out = os.path.join(tmp, "out.jpg")
        with open(src, "wb") as fh:
            fh.write(data)
        _run([
            "gs", "-dSAFER", "-dBATCH", "-dNOPAUSE",
            "-sDEVICE=jpeg", "-r300", "-dJPEGQ=90",
            f"-sOutputFile={out}", src,
        ])
        with open(out, "rb") as fh:
            return fh.read()


def _raster_to_psd(img: Image.Image) -> bytes:
    """Write a minimal flattened PSD (8-bit RGB, raw compression, no layers).

    Pillow cannot write PSD at all (Pillow 10.x has no PSD save plugin),
    so this writes the PSD header + planar channel data directly, per
    Adobe's PSD spec: signature 8BPS, version 1, 3 channels, depth 8,
    colour mode 3 (RGB), empty colour-mode/resources/layer sections,
    then raw (uncompressed) image data, channel by channel (R, G, B).
    The result is a valid flattened PSD readable by Photoshop/GIMP.
    No layers are possible with this writer.
    """
    import struct

    rgb = img.convert("RGB")
    width, height = rgb.size
    r, g, b = rgb.split()
    header = struct.pack(
        ">4sH6sHIIHH",
        b"8BPS", 1, b"\x00" * 6, 3, height, width, 8, 3,
    )
    sections = struct.pack(">I", 0) + struct.pack(">I", 0) + struct.pack(">I", 0)
    image_data = struct.pack(">H", 0) + r.tobytes() + g.tobytes() + b.tobytes()
    return header + sections + image_data


@router.post("/convert")
async def convert_file(
    # NOTE: field is named `image` (not `file`) to match every other AI
    # endpoint and the API proxy in apps/api (which forwards `image`).
    image: UploadFile = File(...),
    from_format: str = Form(...),
    to_format: str = Form(...),
):
    from_fmt = from_format.strip().lower().lstrip(".")
    to_fmt = to_format.strip().lower().lstrip(".")
    if (from_fmt, to_fmt) not in SUPPORTED:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported conversion: {from_fmt} -> {to_fmt}. "
                   f"Supported: {sorted(f'{a}->{b}' for a, b in SUPPORTED)}.",
        )

    raw = await image.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    try:
        if (from_fmt, to_fmt) in {("jpg", "svg"), ("jpeg", "svg"), ("png", "svg")}:
            try:
                img = load_image(raw)
            except ImageValidationError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            result = _raster_to_svg(raw, img)
            media, fname = "image/svg+xml", f"converted.{to_fmt}"
        elif (from_fmt, to_fmt) == ("svg", "eps"):
            result = _svg_to_eps(raw)
            media, fname = "application/postscript", "converted.eps"
        elif (from_fmt, to_fmt) in {("eps", "jpg"), ("eps", "jpeg")}:
            result = _eps_to_jpg(raw)
            media, fname = "image/jpeg", "converted.jpg"
        else:  # JPG/PNG -> PSD
            try:
                img = load_image(raw)
            except ImageValidationError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            result = _raster_to_psd(img)
            media, fname = "image/vnd.adobe.photoshop", "converted.psd"
    except _MissingBinary as exc:
        return _missing(exc.binary, exc.binary)

    headers = {"Content-Disposition": f'attachment; filename="{fname}"'}
    if to_fmt == "psd":
        headers["X-PSD-Note"] = "flattened PSD, no layers (minimal PSD writer)"
    if to_fmt == "svg":
        headers["X-SVG-Note"] = (
            "traced single-colour vector via potrace/autotrace, "
            "not a full-colour vectorisation"
        )
    return Response(content=result, media_type=media, headers=headers)

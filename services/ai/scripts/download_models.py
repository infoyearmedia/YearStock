#!/usr/bin/env python3
"""Download BiRefNet + Real-ESRGAN model weights for the YearMedia AI service.

Usage:
    python3 scripts/download_models.py [--dry-run] [--cache-dir ./models]

Downloads (from Hugging Face):
  - BiRefNet (ZhengPeng7/BiRefNet, ~700 MB) — background removal.
  - RealESRGAN_x4plus.pth (~64 MB) — upscaling.

This script is NOT run automatically and is NOT run during setup — the
VM is small and the weights are large. Run it on the machine that will
actually serve /remove-bg and /upscale (ideally a GPU host).

Requires: pip install huggingface_hub
"""
from __future__ import annotations

import argparse
import os
import sys

BIREFNET_MODEL = os.environ.get("BIREFNET_MODEL", "ZhengPeng7/BiRefNet")
# RealESRGAN_x4plus weights live in the xinntao/Real-ESRGAN repo.
REALESRGAN_REPO = "xinntao/Real-ESRGAN"
REALESRGAN_FILE = "RealESRGAN_x4plus.pth"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download BiRefNet + Real-ESRGAN weights."
    )
    parser.add_argument(
        "--cache-dir", default=os.environ.get("MODEL_CACHE", "./models"),
        help="Directory to store weights in (default: ./models or $MODEL_CACHE).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be downloaded without downloading anything.",
    )
    parser.add_argument(
        "--only", choices=["birefnet", "realesrgan"], default=None,
        help="Download only one model.",
    )
    args = parser.parse_args()

    jobs = []
    if args.only in (None, "birefnet"):
        jobs.append(("BiRefNet", BIREFNET_MODEL, "snapshot"))
    if args.only in (None, "realesrgan"):
        jobs.append(("RealESRGAN_x4plus", f"{REALESRGAN_REPO}:{REALESRGAN_FILE}", "file"))

    for name, source, kind in jobs:
        print(f"[download] {name}: {source} -> {args.cache_dir} ({kind})")

    if args.dry_run:
        print("[dry-run] Nothing downloaded.")
        return 0

    try:
        from huggingface_hub import hf_hub_download, snapshot_download
    except ImportError:
        print(
            "ERROR: huggingface_hub is not installed. Run:\n"
            "  pip install huggingface_hub",
            file=sys.stderr,
        )
        return 1

    os.makedirs(args.cache_dir, exist_ok=True)

    if args.only in (None, "birefnet"):
        print(f"Downloading BiRefNet ({BIREFNET_MODEL}) ...")
        snapshot_download(repo_id=BIREFNET_MODEL, cache_dir=args.cache_dir)
        print("BiRefNet done.")

    if args.only in (None, "realesrgan"):
        print(f"Downloading {REALESRGAN_FILE} ...")
        hf_hub_download(
            repo_id=REALESRGAN_REPO,
            filename=REALESRGAN_FILE,
            local_dir=args.cache_dir,
        )
        print("Real-ESRGAN done.")

    print(f"All weights are in {args.cache_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

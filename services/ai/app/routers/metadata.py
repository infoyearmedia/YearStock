"""POST /metadata — AI metadata generation via the Gemini API.

Real integration only: the image + prompt are sent to Gemini
(generativelanguage.googleapis.com). If GEMINI_API_KEY is not set the
endpoint returns 503 gemini_not_configured. Gemini output is NEVER faked
or templated — on any Gemini error the endpoint returns 502.
"""
from __future__ import annotations

import base64
import json
import os
import re

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from ..models import MetadataResponse
from ..utils.image import ImageValidationError, load_image

router = APIRouter()

GEMINI_API_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

# Per-marketplace keyword limits, from each marketplace's contributor guide.
# Adobe Stock is the outlier (up to 200 keywords); the others cap at 50.
# NOTE: verify against the live contributor guides before launch — these
# limits are enforced in the API and web presets too (keep all three in sync).
MARKETPLACE_LIMITS: dict[str, dict[str, int]] = {
    "adobe": {"keywords": 200, "title": 200},
    "shutterstock": {"keywords": 50, "title": 200},
    "freepik": {"keywords": 50, "title": 200},
    "dreamstime": {"keywords": 50, "title": 200},
    "istock": {"keywords": 50, "title": 200},
    "123rf": {"keywords": 50, "title": 200},
    "alamy": {"keywords": 50, "title": 200},
    "generic": {"keywords": 50, "title": 200},
}

# Keywords that must never appear in generated metadata.
BANNED_KEYWORDS = {"trademark", "brand", "logo", "copyrighted"}


def _build_prompt(marketplace: str, keyword_count: int) -> str:
    limit = MARKETPLACE_LIMITS.get(marketplace, MARKETPLACE_LIMITS["generic"])
    max_kw = min(keyword_count, limit["keywords"])
    return (
        "You are a microstock metadata expert. Analyse this image and return "
        "STRICT JSON only, no markdown fences, no extra text, with exactly "
        "these keys:\n"
        '{"title": string, "description": string, "category": string, '
        '"content_type": "photo" | "illustration" | "vector" | "video", '
        '"keywords": [string, ...]}\n\n'
        f"Rules:\n"
        f"- title: concise, descriptive, max {limit['title']} characters, "
        "no brand or trademark names.\n"
        f"- description: 1-2 sentences describing the image.\n"
        "- category: one microstock category, e.g. Nature, Business, "
        "Technology, People, Food, Travel, Lifestyle.\n"
        "- content_type: best fit for the image.\n"
        f"- keywords: exactly {max_kw} single- or two-word keywords, "
        "lowercase, most relevant first, no duplicates, no brand or "
        "trademark names, no keyword stuffing.\n"
        f"- Target marketplace: {marketplace}.\n"
    )


def _parse_gemini_json(text: str) -> dict:
    """Extract the JSON object from a Gemini text response."""
    cleaned = text.strip()
    # Strip markdown fences if the model added them despite instructions.
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini returned non-JSON output: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("Gemini returned JSON that is not an object.")
    for key in ("title", "description", "category", "content_type", "keywords"):
        if key not in data:
            raise ValueError(f"Gemini response missing key: {key}")
    return data


@router.post("/metadata", response_model=MetadataResponse)
async def generate_metadata(
    image: UploadFile = File(...),
    marketplace: str = Form("generic"),
    keywordCount: int = Form(30),
):
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return JSONResponse(
            status_code=503,
            content={
                "error": "gemini_not_configured",
                "message": "GEMINI_API_KEY not set — metadata generation unavailable",
            },
        )

    if not (5 <= keywordCount <= 50):
        raise HTTPException(
            status_code=422,
            detail="keywordCount must be between 5 and 50.",
        )
    marketplace = marketplace.strip().lower() or "generic"
    if marketplace not in MARKETPLACE_LIMITS:
        marketplace = "generic"

    raw = await image.read()
    try:
        img = load_image(raw)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    mime = "image/jpeg"
    if img.format == "PNG":
        mime = "image/png"
    elif img.format == "WEBP":
        mime = "image/webp"
    image_b64 = base64.b64encode(raw).decode("ascii")

    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
    url = GEMINI_API_URL_TEMPLATE.format(model=model)
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": _build_prompt(marketplace, keywordCount)},
                    {"inline_data": {"mime_type": mime, "data": image_b64}},
                ]
            }
        ],
        "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url, params={"key": api_key}, json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini request failed: {exc}",
        ) from exc

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error {resp.status_code}: {resp.text[:500]}",
        )

    try:
        body = resp.json()
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        data = _parse_gemini_json(text)
    except (KeyError, IndexError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned an unusable response: {exc}",
        ) from exc

    keywords = [str(k).strip().lower() for k in data["keywords"] if str(k).strip()]
    # De-duplicate, drop banned terms, enforce requested count.
    seen: set[str] = set()
    clean_keywords: list[str] = []
    for kw in keywords:
        if kw in seen or kw in BANNED_KEYWORDS:
            continue
        seen.add(kw)
        clean_keywords.append(kw)
    clean_keywords = clean_keywords[:keywordCount]

    return MetadataResponse(
        title=str(data["title"])[:200],
        description=str(data["description"]),
        category=str(data["category"]),
        content_type=str(data["content_type"]),
        keywords=clean_keywords,
        marketplace=marketplace,
        model=model,
    )

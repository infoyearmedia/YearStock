"""Pydantic response models for the YearMedia AI service."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HealthModels(BaseModel):
    birefnet: Literal["available", "not-installed"]
    realesrgan: Literal["available", "not-installed"]
    gemini: Literal["configured", "not-configured"]
    potrace: Literal["found", "missing"]
    inkscape: Literal["found", "missing"]
    ghostscript: Literal["found", "missing"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    models: HealthModels


class QualityRisk(BaseModel):
    metric: str
    threshold: str
    message: str
    severity: Literal["low", "medium", "high"]


class QualityMetrics(BaseModel):
    width: int
    height: int
    megapixels: float
    format: str | None
    file_size_bytes: int
    file_size_kb_per_megapixel: float
    mean_brightness: float
    exposure: Literal["underexposed", "ok", "overexposed"]
    contrast_stddev: float
    mean_saturation: float
    sharpness_laplacian_variance: float
    noise_estimate: float
    jpeg_quality: int | None = None


class QualityResponse(BaseModel):
    metrics: QualityMetrics
    risks: list[QualityRisk] = Field(default_factory=list)
    overall_risk: Literal["low", "medium", "high"]
    methods: list[str] = Field(default_factory=list)


class MetadataResponse(BaseModel):
    title: str
    description: str
    category: str
    content_type: str
    keywords: list[str]
    marketplace: str
    model: str

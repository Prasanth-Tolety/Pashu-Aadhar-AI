"""
Data schemas used across the enrollment service.
Plain Python dataclasses — zero heavy dependencies.
"""

from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class OwnerInfo:
    """Farmer / owner metadata submitted during enrollment."""
    name: str
    phone: str
    aadhaar_last4: str = ""
    village: str = ""
    district: str = ""
    state: str = ""


@dataclass
class AnimalMetadata:
    """Animal details submitted during enrollment."""
    species: str = "cattle"
    breed: str = ""
    sex: str = ""
    age_months: int = 0
    color: str = ""
    tag_number: str = ""


@dataclass
class ValidationResult:
    """Result of offline input + image quality validation."""
    is_valid: bool
    quality_score: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    face_box: Optional[List[int]] = None
    suggestions: List[str] = field(default_factory=list)


@dataclass
class EnrollmentRequest:
    """Full enrollment payload sent from the phone to the backend."""
    image_bytes: bytes
    image_filename: str
    owner: OwnerInfo
    animal: AnimalMetadata
    capture_timestamp: str = ""
    device_id: str = ""
    offline_quality_score: int = 0


@dataclass
class DuplicateCheckResult:
    """Result from duplicate detection."""
    is_duplicate: bool
    matched_livestock_id: Optional[str] = None
    similarity_score: float = 0.0
    message: str = ""


@dataclass
class EnrollmentResponse:
    """Final response returned after full enrollment pipeline."""
    success: bool
    livestock_id: Optional[str] = None
    s3_image_url: Optional[str] = None
    duplicate_check: Optional[DuplicateCheckResult] = None
    message: str = ""
    enrolled_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

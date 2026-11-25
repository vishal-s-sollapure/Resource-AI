from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # dotenv is optional in production environments
    pass

BASE_DIR = Path(__file__).resolve().parent.parent


def _float(name: str, default: str) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return float(default)


class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
    GOOGLE_PLACES_API_KEY: str = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()
    DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
    TOKEN_SECRET: str = os.getenv("TOKEN_SECRET", "").strip()
    APP_ENV: str = os.getenv("APP_ENV", "demo").strip().lower()
    ALLOW_ANONYMOUS_DEMO: bool = os.getenv("ALLOW_ANONYMOUS_DEMO", "true").strip().lower() in {
        "1", "true", "yes", "on"
    }

    MATCH_WEIGHTS: dict[str, float] = {
        "material": _float("MATCH_WEIGHT_MATERIAL", "0.40"),
        "quantity": _float("MATCH_WEIGHT_QUANTITY", "0.25"),
        "location": _float("MATCH_WEIGHT_LOCATION", "0.20"),
        "quality": _float("MATCH_WEIGHT_QUALITY", "0.15"),
    }

    @property
    def is_production(self) -> bool:
        return self.APP_ENV in {"prod", "production"}

    @property
    def supabase_configured(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_ROLE_KEY)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.GEMINI_API_KEY)

    @property
    def places_configured(self) -> bool:
        return bool(self.GOOGLE_PLACES_API_KEY)

    @property
    def distance_configured(self) -> bool:
        return bool(self.GOOGLE_MAPS_API_KEY)


settings = Settings()

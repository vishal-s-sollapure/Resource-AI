from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request

from .config import settings
from .security import parse_token
from .store import get_store

DEMO_USER_IDS = {
    "seller": "usr_seller",
    "buyer": "usr_buyer",
    "buyer_seller": "usr_both",
    "admin": "usr_admin",
}

# Read-only AI/compute endpoints stay public when anonymous demo identities are
# disabled; state-changing actions require a signed session.
PUBLIC_COMPUTE_PATHS = {
    "/api/materials/analyze",
    "/api/pricing/estimate",
    "/api/requirements/extract",
    "/api/discovery/search",
    "/api/matching/seller",
    "/api/matching/buyer",
}


def store() -> Any:
    return get_store()


def sanitize_user(user: dict[str, Any] | None) -> dict[str, Any] | None:
    if not user:
        return None
    hidden = {"password_hash", "bank_account_number", "bank_ifsc", "bank_upi", "bank_account_holder", "bank_name"}
    return {key: value for key, value in user.items() if key not in hidden}


def _resolve(request: Request, default_role: str) -> tuple[dict[str, Any], bool]:
    """Resolve the acting user.

    Returns `(user, authenticated)`. When no valid signed token is present the
    request is treated as an explicitly-labelled demo actor so public demo
    workflows keep working. Server-side role/ownership checks only restrict
    genuinely authenticated sessions.
    """
    header = request.headers.get("authorization", "").strip()
    if header:
        token = header.split(" ", 1)[1] if header.lower().startswith("bearer ") else header
        user_id = parse_token(token.strip())
        user = store().get("users", user_id) if user_id else None
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session. Please sign in again.")
        return user, True
    # Demo fallback identities apply only when no token was supplied. A supplied
    # but invalid token must never silently downgrade to a different demo user.
    if (
        not settings.ALLOW_ANONYMOUS_DEMO
        and request.method not in ("GET", "HEAD", "OPTIONS")
        and request.url.path not in PUBLIC_COMPUTE_PATHS
    ):
        raise HTTPException(status_code=401, detail="Sign in to perform this action in this deployment.")
    role = request.headers.get("x-demo-role", default_role)
    user_id = DEMO_USER_IDS.get(role, DEMO_USER_IDS.get(default_role, "usr_buyer"))
    user = store().get("users", user_id)
    if not user:
        raise HTTPException(status_code=401, detail="No demo user available. Please log in.")
    return user, False


def actor(request: Request, default_role: str = "seller") -> dict[str, Any]:
    """Resolve the acting user from a signed demo token, or use a demo identity."""
    return _resolve(request, default_role)[0]


def actor_for(request: Request, default_role: str, *allowed_roles: str) -> dict[str, Any]:
    """Resolve the actor and enforce the allowed roles for authenticated users."""
    user, authenticated = _resolve(request, default_role)
    if authenticated and user.get("role") != "admin" and user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Your account role cannot perform this action.")
    return user


def ensure_owner(
    request: Request,
    record: dict[str, Any],
    owner_key: str,
    default_role: str,
    *allowed_roles: str,
) -> dict[str, Any]:
    """Enforce ownership for authenticated users; demo (unauthenticated) requests stay usable."""
    user, authenticated = _resolve(request, default_role)
    if authenticated:
        if user.get("role") == "admin":
            return user
        if allowed_roles and user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="Your account role cannot perform this action.")
        if user["id"] != record.get(owner_key):
            raise HTTPException(status_code=403, detail="Only the owner can perform this action.")
    return user


def is_participant(user: dict[str, Any], record: dict[str, Any], *keys: str) -> bool:
    return user.get("role") == "admin" or any(user["id"] == record.get(key) for key in keys)


def require_participant(request: Request, record: dict[str, Any], default_role: str, *keys: str) -> dict[str, Any]:
    user = actor(request, default_role)
    if not is_participant(user, record, *keys):
        raise HTTPException(status_code=403, detail="Only a participant in this record can view or change it.")
    return user


def require_admin(request: Request) -> dict[str, Any]:
    """Admin operations require the seeded admin demo login, never a fallback identity."""
    user, authenticated = _resolve(request, "admin")
    if not authenticated or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access requires the seeded admin demo login.")
    return user


def require_id(row: dict[str, Any] | None, label: str = "Record") -> dict[str, Any]:
    if not row:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return row


def validate_positive(value: Any, label: str, allow_zero: bool = False) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"{label} must be a number")
    if number < 0 or (number == 0 and not allow_zero):
        raise HTTPException(status_code=422, detail=f"{label} must be {'non-negative' if allow_zero else 'positive'}")
    return number

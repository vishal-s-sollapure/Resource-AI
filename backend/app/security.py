from __future__ import annotations

import hashlib
import hmac

from .config import settings

DEMO_SALT = "resource-ai-demo-hackathon"


def _token_secret() -> str:
    """Secret used to sign session tokens.

    The built-in fallback is only for local demo use. Production deployments
    must set ``TOKEN_SECRET`` so tokens cannot be forged with a public secret.
    """
    if settings.TOKEN_SECRET:
        return settings.TOKEN_SECRET
    if settings.is_production:
        raise RuntimeError("TOKEN_SECRET must be set when APP_ENV=production.")
    return "resource-ai-demo-token-secret-change-me"


def hash_password(password: str) -> str:
    return hashlib.sha256(f"{DEMO_SALT}:{password}".encode("utf-8")).hexdigest()


def verify_password(password: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password), stored_hash or "")


def _signature(payload: str) -> str:
    return hmac.new(_token_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def make_token(user_id: str) -> str:
    """Create a signed demo token so clients cannot trivially impersonate another user."""
    payload = f"demo:{user_id}"
    return f"{payload}.{_signature(payload)}"


def parse_token(token: str) -> str | None:
    """Validate and decode a signed demo token. Returns None for unsigned/forged tokens."""
    if not token.startswith("demo:"):
        return None
    payload, separator, signature = token.rpartition(".")
    if not separator or not hmac.compare_digest(signature, _signature(payload)):
        return None
    user_id = payload.split(":", 1)[1] if ":" in payload else ""
    return user_id or None


def mask_account(number: str | None) -> str:
    if not number:
        return "Not provided"
    cleaned = str(number).replace(" ", "")
    if len(cleaned) <= 4:
        return "••••" + cleaned
    return "••••" + cleaned[-4:]

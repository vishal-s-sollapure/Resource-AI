from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .deps import require_admin
from .routers import commerce, core, market
from .store import JsonStore, get_store

if settings.is_production and not settings.TOKEN_SECRET:
    raise RuntimeError("TOKEN_SECRET must be set when APP_ENV=production.")

app = FastAPI(
    title="ReSource AI API",
    version="1.0.0",
    description="AI-powered industrial and agricultural by-product marketplace (hackathon MVP).",
)

_origins = {
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
}
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origin for origin in _origins if origin),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core.router)
app.include_router(market.router)
app.include_router(commerce.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "ReSource AI", "tagline": "Turn Waste into Business Opportunities.", "docs": "/docs"}


@app.get("/api/health")
def health() -> dict[str, str]:
    store = get_store()
    return {
        "status": "ok",
        "storage": "supabase" if not isinstance(store, JsonStore) else "demo-json",
        "gemini": "configured" if settings.gemini_configured else "demo-fallback",
        "google_places": "configured" if settings.places_configured else "demo-fallback",
        "anonymous_demo": "enabled" if settings.ALLOW_ANONYMOUS_DEMO else "sign-in-required",
    }


@app.post("/api/demo/reset")
def reset_demo(request: Request) -> dict[str, str]:
    require_admin(request)
    store = get_store()
    if not isinstance(store, JsonStore):
        return {"message": "Demo reset is disabled with Supabase configured."}
    store.reset()
    return {"message": "Demo data restored to the seeded state."}

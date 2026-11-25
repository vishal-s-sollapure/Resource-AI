"""Identity, business profiles, materials, listings, requirements and passports."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request

from ..deps import (
    actor,
    actor_for,
    ensure_owner,
    require_id,
    sanitize_user,
    store,
    validate_positive,
)
from ..domain import new_id, now
from ..security import hash_password, make_token, verify_password
from ..services.ai import find_knowledge

router = APIRouter(prefix="/api")

BASIC_MONTHLY_PRICE = 0.0
PREMIUM_MONTHLY_PRICE = 1199.0


@router.post("/auth/register")
def register(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    name = str(payload.get("full_name") or payload.get("business_name") or "New user").strip()
    role = str(payload.get("role", "buyer"))
    if "@" not in email or len(password) < 6:
        raise HTTPException(status_code=422, detail="A valid email and a password of at least 6 characters are required.")
    if role not in {"seller", "buyer", "buyer_seller", "admin"}:
        raise HTTPException(status_code=422, detail="Invalid role.")
    if role == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts are seeded for the demo and cannot be self-assigned.")
    db = store()
    if db.list("users", email=email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = db.create(
        "users",
        {
            "id": new_id("usr"),
            "email": email,
            "full_name": name,
            "role": role,
            "password_hash": hash_password(password),
            "phone": payload.get("phone"),
            "verification_status": "unverified",
            "subscription_tier": "basic",
            "trial_status": "active",
            "trial_ends_at": payload.get("trial_ends_at"),
            "is_demo": True,
        },
    )
    if payload.get("business_name"):
        db.create(
            "business_profiles",
            {
                "id": new_id("bsp"),
                "user_id": user["id"],
                "business_name": str(payload["business_name"]),
                "business_type": str(payload.get("business_type", "")),
                "industry": str(payload.get("industry", "")),
                "contact_person": name,
                "email": email,
                "phone": str(payload.get("phone", "")),
                "location": str(payload.get("location", "")),
                "description": str(payload.get("description", "")),
                "verification_status": "unverified",
                "is_demo": True,
            },
        )
    return {"user": sanitize_user(user), "token": make_token(user["id"])}


@router.post("/auth/login")
def login(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    rows = store().list("users", email=email)
    if not rows or not verify_password(password, rows[0].get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password. Use the demo credentials shown on the login page.")
    return {"user": sanitize_user(rows[0]), "token": make_token(rows[0]["id"])}


@router.get("/auth/me")
def me(request: Request) -> dict[str, Any]:
    return {"user": sanitize_user(actor(request, "buyer"))}


@router.post("/auth/logout")
def logout() -> dict[str, Any]:
    return {"message": "Logged out. Discard the client-side demo token."}


@router.get("/profile")
def get_profile(request: Request) -> dict[str, Any]:
    user = sanitize_user(actor(request, "buyer"))
    profile = store().list("business_profiles", user_id=user["id"])
    return {"user": user, "profile": profile[0] if profile else None}


@router.put("/profile")
def update_profile(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    user = actor(request, "buyer")
    db = store()
    profile_rows = db.list("business_profiles", user_id=user["id"])
    profile_fields = (
        "business_name", "business_type", "industry", "contact_person", "email", "phone",
        "location", "description", "logo_url",
    )
    profile_patch = {k: payload[k] for k in profile_fields if k in payload}
    if profile_rows:
        profile = db.update("business_profiles", profile_rows[0]["id"], profile_patch) or profile_rows[0]
    else:
        profile = db.create(
            "business_profiles",
            {"id": new_id("bsp"), "user_id": user["id"], "verification_status": "unverified", "is_demo": True, **profile_patch},
        )
    user_patch = {k: payload[k] for k in ("full_name", "phone", "avatar_url") if k in payload}
    # Bank fields are hidden from API responses. An empty value therefore means
    # "unchanged", not "erase this private field".
    private_fields = ("bank_account_holder", "bank_name", "bank_account_number", "bank_ifsc", "bank_upi")
    for key in private_fields:
        value = payload.get(key)
        if value not in (None, ""):
            user_patch[key] = value
    updated = db.update("users", user["id"], user_patch) or user
    return {"user": sanitize_user(updated), "profile": profile}


@router.get("/buyers")
def list_buyers() -> dict[str, Any]:
    """Sanitized list of buyer accounts so sellers can target orders or enquiries."""
    db = store()
    profiles = {p.get("user_id"): p for p in db.list("business_profiles")}
    items = []
    for user in db.list("users"):
        if user.get("role") in ("buyer", "buyer_seller"):
            safe = sanitize_user(user) or {}
            profile = profiles.get(user.get("id")) or {}
            items.append(
                {
                    "id": safe.get("id"),
                    "full_name": safe.get("full_name"),
                    "role": safe.get("role"),
                    "business_name": profile.get("business_name") or safe.get("full_name"),
                    "location": profile.get("location") or "",
                }
            )
    return {"items": items}


@router.get("/materials")
def list_materials(category: str | None = None) -> dict[str, Any]:
    rows = store().list("materials")
    if category:
        rows = [r for r in rows if r.get("category") == category]
    return {"items": rows, "total": len(rows), "note": "Material knowledge records — not sellable listings."}


@router.get("/materials/{material_id}")
def get_material(material_id: str) -> dict[str, Any]:
    return {"item": require_id(store().get("materials", material_id), "Material")}


@router.get("/listings")
def list_listings(
    status: str = "active",
    material: str | None = None,
    location: str | None = None,
    seller_id: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
) -> dict[str, Any]:
    rows = store().list("listings", status=status)
    if material:
        needle = material.lower()
        rows = [r for r in rows if needle in str(r.get("material_name", "")).lower()]
    if location:
        needle = location.lower()
        rows = [r for r in rows if needle in str(r.get("location", "")).lower()]
    if seller_id:
        rows = [r for r in rows if r.get("seller_id") == seller_id]
    if min_price is not None:
        rows = [r for r in rows if float(r.get("price", 0)) >= min_price]
    if max_price is not None:
        rows = [r for r in rows if float(r.get("price", 0)) <= max_price]
    return {"items": rows, "total": len(rows), "note": "Prices are demo estimates unless real comparable data is configured."}


@router.post("/listings", status_code=201)
def create_listing(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    name = str(payload.get("material_name", "")).strip()
    quantity = validate_positive(payload.get("quantity"), "Quantity")
    price = validate_positive(payload.get("price"), "Price", allow_zero=True)
    if not name:
        raise HTTPException(status_code=422, detail="Material name is required.")
    db = store()
    knowledge = find_knowledge(name, db.list("materials"))
    listing = {
        "id": new_id("lst"),
        "seller_id": user["id"],
        "material_id": knowledge["id"] if knowledge else None,
        "material_name": name,
        "category": knowledge["category"] if knowledge else payload.get("category", "other"),
        "quantity": quantity,
        "unit": payload.get("unit", "kg"),
        "form": payload.get("form", "raw"),
        "quality_grade": payload.get("quality_grade", "ungraded"),
        "moisture_content": payload.get("moisture_content"),
        "processing_level": payload.get("processing_level", "raw"),
        "location": str(payload.get("location", "")),
        "price": price,
        "price_type": payload.get("price_type", "negotiable"),
        "available_date": payload.get("available_date"),
        "images": payload.get("images") or [],
        "description": str(payload.get("description", "")),
        "status": "active",
        "is_demo": False,
    }
    db.create("listings", listing)
    return {"item": listing, "message": "Listing created."}


@router.get("/listings/mine")
def list_my_listings(request: Request, status: str = "active") -> dict[str, Any]:
    """Owner-scoped listings derived from the acting token, never a client-supplied id."""
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    rows = [r for r in store().list("listings", status=status) if r.get("seller_id") == user["id"]]
    return {"items": rows, "total": len(rows), "note": "Only listings owned by the acting user."}


@router.get("/listings/{listing_id}")
def get_listing(listing_id: str) -> dict[str, Any]:
    return {"item": require_id(store().get("listings", listing_id), "Listing")}


@router.put("/listings/{listing_id}")
def update_listing(listing_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    existing = require_id(store().get("listings", listing_id), "Listing")
    ensure_owner(request, existing, "seller_id", "seller", "seller", "buyer_seller")
    patch = {k: v for k, v in payload.items() if k in {
        "material_name", "quantity", "unit", "form", "quality_grade", "moisture_content",
        "processing_level", "location", "price", "price_type", "available_date", "images",
        "description", "category",
    }}
    if "quantity" in patch:
        patch["quantity"] = validate_positive(patch["quantity"], "Quantity")
    if "price" in patch:
        patch["price"] = validate_positive(patch["price"], "Price", allow_zero=True)
    return {"item": store().update("listings", listing_id, patch)}


@router.patch("/listings/{listing_id}/status")
def set_listing_status(listing_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    listing = require_id(store().get("listings", listing_id), "Listing")
    ensure_owner(request, listing, "seller_id", "seller", "seller", "buyer_seller")
    status = str(payload.get("status", ""))
    if status not in {"active", "paused", "sold", "deleted"}:
        raise HTTPException(status_code=422, detail="Invalid listing status.")
    return {"item": store().update("listings", listing_id, {"status": status})}


@router.delete("/listings/{listing_id}")
def delete_listing(listing_id: str, request: Request) -> dict[str, Any]:
    listing = require_id(store().get("listings", listing_id), "Listing")
    ensure_owner(request, listing, "seller_id", "seller", "seller", "buyer_seller")
    store().update("listings", listing_id, {"status": "deleted"})
    return {"message": "Listing moved to deleted status."}


@router.get("/requirements")
def list_requirements(status: str | None = None, buyer_id: str | None = None) -> dict[str, Any]:
    rows = store().list("buyer_requirements")
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if buyer_id:
        rows = [r for r in rows if r.get("buyer_id") == buyer_id]
    return {"items": rows, "total": len(rows)}


@router.post("/requirements", status_code=201)
def create_requirement(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "admin")
    name = str(payload.get("material_name", "")).strip()
    if not name:
        raise HTTPException(status_code=422, detail="Required material is mandatory.")
    qty = validate_positive(payload.get("quantity"), "Quantity")
    item = {
        "id": new_id("req"),
        "buyer_id": user["id"],
        "material_name": name,
        "quantity": qty,
        "unit": payload.get("unit", "kg"),
        "required_quality": payload.get("required_quality", "ungraded"),
        "application": str(payload.get("application", "")),
        "location": str(payload.get("location", "")),
        "max_price": payload.get("max_price"),
        "delivery_date": payload.get("delivery_date"),
        "alternatives_allowed": bool(payload.get("alternatives_allowed", False)),
        "status": "open",
        "confirmed": False,
        "description": str(payload.get("description", "")),
        "is_demo": False,
    }
    store().create("buyer_requirements", item)
    return {"item": item, "message": "Requirement saved. Confirm it to mark it as confirmed demand."}


@router.get("/requirements/mine")
def list_my_requirements(request: Request, status: str | None = None) -> dict[str, Any]:
    """Owner-scoped requirements derived from the acting token."""
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "admin")
    rows = [r for r in store().list("buyer_requirements") if r.get("buyer_id") == user["id"]]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return {"items": rows, "total": len(rows), "note": "Only requirements owned by the acting user."}


@router.get("/requirements/{requirement_id}")
def get_requirement(requirement_id: str) -> dict[str, Any]:
    return {"item": require_id(store().get("buyer_requirements", requirement_id), "Requirement")}


@router.put("/requirements/{requirement_id}")
def update_requirement(requirement_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    existing = require_id(store().get("buyer_requirements", requirement_id), "Requirement")
    ensure_owner(request, existing, "buyer_id", "buyer", "buyer", "buyer_seller")
    patch = {k: v for k, v in payload.items() if k in {
        "material_name", "quantity", "unit", "required_quality", "application", "location",
        "max_price", "delivery_date", "alternatives_allowed", "status", "description",
    }}
    if "quantity" in patch:
        patch["quantity"] = validate_positive(patch["quantity"], "Quantity")
    return {"item": store().update("buyer_requirements", requirement_id, patch)}


@router.patch("/requirements/{requirement_id}/confirm")
def confirm_requirement(requirement_id: str, request: Request) -> dict[str, Any]:
    existing = require_id(store().get("buyer_requirements", requirement_id), "Requirement")
    ensure_owner(request, existing, "buyer_id", "buyer", "buyer", "buyer_seller")
    return {"item": store().update("buyer_requirements", requirement_id, {"confirmed": True, "status": "confirmed"})}


@router.delete("/requirements/{requirement_id}")
def delete_requirement(requirement_id: str, request: Request) -> dict[str, Any]:
    existing = require_id(store().get("buyer_requirements", requirement_id), "Requirement")
    ensure_owner(request, existing, "buyer_id", "buyer", "buyer", "buyer_seller")
    store().delete("buyer_requirements", requirement_id)
    return {"message": "Requirement deleted."}


@router.get("/passports")
def list_passports(request: Request) -> dict[str, Any]:
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    return {"items": store().list("material_passports", user_id=user["id"])}


@router.post("/passports", status_code=201)
def create_passport(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    if not payload.get("material_name"):
        raise HTTPException(status_code=422, detail="Material name is required for a passport.")
    item = {
        "id": new_id("psp"),
        "user_id": user["id"],
        "listing_id": payload.get("listing_id"),
        "material_name": payload["material_name"],
        "source": str(payload.get("source", "")),
        "quantity": str(payload.get("quantity", "")),
        "quality": str(payload.get("quality", "")),
        "processing_history": str(payload.get("processing_history", "")),
        "intended_applications": payload.get("intended_applications") or [],
        "storage_conditions": payload.get("storage_conditions") or [],
        "specifications": payload.get("specifications") or {},
        "is_demo": False,
    }
    store().create("material_passports", item)
    return {"item": item, "message": "Material Passport created."}


@router.get("/subscription")
def get_subscription(request: Request) -> dict[str, Any]:
    user = actor(request, "buyer")
    rows = store().list("subscriptions", user_id=user["id"])
    tier = user.get("subscription_tier", "basic")
    return {
        "tier": tier,
        "monthly_price": PREMIUM_MONTHLY_PRICE if tier == "premium" else BASIC_MONTHLY_PRICE,
        "subscription": rows[0] if rows else None,
        "demo_mode": True,
        "note": "Premium is simulated for the hackathon; no payment is collected.",
    }


@router.post("/subscription/upgrade")
def upgrade_subscription(request: Request) -> dict[str, Any]:
    user = actor(request, "buyer")
    db = store()
    db.update("users", user["id"], {"subscription_tier": "premium"})
    rows = db.list("subscriptions", user_id=user["id"])
    if rows:
        sub = db.update("subscriptions", rows[0]["id"], {"tier": "premium", "monthly_price": PREMIUM_MONTHLY_PRICE, "status": "active"})
    else:
        sub = db.create(
            "subscriptions",
            {
                "id": new_id("sub"), "user_id": user["id"], "tier": "premium",
                "monthly_price": PREMIUM_MONTHLY_PRICE, "status": "active", "demo_mode": True,
                "started_at": now(), "is_demo": False,
            },
        )
    return {"subscription": sub, "message": "Demo premium subscription activated — no real payment."}


@router.post("/subscription/downgrade")
def downgrade_subscription(request: Request) -> dict[str, Any]:
    user = actor(request, "buyer")
    db = store()
    db.update("users", user["id"], {"subscription_tier": "basic"})
    for row in db.list("subscriptions", user_id=user["id"]):
        db.update("subscriptions", row["id"], {"tier": "basic", "monthly_price": 0.0})
    return {"message": "Subscription switched to basic demo mode."}

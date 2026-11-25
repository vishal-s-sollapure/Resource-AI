"""AI analysis, pricing, discovery, matching, enquiries and negotiation."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request

from ..deps import (
    actor,
    actor_for,
    require_id,
    require_participant,
    store,
    validate_positive,
)
from ..domain import new_id, now
from ..services.ai import analyze_material, extract_requirements, suggest_offer
from ..services.discovery import discover
from ..services.engines import calculate_match, estimate_price

router = APIRouter(prefix="/api")


def _active_listing(listing_id: str) -> dict[str, Any]:
    """Commercial actions must target a live listing, never a paused/deleted lot."""
    listing = require_id(store().get("listings", str(listing_id or "")), "Listing")
    if listing.get("status") != "active":
        raise HTTPException(status_code=409, detail="This listing is not active.")
    return listing


def _actionable_offer(offer: dict[str, Any]) -> dict[str, Any]:
    """Only the latest pending offer may be accepted, countered or rejected."""
    if offer.get("status") != "pending":
        raise HTTPException(status_code=409, detail="This offer is no longer open.")
    return offer


def _party_label(user_id: str | None, fallback: str) -> str:
    """Prefer a business/person name over internal user IDs in user-facing copy."""
    if not user_id:
        return fallback
    db = store()
    profile = next(iter(db.list("business_profiles", user_id=user_id)), None)
    if profile and profile.get("business_name"):
        return str(profile["business_name"])
    user = db.get("users", user_id) or {}
    return str(user.get("full_name") or fallback)


@router.post("/materials/analyze")
def analyze(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    name = str(payload.get("material_name") or payload.get("material") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Enter a material to analyse.")
    return {"analysis": analyze_material(payload, store().list("materials"))}


@router.post("/requirements/extract")
def extract(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    text = str(payload.get("text", ""))
    if not text.strip():
        raise HTTPException(status_code=422, detail="Describe the material you need.")
    return {"fields": extract_requirements(text)}


@router.post("/pricing/estimate")
def price_estimate(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    db = store()
    transactions = [
        {"id": o.get("id"), "material_name": o.get("material_name"), "category": o.get("category"),
         "unit": o.get("unit"), "agreed_price": o.get("agreed_price"), "is_demo": o.get("is_demo")}
        for o in db.list("orders", status={"in": ["completed", "delivered"]})
    ]
    return {"estimate": estimate_price(payload, db.list("listings", status="active"), transactions)}


@router.post("/discovery/search")
def discovery_search(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    params = dict(payload)
    if payload.get("material") and not payload.get("analysis"):
        params["analysis"] = analyze_material(payload, store().list("materials"))
    return discover(params, store())


@router.post("/matching/seller")
def match_for_seller(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """A seller's material/offer is matched against published buyer requirements."""
    offer = {
        "material_name": payload.get("material_name", ""),
        "category": payload.get("category", ""),
        "quantity": validate_positive(payload.get("quantity"), "Quantity"),
        "unit": payload.get("unit", "kg"),
        "location": str(payload.get("location", "")),
        "quality_grade": payload.get("quality_grade", "ungraded"),
        "price": payload.get("price"),
    }
    matches = []
    for requirement in store().list("buyer_requirements", status={"in": ["open", "matched", "confirmed"]}):
        score = calculate_match(requirement, offer)
        matches.append(
            {
                "requirement": requirement,
                "buyer_name": f"{_party_label(requirement.get('buyer_id'), 'Demo buyer')} (demo)",
                "match": score,
                "confirmed_demand": bool(requirement.get("confirmed")),
            }
        )
    matches.sort(key=lambda item: item["match"]["score"], reverse=True)
    return {"items": matches[:20], "weights": calculate_match({}, {})["weights"]}


@router.post("/matching/buyer")
def match_for_buyer(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    db = store()
    requirement = None
    if payload.get("requirement_id"):
        requirement = db.get("buyer_requirements", payload["requirement_id"])
    if not requirement:
        requirement = {
            "material_name": payload.get("material_name", ""),
            "quantity": payload.get("quantity", 0),
            "unit": payload.get("unit", "kg"),
            "required_quality": payload.get("required_quality", "ungraded"),
            "application": payload.get("application", ""),
            "location": payload.get("location", ""),
            "max_price": payload.get("max_price"),
        }
    rows = db.list("listings", status="active")
    if payload.get("material_filter"):
        needle = str(payload["material_filter"]).lower()
        rows = [r for r in rows if needle in r.get("material_name", "").lower()]
    if payload.get("location_filter"):
        needle = str(payload["location_filter"]).lower()
        rows = [r for r in rows if needle in r.get("location", "").lower()]
    if payload.get("max_price_filter"):
        rows = [r for r in rows if float(r.get("price", 0)) <= float(payload["max_price_filter"])]
    if payload.get("available_only"):
        rows = [r for r in rows if r.get("status") == "active"]
    matches = []
    for listing in rows:
        score = calculate_match(requirement, listing)
        seller = db.get("users", listing.get("seller_id"))
        profile = db.list("business_profiles", user_id=listing.get("seller_id"))
        matches.append(
            {
                "listing": listing,
                "supplier_name": profile[0].get("business_name") if profile else (seller or {}).get("full_name", ""),
                "match": score,
                "price": listing.get("price"),
                "status": listing.get("status"),
            }
        )
    matches.sort(key=lambda item: item["match"]["score"], reverse=True)
    return {"items": matches[:20], "requirement": requirement}


@router.get("/enquiries")
def list_enquiries(request: Request) -> dict[str, Any]:
    user = actor(request, "buyer")
    rows = [e for e in store().list("enquiries") if user.get("role") == "admin" or user["id"] in (e.get("buyer_id"), e.get("seller_id"))]
    for row in rows:
        row["buyer_name"] = _party_label(row.get("buyer_id"), "Demo buyer")
        row["seller_name"] = _party_label(row.get("seller_id"), "Demo seller")
    return {"items": rows}


@router.post("/enquiries", status_code=201)
def create_enquiry(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "seller", "admin")
    db = store()
    listing = _active_listing(payload.get("listing_id", ""))
    requirement = None
    if payload.get("requirement_id"):
        requirement = require_id(db.get("buyer_requirements", payload["requirement_id"]), "Requirement")
        if requirement.get("status") not in ("open", "matched", "confirmed"):
            raise HTTPException(status_code=409, detail="This requirement is no longer published.")
    message = str(payload.get("message", "")).strip()
    if not message:
        raise HTTPException(status_code=422, detail="Add a short enquiry message.")
    if requirement:
        # A seller may respond to a published requirement using one of their listings.
        buyer_id = requirement.get("buyer_id")
        seller_id = listing.get("seller_id")
    else:
        buyer_id = user["id"]
        seller_id = listing.get("seller_id")
    if buyer_id == seller_id and user.get("role") != "admin":
        raise HTTPException(status_code=422, detail="An enquiry needs a buyer and a seller on opposite sides.")
    if user["id"] not in (buyer_id, seller_id) and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="You are not a participant in this enquiry.")
    item = {
        "id": new_id("enq"),
        "listing_id": listing["id"],
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "requirement_id": requirement["id"] if requirement else None,
        "message": message,
        "status": "sent",
        "reply": None,
        "is_demo": False,
    }
    store().create("enquiries", item)
    message_out = (
        "Response recorded against the published requirement."
        if requirement else "Enquiry sent to the seller."
    )
    return {"item": item, "message": message_out}


@router.patch("/enquiries/{enquiry_id}")
def update_enquiry(enquiry_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    enquiry = require_id(store().get("enquiries", enquiry_id), "Enquiry")
    user = require_participant(request, enquiry, "seller", "buyer_id", "seller_id")
    db = store()
    patch: dict[str, Any] = {}
    if "reply" in payload:
        if user["id"] != enquiry.get("seller_id") and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only the seller can reply to an enquiry.")
        patch["reply"] = str(payload.get("reply") or "").strip()
        if patch["reply"] and "status" not in payload:
            patch["status"] = "replied"
    if "status" in payload:
        status = str(payload.get("status"))
        if status not in ("sent", "replied", "closed"):
            raise HTTPException(status_code=422, detail="Invalid enquiry status.")
        if status == "replied" and not (patch.get("reply") or enquiry.get("reply")):
            raise HTTPException(status_code=409, detail="An enquiry is marked replied only after a seller reply.")
        patch["status"] = status
    if not patch:
        return {"item": enquiry}
    return {"item": db.update("enquiries", enquiry_id, patch)}


@router.get("/offers")
def list_offers(request: Request, negotiation_id: str | None = None) -> dict[str, Any]:
    user = actor(request, "buyer")
    rows = store().list("offers")
    if user.get("role") != "admin":
        rows = [r for r in rows if user["id"] in (r.get("buyer_id"), r.get("seller_id"))]
    if negotiation_id:
        rows = [r for r in rows if r.get("negotiation_id") == negotiation_id]
    return {"items": rows}


@router.post("/offers", status_code=201)
def create_offer(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "admin")
    listing = _active_listing(payload.get("listing_id", ""))
    if listing.get("seller_id") == user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=422, detail="You cannot make an offer on your own listing.")
    db = store()
    negotiations = [
        n for n in db.list("negotiations", listing_id=listing["id"], buyer_id=user["id"])
        if n.get("status") == "in_progress"
    ]
    negotiation = negotiations[0] if negotiations else db.create(
        "negotiations",
        {
            "id": new_id("neg"),
            "listing_id": listing["id"],
            "buyer_id": user["id"],
            "seller_id": listing["seller_id"],
            "status": "in_progress",
            "is_demo": False,
        },
    )
    offer = {
        "id": new_id("ofr"),
        "negotiation_id": negotiation["id"],
        "listing_id": listing["id"],
        "buyer_id": user["id"],
        "seller_id": listing["seller_id"],
        "made_by": "buyer",
        "price": validate_positive(payload.get("price"), "Proposed price"),
        "quantity": validate_positive(payload.get("quantity", listing.get("quantity")), "Quantity"),
        "unit": payload.get("unit", listing.get("unit", "kg")),
        "delivery_location": str(payload.get("delivery_location", "")),
        "message": str(payload.get("message", "")),
        "status": "pending",
        "parent_offer_id": payload.get("parent_offer_id"),
        "is_demo": False,
    }
    db.create("offers", offer)
    return {"offer": offer, "negotiation": negotiation, "message": "Offer sent. The seller decides whether to accept or counter."}


def _counter_party(offer: dict[str, Any]) -> tuple[str, str]:
    if offer.get("made_by") == "seller":
        return "buyer", offer.get("buyer_id", "")
    return "seller", offer.get("seller_id", "")


@router.post("/offers/{offer_id}/counter", status_code=201)
def counter_offer(offer_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    offer = require_id(store().get("offers", offer_id), "Offer")
    _actionable_offer(offer)
    _active_listing(offer.get("listing_id", ""))
    role, expected_user = _counter_party(offer)
    user = actor(request, role)
    if user["id"] != expected_user and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the counter-party can counter this offer.")
    db = store()
    db.update("offers", offer_id, {"status": "countered"})
    counter = {
        "id": new_id("ofr"),
        "negotiation_id": offer["negotiation_id"],
        "listing_id": offer["listing_id"],
        "buyer_id": offer["buyer_id"],
        "seller_id": offer["seller_id"],
        "made_by": role,
        "price": validate_positive(payload.get("price"), "Counter price"),
        "quantity": validate_positive(payload.get("quantity", offer.get("quantity")), "Quantity"),
        "unit": offer.get("unit", "kg"),
        "delivery_location": str(payload.get("delivery_location", offer.get("delivery_location", ""))),
        "message": str(payload.get("message", "")),
        "status": "pending",
        "parent_offer_id": offer_id,
        "is_demo": False,
    }
    db.create("offers", counter)
    return {"offer": counter, "message": "Counteroffer sent. The other party decides."}


@router.post("/offers/{offer_id}/accept")
def accept_offer(offer_id: str, request: Request) -> dict[str, Any]:
    offer = require_id(store().get("offers", offer_id), "Offer")
    _actionable_offer(offer)
    _active_listing(offer.get("listing_id", ""))
    role, expected_user = _counter_party(offer)
    user = actor(request, role)
    if user["id"] != expected_user and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the counter-party can accept this offer.")
    db = store()
    db.update("offers", offer_id, {"status": "accepted"})
    # Countered offers remain in the thread as history; only competing open
    # offers are withdrawn when a decision is made.
    for other in db.list("offers", negotiation_id=offer["negotiation_id"]):
        if other["id"] != offer_id and other.get("status") == "pending":
            db.update("offers", other["id"], {"status": "withdrawn"})
    negotiation = db.update(
        "negotiations",
        offer["negotiation_id"],
        {
            "status": "agreed",
            "agreed_price": offer["price"],
            "agreed_quantity": offer["quantity"],
        },
    )
    return {
        "offer": db.get("offers", offer_id),
        "negotiation": negotiation,
        "message": "Price agreed. Create the order to lock the terms — payment is not automatic.",
    }


@router.post("/offers/{offer_id}/reject")
def reject_offer(offer_id: str, request: Request) -> dict[str, Any]:
    offer = require_id(store().get("offers", offer_id), "Offer")
    _actionable_offer(offer)
    _active_listing(offer.get("listing_id", ""))
    role, expected_user = _counter_party(offer)
    user = actor(request, role)
    if user["id"] != expected_user and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the counter-party can reject this offer.")
    db = store()
    db.update("offers", offer_id, {"status": "rejected"})
    # Countered offers remain in the thread as history; only competing open
    # offers are withdrawn when a decision is made.
    for other in db.list("offers", negotiation_id=offer["negotiation_id"]):
        if other["id"] != offer_id and other.get("status") == "pending":
            db.update("offers", other["id"], {"status": "withdrawn"})
    db.update("negotiations", offer["negotiation_id"], {"status": "closed"})
    return {"message": "Offer rejected. The buyer can send a new offer."}


@router.get("/negotiations")
def list_negotiations(request: Request) -> dict[str, Any]:
    user = actor(request, "buyer")
    rows = [n for n in store().list("negotiations") if user.get("role") == "admin" or user["id"] in (n.get("buyer_id"), n.get("seller_id"))]
    for row in rows:
        row["buyer_name"] = _party_label(row.get("buyer_id"), "Demo buyer")
        row["seller_name"] = _party_label(row.get("seller_id"), "Demo seller")
    return {"items": rows}


@router.get("/negotiations/{negotiation_id}")
def get_negotiation(negotiation_id: str, request: Request) -> dict[str, Any]:
    db = store()
    negotiation = require_id(db.get("negotiations", negotiation_id), "Negotiation")
    require_participant(request, negotiation, "buyer", "buyer_id", "seller_id")
    offers = [o for o in db.list("offers") if o.get("negotiation_id") == negotiation_id]
    offers.sort(key=lambda o: o.get("created_at", ""))
    listing = db.get("listings", negotiation.get("listing_id", ""))
    display = dict(negotiation)
    display["buyer_name"] = _party_label(negotiation.get("buyer_id"), "Demo buyer")
    display["seller_name"] = _party_label(negotiation.get("seller_id"), "Demo seller")
    return {"negotiation": display, "offers": offers, "listing": listing}


@router.post("/negotiations/{negotiation_id}/assist")
def negotiation_assist(negotiation_id: str, request: Request) -> dict[str, Any]:
    db = store()
    negotiation = require_id(db.get("negotiations", negotiation_id), "Negotiation")
    require_participant(request, negotiation, "buyer", "buyer_id", "seller_id")
    listing = db.get("listings", negotiation.get("listing_id", "")) or {}
    estimate = estimate_price(listing, db.list("listings", status="active"))
    reference = estimate.get("suggested_typical_per_kg")
    suggestion = suggest_offer(
        {
            "reference_price_per_unit": reference,
            "quantity": negotiation.get("agreed_quantity") or listing.get("quantity", 0),
        }
    )
    return {"suggestion": suggestion, "price_estimate": estimate}

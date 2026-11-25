"""Hybrid discovery: AI prospects, real business listings, published requirements."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any

from ..config import settings
from .ai import suggest_prospects
from .engines import canonical, coords_for, haversine_km

BUCKET_LABELS = {
    "ai_prospect": "AI-suggested prospect",
    "real_business_listing": "Real business listing – potential buyer/supplier",
    "published_requirement": "Published requirement",
}


def _places_search(query: str, origin: str | None = None) -> list[dict[str, Any]]:
    if not settings.places_configured:
        return []
    params = {"query": query, "key": settings.GOOGLE_PLACES_API_KEY}
    if origin:
        params["location"] = origin
        params["radius"] = "100000"
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
        rows = payload.get("results", [])
    except Exception as exc:  # pragma: no cover - requires live key
        print(f"[ReSource AI] Google Places unavailable ({exc}); using sample listings.")
        return []
    origin_coords = coords_for(origin) if origin else None
    output = []
    for row in rows[:10]:
        location = row.get("geometry", {}).get("location", {})
        lat, lng = location.get("lat"), location.get("lng")
        distance = None
        if origin_coords and lat is not None and lng is not None:
            distance = round(haversine_km(origin_coords, (float(lat), float(lng))) * 1.25, 1)
        output.append(
            {
                "source_type": "real_business_listing",
                "label": BUCKET_LABELS["real_business_listing"],
                "business_name": row.get("name", ""),
                "address": row.get("formatted_address", ""),
                "category": (row.get("types") or ["business"])[0].replace("_", " ").title(),
                "website": None,
                "distance_km": distance,
                "note": "Google Places listing. A listing does not prove that the business currently buys or sells this material.",
                "source": "Google Places API",
                "is_real_business": True,
                "is_confirmed_demand": False,
                "is_demo": False,
            }
        )
    return output


def discover(params: dict[str, Any], store: Any) -> dict[str, Any]:
    material = str(params.get("material") or params.get("material_name") or "").strip()
    location = str(params.get("location") or "").strip()
    query = str(params.get("query") or f"{material or 'by-product'} buyers {location}".strip())

    results: list[dict[str, Any]] = []

    def _buyer_label(user_id: str | None) -> str:
        if not user_id:
            return "Demo buyer"
        profile = next(iter(store.list("business_profiles", user_id=user_id)), None)
        if profile and profile.get("business_name"):
            return f"{profile['business_name']} (demo)"
        user = store.get("users", user_id) or {}
        return f"{user.get('full_name') or 'Demo buyer'} (demo)"

    # C. Published requirements from actual platform users.
    for requirement in store.list("buyer_requirements", status={"in": ["open", "matched", "confirmed"]}):
        req_name = canonical(requirement.get("material_name", ""))
        mat = canonical(material)
        related = bool(mat and req_name and (req_name == mat or mat in req_name or req_name in mat))
        if material and not related:
            continue
        confirmed = bool(requirement.get("confirmed"))
        results.append(
            {
                "source_type": "published_requirement",
                "label": "Published requirement",
                "demand_label": "Confirmed demand" if confirmed else "Published requirement (not yet confirmed)",
                "business_name": _buyer_label(requirement.get("buyer_id")),
                "address": requirement.get("location", ""),
                "category": requirement.get("application", "Buyer requirement"),
                "material": requirement.get("material_name", ""),
                "quantity": requirement.get("quantity"),
                "unit": requirement.get("unit"),
                "reference_id": requirement.get("id"),
                "note": (
                    "Buyer has confirmed this requirement."
                    if confirmed
                    else "Published by a platform user but not confirmed as current demand."
                ),
                "is_real_business": False,
                "is_confirmed_demand": confirmed,
                "is_demo": bool(requirement.get("is_demo")),
            }
        )

    # A. AI-suggested prospects — categories and search queries, never fake companies.
    analysis = params.get("analysis") or {}
    prospects = suggest_prospects(material, analysis)
    for prospect in prospects:
        results.append(
            {
                "source_type": "ai_prospect",
                "label": BUCKET_LABELS["ai_prospect"],
                "business_name": "",
                "category": prospect.get("category", ""),
                "search_query": prospect.get("search_query", ""),
                "note": prospect.get("note", ""),
                "is_real_business": False,
                "is_confirmed_demand": False,
                "is_demo": True,
            }
        )

    # B. Real business listings via Google Places, otherwise clearly-labelled samples.
    if settings.places_configured:
        results.extend(_places_search(query, location))
    else:
        samples = store.list("business_discovery_results", source_type="real_business_listing")
        mat = canonical(material)
        matching = [s for s in samples if mat and mat in canonical(s.get("material", ""))]
        for sample in matching or samples:
            results.append(
                {
                    "source_type": "real_business_listing",
                    "label": "Sample business data (demo) — not verified",
                    "business_name": sample.get("business_name", ""),
                    "address": sample.get("address", ""),
                    "category": sample.get("category", ""),
                    "website": sample.get("website"),
                    "distance_km": sample.get("distance_km"),
                    "note": sample.get("note", "Sample only."),
                    "source": "Sample data (Google Places not configured)",
                    "is_real_business": False,
                    "is_confirmed_demand": False,
                    "is_demo": True,
                }
            )

    buckets = {key: [r for r in results if r.get("source_type") == key] for key in BUCKET_LABELS}
    return {
        "query": query,
        "material": material,
        "location": location,
        "buckets": buckets,
        "results": results,
        "google_places_configured": settings.places_configured,
        "disclaimer": (
            "AI-suggested prospects are industry categories, not real companies. "
            "A real business listing does not prove current buying or selling intent. "
            "Only confirmed requirements represent stated demand."
        ),
    }

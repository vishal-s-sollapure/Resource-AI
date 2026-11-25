"""Transparent, testable business engines.

AI explains factors; these functions generate the actual numbers.
"""

from __future__ import annotations

import math
import re
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from ..config import settings

MATCH_WEIGHTS = settings.MATCH_WEIGHTS

MATERIAL_ALIASES: dict[str, set[str]] = {
    "coconut husk": {"coconut husk", "coco husk", "coir husk", "khopra"},
    "coconut coir": {"coconut coir", "coir fibre", "coir fiber", "coir"},
    "coco peat": {"coco peat", "coir pith", "cocopeat"},
    "sugarcane bagasse": {"sugarcane bagasse", "bagasse", "cane bagasse"},
    "bamboo waste": {"bamboo waste", "bamboo offcuts", "bamboo scrap", "bamboo"},
    "bamboo fibre": {"bamboo fibre", "bamboo fiber"},
    "jute fibre": {"jute fibre", "jute fiber", "jute", "golden fibre"},
    "rice husk": {"rice husk", "paddy husk", "rice hull"},
}

CITY_COORDS: dict[str, tuple[float, float]] = {
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "karnataka": (14.4672, 75.1257),
    "mumbai": (19.0760, 72.8777),
    "maharashtra": (19.7515, 75.7139),
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "chennai": (13.0827, 80.2707),
    "tamil nadu": (11.1271, 78.6569),
    "coimbatore": (11.0168, 76.9558),
    "kolkata": (22.5726, 88.3639),
    "west bengal": (23.8103, 85.2787),
    "guwahati": (26.1445, 91.7362),
    "assam": (26.2006, 92.9376),
    "lucknow": (26.8467, 80.9462),
    "uttar pradesh": (26.8467, 80.9462),
    "ludhiana": (30.9010, 75.8573),
    "punjab": (31.1471, 75.3412),
    "pune": (18.5204, 73.8567),
    "hyderabad": (17.3850, 78.4867),
    "telangana": (17.3850, 78.4867),
    "ahmedabad": (23.0225, 72.5714),
    "gujarat": (22.2587, 71.1924),
    "jaipur": (26.9124, 75.7873),
    "rajasthan": (27.0238, 74.2179),
    "bhopal": (23.2599, 77.4126),
    "madhya pradesh": (22.9734, 78.6569),
}

UNIT_KG = {"kg": 1.0, "tonne": 1000.0, "litre": 1.0, "piece": 1.0, "other": 1.0}
GRADE_RANK = {"A": 3, "B": 2, "C": 1, "ungraded": 0}
VEHICLES = (
    (500, "Mini truck (demo suggestion)", 18.0),
    (2000, "Mini truck / small pickup (demo suggestion)", 22.0),
    (5000, "Medium truck (demo suggestion)", 32.0),
    (float("inf"), "Heavy truck (demo suggestion)", 48.0),
)


def canonical(name: str | None) -> str:
    text = (name or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def to_kg(quantity: float, unit: str | None) -> float:
    return float(quantity or 0) * UNIT_KG.get(str(unit or "kg").lower(), 1.0)


def coords_for(location: str | None) -> Optional[tuple[float, float]]:
    text = canonical(location)
    for key, coords in CITY_COORDS.items():
        if re.search(rf"\b{re.escape(key)}\b", text):
            return coords
    return None


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def material_score(required: str, supplied: str, category: str | None = None) -> tuple[float, str]:
    req, sup = canonical(required), canonical(supplied)
    if not req or not sup:
        return 0.0, "Material information is missing."
    if req == sup:
        return 100.0, f"Exact material match: {supplied}."
    req_aliases = MATERIAL_ALIASES.get(req, {req})
    sup_aliases = MATERIAL_ALIASES.get(sup, {sup})
    if req_aliases & sup_aliases:
        return 96.0, f"Compatible material family: {required} ↔ {supplied}."
    req_tokens, sup_tokens = set(req.split()), set(sup.split())
    if req_tokens & sup_tokens:
        overlap = len(req_tokens & sup_tokens) / max(len(req_tokens | sup_tokens), 1)
        return round(45 + overlap * 45, 1), f"Partial material overlap: {required} ↔ {supplied}."
    if category and canonical(category) in req:
        return 70.0, f"Same material category ({category}) but different named material."
    return 15.0, f"Different material: {required} vs {supplied}."


def quantity_score(req_qty: float, req_unit: str, sup_qty: float, sup_unit: str) -> tuple[float, str]:
    need, have = to_kg(req_qty, req_unit), to_kg(sup_qty, sup_unit)
    if need <= 0:
        return 50.0, "Required quantity not specified."
    if have >= need:
        return 100.0, f"Supplier has enough ({have:,.0f} kg vs {need:,.0f} kg required)."
    ratio = have / need
    return round(max(0.0, ratio * 100), 1), f"Partial quantity coverage ({have:,.0f} kg of {need:,.0f} kg required)."


def location_score(req_loc: str, sup_loc: str) -> tuple[float, str]:
    req, sup = canonical(req_loc), canonical(sup_loc)
    if not req or not sup:
        return 50.0, "Location not specified for one party."
    if req in sup or sup in req:
        return 100.0, f"Same preferred region ({req_loc or sup_loc})."
    a, b = coords_for(req_loc), coords_for(sup_loc)
    if a and b:
        distance = haversine_km(a, b) * 1.25
        if distance < 50:
            return 95.0, f"Very close (~{distance:,.0f} km by road estimate)."
        if distance < 150:
            return 82.0, f"Nearby region (~{distance:,.0f} km by road estimate)."
        if distance < 400:
            return 62.0, f"Moderate distance (~{distance:,.0f} km by road estimate)."
        if distance < 800:
            return 42.0, f"Long distance (~{distance:,.0f} km by road estimate)."
        return 20.0, f"Far apart (~{distance:,.0f} km by road estimate); transport cost may be high."
    return 50.0, "Distance could not be estimated; verify logistics manually."


def quality_score(req_quality: str, sup_quality: str) -> tuple[float, str]:
    req = GRADE_RANK.get(str(req_quality or "ungraded"), None)
    sup = GRADE_RANK.get(str(sup_quality or "ungraded"), None)
    if req is None:
        req = GRADE_RANK.get(canonical(req_quality) or "ungraded", 0)
    if sup is None:
        sup = GRADE_RANK.get(canonical(sup_quality) or "ungraded", 0)
    if req == 0 or sup == 0:
        return 55.0, "Quality grade is ungraded or unknown; confirm specifications directly."
    diff = abs(req - sup)
    if diff == 0:
        return 100.0, f"Quality grades match ({sup_quality})."
    if diff == 1:
        return 75.0, f"Adjacent grade ({sup_quality} vs {req_quality}); may be workable."
    return 40.0, f"Quality gap ({sup_quality} vs {req_quality}); confirm suitability."


def calculate_match(
    requirement: dict[str, Any], listing: dict[str, Any], weights: dict[str, float] | None = None
) -> dict[str, Any]:
    """Weighted, explainable score: material 40 / quantity 25 / location 20 / quality 15."""
    w = weights or MATCH_WEIGHTS
    m_score, m_reason = material_score(
        requirement.get("material_name", ""), listing.get("material_name", ""), listing.get("category")
    )
    q_score, q_reason = quantity_score(
        requirement.get("quantity", 0),
        requirement.get("unit", "kg"),
        listing.get("quantity", 0),
        listing.get("unit", "kg"),
    )
    l_score, l_reason = location_score(requirement.get("location", ""), listing.get("location", ""))
    qual_score, qual_reason = quality_score(
        requirement.get("required_quality", requirement.get("quality_grade", "ungraded")),
        listing.get("quality_grade", "ungraded"),
    )
    factors = {
        "material": round(m_score, 1),
        "quantity": round(q_score, 1),
        "location": round(l_score, 1),
        "quality": round(qual_score, 1),
    }
    score = round(
        factors["material"] * w.get("material", 0.4)
        + factors["quantity"] * w.get("quantity", 0.25)
        + factors["location"] * w.get("location", 0.2)
        + factors["quality"] * w.get("quality", 0.15),
        1,
    )
    reasons = [m_reason, q_reason, l_reason, qual_reason]
    if score >= 80:
        summary = (
            "Strong match: material, quantity, quality and region are broadly compatible. "
            "Confirm specifications and price directly with the other party."
        )
    elif score >= 60:
        summary = "Moderate match: some factors align; check the weaker factors before transacting."
    else:
        summary = "Weak match: one or more important factors do not align."
    return {
        "score": score,
        "factors": factors,
        "weights": w,
        "reasons": reasons,
        "summary": summary,
        "note": "Match percentage is indicative only and does not guarantee a successful transaction.",
    }


def estimate_price(
    params: dict[str, Any],
    comparables: list[dict[str, Any]],
    transactions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Median-of-comparables estimator. Never invents a market price."""
    factors = [
        f"Material type: {params.get('material_name', 'unspecified')}",
        f"Form: {params.get('form', 'unspecified')}",
        f"Quality: {params.get('quality_grade', 'ungraded')}",
        f"Quantity: {params.get('quantity', 'unspecified')} {params.get('unit', '')}",
        f"Moisture: {params.get('moisture_content', 'unknown')}",
        f"Processing level: {params.get('processing_level', 'unspecified')}",
        f"Location: {params.get('location', 'unspecified')} (affects transport cost)",
    ]
    base = canonical(params.get("material_name", ""))
    aliases = MATERIAL_ALIASES.get(base, {base}) if base else set()
    category = canonical(params.get("category", ""))
    exclude_id = params.get("id")
    refs: list[dict[str, Any]] = []
    for row in list(comparables or []) + list(transactions or []):
        if row.get("id") == exclude_id:
            continue
        price = row.get("price") or row.get("agreed_price")
        if not price or float(price) <= 0:
            continue
        name = canonical(row.get("material_name", ""))
        row_cat = canonical(row.get("category", ""))
        if name in aliases or (name and (name in base or base in name)) or (category and row_cat == category):
            refs.append(row)

    per_kg_prices = [
        float(r.get("price") or r.get("agreed_price")) / UNIT_KG.get(str(r.get("unit", "kg")).lower(), 1.0)
        for r in refs
    ]
    if len(refs) < 3 or not per_kg_prices:
        return {
            "insufficient_data": True,
            "suggested_low": None,
            "suggested_typical": None,
            "suggested_high": None,
            "message": "Insufficient market data.",
            "factors": factors,
            "data_source": "No reliable comparable listings or completed transactions available",
            "confidence": "none",
            "comparable_count": len(refs),
            "is_demo_estimate": False,
            "seller_control": "Seller sets their own price; buyers can request a quotation and negotiate.",
        }

    median = statistics.median(per_kg_prices)
    low, high = median * 0.90, median * 1.15
    demo = all(bool(r.get("is_demo")) for r in refs)
    source = "Comparable platform listings"
    if any(r.get("agreed_price") for r in refs):
        source += " and completed transactions"
    if demo:
        source += " (demo estimates — not real market prices)"
    return {
        "insufficient_data": False,
        "suggested_low_per_kg": round(low, 2),
        "suggested_typical_per_kg": round(median, 2),
        "suggested_high_per_kg": round(high, 2),
        "suggested_low_per_tonne": round(low * 1000, 2),
        "suggested_typical_per_tonne": round(median * 1000, 2),
        "suggested_high_per_tonne": round(high * 1000, 2),
        "suggested_low": round(low, 2),
        "suggested_typical": round(median, 2),
        "suggested_high": round(high, 2),
        "unit": "INR per kg",
        "message": "Indicative range from comparable listings; not a market quote.",
        "factors": factors,
        "data_source": source,
        "confidence": "medium" if len(refs) >= 5 else "low",
        "comparable_count": len(refs),
        "is_demo_estimate": demo,
        "seller_control": "The seller always sets their own selling price.",
    }


def seller_fee(order_value: float) -> float:
    """Proposed seller service fee, charged after a confirmed order."""
    value = float(order_value or 0)
    if value <= 10000:
        return 499.0
    if value <= 20000:
        return 999.0
    if value <= 50000:
        return 1599.0
    return 2599.0


def advance_split(total_value: float) -> dict[str, float]:
    total = round(float(total_value or 0), 2)
    advance = round(total * 0.20, 2)
    return {"total": total, "advance": advance, "balance": round(total - advance, 2)}


def estimate_logistics(
    pickup: str,
    delivery: str,
    quantity_kg: float,
    vehicle_type: str | None = None,
    transporter_schedule: str | None = None,
) -> dict[str, Any]:
    """Indicative distance, vehicle, cost and delivery estimate — no GPS tracking."""
    a, b = coords_for(pickup), coords_for(delivery)
    distance = round(haversine_km(a, b) * 1.25, 1) if a and b else None
    chosen_vehicle = vehicle_type
    rate = None
    if not chosen_vehicle:
        for capacity, name, default_rate in VEHICLES:
            if float(quantity_kg or 0) <= capacity:
                chosen_vehicle, rate = name, default_rate
                break
    else:
        for _capacity, name, default_rate in VEHICLES:
            if chosen_vehicle.lower() in name.lower():
                rate = default_rate
                break
    cost = round(distance * rate, 2) if distance is not None and rate else None
    days = None
    eta = None
    if distance is not None:
        days = max(1, math.ceil(distance / (45 * 8)) + 1)
        eta = (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()
    return {
        "distance_km": distance,
        "distance_source": "Estimated from city coordinates (road factor 1.25)" if distance else "Unavailable",
        "vehicle_type": chosen_vehicle or "Vehicle type to be confirmed",
        "transport_cost": cost,
        "cost_source": "Indicative demo rate card" if cost else "Insufficient transport rate data",
        "loading_unloading_hours": 4,
        "estimated_transit_days": days,
        "estimated_delivery_date": transporter_schedule or eta,
        "transport_cost_available": cost is not None,
        "note": "Estimate only. ReSource AI does not own vehicles and does not provide real-time GPS tracking.",
    }

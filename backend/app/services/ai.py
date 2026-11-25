"""Gemini integration with a deterministic, clearly-labelled demo fallback.

Gemini is used only for interpretation and suggestions. Numerical estimates
come from transparent algorithms in ``engines.py``.
"""

from __future__ import annotations

import json
import re
import urllib.request
from typing import Any

from ..config import settings
from .engines import canonical, MATERIAL_ALIASES, MATERIAL_ALIASES as ALIASES

DISCLAIMER = (
    "Applications depend on material quality, contamination and processing. "
    "Not every quantity of a material can be converted into every suggested product. "
    "Verify suitability with the actual buyer before transacting."
)


def _gemini_json(prompt: str) -> dict[str, Any] | None:
    if not settings.gemini_configured:
        return None
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    try:
        request = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except Exception as exc:  # network / quota / parsing failures fall back safely
        print(f"[ReSource AI] Gemini unavailable ({exc}); using demo fallback.")
        return None


def find_knowledge(material_name: str, materials: list[dict[str, Any]]) -> dict[str, Any] | None:
    name = canonical(material_name)
    aliases = ALIASES.get(name, {name}) if name else set()
    for material in materials:
        kb_name = canonical(material.get("name", ""))
        if kb_name == name or kb_name in aliases:
            return material
        for alias in material.get("aliases", []) or []:
            if canonical(alias) in aliases or canonical(alias) in name:
                return material
    return None


def analyze_material(payload: dict[str, Any], materials: list[dict[str, Any]]) -> dict[str, Any]:
    name = str(payload.get("material_name") or payload.get("material") or "").strip()
    quantity = payload.get("quantity", "")
    unit = payload.get("unit", "")
    form = payload.get("form", "")
    quality = payload.get("quality_grade", "")
    kb = find_knowledge(name, materials)

    if settings.gemini_configured:
        prompt = f"""
You are a cautious industrial by-product analyst. Analyse the material below for a circular-economy marketplace.
Return ONLY valid JSON with this exact structure:
{{
  "material_identity": "string",
  "category": "string",
  "possible_applications": [{{"name": "string", "rationale": "string", "feasibility": "string"}}],
  "target_industries": ["string"],
  "potential_products": ["string"],
  "processing_requirements": ["string"],
  "quality_considerations": ["string"],
  "storage_handling": ["string"],
  "environmental_benefits": ["string"],
  "buyer_categories": ["string"],
  "search_queries": ["string"]
}}
Material: {name}
Quantity: {quantity} {unit}
Form: {form}
Quality: {quality}
Knowledge reference: {json.dumps(kb or {}, ensure_ascii=False)[:2500]}
Rules: suggest possibilities only, never claim commercial feasibility for every quality, never invent company names or market prices.
""".strip()
        result = _gemini_json(prompt)
        if result:
            for key in (
                "possible_applications",
                "target_industries",
                "potential_products",
                "processing_requirements",
                "quality_considerations",
                "storage_handling",
                "environmental_benefits",
                "buyer_categories",
                "search_queries",
            ):
                if not isinstance(result.get(key), list):
                    result[key] = []
            result.update(
                {
                    "source": "Gemini AI analysis",
                    "is_ai_generated": True,
                    "disclaimer": DISCLAIMER,
                    "quantity_context": f"{quantity} {unit}".strip() or "Not specified",
                    "material_identity": result.get("material_identity") or name,
                }
            )
            return result

    applications = [
        {"name": item, "rationale": "Suggested by the material knowledge hub.", "feasibility": "Depends on quality and processing"}
        for item in (kb or {}).get("applications", [])
    ]
    industries = list((kb or {}).get("buyer_industries", []))
    search_queries = [f"{name or 'by-product'} buyers India", f"{name or 'by-product'} manufacturers India"] if name else []
    return {
        "material_identity": name or "Unspecified material",
        "category": (kb or {}).get("category", "other"),
        "quantity_context": f"{quantity} {unit}".strip() or "Not specified",
        "possible_applications": applications,
        "target_industries": industries,
        "potential_products": list((kb or {}).get("possible_products", [])),
        "processing_requirements": list((kb or {}).get("processing_methods", [])),
        "quality_considerations": list((kb or {}).get("quality_requirements", [])),
        "storage_handling": list((kb or {}).get("storage_handling", [])),
        "environmental_benefits": list((kb or {}).get("environmental_considerations", [])),
        "buyer_categories": industries,
        "search_queries": search_queries,
        "source": "Knowledge-base rules (demo fallback) — Gemini not configured",
        "is_ai_generated": False,
        "disclaimer": DISCLAIMER
        + (" No knowledge-base entry was found for this material; verify with an expert." if not kb else ""),
    }


def extract_requirements(text: str) -> dict[str, Any]:
    raw = str(text or "").strip()
    result: dict[str, Any] = {
        "material_name": "",
        "quantity": None,
        "unit": "kg",
        "required_quality": "ungraded",
        "application": "",
        "location": "",
        "max_price": None,
        "delivery_date": None,
        "alternatives_allowed": False,
        "confidence": "low",
    }
    if not raw:
        return {**result, "source": "Rule-based extraction (demo fallback)", "is_ai_generated": False}

    # Gemini first when configured; deterministic parsing remains the editable baseline.
    if settings.gemini_configured:
        prompt = f"""
Extract structured fields from this buyer request. Return ONLY JSON:
{{"material_name":"","quantity":0,"unit":"kg|tonne|litre|piece","required_quality":"A|B|C|ungraded","application":"","location":"","max_price":null,"delivery_date":null,"alternatives_allowed":false}}
Request: {raw}
Do not invent values that are absent. Use null or empty strings when unknown.
""".strip()
        ai = _gemini_json(prompt)
        if ai:
            for key in result:
                if key in ai and key != "confidence":
                    result[key] = ai[key]
            result["source"] = "Gemini AI extraction"
            result["is_ai_generated"] = True
            result["confidence"] = "high"
            result["raw_input"] = raw
            return result

    lowered = raw.lower()
    qty_match = re.search(
        r"(\d+(?:\.\d+)?)\s*(tonnes?|tons?|t\b|kilograms?|kgs?|quintals?)", lowered
    )
    if qty_match:
        number = float(qty_match.group(1))
        word = qty_match.group(2)
        if word.startswith("t") or word == "ton":
            result["quantity"], result["unit"] = number, "tonne"
        elif word.startswith("quintal"):
            result["quantity"], result["unit"] = number * 100, "kg"
        else:
            result["quantity"], result["unit"] = number, "kg"

    material_keywords = {
        "coconut husk": "Coconut husk", "coconut coir": "Coconut coir", "coco peat": "Coco peat",
        "sugarcane bagasse": "Sugarcane bagasse", "bagasse": "Sugarcane bagasse",
        "bamboo fibre": "Bamboo fibre", "bamboo": "Bamboo waste",
        "jute fibre": "Jute fibre", "jute": "Jute fibre", "rice husk": "Rice husk",
        "coir": "Coconut coir",
    }
    for keyword in sorted(material_keywords, key=len, reverse=True):
        if keyword in lowered:
            result["material_name"] = material_keywords[keyword]
            break

    from .engines import CITY_COORDS

    locations = sorted(set(CITY_COORDS.keys()) | {"karnataka", "maharashtra", "tamil nadu"}, key=len, reverse=True)
    for place in locations:
        if re.search(rf"\b{re.escape(place)}\b", lowered):
            result["location"] = place.title()
            break

    for word in ("raw", "dried", "processed", "graded"):
        if word in lowered:
            result["required_quality"] = "ungraded" if word == "graded" else word
            break
    match = re.search(r"grade\s*([abc])", lowered)
    if match:
        result["required_quality"] = match.group(1).upper()

    app_match = re.search(r"\bfor\s+(.+?)(?:\s+in\s+|\s+near\s+|[.!,;]|$)", lowered)
    if app_match:
        application = app_match.group(1).strip()
        result["application"] = application[:1].upper() + application[1:] if application else ""

    price_match = re.search(r"(?:under|below|budget|max(?:imum)?)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)", lowered)
    if price_match:
        result["max_price"] = float(price_match.group(1))

    if any(kw in lowered for kw in ("alternative", "or similar", "instead", "substitute")):
        result["alternatives_allowed"] = True

    found = sum(
        1
        for key in ("material_name", "quantity", "location", "application")
        if result.get(key) not in (None, "", 0)
    )
    result["confidence"] = "high" if found >= 4 else "medium" if found >= 2 else "low"
    result["source"] = "Rule-based extraction (demo fallback) — Gemini not configured"
    result["is_ai_generated"] = False
    result["raw_input"] = raw
    return result


def suggest_prospects(material: str, analysis: dict[str, Any]) -> list[dict[str, Any]]:
    categories = list(analysis.get("target_industries") or [])
    queries = list(analysis.get("search_queries") or [])
    if settings.gemini_configured and categories:
        prompt = f"""
Suggest 3 broad buyer industry categories and 3 Google search queries for a seller of {material}.
Return ONLY JSON: {{"categories":["industry category — not a company"],"queries":["search query"]}}.
Never invent company names.
""".strip()
        ai = _gemini_json(prompt)
        if ai:
            categories = [str(c) for c in ai.get("categories", [])] or categories
            queries = [str(q) for q in ai.get("queries", [])] or queries
    result = []
    for index, category in enumerate(categories[:5]):
        result.append(
            {
                "category": category,
                "search_query": queries[index] if index < len(queries) else f"{material or 'by-product'} buyers India",
                "label": "AI-suggested prospect",
                "source_type": "ai_prospect",
                "note": "Industry category suggestion only — not a real company and not confirmed demand.",
            }
        )
    return result


def suggest_offer(context: dict[str, Any]) -> dict[str, Any]:
    reference = context.get("reference_price_per_unit")
    qty = float(context.get("quantity") or 0)
    if reference:
        suggested = round(float(reference) * 0.92, 2)
        total = round(suggested * qty, 2)
        return {
            "suggested_price_per_unit": suggested,
            "suggested_total": total,
            "rationale": (
                "Suggestion is 8% below the indicative comparable reference, adjusted for quantity and "
                "transport considerations. The buyer and seller decide the final price."
            ),
            "source": "AI-assisted suggestion from available price references" if settings.gemini_configured
            else "Rule-based suggestion from available price references (demo fallback)",
            "note": "AI never accepts or rejects an offer automatically.",
        }
    return {
        "suggested_price_per_unit": None,
        "suggested_total": None,
        "rationale": "Insufficient market data for an offer suggestion. Request a quotation and negotiate directly.",
        "source": "No reliable price references",
        "note": "AI never accepts or rejects an offer automatically.",
    }

"""Pre-flight checks for a live ReSource AI hackathon demo.

Run with both dev servers started:

    python scripts/demo_preflight.py --reset

The script only uses public/demo credentials and never reads API keys.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DEMO_ACCOUNTS = {
    "seller": "seller@demo.resourceai.in",
    "buyer": "buyer@demo.resourceai.in",
    "both": "both@demo.resourceai.in",
    "admin": "admin@demo.resourceai.in",
}
DEMO_PASSWORD = "demo123"


class CheckError(RuntimeError):
    pass


def api_request(
    base: str,
    method: str,
    path: str,
    *,
    data: dict[str, Any] | None = None,
    token: str | None = None,
) -> tuple[int, Any]:
    headers = {"Accept": "application/json"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{base}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail).get("detail", detail)
        except (ValueError, AttributeError):
            pass
        return exc.code, detail
    except (urllib.error.URLError, TimeoutError) as exc:
        raise CheckError(f"Cannot reach {base}{path}: {exc}") from exc


def page_status(base: str, path: str) -> int:
    request = urllib.request.Request(f"{base}{path}", method="GET")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except (urllib.error.URLError, TimeoutError) as exc:
        raise CheckError(f"Cannot reach frontend {base}{path}: {exc}") from exc


def expect(condition: bool, label: str) -> None:
    if not condition:
        raise CheckError(label)


def safe(value: Any) -> str:
    """Keep pre-flight output readable on Windows consoles with cp1252 encoding."""
    return str(value).replace("—", "-").replace("–", "-").encode("ascii", errors="replace").decode("ascii")


def run_checks(api_base: str, frontend_base: str, reset: bool, skip_frontend: bool) -> None:
    api_base = api_base.rstrip("/")
    frontend_base = frontend_base.rstrip("/")

    status, health = api_request(api_base, "GET", "/api/health")
    expect(status == 200, f"Health check failed ({status}): {health}")
    expect(health.get("status") == "ok", f"Backend status is not ok: {health}")
    print(f"PASS backend health: {health['storage']}, gemini={health['gemini']}, places={health['google_places']}")

    tokens: dict[str, str] = {}
    for name, email in DEMO_ACCOUNTS.items():
        status, result = api_request(
            api_base, "POST", "/api/auth/login",
            data={"email": email, "password": DEMO_PASSWORD},
        )
        expect(status == 200 and result.get("token"), f"Demo login failed for {name} ({status}): {result}")
        tokens[name] = result["token"]
    print("PASS demo accounts: seller, buyer, both, admin")

    if reset:
        status, result = api_request(api_base, "POST", "/api/demo/reset", token=tokens["admin"])
        expect(status == 200, f"Demo reset failed ({status}): {result}")
        print("PASS demo data reset to seeded state")

    status, result = api_request(api_base, "GET", "/api/listings?status=active")
    expect(status == 200, f"Listings request failed ({status}): {result}")
    coconut = next((item for item in result["items"] if item.get("id") == "lst_coconut"), None)
    expect(coconut is not None, "Active 500 kg coconut husk listing is missing")
    expect(coconut.get("quantity") == 500 and coconut.get("unit") == "kg", "Coconut husk listing quantity is not 500 kg")
    expect(coconut.get("status") == "active", "Coconut husk listing is not active")
    print("PASS demo listing: 500 kg coconut husk is active")

    status, result = api_request(api_base, "GET", "/api/requirements")
    expect(status == 200, f"Requirements request failed ({status}): {result}")
    requirement = next((item for item in result["items"] if item.get("id") == "req_coconut"), None)
    expect(requirement is not None, "Confirmed coconut husk buyer requirement is missing")
    expect(requirement.get("confirmed") is True, "Coconut husk requirement is not marked confirmed")
    print("PASS demo requirement: confirmed coconut husk demand is available")

    analysis_payload = {
        "material_name": "Coconut husk",
        "quantity": 500,
        "unit": "kg",
        "location": "Bengaluru, Karnataka",
        "quality_grade": "B",
    }
    status, result = api_request(
        api_base, "POST", "/api/materials/analyze",
        data=analysis_payload, token=tokens["seller"],
    )
    expect(status == 200, f"Material analysis failed ({status}): {result}")
    analysis = result["analysis"]
    expect(bool(analysis.get("possible_applications")), "Material analysis returned no applications")
    expect(bool(analysis.get("disclaimer")), "Material analysis has no disclaimer")
    expect(bool(analysis.get("source")), "Material analysis has no source label")
    print(f"PASS AI fallback ready: {safe(analysis['source'])}")

    status, result = api_request(
        api_base, "POST", "/api/requirements/extract",
        data={"text": "I need 500 kg of raw coconut husk in Karnataka for coco peat production."},
        token=tokens["buyer"],
    )
    expect(status == 200, f"Requirement extraction failed ({status}): {result}")
    fields = result["fields"]
    expect(fields.get("material_name") == "Coconut husk", "Extraction did not identify coconut husk")
    expect(fields.get("quantity") == 500, "Extraction did not identify 500 kg")
    print(f"PASS extraction fallback ready: {safe(fields['source'])}")

    status, result = api_request(
        api_base, "POST", "/api/pricing/estimate",
        data={**analysis_payload, "id": "preflight"}, token=tokens["seller"],
    )
    expect(status == 200, f"Price estimate failed ({status}): {result}")
    expect("estimate" in result, "Price estimate response has no estimate")
    print("PASS indicative pricing endpoint responds")

    status, result = api_request(
        api_base, "POST", "/api/pricing/estimate",
        data={"material_name": "Unobtainium offcuts", "quantity": 1, "unit": "kg", "id": "preflight-unknown"},
        token=tokens["seller"],
    )
    expect(status == 200, f"Insufficient-data pricing check failed ({status}): {result}")
    expect(result["estimate"].get("insufficient_data") is True, "Unknown material did not return insufficient data")
    expect(result["estimate"].get("message") == "Insufficient market data.", "Insufficient-data message is missing")
    print("PASS pricing safety fallback: Insufficient market data.")

    status, result = api_request(
        api_base, "POST", "/api/negotiations/neg_1/assist", token=tokens["seller"]
    )
    expect(status == 200, f"Offer assistance failed ({status}): {result}")
    expect(bool(result.get("suggestion", {}).get("note")), "Offer assistance returned no explanatory note")
    print(f"PASS offer-assistance fallback ready: {safe(result['suggestion']['source'])}")

    status, result = api_request(
        api_base, "POST", "/api/discovery/search",
        data={"material": "Coconut husk", "location": "Bengaluru, Karnataka"},
        token=tokens["seller"],
    )
    expect(status == 200, f"Discovery failed ({status}): {result}")
    expect(set(result.get("buckets", {})) == {
        "ai_prospect", "real_business_listing", "published_requirement"
    }, "Discovery result buckets are incomplete")
    print("PASS discovery buckets: AI prospects, business listings, published requirements")

    status, result = api_request(
        api_base, "POST", "/api/matching/buyer",
        data=analysis_payload, token=tokens["buyer"],
    )
    expect(status == 200, f"Buyer matching failed ({status}): {result}")
    expect(any(item.get("listing", {}).get("id") == "lst_coconut" for item in result["items"]),
           "Buyer matching did not find the coconut husk listing")
    print("PASS weighted matching finds the demo listing")

    status, result = api_request(api_base, "GET", "/api/orders/ord_4", token=tokens["buyer"])
    expect(status == 200, f"Walkthrough order request failed ({status}): {result}")
    order = result["order"]
    expect(order.get("buyer_id") == "usr_buyer" and order.get("seller_id") == "usr_seller",
           "Walkthrough order has unexpected participants")
    expect(order.get("quantity") == 500 and order.get("unit") == "kg",
           "Walkthrough order is not for 500 kg")
    print(f"PASS walkthrough order ord_4: {order['status']}")

    if not skip_frontend:
        for path in ("/", "/find-buyers", "/find-materials", "/orders/ord_4"):
            code = page_status(frontend_base, path)
            expect(code == 200, f"Frontend route {path} returned {code}")
        print("PASS frontend routes: /, /find-buyers, /find-materials, /orders/ord_4")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="Restore the seeded demo dataset first")
    parser.add_argument("--api-base", default=os.getenv("API_BASE", "http://localhost:8000"))
    parser.add_argument("--frontend-base", default=os.getenv("FRONTEND_BASE", "http://localhost:5173"))
    parser.add_argument("--skip-frontend", action="store_true", help="Check the API only")
    args = parser.parse_args()

    try:
        run_checks(args.api_base, args.frontend_base, args.reset, args.skip_frontend)
    except CheckError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    print("ALL DEMO PRE-FLIGHT CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

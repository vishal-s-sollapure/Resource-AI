"""Smoke coverage for every documented API operation."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.store import get_store


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_every_documented_endpoint_responds():
    client = TestClient(app)
    get_store().reset()
    touched: set[tuple[str, str]] = set()

    def call(method: str, template: str, url: str, *, headers=None, json=None, allowed=(200,)):
        response = client.request(method, url, headers=headers, json=json)
        touched.add((method.upper(), template))
        assert response.status_code in allowed, (
            f"{method.upper()} {template} -> {response.status_code}: {response.text}"
        )
        return response.json()

    try:
        admin = _headers(call(
            "POST", "/api/auth/login", "/api/auth/login",
            json={"email": "admin@demo.resourceai.in", "password": "demo123"},
        )["token"])
        call("POST", "/api/demo/reset", "/api/demo/reset", headers=admin)
        assert call("GET", "/", "/")["name"] == "ReSource AI"
        health = call("GET", "/api/health", "/api/health")
        assert health["status"] == "ok"

        registered = call(
            "POST", "/api/auth/register", "/api/auth/register",
            json={"email": "surface@demo.resourceai.in", "password": "demo123", "full_name": "Surface Tester", "role": "buyer"},
        )
        new_user_token = registered["token"]
        call("POST", "/api/auth/login", "/api/auth/login", json={"email": "surface@demo.resourceai.in", "password": "demo123"})
        call("GET", "/api/auth/me", "/api/auth/me", headers=_headers(new_user_token))
        call("POST", "/api/auth/logout", "/api/auth/logout")

        def login(email: str) -> str:
            return call("POST", "/api/auth/login", "/api/auth/login", json={"email": email, "password": "demo123"})["token"]

        seller = _headers(login("seller@demo.resourceai.in"))
        buyer = _headers(login("buyer@demo.resourceai.in"))

        call("GET", "/api/profile", "/api/profile", headers=seller)
        call(
            "PUT", "/api/profile", "/api/profile", headers=seller,
            json={"full_name": "Ananya Rao", "phone": "+91 90000 00001", "business_name": "GreenLoop Agro Byproducts"},
        )

        call("GET", "/api/buyers", "/api/buyers")
        call("GET", "/api/materials", "/api/materials")
        call("GET", "/api/materials/{material_id}", "/api/materials/mat_coconut")

        listing = call(
            "POST", "/api/listings", "/api/listings", headers=seller, allowed=(201,),
            json={"material_name": "Coconut husk", "quantity": 300, "unit": "kg", "location": "Bengaluru", "price": 9},
        )["item"]
        call("GET", "/api/listings", "/api/listings")
        call("GET", "/api/listings/mine", "/api/listings/mine", headers=seller)
        call("GET", "/api/listings/{listing_id}", f"/api/listings/{listing['id']}", headers=seller)
        call("PUT", "/api/listings/{listing_id}", f"/api/listings/{listing['id']}", headers=seller, json={"price": 9.5})
        call("PATCH", "/api/listings/{listing_id}/status", f"/api/listings/{listing['id']}/status", headers=seller, json={"status": "paused"})
        call("PATCH", "/api/listings/{listing_id}/status", f"/api/listings/{listing['id']}/status", headers=seller, json={"status": "active"})
        call("DELETE", "/api/listings/{listing_id}", f"/api/listings/{listing['id']}", headers=seller)

        requirement = call(
            "POST", "/api/requirements", "/api/requirements", headers=buyer, allowed=(201,),
            json={"material_name": "Coconut husk", "quantity": 100, "unit": "kg", "location": "Karnataka"},
        )["item"]
        call("GET", "/api/requirements", "/api/requirements")
        call("GET", "/api/requirements/mine", "/api/requirements/mine", headers=buyer)
        call("GET", "/api/requirements/{requirement_id}", f"/api/requirements/{requirement['id']}")
        call("PUT", "/api/requirements/{requirement_id}", f"/api/requirements/{requirement['id']}", headers=buyer, json={"quantity": 120})
        call("PATCH", "/api/requirements/{requirement_id}/confirm", f"/api/requirements/{requirement['id']}/confirm", headers=buyer)
        call("DELETE", "/api/requirements/{requirement_id}", f"/api/requirements/{requirement['id']}", headers=buyer)

        call(
            "POST", "/api/passports", "/api/passports", headers=seller, allowed=(201,),
            json={"material_name": "Coconut husk", "quantity": "300 kg", "source": "Demo farm"},
        )
        call("GET", "/api/passports", "/api/passports", headers=seller)

        call("GET", "/api/subscription", "/api/subscription", headers=buyer)
        call("POST", "/api/subscription/upgrade", "/api/subscription/upgrade", headers=buyer)
        call("POST", "/api/subscription/downgrade", "/api/subscription/downgrade", headers=buyer)

        call("POST", "/api/materials/analyze", "/api/materials/analyze", headers=buyer, json={"material_name": "Coconut husk"})
        call("POST", "/api/requirements/extract", "/api/requirements/extract", headers=buyer, json={"text": "Need 500 kg coconut husk in Karnataka"})
        call("POST", "/api/pricing/estimate", "/api/pricing/estimate", headers=buyer, json={"material_name": "Coconut husk", "quantity": 500, "unit": "kg", "id": "surface"})
        call("POST", "/api/discovery/search", "/api/discovery/search", headers=buyer, json={"material": "Coconut husk", "location": "Karnataka"})
        call("POST", "/api/matching/seller", "/api/matching/seller", headers=seller, json={"material_name": "Coconut husk", "quantity": 500, "unit": "kg", "location": "Bengaluru", "quality_grade": "B", "price": 9})
        call("POST", "/api/matching/buyer", "/api/matching/buyer", headers=buyer, json={"material_name": "Coconut husk", "quantity": 500, "unit": "kg", "location": "Karnataka"})

        enquiry = call(
            "POST", "/api/enquiries", "/api/enquiries", headers=buyer, allowed=(201,),
            json={"listing_id": "lst_coconut", "message": "Please quote."},
        )["item"]
        call("GET", "/api/enquiries", "/api/enquiries", headers=buyer)
        call("PATCH", "/api/enquiries/{enquiry_id}", f"/api/enquiries/{enquiry['id']}", headers=seller, json={"status": "replied", "reply": "Quoted."})

        offer = call(
            "POST", "/api/offers", "/api/offers", headers=buyer, allowed=(201,),
            json={"listing_id": "lst_coconut", "price": 9, "quantity": 500, "delivery_location": "Pune"},
        )
        negotiation_id = offer["negotiation"]["id"]
        counter = call(
            "POST", "/api/offers/{offer_id}/counter", f"/api/offers/{offer['offer']['id']}/counter",
            headers=seller, allowed=(201,), json={"price": 9.5, "quantity": 500},
        )["offer"]
        call("POST", "/api/offers/{offer_id}/accept", f"/api/offers/{counter['id']}/accept", headers=buyer)
        reject_offer = call(
            "POST", "/api/offers", "/api/offers", headers=buyer, allowed=(201,),
            json={"listing_id": "lst_bagasse", "price": 4, "quantity": 100},
        )["offer"]
        call("POST", "/api/offers/{offer_id}/reject", f"/api/offers/{reject_offer['id']}/reject", headers=seller)
        call("GET", "/api/offers", "/api/offers", headers=buyer)
        call("GET", "/api/negotiations", "/api/negotiations", headers=buyer)
        call("GET", "/api/negotiations/{negotiation_id}", f"/api/negotiations/{negotiation_id}", headers=buyer)
        call("POST", "/api/negotiations/{negotiation_id}/assist", f"/api/negotiations/{negotiation_id}/assist", headers=buyer)

        call("GET", "/api/fee-policy", "/api/fee-policy")
        call("GET", "/api/logistics/estimate", "/api/logistics/estimate?pickup=Bengaluru&delivery=Pune&quantity=500")

        order = call(
            "POST", "/api/orders", "/api/orders", headers=buyer, allowed=(201,),
            json={"listing_id": "lst_coconut", "negotiation_id": negotiation_id, "agreed_price": 9.5, "quantity": 500, "delivery_location": "Pune"},
        )["order"]
        call("GET", "/api/orders", "/api/orders", headers=buyer)
        call("GET", "/api/orders/{order_id}", f"/api/orders/{order['id']}", headers=buyer)
        call("POST", "/api/orders/{order_id}/accept", f"/api/orders/{order['id']}/accept", headers=seller)
        call("GET", "/api/orders/{order_id}/bank-details", f"/api/orders/{order['id']}/bank-details", headers=buyer)
        call("POST", "/api/orders/{order_id}/submit-utr", f"/api/orders/{order['id']}/submit-utr", headers=buyer, json={"utr": "SURFUTR123", "type": "advance"})
        call("POST", "/api/orders/{order_id}/confirm-advance", f"/api/orders/{order['id']}/confirm-advance", headers=seller, json={"confirmed": True})
        call("POST", "/api/orders/{order_id}/submit-utr", f"/api/orders/{order['id']}/submit-utr", headers=buyer, json={"utr": "SURFBAL123", "type": "balance"})
        call("POST", "/api/orders/{order_id}/confirm-balance", f"/api/orders/{order['id']}/confirm-balance", headers=seller)
        call("POST", "/api/orders/{order_id}/transport", f"/api/orders/{order['id']}/transport", headers=buyer, json={"agreed": True, "vehicle_type": "Mini truck"})
        call("POST", "/api/orders/{order_id}/shipment-status", f"/api/orders/{order['id']}/shipment-status", headers=seller, json={"status": "preparing_material"})

        seller_proposed = call(
            "POST", "/api/orders", "/api/orders", headers=seller, allowed=(201,),
            json={"listing_id": "lst_coconut", "buyer_id": "usr_buyer", "quantity": 100, "delivery_location": "Pune"},
        )["order"]
        call("POST", "/api/orders/{order_id}/buyer-accept", f"/api/orders/{seller_proposed['id']}/buyer-accept", headers=buyer)

        cancel_order = call(
            "POST", "/api/orders", "/api/orders", headers=buyer, allowed=(201,),
            json={"listing_id": "lst_bagasse", "agreed_price": 4.5, "quantity": 100},
        )["order"]
        call("POST", "/api/orders/{order_id}/accept", f"/api/orders/{cancel_order['id']}/accept", headers=seller)
        call("POST", "/api/orders/{order_id}/submit-utr", f"/api/orders/{cancel_order['id']}/submit-utr", headers=buyer, json={"utr": "SURFCANCEL123", "type": "advance"})
        call("POST", "/api/orders/{order_id}/cancel", f"/api/orders/{cancel_order['id']}/cancel", headers=buyer, json={"reason": "Demo cancellation"})
        refund = call(
            "POST", "/api/orders/{order_id}/refund-request", f"/api/orders/{cancel_order['id']}/refund-request",
            headers=buyer, json={"amount": 90, "reason": "Demo refund", "order_stage": "After acceptance but before preparation"},
        )["refund"]
        call("GET", "/api/refunds", "/api/refunds", headers=buyer)
        call("PATCH", "/api/refunds/{refund_id}", f"/api/refunds/{refund['id']}", headers=seller, json={"status": "approved", "seller_response": "Approved in demo."})

        call("GET", "/api/transporters", "/api/transporters")
        call(
            "POST", "/api/transporters", "/api/transporters", headers=seller, allowed=(201,),
            json={"name": "Surface Transporter", "vehicle_type": "Mini truck", "capacity_kg": 2000, "location": "Bengaluru"},
        )
        call("GET", "/api/admin/overview", "/api/admin/overview", headers=admin)

        documented = {(method.upper(), path) for path, operations in app.openapi()["paths"].items() for method in operations}
        missing = documented - touched
        assert not missing, f"Untested API operations: {sorted(missing)}"
    finally:
        get_store().reset()

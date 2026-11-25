"""End-to-end smoke test for the full coconut-husk demo workflow."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.store import get_store


def _token(client: TestClient, email: str) -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": "demo123"})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _ok(response, expected: int = 200):
    assert response.status_code == expected, f"{response.status_code}: {response.text}"
    return response.json()


def test_coconut_husk_workflow_from_analysis_to_delivery():
    client = TestClient(app)
    get_store().reset()
    try:
        health = _ok(client.get("/api/health"))
        assert health["storage"] == "demo-json"
        demo_ai = health["gemini"] == "demo-fallback"

        seller = _headers(_token(client, "seller@demo.resourceai.in"))
        buyer = _headers(_token(client, "buyer@demo.resourceai.in"))
        admin = _headers(_token(client, "admin@demo.resourceai.in"))

        # 1. Material analysis and requirement extraction.
        analysis = _ok(client.post(
            "/api/materials/analyze",
            headers=buyer,
            json={"material_name": "Coconut husk", "quantity": 500, "unit": "kg"},
        ))["analysis"]
        assert analysis["material_identity"] == "Coconut husk"
        assert analysis["possible_applications"]
        assert analysis["disclaimer"]
        if demo_ai:
            assert analysis["is_ai_generated"] is False

        fields = _ok(client.post(
            "/api/requirements/extract",
            headers=buyer,
            json={"text": "I need 500 kg of raw coconut husk in Karnataka for coco peat production."},
        ))["fields"]
        assert fields["material_name"] == "Coconut husk"
        assert fields["quantity"] == 500
        assert fields["application"] == "Coco peat production"

        # 2. Pricing refuses to invent prices when there are no comparables.
        unknown = _ok(client.post(
            "/api/pricing/estimate",
            headers=buyer,
            json={"material_name": "Unobtainium offcuts", "quantity": 1, "unit": "kg", "id": "unknown"},
        ))["estimate"]
        assert unknown["insufficient_data"] is True
        assert unknown["message"] == "Insufficient market data."

        # 3. Hybrid discovery keeps result types separate.
        discovery = _ok(client.post(
            "/api/discovery/search",
            headers=buyer,
            json={"material": "Coconut husk", "location": "Bengaluru, Karnataka"},
        ))
        assert set(discovery["buckets"]) == {
            "ai_prospect", "real_business_listing", "published_requirement"
        }
        assert discovery["disclaimer"]

        # 4. Buyer matching finds the seeded coconut-husk listing.
        matches = _ok(client.post(
            "/api/matching/buyer",
            headers=buyer,
            json={
                "material_name": "Coconut husk",
                "quantity": 500,
                "unit": "kg",
                "required_quality": "B",
                "location": "Karnataka",
            },
        ))["items"]
        assert matches
        listing = next(m["listing"] for m in matches if m["listing"]["id"] == "lst_coconut")
        assert listing["seller_id"] == "usr_seller"

        # 5. Enquiry, offer, seller counteroffer and buyer acceptance.
        enquiry = _ok(client.post(
            "/api/enquiries",
            headers=buyer,
            json={"listing_id": listing["id"], "message": "Please quote for 500 kg of sun-dried husk."},
        ), 201)["item"]
        assert enquiry["buyer_id"] == "usr_buyer" and enquiry["seller_id"] == "usr_seller"

        offer = _ok(client.post(
            "/api/offers",
            headers=buyer,
            json={"listing_id": listing["id"], "price": 9, "quantity": 500, "delivery_location": "Mumbai"},
        ), 201)
        negotiation_id = offer["negotiation"]["id"]
        assert offer["offer"]["status"] == "pending"

        counter = _ok(client.post(
            f"/api/offers/{offer['offer']['id']}/counter",
            headers=seller,
            json={"price": 9.5, "quantity": 500, "delivery_location": "Mumbai"},
        ), 201)["offer"]
        assert counter["made_by"] == "seller"

        accepted = _ok(client.post(f"/api/offers/{counter['id']}/accept", headers=buyer))
        assert accepted["negotiation"]["status"] == "agreed"
        assert accepted["negotiation"]["agreed_price"] == 9.5

        thread = _ok(client.get(f"/api/negotiations/{negotiation_id}", headers=buyer))
        assert [o["id"] for o in thread["offers"]] == [offer["offer"]["id"], counter["id"]]
        assert thread["offers"][0]["status"] == "countered"
        assert thread["offers"][1]["status"] == "accepted"

        assistance = _ok(client.post(f"/api/negotiations/{negotiation_id}/assist", headers=buyer))
        assert "suggested_price_per_unit" in assistance["suggestion"]
        assert assistance["suggestion"]["note"]

        # 6. Order creation; no payment status is trusted before seller action.
        order = _ok(client.post(
            "/api/orders",
            headers=buyer,
            json={
                "listing_id": listing["id"],
                "negotiation_id": negotiation_id,
                "agreed_price": 9.5,
                "quantity": 500,
                "delivery_location": "Mumbai, Maharashtra",
            },
        ), 201)["order"]
        order_id = order["id"]
        assert order["status"] == "awaiting_seller_acceptance"
        assert order["total_value"] == 4750.0
        assert order["advance_amount"] == 950.0
        assert order["balance_amount"] == 3800.0
        assert order["seller_fee"] == 499.0

        denied = client.get(f"/api/orders/{order_id}/bank-details", headers=buyer)
        assert denied.status_code == 403

        _ok(client.post(f"/api/orders/{order_id}/accept", headers=seller))
        bank = _ok(client.get(f"/api/orders/{order_id}/bank-details", headers=buyer))
        assert bank["account_number_masked"] == "••••1234"
        assert "0000001234" not in str(bank)

        submitted = _ok(client.post(
            f"/api/orders/{order_id}/submit-utr",
            headers=buyer,
            json={"utr": "DEMOUTR123456", "type": "advance"},
        ))["order"]
        assert submitted["status"] == "advance_submitted"
        assert submitted["advance_status"] == "submitted"

        # A submitted reference must not be treated as confirmed money.
        detail_before = _ok(client.get(f"/api/orders/{order_id}", headers=buyer))
        assert detail_before["order"]["advance_status"] == "submitted"
        assert detail_before["payments"][0]["status"] == "submitted"
        assert detail_before["seller_bank"] is None

        confirmed = _ok(client.post(
            f"/api/orders/{order_id}/confirm-advance",
            headers=seller,
            json={"confirmed": True},
        ))["order"]
        assert confirmed["status"] == "advance_paid"
        assert confirmed["advance_status"] == "confirmed"

        # 7. Transport coordination and manual shipment milestones.
        transport = _ok(client.post(
            f"/api/orders/{order_id}/transport",
            headers=buyer,
            json={"pickup_location": "Bengaluru, Karnataka", "vehicle_type": "Mini truck", "agreed": True},
        ))
        assert transport["order"]["transport_agreed"] is True
        assert transport["estimate"]["note"]

        for status in (
            "preparing_material", "shipment_scheduled", "shipped",
            "in_transit", "out_for_delivery", "delivered", "completed",
        ):
            result = _ok(client.post(
                f"/api/orders/{order_id}/shipment-status",
                headers=seller,
                json={"status": status, "note": "Manual demo update."},
            ))
            assert result["shipment"]["status"] == status

        final = _ok(client.get(f"/api/orders/{order_id}", headers=buyer))
        assert final["order"]["status"] == "completed"
        assert final["shipment"]["actual_pickup"]
        assert final["shipment"]["actual_delivery"]
        assert len(final["shipment"]["tracking_events"]) >= 8
        assert "GPS" in final["shipment"]["tracking_events"][-1]["note"] or "GPS" in transport["estimate"]["note"]

        # 8. Separate cancellation/refund path remains seller-reviewed.
        refund_order = _ok(client.post(
            "/api/orders",
            headers=buyer,
            json={"listing_id": "lst_bagasse", "agreed_price": 4.5, "quantity": 100, "delivery_location": "Pune"},
        ), 201)["order"]
        _ok(client.post(f"/api/orders/{refund_order['id']}/accept", headers=seller))
        _ok(client.post(
            f"/api/orders/{refund_order['id']}/submit-utr",
            headers=buyer,
            json={"utr": "REFUNDDEMO123", "type": "advance"},
        ))
        refund = _ok(client.post(
            f"/api/orders/{refund_order['id']}/refund-request",
            headers=buyer,
            json={"amount": 90, "reason": "Buyer cancelled before preparation", "order_stage": "After acceptance but before preparation"},
        ))["refund"]
        assert refund["status"] == "requested"
        assert _ok(client.get(f"/api/orders/{refund_order['id']}", headers=buyer))["order"]["advance_status"] == "refund_requested"

        _ok(client.patch(
            f"/api/refunds/{refund['id']}",
            headers=seller,
            json={"status": "approved", "seller_response": "Approved in demo."},
        ))
        assert _ok(client.get(f"/api/orders/{refund_order['id']}", headers=buyer))["order"]["advance_status"] == "refunded"

        overview = _ok(client.get("/api/admin/overview", headers=admin))
        assert overview["counts"]["orders"] >= 2
        assert overview["demo_revenue_overview"]["note"]
    finally:
        get_store().reset()


def test_seeded_fast_demo_order_walkthrough():
    """The 5-minute judge path uses ord_4 from the seeded demo dataset."""
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(_token(client, "seller@demo.resourceai.in"))
        buyer = _headers(_token(client, "buyer@demo.resourceai.in"))

        initial = _ok(client.get("/api/orders/ord_4", headers=buyer))
        order = initial["order"]
        assert order["quantity"] == 500 and order["unit"] == "kg"
        assert order["status"] == "awaiting_seller_acceptance"
        assert order["advance_amount"] == 1000.0
        assert client.get("/api/orders/ord_4/bank-details", headers=buyer).status_code == 403

        _ok(client.post("/api/orders/ord_4/accept", headers=seller))
        _ok(client.get("/api/orders/ord_4/bank-details", headers=buyer))

        submitted = _ok(client.post(
            "/api/orders/ord_4/submit-utr",
            headers=buyer,
            json={"utr": "DEMOUTR500", "type": "advance"},
        ))
        assert submitted["order"]["advance_status"] == "submitted"
        confirmed = _ok(client.post(
            "/api/orders/ord_4/confirm-advance", headers=seller, json={"confirmed": True}
        ))
        assert confirmed["order"]["advance_status"] == "confirmed"

        _ok(client.post(
            "/api/orders/ord_4/transport",
            headers=buyer,
            json={"agreed": True, "vehicle_type": "Mini truck"},
        ))
        shipped = _ok(client.post(
            "/api/orders/ord_4/shipment-status",
            headers=seller,
            json={"status": "shipped", "note": "Demo milestone update."},
        ))
        assert shipped["shipment"]["status"] == "shipped"

        final = _ok(client.get("/api/orders/ord_4", headers=buyer))
        assert final["order"]["advance_status"] == "confirmed"
        assert final["shipment"]["status"] == "shipped"
        assert final["shipment"]["tracking_events"]
    finally:
        get_store().reset()


def test_seller_initiated_order_visible_to_receiver_and_confirmable():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(_token(client, "seller@demo.resourceai.in"))
        buyer = _headers(_token(client, "buyer@demo.resourceai.in"))

        created = _ok(client.post(
            "/api/orders",
            headers=seller,
            json={
                "listing_id": "lst_coconut",
                "buyer_id": "usr_buyer",
                "quantity": 120,
                "delivery_location": "Mumbai, Maharashtra",
            },
        ), 201)["order"]
        assert created["buyer_id"] == "usr_buyer"
        assert created["seller_id"] == "usr_seller"
        assert created["status"] == "awaiting_buyer_confirmation"

        buyer_orders = _ok(client.get("/api/orders", headers=buyer))["items"]
        assert any(o["id"] == created["id"] for o in buyer_orders)

        assert client.get(f"/api/orders/{created['id']}/bank-details", headers=buyer).status_code == 403
        confirmed = _ok(client.post(f"/api/orders/{created['id']}/buyer-accept", headers=buyer))["order"]
        assert confirmed["status"] == "advance_pending"
        assert confirmed["buyer_confirmed_at"]
        assert client.get(f"/api/orders/{created['id']}/bank-details", headers=buyer).status_code == 200
    finally:
        get_store().reset()

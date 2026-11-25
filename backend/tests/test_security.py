"""Authorization and workflow-state regression checks."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.security import _token_secret
from app.store import get_store


def _headers(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": "demo123"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def _create_order(client: TestClient, buyer: dict[str, str]) -> str:
    response = client.post(
        "/api/orders",
        headers=buyer,
        json={
            "listing_id": "lst_coconut",
            "agreed_price": 10,
            "quantity": 100,
            "delivery_location": "Mumbai",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["order"]["id"]


def test_authenticated_roles_and_ownership_are_enforced():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(client, "seller@demo.resourceai.in")
        buyer = _headers(client, "buyer@demo.resourceai.in")
        both = _headers(client, "both@demo.resourceai.in")
        admin = _headers(client, "admin@demo.resourceai.in")

        forbidden = client.post(
            "/api/auth/register",
            json={"email": "rogue@demo.resourceai.in", "password": "demo123", "role": "admin"},
        )
        assert forbidden.status_code == 403

        seller_listing = client.put(
            "/api/listings/lst_coconut", headers=buyer, json={"price": 1}
        )
        assert seller_listing.status_code == 403

        buyer_requirement = client.put(
            "/api/requirements/req_coconut", headers=both, json={"quantity": 1}
        )
        assert buyer_requirement.status_code == 403

        order_id = _create_order(client, buyer)
        assert client.get(f"/api/orders/{order_id}", headers=both).status_code == 403
        assert client.get(f"/api/orders/{order_id}", headers=seller).status_code == 200

        assert client.get("/api/admin/overview").status_code == 403
        assert client.get("/api/admin/overview", headers=buyer).status_code == 403
        assert client.get("/api/admin/overview", headers=admin).status_code == 200
        assert client.post("/api/demo/reset").status_code == 403

        missing = client.put(
            "/api/requirements/req_missing", headers=buyer, json={"quantity": 1}
        )
        assert missing.status_code == 404
        assert client.patch(
            "/api/enquiries/enq_missing", headers=seller, json={"reply": "No."}
        ).status_code == 404
    finally:
        get_store().reset()


def test_payment_and_transport_state_checks_are_enforced():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(client, "seller@demo.resourceai.in")
        buyer = _headers(client, "buyer@demo.resourceai.in")
        order_id = _create_order(client, buyer)

        early_balance = client.post(f"/api/orders/{order_id}/confirm-balance", headers=seller)
        assert early_balance.status_code == 409

        no_agreement = client.post(
            f"/api/orders/{order_id}/transport", headers=buyer, json={"agreed": False}
        )
        assert no_agreement.status_code == 422
        assert client.post(
            f"/api/orders/{order_id}/shipment-status",
            headers=seller,
            json={"status": "preparing_material"},
        ).status_code == 409

        assert client.post(
            f"/api/orders/{order_id}/transport", headers=buyer, json={"agreed": True}
        ).status_code == 200
        assert client.post(
            f"/api/orders/{order_id}/confirm-advance", headers=seller, json={"confirmed": True}
        ).status_code == 409
    finally:
        get_store().reset()


def test_bank_details_are_masked_and_advance_status_is_seller_only():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(client, "seller@demo.resourceai.in")
        buyer = _headers(client, "buyer@demo.resourceai.in")
        order_id = _create_order(client, buyer)

        assert client.get(f"/api/orders/{order_id}/bank-details", headers=buyer).status_code == 403
        assert client.post(f"/api/orders/{order_id}/accept", headers=seller).status_code == 200

        bank = client.get(f"/api/orders/{order_id}/bank-details", headers=buyer)
        assert bank.status_code == 200, bank.text
        payload = bank.json()
        assert payload["account_number_masked"].endswith("1234")
        assert "0000001234" not in str(payload)
        assert "demogreenloop@bank" not in payload["upi"]
        assert "••••" in payload["upi"]

        forced_advance = client.post(
            f"/api/orders/{order_id}/shipment-status",
            headers=seller,
            json={"status": "advance_paid"},
        )
        assert forced_advance.status_code == 409
    finally:
        get_store().reset()


def test_invalid_tokens_are_rejected_and_owner_scoped_reads_use_the_actor():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(client, "seller@demo.resourceai.in")
        buyer = _headers(client, "buyer@demo.resourceai.in")
        invalid = {"Authorization": "Bearer not-a-real-token"}

        assert client.get("/api/auth/me", headers=invalid).status_code == 401
        assert client.get("/api/orders", headers=invalid).status_code == 401
        assert client.get("/api/listings/mine", headers=invalid).status_code == 401

        seller_listings = client.get("/api/listings/mine", headers=seller)
        buyer_listings = client.get("/api/listings/mine", headers=buyer)
        assert seller_listings.status_code == 200
        assert buyer_listings.status_code == 403
        assert all(item["seller_id"] == "usr_seller" for item in seller_listings.json()["items"])

        buyer_requirements = client.get("/api/requirements/mine", headers=buyer)
        seller_requirements = client.get("/api/requirements/mine", headers=seller)
        assert buyer_requirements.status_code == 200
        assert seller_requirements.status_code == 403
        assert all(item["buyer_id"] == "usr_buyer" for item in buyer_requirements.json()["items"])
    finally:
        get_store().reset()


def test_profile_update_preserves_hidden_bank_fields():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(client, "seller@demo.resourceai.in")
        response = client.put(
            "/api/profile",
            headers=seller,
            json={
                "full_name": "Ananya Rao",
                "bank_account_number": "",
                "bank_ifsc": "",
                "bank_upi": "",
                "bank_name": "",
                "bank_account_holder": "",
            },
        )
        assert response.status_code == 200, response.text
        user = get_store().get("users", "usr_seller")
        assert user["bank_account_number"] == "0000001234"
        assert user["bank_ifsc"] == "DEMO000001"
    finally:
        get_store().reset()


def test_direct_orders_cannot_invent_commercial_terms():
    client = TestClient(app)
    get_store().reset()
    try:
        buyer = _headers(client, "buyer@demo.resourceai.in")
        invented_price = client.post(
            "/api/orders",
            headers=buyer,
            json={"listing_id": "lst_coconut", "agreed_price": 1, "quantity": 100},
        )
        assert invented_price.status_code == 422
        excess_quantity = client.post(
            "/api/orders",
            headers=buyer,
            json={"listing_id": "lst_coconut", "quantity": 501},
        )
        assert excess_quantity.status_code == 422
    finally:
        get_store().reset()


def test_enquiry_status_cannot_be_faked_by_a_buyer():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(client, "seller@demo.resourceai.in")
        buyer = _headers(client, "buyer@demo.resourceai.in")
        enquiry = client.post(
            "/api/enquiries",
            headers=buyer,
            json={"listing_id": "lst_coconut", "message": "Please quote for 100 kg."},
        )
        assert enquiry.status_code == 201, enquiry.text
        enquiry_id = enquiry.json()["item"]["id"]

        assert client.patch(
            f"/api/enquiries/{enquiry_id}", headers=buyer, json={"status": "replied"}
        ).status_code == 409
        assert client.patch(
            f"/api/enquiries/{enquiry_id}", headers=buyer, json={"status": "verified"}
        ).status_code == 422
        replied = client.patch(
            f"/api/enquiries/{enquiry_id}", headers=seller, json={"reply": "Our quote is ready."}
        )
        assert replied.status_code == 200, replied.text
        assert replied.json()["item"]["status"] == "replied"
    finally:
        get_store().reset()


def test_refund_balance_and_shipment_guards():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(client, "seller@demo.resourceai.in")
        buyer = _headers(client, "buyer@demo.resourceai.in")
        order_id = _create_order(client, buyer)

        early_refund = client.post(
            f"/api/orders/{order_id}/refund-request",
            headers=buyer,
            json={"amount": 200, "reason": "No payment made", "order_stage": "Before seller acceptance"},
        )
        assert early_refund.status_code == 409

        assert client.post(f"/api/orders/{order_id}/accept", headers=seller).status_code == 200
        assert client.post(
            f"/api/orders/{order_id}/submit-utr",
            headers=buyer,
            json={"utr": "INTEGRITY123", "type": "advance"},
        ).status_code == 200
        excessive_refund = client.post(
            f"/api/orders/{order_id}/refund-request",
            headers=buyer,
            json={"amount": 99999, "reason": "Too much", "order_stage": "After acceptance but before preparation"},
        )
        assert excessive_refund.status_code == 422
        invalid_stage = client.post(
            f"/api/orders/{order_id}/refund-request",
            headers=buyer,
            json={"amount": 10, "reason": "Bad stage", "order_stage": "After landing"},
        )
        assert invalid_stage.status_code == 422

        assert client.post(
            f"/api/orders/{order_id}/confirm-advance", headers=seller, json={"confirmed": True}
        ).status_code == 200
        assert client.post(f"/api/orders/{order_id}/confirm-balance", headers=seller).status_code == 409
        assert client.post(
            f"/api/orders/{order_id}/submit-utr",
            headers=buyer,
            json={"utr": "BALANCE123", "type": "balance"},
        ).status_code == 200
        assert client.post(f"/api/orders/{order_id}/confirm-balance", headers=seller).status_code == 200

        assert client.post(
            f"/api/orders/{order_id}/transport", headers=buyer, json={"agreed": True}
        ).status_code == 200
        assert client.post(
            f"/api/orders/{order_id}/shipment-status",
            headers=seller, json={"status": "preparing_material"},
        ).status_code == 200
        assert client.post(
            f"/api/orders/{order_id}/shipment-status",
            headers=seller, json={"status": "shipped"},
        ).status_code == 200
        assert client.post(
            f"/api/orders/{order_id}/shipment-status",
            headers=seller, json={"status": "preparing_material"},
        ).status_code == 409
    finally:
        get_store().reset()


def test_production_configuration_guards(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "TOKEN_SECRET", "")
    with pytest.raises(RuntimeError, match="TOKEN_SECRET"):
        _token_secret()

    monkeypatch.setattr(settings, "TOKEN_SECRET", "test-secret")
    assert _token_secret() == "test-secret"

    monkeypatch.setattr(settings, "APP_ENV", "demo")
    monkeypatch.setattr(settings, "ALLOW_ANONYMOUS_DEMO", False)
    client = TestClient(app)
    assert client.post(
        "/api/listings",
        json={"material_name": "Coconut husk", "quantity": 10, "unit": "kg", "price": 5},
    ).status_code == 401
    assert client.get("/api/materials").status_code == 200
    assert client.post(
        "/api/materials/analyze", json={"material_name": "Coconut husk"}
    ).status_code == 200

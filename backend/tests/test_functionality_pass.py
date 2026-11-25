"""Coverage for seller-created listings and the remaining commerce branches."""

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


def test_seller_created_listing_matching_and_order_confirmation():
    client = TestClient(app)
    get_store().reset()
    try:
        seller = _headers(_token(client, "seller@demo.resourceai.in"))
        buyer = _headers(_token(client, "buyer@demo.resourceai.in"))

        # A seller-created listing is real marketplace data, not demo seed data.
        created = _ok(client.post(
            "/api/listings",
            headers=seller,
            json={
                "material_name": "Sugarcane bagasse",
                "quantity": 750,
                "unit": "kg",
                "quality_grade": "A",
                "location": "Lucknow, Uttar Pradesh",
                "price": 5,
                "price_type": "negotiable",
            },
        ), 201)
        listing = created["item"]
        assert listing["status"] == "active"
        assert listing["seller_id"] == "usr_seller"
        assert listing["is_demo"] is False
        assert listing["category"] == "sugarcane"

        mine = _ok(client.get("/api/listings/mine", headers=seller))
        assert listing["id"] in [row["id"] for row in mine["items"]]
        assert client.get("/api/listings/mine", headers=buyer).status_code == 403
        public = _ok(client.get("/api/listings", params={"material": "bagasse"}))
        assert listing["id"] in [row["id"] for row in public["items"]]

        # A published, confirmed requirement is matched from both sides and
        # stays distinct from AI prospects and sample business listings.
        requirement = _ok(client.post(
            "/api/requirements",
            headers=buyer,
            json={
                "material_name": "Sugarcane bagasse",
                "quantity": 750,
                "unit": "kg",
                "required_quality": "A",
                "application": "Moulded fibre packaging",
                "location": "Uttar Pradesh",
                "max_price": 6,
            },
        ), 201)["item"]
        confirmed = _ok(client.patch(f"/api/requirements/{requirement['id']}/confirm", headers=buyer))
        assert confirmed["item"]["confirmed"] is True
        assert confirmed["item"]["status"] == "confirmed"

        discovery = _ok(client.post(
            "/api/discovery/search",
            headers=seller,
            json={"material": "Sugarcane bagasse", "location": "Lucknow, Uttar Pradesh"},
        ))
        published = discovery["buckets"]["published_requirement"]
        assert any(row.get("reference_id") == requirement["id"] and row["is_confirmed_demand"] for row in published)
        assert all(row["source_type"] == "published_requirement" for row in published)
        assert discovery["buckets"]["ai_prospect"]
        assert discovery["buckets"]["real_business_listing"]

        seller_matches = _ok(client.post(
            "/api/matching/seller",
            headers=seller,
            json={
                "material_name": "Sugarcane bagasse",
                "category": "sugarcane",
                "quantity": 750,
                "unit": "kg",
                "location": "Lucknow, Uttar Pradesh",
                "quality_grade": "A",
                "price": 5,
            },
        ))["items"]
        matched_requirement = next(
            row for row in seller_matches if row["requirement"]["id"] == requirement["id"]
        )
        assert matched_requirement["match"]["score"] >= 90
        assert matched_requirement["confirmed_demand"] is True

        buyer_matches = _ok(client.post(
            "/api/matching/buyer",
            headers=buyer,
            json={
                "material_name": "Sugarcane bagasse",
                "quantity": 750,
                "unit": "kg",
                "required_quality": "A",
                "location": "Uttar Pradesh",
            },
        ))["items"]
        assert listing["id"] in [row["listing"]["id"] for row in buyer_matches]

        # A seller can respond to that published requirement with their listing.
        enquiry = _ok(client.post(
            "/api/enquiries",
            headers=seller,
            json={
                "listing_id": listing["id"],
                "requirement_id": requirement["id"],
                "message": "We can supply 750 kg of dried bagasse from Lucknow.",
            },
        ), 201)["item"]
        assert enquiry["buyer_id"] == "usr_buyer"
        assert enquiry["seller_id"] == "usr_seller"
        assert enquiry["requirement_id"] == requirement["id"]

        # Seller rejection closes the thread; a resolved offer cannot be reused.
        first = _ok(client.post(
            "/api/offers",
            headers=buyer,
            json={"listing_id": listing["id"], "price": 5, "quantity": 750},
        ), 201)
        _ok(client.post(f"/api/offers/{first['offer']['id']}/reject", headers=seller))
        first_thread = _ok(client.get(f"/api/negotiations/{first['negotiation']['id']}", headers=buyer))
        assert first_thread["offers"][0]["status"] == "rejected"
        assert first_thread["negotiation"]["status"] == "closed"
        assert client.post(f"/api/offers/{first['offer']['id']}/accept", headers=seller).status_code == 409

        # Seller acceptance of a fresh offer agrees the terms without creating
        # an order or moving any payment state.
        second = _ok(client.post(
            "/api/offers",
            headers=buyer,
            json={"listing_id": listing["id"], "price": 5, "quantity": 750, "delivery_location": "Pune"},
        ), 201)
        accepted = _ok(client.post(f"/api/offers/{second['offer']['id']}/accept", headers=seller))
        assert accepted["offer"]["status"] == "accepted"
        assert accepted["negotiation"]["status"] == "agreed"
        assert accepted["message"].startswith("Price agreed.")
        negotiation_id = second["negotiation"]["id"]

        # An order cannot silently override agreed terms.
        assert client.post(
            "/api/orders",
            headers=buyer,
            json={
                "listing_id": listing["id"],
                "negotiation_id": negotiation_id,
                "agreed_price": 6,
                "quantity": 750,
            },
        ).status_code == 422
        assert client.post(
            "/api/orders",
            headers=buyer,
            json={
                "listing_id": listing["id"],
                "negotiation_id": negotiation_id,
                "agreed_price": 5,
                "quantity": 500,
            },
        ).status_code == 422

        order = _ok(client.post(
            "/api/orders",
            headers=buyer,
            json={
                "listing_id": listing["id"],
                "negotiation_id": negotiation_id,
                "agreed_price": 5,
                "quantity": 750,
                "delivery_location": "Pune, Maharashtra",
            },
        ), 201)["order"]
        # Buyer confirmation is recorded at creation; seller confirmation is not.
        assert order["status"] == "awaiting_seller_acceptance"
        assert order["buyer_confirmed_at"]
        assert order["seller_accepted_at"] is None
        assert order["advance_status"] == "pending"
        assert client.get(f"/api/orders/{order['id']}/bank-details", headers=buyer).status_code == 403

        seller_accepted = _ok(client.post(f"/api/orders/{order['id']}/accept", headers=seller))["order"]
        assert seller_accepted["status"] == "advance_pending"
        assert seller_accepted["seller_accepted_at"]

        # Closed orders cannot accept new payment references, transport changes
        # or duplicate cancellation requests.
        _ok(client.post(f"/api/orders/{order['id']}/cancel", headers=buyer, json={"reason": "Demo cancellation"}))
        assert client.post(
            f"/api/orders/{order['id']}/submit-utr",
            headers=buyer,
            json={"utr": "DEMOUTR999999", "type": "advance"},
        ).status_code == 409
        assert client.post(
            f"/api/orders/{order['id']}/confirm-advance",
            headers=seller,
            json={"confirmed": True},
        ).status_code == 409
        assert client.post(
            f"/api/orders/{order['id']}/transport",
            headers=buyer,
            json={"agreed": True, "transport_payer": "buyer"},
        ).status_code == 409
        assert client.post(
            f"/api/orders/{order['id']}/cancel",
            headers=buyer,
            json={"reason": "Second cancellation"},
        ).status_code == 409

        # A paused listing must not remain commercially actionable.
        _ok(client.patch(
            f"/api/listings/{listing['id']}/status",
            headers=seller,
            json={"status": "paused"},
        ))
        assert client.post(
            "/api/enquiries",
            headers=buyer,
            json={"listing_id": listing["id"], "message": "Still available?"},
        ).status_code == 409
        assert client.post(
            "/api/offers",
            headers=buyer,
            json={"listing_id": listing["id"], "price": 5, "quantity": 750},
        ).status_code == 409
        assert client.post(
            "/api/orders",
            headers=buyer,
            json={"listing_id": listing["id"], "agreed_price": 5, "quantity": 750},
        ).status_code == 409
    finally:
        get_store().reset()

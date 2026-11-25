"""Orders, direct-transfer payments, refunds, shipments, transport and admin demo metrics."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query, Request

from ..deps import (
    actor,
    actor_for,
    require_admin,
    require_id,
    require_participant,
    store,
    validate_positive,
)
from ..domain import new_id, now
from ..services.engines import advance_split, estimate_logistics, seller_fee

router = APIRouter(prefix="/api")

ORDER_FROM_SHIPMENT = {
    "order_confirmed": "accepted",
    "advance_paid": "advance_paid",
    "preparing_material": "preparing",
    "shipment_scheduled": "shipment_scheduled",
    "shipped": "shipped",
    "in_transit": "in_transit",
    "out_for_delivery": "out_for_delivery",
    "delivered": "delivered",
    "completed": "completed",
}

CANCELLATION_POLICY = [
    {"stage": "Before seller acceptance", "terms": "Advance refund requested. No material preparation should begin."},
    {"stage": "After acceptance but before preparation", "terms": "Refund according to the agreed terms; document any early costs."},
    {"stage": "After material preparation", "terms": "Seller may claim documented preparation costs according to agreed terms."},
    {"stage": "After shipment", "terms": "Cancellation follows the agreed return and delivery terms."},
]


@router.get("/fee-policy")
def fee_policy() -> dict[str, Any]:
    return {
        "seller_service_fee": [
            {"range": "Up to ₹10,000", "fee": 499},
            {"range": "₹10,001 – ₹20,000", "fee": 999},
            {"range": "₹20,001 – ₹50,000", "fee": 1599},
            {"range": "Above ₹50,000", "fee": 2599},
        ],
        "advance": "20% of the agreed material value, paid directly to the seller. The advance is part of the material price, not platform revenue.",
        "balance": "80% payable according to the terms agreed by buyer and seller.",
        "cancellation_policy": CANCELLATION_POLICY,
        "note": "Proposed demo fee policy. No real money is collected on this prototype.",
    }


@router.get("/logistics/estimate")
def logistics_estimate(
    pickup: str = "",
    delivery: str = "",
    quantity: float = 0,
    unit: str = "kg",
    vehicle_type: str | None = None,
) -> dict[str, Any]:
    return {"estimate": estimate_logistics(pickup, delivery, quantity, vehicle_type)}


@router.post("/orders", status_code=201)
def create_order(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    db = store()
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "seller", "admin")
    listing = require_id(db.get("listings", payload.get("listing_id", "")), "Listing")
    if listing.get("status") != "active":
        raise HTTPException(status_code=409, detail="Only an active listing can be ordered.")
    seller_initiated = listing.get("seller_id") == user["id"]
    if user.get("role") == "seller" and not seller_initiated:
        raise HTTPException(status_code=403, detail="Sellers can only send orders from their own listings.")
    target_buyer_id: str = user["id"]
    if seller_initiated:
        req_buyer_id = payload.get("buyer_id")
        if not req_buyer_id and payload.get("requirement_id"):
            req = db.get("buyer_requirements", payload["requirement_id"])
            req_buyer_id = req.get("buyer_id") if req else None
        if not req_buyer_id:
            raise HTTPException(status_code=422, detail="Choose a buyer to send this order to.")
        target_buyer = require_id(db.get("users", str(req_buyer_id)), "Buyer")
        if target_buyer["id"] == user["id"] or target_buyer.get("role") == "seller":
            raise HTTPException(status_code=422, detail="Choose a valid buyer account to receive this order.")
        target_buyer_id = target_buyer["id"]
    negotiation = None
    if payload.get("negotiation_id"):
        negotiation = require_id(db.get("negotiations", payload["negotiation_id"]), "Negotiation")
        require_participant(request, negotiation, "buyer", "buyer_id", "seller_id")
        if negotiation.get("buyer_id") not in (None, target_buyer_id) and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only the negotiation buyer can create an order from it.")
        if negotiation.get("status") != "agreed":
            raise HTTPException(status_code=409, detail="The negotiation is not agreed yet.")
        if negotiation.get("order_id"):
            raise HTTPException(status_code=409, detail="An order already exists for this negotiation.")
    # A negotiated order must use the accepted offer. A direct order may choose
    # a smaller quantity, but never a different price: clients cannot invent
    # commercial terms that the seller did not quote.
    if negotiation:
        agreed_price = float(negotiation.get("agreed_price") or 0)
        default_quantity = negotiation.get("agreed_quantity") or listing.get("quantity")
        if payload.get("agreed_price") is not None and abs(float(payload["agreed_price"]) - agreed_price) > 0.01:
            raise HTTPException(status_code=422, detail="The order price must match the agreed offer.")
    else:
        agreed_price = float(listing.get("price") or 0)
        default_quantity = payload.get("quantity", listing.get("quantity"))
        if payload.get("agreed_price") is not None and abs(float(payload["agreed_price"]) - agreed_price) > 0.01:
            raise HTTPException(
                status_code=422,
                detail="Direct orders use the seller's listed price. Negotiate with the seller for different terms.",
            )
    if agreed_price <= 0:
        raise HTTPException(status_code=422, detail="An agreed price is required.")
    quantity = validate_positive(payload.get("quantity", default_quantity), "Quantity")
    if negotiation:
        if negotiation.get("agreed_quantity") is not None and abs(quantity - float(negotiation["agreed_quantity"])) > 0.01:
            raise HTTPException(status_code=422, detail="The order quantity must match the agreed offer.")
    elif quantity > float(listing.get("quantity") or 0):
        raise HTTPException(status_code=422, detail="The order quantity cannot exceed the listed quantity.")
    split = advance_split(quantity * agreed_price)
    order = {
        "id": new_id("ord"),
        "listing_id": listing["id"],
        "buyer_id": target_buyer_id,
        "seller_id": listing["seller_id"],
        "negotiation_id": negotiation["id"] if negotiation else None,
        "material_name": listing["material_name"],
        "quantity": quantity,
        # Quantity and price are expressed in the listing's unit; do not trust a
        # client-supplied unit that would silently change the commercial terms.
        "unit": listing.get("unit", "kg"),
        "agreed_price": agreed_price,
        "total_value": split["total"],
        "advance_amount": split["advance"],
        "balance_amount": split["balance"],
        "advance_status": "pending",
        "balance_status": "pending",
        "seller_fee": seller_fee(split["total"]),
        "transport_cost": payload.get("transport_cost"),
        "transport_payer": str(payload.get("transport_payer", "buyer")),
        "transport_agreed": bool(payload.get("transport_agreed", False)),
        "status": "awaiting_buyer_confirmation" if seller_initiated else "awaiting_seller_acceptance",
        "buyer_confirmed_at": None if seller_initiated else now(),
        "seller_accepted_at": now() if seller_initiated else None,
        "pickup_location": str(payload.get("pickup_location", listing.get("location", ""))),
        "delivery_location": str(payload.get("delivery_location", "")),
        "estimated_pickup": payload.get("estimated_pickup"),
        "estimated_delivery": payload.get("estimated_delivery"),
        "terms": "20% advance paid directly to seller; 80% balance per agreed terms. Demo order — no real money involved.",
        "is_demo": False,
    }
    db.create("orders", order)
    if negotiation:
        db.update("negotiations", negotiation["id"], {"order_id": order["id"], "status": "agreed"})
    db.create(
        "shipments",
        {
            "id": new_id("shp"),
            "order_id": order["id"],
            "status": "order_confirmed",
            "vehicle_type": payload.get("vehicle_type", ""),
            "distance_km": payload.get("distance_km"),
            "transport_cost": payload.get("transport_cost"),
            "estimated_pickup": payload.get("estimated_pickup"),
            "estimated_delivery": payload.get("estimated_delivery"),
            "tracking_events": [
                {
                    "status": "order_confirmed",
                    "timestamp": now(),
                    "note": "Order proposed by seller; awaiting buyer confirmation." if seller_initiated else "Order created from agreed terms.",
                }
            ],
            "is_demo": False,
        },
    )
    return {
        "order": order,
        "seller_fee": order["seller_fee"],
        "message": (
            "Order sent to the buyer. They can accept & buy or negotiate the terms."
            if seller_initiated
            else "Order created. Seller must accept before any advance is submitted."
        ),
    }


@router.get("/orders")
def list_orders(request: Request, status: str | None = None) -> dict[str, Any]:
    user = actor(request, "buyer")
    rows = store().list("orders")
    if user.get("role") != "admin":
        rows = [r for r in rows if user["id"] in (r.get("buyer_id"), r.get("seller_id"))]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return {"items": rows, "total": len(rows)}


@router.get("/orders/{order_id}")
def get_order(order_id: str, request: Request) -> dict[str, Any]:
    db = store()
    order = require_id(db.get("orders", order_id), "Order")
    require_participant(request, order, "buyer", "buyer_id", "seller_id")
    return {
        "order": order,
        "listing": db.get("listings", order.get("listing_id", "")),
        "payments": [p for p in db.list("payments") if p.get("order_id") == order_id],
        "refunds": [r for r in db.list("refunds") if r.get("order_id") == order_id],
        "shipment": next(iter([s for s in db.list("shipments") if s.get("order_id") == order_id]), None),
        "seller_bank": None,
        "fee_policy": {"seller_fee": order.get("seller_fee"), "note": "Platform fee is separate from the material payment."},
    }


@router.post("/orders/{order_id}/accept")
def accept_order(order_id: str, request: Request) -> dict[str, Any]:
    order = require_id(store().get("orders", order_id), "Order")
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    if order.get("seller_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the seller can accept this order.")
    if order.get("status") != "awaiting_seller_acceptance":
        raise HTTPException(status_code=409, detail="This order is not awaiting seller acceptance.")
    db = store()
    db.create(
        "payments",
        {
            "id": new_id("pay"), "order_id": order_id, "type": "advance",
            "amount": order["advance_amount"], "status": "pending", "method": "direct_bank_transfer",
            "note": "Advance is paid directly to the seller by bank transfer; seller confirms receipt manually.",
            "is_demo": False,
        },
    )
    db.create(
        "payments",
        {
            "id": new_id("pay"), "order_id": order_id, "type": "balance",
            "amount": order["balance_amount"], "status": "pending", "method": "direct_bank_transfer",
            "note": "Balance reference is submitted by the buyer, then confirmed by the seller. No real transfer occurs.",
            "is_demo": False,
        },
    )
    updated = db.update(
        "orders",
        order_id,
        {"status": "advance_pending", "seller_accepted_at": now()},
    )
    return {"order": updated, "message": "Order accepted. Bank details are now visible to the buyer in the order view only."}


@router.post("/orders/{order_id}/buyer-accept")
def buyer_accept_order(order_id: str, request: Request) -> dict[str, Any]:
    """Allows a buyer to confirm and accept an order proposed by a seller."""
    order = require_id(store().get("orders", order_id), "Order")
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "admin")
    if order.get("buyer_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the order's buyer can confirm this order.")
    if order.get("status") != "awaiting_buyer_confirmation":
        raise HTTPException(status_code=409, detail="This order is not awaiting buyer confirmation.")
    db = store()
    existing_payments = [p for p in db.list("payments") if p.get("order_id") == order_id]
    if not existing_payments:
        db.create(
            "payments",
            {
                "id": new_id("pay"), "order_id": order_id, "type": "advance",
                "amount": order["advance_amount"], "status": "pending", "method": "direct_bank_transfer",
                "note": "Advance is paid directly to the seller by bank transfer; seller confirms receipt manually.",
                "is_demo": False,
            },
        )
        db.create(
            "payments",
            {
                "id": new_id("pay"), "order_id": order_id, "type": "balance",
                "amount": order["balance_amount"], "status": "pending", "method": "direct_bank_transfer",
                "note": "Balance reference is submitted by the buyer, then confirmed by the seller. No real transfer occurs.",
                "is_demo": False,
            },
        )
    updated = db.update(
        "orders",
        order_id,
        {"status": "advance_pending", "buyer_confirmed_at": now()},
    )
    return {"order": updated, "message": "Order confirmed. You can now view demo bank details and submit the 20% advance reference."}


@router.get("/orders/{order_id}/bank-details")
def order_bank_details(order_id: str, request: Request) -> dict[str, Any]:
    """Bank details are private and only available to the order's buyer after acceptance."""
    order = require_id(store().get("orders", order_id), "Order")
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "admin")
    if user["id"] != order.get("buyer_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the order's buyer can view payment details.")
    if order.get("status") in ("awaiting_seller_acceptance", "awaiting_buyer_confirmation"):
        raise HTTPException(status_code=403, detail="Bank details are shown only after both parties accept the order.")
    seller = store().get("users", order.get("seller_id", "")) or {}
    upi = str(seller.get("bank_upi", ""))
    upi_masked = f"{upi[:3]}••••{upi[-4:]}" if len(upi) > 7 else ("••••" if upi else None)
    return {
        "account_holder": seller.get("bank_account_holder"),
        "bank_name": seller.get("bank_name"),
        "account_number_masked": "••••" + str(seller.get("bank_account_number", ""))[-4:] if seller.get("bank_account_number") else None,
        "ifsc": seller.get("bank_ifsc"),
        "upi": upi_masked,
        "note": "Demo bank details only. Do not transfer real money. Verify details independently before any payment.",
    }


@router.post("/orders/{order_id}/submit-utr")
def submit_utr(order_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    order = require_id(store().get("orders", order_id), "Order")
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "admin")
    if user["id"] != order.get("buyer_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the order's buyer can submit a payment reference.")
    if order.get("status") in ("awaiting_seller_acceptance", "awaiting_buyer_confirmation"):
        raise HTTPException(status_code=409, detail="Accept the order before submitting a payment reference.")
    if order.get("status") in ("cancelled", "delivered", "completed"):
        raise HTTPException(status_code=409, detail="Payment references cannot be submitted for a closed order.")
    payment_type = str(payload.get("type", "advance"))
    if payment_type == "balance" and order.get("advance_status") != "confirmed":
        raise HTTPException(status_code=409, detail="Confirm the advance receipt before submitting a balance reference.")
    if payment_type not in ("advance", "balance"):
        raise HTTPException(status_code=422, detail="Invalid payment type.")
    utr = str(payload.get("utr", "")).strip()
    if len(utr) < 6:
        raise HTTPException(status_code=422, detail="Enter a valid UTR / payment reference (at least 6 characters).")
    db = store()
    payments = [p for p in db.list("payments") if p.get("order_id") == order_id and p.get("type") == payment_type]
    if not payments:
        raise HTTPException(status_code=404, detail="Payment record not found for this order.")
    payment = payments[0]
    if payment.get("status") == "confirmed":
        raise HTTPException(status_code=409, detail="This payment is already confirmed.")
    db.update("payments", payment["id"], {"status": "submitted", "utr": utr, "submitted_at": now()})
    updated = db.update(
        "orders",
        order_id,
        {"status": "advance_submitted" if payment_type == "advance" else order.get("status"),
         "advance_status": "submitted" if payment_type == "advance" else order.get("advance_status")},
    )
    return {
        "order": updated,
        "message": "Reference submitted. The order is NOT marked paid until the seller confirms receipt.",
    }


@router.post("/orders/{order_id}/confirm-advance")
def confirm_advance(order_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    order = require_id(store().get("orders", order_id), "Order")
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    if user["id"] != order.get("seller_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the seller can confirm receiving the advance.")
    if not payload.get("confirmed"):
        raise HTTPException(status_code=422, detail="Explicit confirmation is required.")
    if order.get("status") in ("cancelled", "delivered", "completed"):
        raise HTTPException(status_code=409, detail="Advance receipt cannot be confirmed for a closed order.")
    db = store()
    payment = next(iter([p for p in db.list("payments") if p.get("order_id") == order_id and p.get("type") == "advance"]), None)
    if not payment or payment.get("status") != "submitted" or not payment.get("utr"):
        raise HTTPException(status_code=409, detail="The buyer must submit a UTR / payment reference before confirmation.")
    db.update("payments", payment["id"], {"status": "confirmed", "confirmed_at": now()})
    updated = db.update("orders", order_id, {"status": "advance_paid", "advance_status": "confirmed"})
    for shipment in db.list("shipments", order_id=order_id):
        db.update(
            "shipments",
            shipment["id"],
            {
                "status": "advance_paid",
                "tracking_events": shipment.get("tracking_events", [])
                + [{"status": "advance_paid", "timestamp": now(), "note": "Seller confirmed advance receipt (demo)."}],
            },
        )
    return {"order": updated, "message": "Advance confirmed by seller. Order status is now Advance Paid."}


@router.post("/orders/{order_id}/confirm-balance")
def confirm_balance(order_id: str, request: Request) -> dict[str, Any]:
    order = require_id(store().get("orders", order_id), "Order")
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    if user["id"] != order.get("seller_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the seller can confirm the balance payment.")
    if order.get("advance_status") != "confirmed":
        raise HTTPException(status_code=409, detail="Confirm the advance receipt before confirming the balance.")
    if order.get("status") in ("cancelled", "delivered", "completed"):
        raise HTTPException(status_code=409, detail="Balance cannot be confirmed for a closed order.")
    db = store()
    payment = next(iter([p for p in db.list("payments") if p.get("order_id") == order_id and p.get("type") == "balance"]), None)
    if not payment or payment.get("status") != "submitted" or not payment.get("utr"):
        raise HTTPException(
            status_code=409,
            detail="The buyer must submit a balance payment reference before the seller can confirm receipt.",
        )
    db.update("payments", payment["id"], {"status": "confirmed", "confirmed_at": now()})
    return {
        "order": db.update("orders", order_id, {"balance_status": "confirmed"}),
        "message": "Balance reference confirmed by seller. No real transfer occurred.",
    }


@router.post("/orders/{order_id}/transport")
def agree_transport(order_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    order = require_id(store().get("orders", order_id), "Order")
    require_participant(request, order, "buyer", "buyer_id", "seller_id")
    if payload.get("agreed") is not True:
        raise HTTPException(status_code=422, detail="Explicitly agree to the transport terms before recording them.")
    if order.get("status") in ("cancelled", "delivered", "completed"):
        raise HTTPException(status_code=409, detail="Transport cannot be changed for a closed order.")
    db = store()
    qty_kg = float(order.get("quantity", 0)) * (1000 if order.get("unit") == "tonne" else 1)
    estimate = estimate_logistics(
        str(payload.get("pickup_location", order.get("pickup_location", ""))),
        str(payload.get("delivery_location", order.get("delivery_location", ""))),
        qty_kg,
        payload.get("vehicle_type"),
        payload.get("transporter_schedule"),
    )
    cost = payload.get("transport_cost", estimate.get("transport_cost"))
    patch = {
        "transport_cost": cost,
        "transport_payer": str(payload.get("transport_payer", order.get("transport_payer", "buyer"))),
        "transport_agreed": True,
        "estimated_delivery": payload.get("estimated_delivery", estimate.get("estimated_delivery_date")),
    }
    updated = db.update("orders", order_id, patch)
    for shipment in db.list("shipments", order_id=order_id):
        db.update(
            "shipments",
            shipment["id"],
            {"distance_km": estimate.get("distance_km"), "transport_cost": cost,
             "vehicle_type": payload.get("vehicle_type", estimate.get("vehicle_type")),
             "transporter_id": payload.get("transporter_id"),
             "estimated_delivery": patch["estimated_delivery"]},
        )
    return {
        "order": updated,
        "estimate": estimate,
        "delivered_cost": round(float(order.get("total_value", 0)) + float(cost or 0), 2),
        "note": "ReSource AI coordinates transport; sellers or third-party transporters handle delivery.",
    }


@router.post("/orders/{order_id}/shipment-status")
def update_shipment_status(order_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    order = require_id(store().get("orders", order_id), "Order")
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    if user["id"] != order.get("seller_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the order's seller can update shipment milestones.")
    status = str(payload.get("status", ""))
    if status not in ORDER_FROM_SHIPMENT:
        raise HTTPException(status_code=422, detail="Invalid shipment status.")
    if order.get("status") in ("cancelled", "completed"):
        raise HTTPException(status_code=409, detail="Shipment milestones cannot change for a closed order.")
    if status == "advance_paid":
        raise HTTPException(status_code=409, detail="Advance status is set only when the seller explicitly confirms receipt.")
    if status != "order_confirmed" and order.get("advance_status") != "confirmed":
        raise HTTPException(status_code=409, detail="Shipment updates begin after the seller confirms the advance.")
    if status not in ("order_confirmed", "advance_paid") and not order.get("transport_agreed"):
        raise HTTPException(status_code=409, detail="Agree the transport terms before updating shipment milestones.")
    if order.get("status") not in ("advance_paid", "advance_submitted", "preparing", "shipment_scheduled", "shipped", "in_transit", "out_for_delivery", "delivered") and status != "order_confirmed":
        raise HTTPException(status_code=409, detail="Shipment updates begin after the advance is paid.")
    db = store()
    shipment = next(iter(db.list("shipments", order_id=order_id)), None)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment record not found.")
    milestone_order = list(ORDER_FROM_SHIPMENT)
    current_status = str(shipment.get("status") or "order_confirmed")
    if (
        current_status in milestone_order
        and status in milestone_order
        and milestone_order.index(status) <= milestone_order.index(current_status)
    ):
        raise HTTPException(status_code=409, detail="Shipment milestones must move forward, not backwards or repeat.")
    events = list(shipment.get("tracking_events") or [])
    events.append(
        {"status": status, "timestamp": now(), "note": str(payload.get("note", "Manual status update by seller or transporter."))}
    )
    patch = {"status": status, "tracking_events": events}
    if status == "shipped":
        patch["actual_pickup"] = now()[:10]
    if status == "delivered":
        patch["actual_delivery"] = now()[:10]
    db.update("shipments", shipment["id"], patch)
    updated = db.update("orders", order_id, {"status": ORDER_FROM_SHIPMENT[status]})
    return {
        "shipment": db.get("shipments", shipment["id"]),
        "order": updated,
        "note": "Manual status updates only — no real-time GPS tracking is integrated.",
    }


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    order = require_id(store().get("orders", order_id), "Order")
    require_participant(request, order, "buyer", "buyer_id", "seller_id")
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        raise HTTPException(status_code=422, detail="A cancellation reason is required.")
    if order.get("status") in ("cancelled", "completed"):
        raise HTTPException(status_code=409, detail="This order is already closed.")
    updated = store().update("orders", order_id, {"status": "cancelled", "cancellation_reason": reason})
    return {"order": updated, "policy": CANCELLATION_POLICY, "message": "Cancellation recorded. Submit a refund request if applicable."}


@router.post("/orders/{order_id}/refund-request")
def create_refund(order_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    order = require_id(store().get("orders", order_id), "Order")
    user = actor_for(request, "buyer", "buyer", "buyer_seller", "admin")
    if user["id"] != order.get("buyer_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the order's buyer can request a refund.")
    if order.get("status") == "completed":
        raise HTTPException(status_code=409, detail="A completed order cannot enter the refund workflow.")
    db = store()
    advance_payment = next(iter([p for p in db.list("payments") if p.get("order_id") == order_id and p.get("type") == "advance"]), None)
    paid_reference = bool(advance_payment and advance_payment.get("status") in ("submitted", "confirmed") and advance_payment.get("utr"))
    if not paid_reference and order.get("advance_status") != "refund_requested":
        raise HTTPException(status_code=409, detail="Submit an advance payment reference before requesting a refund.")
    max_refund = float(order.get("advance_amount") or 0)
    amount = validate_positive(payload.get("amount", max_refund), "Refund amount", allow_zero=True)
    if amount > max_refund:
        raise HTTPException(status_code=422, detail=f"Refund cannot exceed the advance amount ({max_refund:,.2f}).")
    valid_stages = {
        "Before seller acceptance",
        "After acceptance but before preparation",
        "After material preparation",
        "After shipment",
    }
    order_stage = str(payload.get("order_stage", "Before seller acceptance"))
    if order_stage not in valid_stages:
        raise HTTPException(status_code=422, detail="Invalid refund stage.")
    refund = {
        "id": new_id("rfd"),
        "order_id": order_id,
        "requested_by": user["id"],
        "reason": str(payload.get("reason", "")),
        "order_stage": order_stage,
        "amount": amount,
        "seller_response": "",
        "status": "requested",
        "is_demo": False,
    }
    db.create("refunds", refund)
    db.update("orders", order_id, {"advance_status": "refund_requested"})
    return {"refund": refund, "policy": CANCELLATION_POLICY, "message": "Refund request sent to the seller for review."}


@router.get("/refunds")
def list_refunds(request: Request) -> dict[str, Any]:
    user = actor(request, "buyer")
    rows = [r for r in store().list("refunds") if user.get("role") == "admin" or r.get("requested_by") == user["id"] or r.get("order_id") in [o["id"] for o in store().list("orders", seller_id=user["id"])]]
    return {"items": rows}


@router.patch("/refunds/{refund_id}")
def update_refund(refund_id: str, request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    db = store()
    refund = require_id(db.get("refunds", refund_id), "Refund")
    order = require_id(db.get("orders", refund.get("order_id", "")), "Order")
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    if user["id"] != order.get("seller_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the order's seller can review a refund.")
    patch = {k: payload[k] for k in ("status", "seller_response") if k in payload}
    if patch.get("status") and patch["status"] not in ("requested", "seller_review", "approved", "rejected", "completed"):
        raise HTTPException(status_code=422, detail="Invalid refund status.")
    updated = db.update("refunds", refund_id, patch)
    if updated and updated.get("status") in ("approved", "completed"):
        store().update("orders", updated["order_id"], {"advance_status": "refunded"})
    return {"refund": updated}


@router.get("/transporters")
def list_transporters() -> dict[str, Any]:
    return {"items": store().list("transporters"), "note": "Independent or third-party transporters. ReSource AI does not own vehicles."}


@router.post("/transporters", status_code=201)
def create_transporter(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    user = actor_for(request, "seller", "seller", "buyer_seller", "admin")
    item = {
        "id": new_id("trp"),
        "name": str(payload.get("name", "")),
        "phone": str(payload.get("phone", "")),
        "vehicle_type": str(payload.get("vehicle_type", "")),
        "capacity_kg": validate_positive(payload.get("capacity_kg", 0), "Capacity", allow_zero=True),
        "location": str(payload.get("location", "")),
        "added_by": user["id"],
        "is_partner": False,
        "is_demo": False,
    }
    if not item["name"]:
        raise HTTPException(status_code=422, detail="Transporter name is required.")
    store().create("transporters", item)
    return {"item": item}


@router.get("/admin/overview")
def admin_overview(request: Request) -> dict[str, Any]:
    require_admin(request)
    db = store()
    counts = {
        "listings": len(db.list("listings", status={"ne": "deleted"})),
        "buyer_requirements": len(db.list("buyer_requirements")),
        "enquiries": len(db.list("enquiries")),
        "offers": len(db.list("offers")),
        "negotiations": len(db.list("negotiations")),
        "orders": len(db.list("orders")),
        "shipments": len(db.list("shipments")),
        "users": len(db.list("users")),
    }
    listings = db.list("listings", status={"ne": "deleted"})
    categories: dict[str, int] = {}
    for row in listings:
        categories[row.get("category", "other")] = categories.get(row.get("category", "other"), 0) + 1
    orders = db.list("orders")
    active_orders = [o for o in orders if o.get("status") != "cancelled"]
    revenue = sum(float(o.get("seller_fee", 0)) for o in active_orders)
    material_value = sum(float(o.get("total_value", 0)) for o in active_orders)
    return {
        "counts": counts,
        "material_categories": categories,
        "demo_revenue_overview": {
            "service_fees": round(revenue, 2),
            "order_material_value": round(material_value, 2),
            "note": "Demo figures only — no real payments have been collected.",
        },
        "storage_backend": "Supabase PostgreSQL" if db.__class__.__name__ == "SupabaseStore" else "Local demo JSON store",
    }

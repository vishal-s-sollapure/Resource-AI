"""Domain models for ReSource AI.

A *material* is knowledge about a material type. A *listing* is a specific
quantity offered by a specific seller. The two are deliberately separate.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


class Role(str, Enum):
    SELLER = "seller"
    BUYER = "buyer"
    BOTH = "buyer_seller"
    ADMIN = "admin"


class VerificationStatus(str, Enum):
    UNVERIFIED = "unverified"
    PENDING = "pending"
    VERIFIED = "verified"


class SubscriptionTier(str, Enum):
    BASIC = "basic"
    PREMIUM = "premium"


class MaterialCategory(str, Enum):
    COCONUT = "coconut"
    SUGARCANE = "sugarcane"
    BAMBOO = "bamboo"
    JUTE = "jute"
    RICE = "rice"
    WOOD = "wood"
    FOOD = "food_processing"
    INDUSTRIAL = "industrial"
    OTHER = "other"


class Unit(str, Enum):
    KG = "kg"
    TONNE = "tonne"
    LITRE = "litre"
    PIECE = "piece"
    OTHER = "other"


class MaterialForm(str, Enum):
    RAW = "raw"
    DRIED = "dried"
    PROCESSED = "processed"
    FIBRE = "fibre"
    POWDER = "powder"
    CHIPS = "chips"
    PELLET = "pellet"
    OTHER = "other"


class QualityGrade(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    UNGRADED = "ungraded"


class PriceType(str, Enum):
    FIXED = "fixed"
    NEGOTIABLE = "negotiable"


class ListingStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    SOLD = "sold"
    DELETED = "deleted"


class RequirementStatus(str, Enum):
    OPEN = "open"
    MATCHED = "matched"
    CONFIRMED = "confirmed"
    CLOSED = "closed"


class SourceType(str, Enum):
    AI_PROSPECT = "ai_prospect"
    REAL_BUSINESS = "real_business_listing"
    PUBLISHED_REQUIREMENT = "published_requirement"


class EnquiryStatus(str, Enum):
    SENT = "sent"
    REPLIED = "replied"
    CLOSED = "closed"


class OfferStatus(str, Enum):
    PENDING = "pending"
    COUNTERED = "countered"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class OrderStatus(str, Enum):
    AWAITING_ACCEPTANCE = "awaiting_seller_acceptance"
    ACCEPTED = "accepted"
    ADVANCE_PENDING = "advance_pending"
    ADVANCE_SUBMITTED = "advance_submitted"
    ADVANCE_PAID = "advance_paid"
    PREPARING = "preparing"
    SHIPMENT_SCHEDULED = "shipment_scheduled"
    SHIPPED = "shipped"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    REFUND_REQUESTED = "refund_requested"
    REFUNDED = "refunded"


class ShipmentStatus(str, Enum):
    ORDER_CONFIRMED = "order_confirmed"
    ADVANCE_PAID = "advance_paid"
    PREPARING_MATERIAL = "preparing_material"
    SHIPMENT_SCHEDULED = "shipment_scheduled"
    SHIPPED = "shipped"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    COMPLETED = "completed"


class RefundStatus(str, Enum):
    REQUESTED = "requested"
    SELLER_REVIEW = "seller_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class Entity(BaseModel):
    id: str = Field(default_factory=lambda: new_id("id"))
    created_at: str = Field(default_factory=now)
    updated_at: str = Field(default_factory=now)
    is_demo: bool = True


class User(Entity):
    id: str = Field(default_factory=lambda: new_id("usr"))
    email: str
    full_name: str
    role: Role = Role.BUYER
    password_hash: str = ""
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    verification_status: VerificationStatus = VerificationStatus.UNVERIFIED
    subscription_tier: SubscriptionTier = SubscriptionTier.BASIC
    trial_status: str = "active"
    trial_ends_at: Optional[str] = None
    # Private bank details — never returned on public listings.
    bank_account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_upi: Optional[str] = None


class BusinessProfile(Entity):
    id: str = Field(default_factory=lambda: new_id("bsp"))
    user_id: str
    business_name: str
    business_type: str = ""
    industry: str = ""
    contact_person: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    description: str = ""
    logo_url: Optional[str] = None
    verification_status: VerificationStatus = VerificationStatus.UNVERIFIED


class Material(Entity):
    """Knowledge-base record — not a sellable quantity."""

    id: str = Field(default_factory=lambda: new_id("mat"))
    name: str
    category: MaterialCategory = MaterialCategory.OTHER
    description: str = ""
    source: str = ""
    common_byproducts: list[str] = Field(default_factory=list)
    applications: list[str] = Field(default_factory=list)
    possible_products: list[str] = Field(default_factory=list)
    processing_methods: list[str] = Field(default_factory=list)
    quality_requirements: list[str] = Field(default_factory=list)
    buyer_industries: list[str] = Field(default_factory=list)
    storage_handling: list[str] = Field(default_factory=list)
    environmental_considerations: list[str] = Field(default_factory=list)
    aliases: list[str] = Field(default_factory=list)


class Listing(Entity):
    id: str = Field(default_factory=lambda: new_id("lst"))
    seller_id: str
    material_id: Optional[str] = None
    material_name: str
    category: MaterialCategory = MaterialCategory.OTHER
    quantity: float
    unit: Unit = Unit.KG
    form: MaterialForm = MaterialForm.RAW
    quality_grade: QualityGrade = QualityGrade.UNGRADED
    moisture_content: Optional[float] = None
    processing_level: str = "raw"
    location: str = ""
    price: float = 0.0  # price per `unit`, in INR
    price_type: PriceType = PriceType.NEGOTIABLE
    available_date: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    description: str = ""
    status: ListingStatus = ListingStatus.ACTIVE


class BuyerRequirement(Entity):
    id: str = Field(default_factory=lambda: new_id("req"))
    buyer_id: str
    material_name: str
    quantity: float
    unit: Unit = Unit.KG
    required_quality: QualityGrade = QualityGrade.UNGRADED
    application: str = ""
    location: str = ""
    max_price: Optional[float] = None
    delivery_date: Optional[str] = None
    alternatives_allowed: bool = False
    status: RequirementStatus = RequirementStatus.OPEN
    confirmed: bool = False
    description: str = ""


class DiscoveryResult(Entity):
    id: str = Field(default_factory=lambda: new_id("dis"))
    query: str = ""
    source_type: SourceType = SourceType.AI_PROSPECT
    label: str = ""
    business_name: str = ""
    address: str = ""
    category: str = ""
    website: Optional[str] = None
    distance_km: Optional[float] = None
    location: str = ""
    material: str = ""
    note: str = ""
    search_query: Optional[str] = None
    confidence: Optional[float] = None
    is_real_business: bool = False
    is_confirmed_demand: bool = False


class Enquiry(Entity):
    id: str = Field(default_factory=lambda: new_id("enq"))
    listing_id: str
    buyer_id: str
    seller_id: str
    requirement_id: Optional[str] = None
    message: str = ""
    status: EnquiryStatus = EnquiryStatus.SENT
    reply: Optional[str] = None


class Offer(Entity):
    id: str = Field(default_factory=lambda: new_id("ofr"))
    negotiation_id: str
    listing_id: str
    buyer_id: str
    seller_id: str
    made_by: Role = Role.BUYER
    price: float
    quantity: float
    unit: Unit = Unit.KG
    delivery_location: str = ""
    message: str = ""
    status: OfferStatus = OfferStatus.PENDING
    parent_offer_id: Optional[str] = None


class Negotiation(Entity):
    id: str = Field(default_factory=lambda: new_id("neg"))
    listing_id: str
    buyer_id: str
    seller_id: str
    status: str = "in_progress"
    agreed_price: Optional[float] = None
    agreed_quantity: Optional[float] = None
    order_id: Optional[str] = None


class Order(Entity):
    id: str = Field(default_factory=lambda: new_id("ord"))
    listing_id: str
    buyer_id: str
    seller_id: str
    negotiation_id: Optional[str] = None
    material_name: str
    quantity: float
    unit: Unit = Unit.KG
    agreed_price: float  # per unit, locked after agreement
    total_value: float
    advance_amount: float
    balance_amount: float
    advance_status: PaymentStatus = PaymentStatus.PENDING
    balance_status: PaymentStatus = PaymentStatus.PENDING
    seller_fee: float = 0.0
    transport_cost: Optional[float] = None
    transport_payer: str = "buyer"
    transport_agreed: bool = False
    status: OrderStatus = OrderStatus.AWAITING_ACCEPTANCE
    pickup_location: str = ""
    delivery_location: str = ""
    estimated_pickup: Optional[str] = None
    estimated_delivery: Optional[str] = None
    terms: str = "20% advance directly to seller; 80% balance per agreed terms."
    cancellation_reason: Optional[str] = None


class Payment(Entity):
    id: str = Field(default_factory=lambda: new_id("pay"))
    order_id: str
    type: str = "advance"
    amount: float
    status: PaymentStatus = PaymentStatus.PENDING
    method: str = "direct_bank_transfer"
    utr: Optional[str] = None
    submitted_at: Optional[str] = None
    confirmed_at: Optional[str] = None
    note: str = ""


class Refund(Entity):
    id: str = Field(default_factory=lambda: new_id("rfd"))
    order_id: str
    requested_by: str
    reason: str
    order_stage: str
    amount: float
    seller_response: str = ""
    status: RefundStatus = RefundStatus.REQUESTED


class Shipment(Entity):
    id: str = Field(default_factory=lambda: new_id("shp"))
    order_id: str
    status: ShipmentStatus = ShipmentStatus.ORDER_CONFIRMED
    transporter_id: Optional[str] = None
    vehicle_type: str = ""
    distance_km: Optional[float] = None
    transport_cost: Optional[float] = None
    estimated_pickup: Optional[str] = None
    estimated_delivery: Optional[str] = None
    actual_pickup: Optional[str] = None
    actual_delivery: Optional[str] = None
    tracking_events: list[dict[str, Any]] = Field(default_factory=list)


class Transporter(Entity):
    id: str = Field(default_factory=lambda: new_id("trp"))
    name: str
    phone: str = ""
    vehicle_type: str = ""
    capacity_kg: float = 0.0
    location: str = ""
    added_by: str = ""
    is_partner: bool = False  # false = independent / third-party transporter


class Subscription(Entity):
    id: str = Field(default_factory=lambda: new_id("sub"))
    user_id: str
    tier: SubscriptionTier = SubscriptionTier.BASIC
    monthly_price: float = 1199.0
    status: str = "active"
    demo_mode: bool = True
    started_at: Optional[str] = None
    expires_at: Optional[str] = None


class MaterialPassport(Entity):
    id: str = Field(default_factory=lambda: new_id("psp"))
    user_id: str
    listing_id: Optional[str] = None
    material_name: str
    source: str = ""
    quantity: str = ""
    quality: str = ""
    processing_history: str = ""
    intended_applications: list[str] = Field(default_factory=list)
    storage_conditions: list[str] = Field(default_factory=list)
    specifications: dict[str, Any] = Field(default_factory=dict)

from app.services.ai import extract_requirements
from app.services.engines import (
    advance_split,
    calculate_match,
    estimate_logistics,
    estimate_price,
    seller_fee,
)


def test_matching_uses_configurable_weights_and_explains():
    requirement = {
        "material_name": "Coconut husk",
        "quantity": 500,
        "unit": "kg",
        "location": "Karnataka",
        "required_quality": "B",
    }
    listing = {
        "material_name": "Coconut husk",
        "category": "coconut",
        "quantity": 500,
        "unit": "kg",
        "location": "Bengaluru, Karnataka",
        "quality_grade": "B",
    }
    result = calculate_match(requirement, listing)
    assert result["score"] >= 95
    assert result["weights"] == {"material": 0.4, "quantity": 0.25, "location": 0.2, "quality": 0.15}
    assert set(result["factors"]) == {"material", "quantity", "location", "quality"}
    assert all(result["factors"][key] == 100 for key in result["factors"])
    assert len(result["reasons"]) == 4
    assert "does not guarantee" in result["note"]


def test_matching_partial_quantity():
    requirement = {"material_name": "Coconut husk", "quantity": 1000, "unit": "kg", "location": "Karnataka", "required_quality": "B"}
    listing = {"material_name": "Coconut husk", "quantity": 250, "unit": "kg", "location": "Karnataka", "quality_grade": "B"}
    result = calculate_match(requirement, listing)
    assert result["factors"]["quantity"] == 25.0
    assert result["score"] < 90


def test_price_estimator_refuses_to_invent_prices():
    estimate = estimate_price({"material_name": "Coconut husk", "id": "lst_x"}, [
        {"id": "a", "material_name": "Coconut husk", "unit": "kg", "price": 10, "is_demo": True},
    ])
    assert estimate["insufficient_data"] is True
    assert estimate["message"] == "Insufficient market data."
    assert estimate["suggested_typical"] is None


def test_price_estimator_uses_median_and_labels_demo():
    comparables = [
        {"id": "a", "material_name": "Coconut husk", "unit": "kg", "price": 10, "is_demo": True},
        {"id": "b", "material_name": "Coconut husk", "unit": "kg", "price": 12, "is_demo": True},
        {"id": "c", "material_name": "Coconut husk", "unit": "kg", "price": 14, "is_demo": True},
    ]
    estimate = estimate_price({"material_name": "Coconut husk", "id": "lst_x"}, comparables)
    assert estimate["insufficient_data"] is False
    assert estimate["suggested_typical_per_kg"] == 12
    assert estimate["suggested_low_per_kg"] == 10.8
    assert estimate["is_demo_estimate"] is True
    assert "demo estimates" in estimate["data_source"]


def test_fee_tiers_and_advance():
    assert seller_fee(10000) == 499
    assert seller_fee(10001) == 999
    assert seller_fee(20000) == 999
    assert seller_fee(20001) == 1599
    assert seller_fee(50000) == 1599
    assert seller_fee(50001) == 2599
    split = advance_split(20000)
    assert split == {"total": 20000.0, "advance": 4000.0, "balance": 16000.0}


def test_logistics_estimate_has_no_gps_claim():
    estimate = estimate_logistics("Bengaluru, Karnataka", "Mumbai, Maharashtra", 500)
    assert estimate["distance_km"] and estimate["distance_km"] > 0
    assert estimate["transport_cost"] is not None
    assert estimate["estimated_delivery_date"] is not None
    assert "GPS" in estimate["note"]


def test_requirement_extraction_from_natural_language():
    fields = extract_requirements(
        "I need 2 tonnes of raw coconut husk in Karnataka for coco peat production."
    )
    assert fields["quantity"] == 2
    assert fields["unit"] == "tonne"
    assert fields["material_name"] == "Coconut husk"
    assert fields["location"] == "Karnataka"
    assert fields["application"] == "Coco peat production"
    assert fields["required_quality"] == "raw"

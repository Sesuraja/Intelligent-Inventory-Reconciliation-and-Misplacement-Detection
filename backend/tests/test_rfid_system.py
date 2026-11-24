import pytest
from datetime import datetime, timezone
from app.rfid.event_validator import EventValidator
from app.rfid.event_normalizer import EventNormalizer
from app.rfid.gateway_adapter import GatewayReaderAdapter
from app.ai.location_inference import location_engine
from app.ai.read_reliability import read_reliability_model
from app.ai.root_cause import root_cause_model
from app.ai.feature_engineering import FeatureEngine
from app.ai.demand_forecasting import demand_engine
from app.ai.cycle_counting import cycle_counting_engine
from app.core.database import SessionLocal
from app.services.inventory_service import InventoryService
from app.services.reconciliation_service import ReconciliationService
from app.services.verification_service import VerificationService
from app.models.discrepancy import Discrepancy
from app.seed_data import seed_database

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    seed_database()

def test_event_validator():
    # Valid event
    valid_data = {
        "epc": "EPC-9001",
        "rssi_dbm": -45.0,
        "antenna_id": 1,
        "frequency": 866.3
    }
    is_valid, msg = EventValidator.validate_event(valid_data)
    assert is_valid is True

    # Invalid RSSI (out of range)
    invalid_rssi = {
        "epc": "EPC-9001",
        "rssi_dbm": -105.0,
        "antenna_id": 1
    }
    is_valid, msg = EventValidator.validate_event(invalid_rssi)
    assert is_valid is False

    # Invalid EPC (empty)
    invalid_epc = {
        "epc": "",
        "rssi_dbm": -45.0,
        "antenna_id": 1
    }
    is_valid, msg = EventValidator.validate_event(invalid_epc)
    assert is_valid is False

def test_event_normalizer():
    raw = {
        "epc": "epc-test-01",
        "rssi_dbm": -48.2,
        "observed_at": "2026-11-17T10:00:00Z"
    }
    norm = EventNormalizer.normalize(raw, reader_code="READER_01", antenna_id=2)
    assert norm["epc"] == "EPC-TEST-01"
    assert norm["reader_id"] == "READER_01"
    assert norm["antenna_id"] == 2
    assert norm["valid"] is True
    assert norm["event_id"].startswith("EVT-")

@pytest.mark.asyncio
async def test_gateway_reader_adapter():
    adapter = GatewayReaderAdapter(
        reader_code="100EHH5323020053",
        gateway_url="https://gateway.apertureventurestudio.com"
    )
    health = await adapter.get_health_status()
    assert health["reader_code"] == "100EHH5323020053"
    assert health["adapter_type"] == "APERTURE_HTTP_GATEWAY"

    # Poll live observations from gateway
    obs = await adapter.poll_observations()
    assert isinstance(obs, list)
    if obs:
        first = obs[0]
        assert "epc" in first
        assert "antenna_port" in first
        assert "rssi_dbm" in first
        assert first["rssi_dbm"] < 0
        assert first["reader_code"] == "100EHH5323020053"

def test_location_inference():
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}

    # Case 1: Strong detection on Antenna 1 (Shelf A), faint cross-read on Antenna 2 (Shelf B)
    ant_stats = {
        1: {"read_count": 25, "median_rssi": -42.0},
        2: {"read_count": 4, "median_rssi": -69.0}
    }
    res = location_engine.infer_location(
        epc="EPC-TEST",
        expected_shelf="SHELF_A",
        antenna_stats=ant_stats,
        port_shelf_map=port_shelf_map
    )
    assert res["predicted_location"] == "SHELF_A"
    assert res["predicted_state"] == "IN_PLACE"
    assert res["confidence"] > 0.85
    assert res["verification_required"] is False

    # Case 2: Misplaced detection (Expected Shelf A, but observed on Shelf C)
    ant_stats_misplaced = {
        3: {"read_count": 28, "median_rssi": -41.0}
    }
    res_mis = location_engine.infer_location(
        epc="EPC-TEST",
        expected_shelf="SHELF_A",
        antenna_stats=ant_stats_misplaced,
        port_shelf_map=port_shelf_map
    )
    assert res_mis["predicted_location"] == "SHELF_C"
    assert res_mis["predicted_state"] == "MISPLACED"
    assert res_mis["verification_required"] is True

    # Case 3: Ambiguous cross-read (shelf divider boundary)
    ant_stats_ambiguous = {
        1: {"read_count": 12, "median_rssi": -62.0},
        2: {"read_count": 11, "median_rssi": -62.5}
    }
    res_amb = location_engine.infer_location(
        epc="EPC-TEST",
        expected_shelf="SHELF_A",
        antenna_stats=ant_stats_ambiguous,
        port_shelf_map=port_shelf_map
    )
    assert res_amb["predicted_state"] == "AMBIGUOUS"
    assert res_amb["verification_required"] is True

def test_read_reliability_prediction():
    # Scenario A: Reader is offline -> Must predict LIKELY_UNREAD, not missing
    feat_offline = {
        "epc": "EPC-01",
        "expected_shelf": "SHELF_A",
        "total_reads": 0,
        "last_seen_seconds": 600.0,
        "reader_health": 0.0,  # Reader is offline
        "packaging_risk": 0.0
    }
    res_off = read_reliability_model.predict_reliability(feat_offline)
    assert res_off["status"] == "LIKELY_UNREAD"
    assert any("OFFLINE" in e for e in res_off["evidence"])

    # Scenario B: Reader online, zero reads, long absence -> LIKELY_ABSENT
    feat_absent = {
        "epc": "EPC-02",
        "expected_shelf": "SHELF_A",
        "total_reads": 0,
        "last_seen_seconds": 1200.0,
        "reader_health": 1.0,
        "packaging_risk": 0.0
    }
    res_abs = read_reliability_model.predict_reliability(feat_absent)
    assert res_abs["status"] == "LIKELY_ABSENT"

    # Scenario C: Reader online, zero reads, metal shielding packaging -> LIKELY_UNREAD
    feat_shadowed = {
        "epc": "EPC-03",
        "expected_shelf": "SHELF_B",
        "total_reads": 0,
        "last_seen_seconds": 40.0,
        "reader_health": 1.0,
        "packaging_risk": 0.8
    }
    res_shad = read_reliability_model.predict_reliability(feat_shadowed)
    assert res_shad["status"] == "LIKELY_UNREAD"

def test_root_cause_explanation():
    # Misplacement cause
    exp_mis = root_cause_model.explain_discrepancy(
        epc="EPC-9002",
        discrepancy_type="MISPLACED",
        expected_shelf="SHELF_A",
        observed_shelf="SHELF_C",
        reader_online=True
    )
    assert exp_mis["predicted_cause"] == "PHYSICAL_RELOCATION"
    assert exp_mis["confidence"] >= 0.85
    assert len(exp_mis["evidence"]) > 0

    # Reader outage cause
    exp_outage = root_cause_model.explain_discrepancy(
        epc="EPC-9005",
        discrepancy_type="POSSIBLE_UNREAD",
        expected_shelf="SHELF_A",
        reader_online=False
    )
    assert exp_outage["predicted_cause"] == "READER_OUTAGE"

def test_p1_models():
    # Demand forecasting
    fc = demand_engine.forecast_product_demand(
        sku="SKU-1001",
        name="Test Scanner",
        current_stock=2,
        min_stock=5
    )
    assert fc["stockout_risk"] in ["HIGH", "CRITICAL", "MEDIUM"]
    assert fc["reorder_recommended"] is True

    # Cycle counting prioritization
    risk = cycle_counting_engine.calculate_shelf_risk(
        shelf_id=1,
        shelf_code="SHELF_A",
        zone_name="Zone A",
        open_exceptions_count=3,
        misplaced_count=2,
        total_shelf_value=6500.0,
        items_count=12
    )
    assert risk["risk_score"] > 50.0
    assert risk["priority"] in ["HIGH", "MEDIUM"]

def test_dashboard_summary():
    db = SessionLocal()
    try:
        summary = InventoryService.get_dashboard_summary(db)
        assert summary["kpis"]["total_products"] > 0
        assert summary["kpis"]["total_tags"] > 0
        assert len(summary["status_distribution"]) == 5
        assert len(summary["shelf_distribution"]) >= 4
    finally:
        db.close()


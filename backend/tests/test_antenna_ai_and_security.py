import pytest
from app.ai.location_inference import location_engine
from app.ai.read_reliability import read_reliability_model
from app.ai.root_cause import root_cause_model
from app.rfid.event_validator import EventValidator
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token

def test_antenna_location_inference_clear_signal():
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}
    # Strong signal on Port 1, zero on others
    stats = {
        1: {"read_count": 30, "median_rssi": -42.0},
        2: {"read_count": 0, "median_rssi": -99.0}
    }
    res = location_engine.infer_location("EPC-001", "SHELF_A", stats, port_shelf_map)
    assert res["predicted_location"] == "SHELF_A"
    assert res["predicted_state"] == "IN_PLACE"
    assert res["confidence"] > 0.85
    assert res["verification_required"] is False

def test_antenna_cross_reading_detection():
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}
    # Antenna 1 and Antenna 2 detect with close RSSI (diff < 6 dB) and high read counts on both (boundary placement)
    stats = {
        1: {"read_count": 20, "median_rssi": -52.0},
        2: {"read_count": 18, "median_rssi": -54.0}
    }
    res = location_engine.infer_location("EPC-BOUNDARY", "SHELF_A", stats, port_shelf_map)
    assert res["cross_reading_detected"] is True
    assert res["predicted_state"] == "AMBIGUOUS"
    assert res["verification_required"] is True
    assert len(res["candidate_locations"]) >= 2

def test_antenna_never_uses_rssi_alone():
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B"}
    # Port 2 has 1 single lucky high RSSI read (-38 dBm),
    # but Port 1 has 35 sustained reads at -46 dBm (true physical location)
    stats = {
        1: {"read_count": 35, "median_rssi": -46.0},
        2: {"read_count": 1, "median_rssi": -38.0}
    }
    res = location_engine.infer_location("EPC-SPURIOUS", "SHELF_A", stats, port_shelf_map)
    # The preponderance of reads on Shelf A must dominate over single spike on Shelf B
    assert res["predicted_location"] == "SHELF_A"
    assert res["predicted_state"] == "IN_PLACE"

def test_antenna_failure_handling():
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B"}
    antenna_health = {1: False, 2: True}  # Port 1 is down!
    stats = {}
    res = location_engine.infer_location(
        "EPC-COVERED",
        "SHELF_A",
        stats,
        port_shelf_map,
        antenna_health=antenna_health
    )
    # Since antenna covering SHELF_A is offline, absence must be classified as POSSIBLE_UNREAD, NOT missing!
    assert res["predicted_state"] == "POSSIBLE_UNREAD"
    assert res["verification_required"] is True

def test_read_reliability_packaging_attenuation():
    features = {
        "total_reads": 0,
        "last_seen_seconds": 15.0,
        "reader_health": 1.0,
        "packaging_risk": 0.8  # Liquid or metallic packaging
    }
    pred = read_reliability_model.predict_reliability(features)
    assert pred["status"] == "LIKELY_UNREAD"
    assert "rules_baseline" in pred
    assert pred["rules_baseline"]["decision"] != pred["status"] or pred["reliability_score"] > 0.85

def test_root_cause_multiclass_explanations():
    # 1. Reader outage
    outage_exp = root_cause_model.explain_discrepancy(
        epc="EPC-1", discrepancy_type="POSSIBLE_UNREAD", expected_shelf="SHELF_A",
        reader_online=False
    )
    assert outage_exp["predicted_cause"] == "READER_OUTAGE"

    # 2. RF Shadowing
    shadow_exp = root_cause_model.explain_discrepancy(
        epc="EPC-2", discrepancy_type="POSSIBLE_UNREAD", expected_shelf="SHELF_A",
        packaging_class="METAL_SHIELDED"
    )
    assert shadow_exp["predicted_cause"] == "RF_SHADOWING"

    # 3. Incorrect WMS Transaction (unauthorized move)
    wms_exp = root_cause_model.explain_discrepancy(
        epc="EPC-3", discrepancy_type="MISPLACED", expected_shelf="SHELF_A",
        observed_shelf="SHELF_B", unauthorized_move=True
    )
    assert wms_exp["predicted_cause"] == "INCORRECT_WMS_TRANSACTION"

def test_security_password_and_jwt():
    raw_pass = "secure-warehouse-pwd-2026"
    pw_hash = get_password_hash(raw_pass)
    assert verify_password(raw_pass, pw_hash) is True
    assert verify_password("wrong-password", pw_hash) is False

    # JWT generation and verification
    token = create_access_token({"sub": "tester@warehouse.io", "role": "Administrator"})
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "tester@warehouse.io"
    assert decoded["role"] == "Administrator"

def test_event_validator_inputs():
    valid, msg = EventValidator.validate_event({
        "epc": "EPC-VALID-9999",
        "rssi_dbm": -55.0,
        "antenna_id": 1,
        "frequency": 866.3
    })
    assert valid is True

    # Invalid EPC (empty)
    v_bad, _ = EventValidator.validate_event({"epc": "", "rssi_dbm": -55.0, "antenna_id": 1})
    assert v_bad is False

    # Out-of-range RSSI (+10 dBm)
    v_bad_rssi, _ = EventValidator.validate_event({"epc": "EPC-001", "rssi_dbm": 15.0, "antenna_id": 1})
    assert v_bad_rssi is False

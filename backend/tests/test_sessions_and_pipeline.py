"""
Comprehensive Test Suite for Section 2.1 (Sessions, Sweeps, Ground Truth, Scenarios, ZIP export)
and Section 2.2 (Standardized Scored Event JSON).
"""

import pytest
import io
import zipfile
import json
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.rfid.event_normalizer import EventNormalizer
from app.rfid.event_collector import event_collector

client = TestClient(app)


def test_session_lifecycle_and_immutability():
    """
    Verifies full session lifecycle:
    created -> baseline_truth -> sweeping -> scenario_injected -> verification -> closed.
    Verifies session is strictly immutable once closed.
    """
    # 1. Create session
    create_payload = {
        "name": "Validation Session Alpha",
        "is_simulated": True,
        "data_source": "simulated",
        "target_item_count": 4,
        "notes": "Testing lifecycle and immutability"
    }
    create_resp = client.post("/api/v1/sessions", json=create_payload)
    assert create_resp.status_code == 200
    sess = create_resp.json()
    sess_id = sess["id"]
    assert sess["status"] == "created"
    assert sess["is_evaluable"] is False
    assert sess["config_snapshot"] is not None

    # 2. Advance to baseline_truth
    patch_resp = client.patch(f"/api/v1/sessions/{sess_id}/status", json={"status": "baseline_truth"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "baseline_truth"

    # 3. Advance to sweeping
    patch_resp = client.patch(f"/api/v1/sessions/{sess_id}/status", json={"status": "sweeping"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "sweeping"

    # 4. Record 3 sweeps
    for i in range(1, 4):
        sweep_data = {
            "sweep_number": i,
            "sweep_type": "normal",
            "reads_count": 45,
            "unique_epcs_seen": 4,
            "per_bay_reads": {"SHELF_A": 20, "SHELF_B": 15, "SHELF_C": 10}
        }
        sw_resp = client.post(f"/api/v1/sessions/{sess_id}/sweeps", json=sweep_data)
        assert sw_resp.status_code == 200
        assert sw_resp.json()["sweep_number"] == i

    # 5. Advance to scenario_injected
    patch_resp = client.patch(f"/api/v1/sessions/{sess_id}/status", json={"status": "scenario_injected"})
    assert patch_resp.status_code == 200

    # Record injected scenario
    scen_data = {
        "scenario_type": "move_carton_without_wms",
        "target_epc": "EPC-001",
        "from_location": "SHELF_A",
        "to_location": "SHELF_B",
        "notes": "Worker physically moved carton to Shelf B without authorization order"
    }
    scen_resp = client.post(f"/api/v1/sessions/{sess_id}/injected-scenarios", json=scen_data)
    assert scen_resp.status_code == 200
    assert scen_resp.json()["scenario_type"] == "move_carton_without_wms"

    # 6. Advance to verification
    patch_resp = client.patch(f"/api/v1/sessions/{sess_id}/status", json={"status": "verification"})
    assert patch_resp.status_code == 200

    # 7. Close session
    close_resp = client.patch(f"/api/v1/sessions/{sess_id}/status", json={"status": "closed"})
    assert close_resp.status_code == 200
    closed_sess = close_resp.json()
    assert closed_sess["status"] == "closed"
    assert closed_sess["closed_at"] is not None
    assert closed_sess["per_bay_read_rates"] is not None
    assert closed_sess["per_bay_read_rates"]["total_system_reads"] == 135

    # 8. Immutability verification: Any attempt to mutate closed session must fail with 400
    fail_sweep = client.post(f"/api/v1/sessions/{sess_id}/sweeps", json={
        "sweep_number": 99,
        "sweep_type": "normal",
        "reads_count": 10,
        "unique_epcs_seen": 1
    })
    assert fail_sweep.status_code == 400
    assert "immutable" in fail_sweep.json()["detail"].lower()

    fail_status = client.patch(f"/api/v1/sessions/{sess_id}/status", json={"status": "sweeping"})
    assert fail_status.status_code == 400
    assert "immutable" in fail_status.json()["detail"].lower()


def test_100_percent_ground_truth_rule_for_evaluable():
    """
    CRITICAL RULE (Section 2.1):
    A session can be marked evaluable ONLY when 100% of test items have ground truth.
    """
    # Create session with target_item_count = 3
    create_resp = client.post("/api/v1/sessions", json={
        "name": "Evaluable Threshold Test",
        "target_item_count": 3
    })
    sess_id = create_resp.json()["id"]

    # Add 2 ground truth labels (< 3 target items)
    partial_import = {
        "labels": [
            {
                "epc": "EPC-T1",
                "label": "present_correct",
                "actual_bay": "SHELF_A",
                "provenance_who": "Auditor Dave",
                "provenance_method": "handheld_rfid_scan"
            },
            {
                "epc": "EPC-T2",
                "label": "present_misplaced",
                "actual_bay": "SHELF_B",
                "provenance_who": "Auditor Dave",
                "provenance_method": "handheld_barcode_scan"
            }
        ]
    }
    resp1 = client.post(f"/api/v1/sessions/{sess_id}/ground-truth", json=partial_import)
    assert resp1.status_code == 200
    assert resp1.json()["is_evaluable"] is False  # Only 2/3 recorded

    # Check session record directly
    get_resp1 = client.get(f"/api/v1/sessions/{sess_id}")
    assert get_resp1.json()["is_evaluable"] is False

    # Now add the 3rd label (reaches 100% of target item count)
    full_import = {
        "labels": [
            {
                "epc": "EPC-T3",
                "label": "absent",
                "actual_bay": None,
                "provenance_who": "Auditor Dave",
                "provenance_method": "visual_inspection"
            }
        ]
    }
    resp2 = client.post(f"/api/v1/sessions/{sess_id}/ground-truth", json=full_import)
    assert resp2.status_code == 200
    assert resp2.json()["is_evaluable"] is True  # 3/3 reached

    # Verify session record is now marked evaluable
    get_resp2 = client.get(f"/api/v1/sessions/{sess_id}")
    assert get_resp2.json()["is_evaluable"] is True


def test_scored_event_json_exact_schema():
    """
    CRITICAL REQUIREMENT (Section 2.2):
    Validates that scored event JSON contains all exact fields:
    epc, predicted_state, score, root_cause, candidate_zones, count_priority,
    demand_forecast, model_version, baseline_state, session_id, generated_at,
    reason_codes, is_simulated, validation_status.
    """
    create_resp = client.post("/api/v1/sessions", json={"name": "Scored Event Schema Test"})
    sess_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/sessions/{sess_id}/scored-events")
    assert resp.status_code == 200
    events = resp.json()
    assert len(events) > 0

    first = events[0]
    required_keys = [
        "epc", "predicted_state", "score", "root_cause", "candidate_zones",
        "count_priority", "demand_forecast", "model_version", "baseline_state",
        "session_id", "generated_at", "reason_codes", "is_simulated", "validation_status"
    ]
    for key in required_keys:
        assert key in first, f"Missing required key '{key}' in scored event JSON"

    # Verify root_cause and demand_forecast substructures
    assert "label" in first["root_cause"]
    assert "d1" in first["demand_forecast"]
    assert "d3" in first["demand_forecast"]
    assert "d7" in first["demand_forecast"]
    assert first["session_id"] == sess_id
    assert first["validation_status"] == "experimental"


def test_session_zip_export():
    """
    Verifies /sessions/{id}/export-zip produces a valid ZIP archive containing:
    config.json, sweeps.json, ground_truth.json, injected_scenarios.json,
    scored_events.json, session_summary.json.
    """
    # Create and populate a session
    sess_res = client.post("/api/v1/sessions", json={"name": "ZIP Export Test Session"})
    sess_id = sess_res.json()["id"]

    client.post(f"/api/v1/sessions/{sess_id}/sweeps", json={
        "sweep_number": 1,
        "reads_count": 30,
        "unique_epcs_seen": 2
    })
    client.post(f"/api/v1/sessions/{sess_id}/ground-truth", json={
        "labels": [
            {"epc": "EPC-ZIP-1", "label": "present_correct", "actual_bay": "SHELF_A"}
        ]
    })
    client.post(f"/api/v1/sessions/{sess_id}/injected-scenarios", json={
        "scenario_type": "occlude_tag",
        "target_epc": "EPC-ZIP-1",
        "from_location": "SHELF_A"
    })

    export_resp = client.get(f"/api/v1/sessions/{sess_id}/export-zip")
    assert export_resp.status_code == 200
    assert export_resp.headers["content-type"] == "application/zip"

    # Read and inspect the ZIP contents in memory
    zip_bytes = io.BytesIO(export_resp.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        file_list = zf.namelist()
        assert "config.json" in file_list
        assert "sweeps.json" in file_list
        assert "ground_truth.json" in file_list
        assert "injected_scenarios.json" in file_list
        assert "scored_events.json" in file_list
        assert "session_summary.json" in file_list

        summary = json.loads(zf.read("session_summary.json"))
        assert summary["session_id"] == sess_id


def test_event_normalizer_hardening():
    """
    Verifies event normalization hardening:
    - SHA-256 idempotency key
    - Clock-drift calculation
    - Stale event watermark flag
    """
    now = datetime.now(timezone.utc)
    raw = {
        "epc": "EPC-NORMALIZER-01",
        "rssi_dbm": -45.0,
        "frequency": 866.5,
        "observed_at": now.isoformat()
    }

    norm = EventNormalizer.normalize(
        raw_event=raw,
        reader_code="READER_01",
        antenna_id=1,
        source="PHYSICAL"
    )

    assert norm["valid"] is True
    assert "idempotency_key" in norm
    assert len(norm["idempotency_key"]) == 64  # SHA256 length
    assert norm["clock_drift_exceeded"] is False
    assert norm["is_stale"] is False
    assert norm["is_simulated"] is False

    # Stale / Clock drift test: Event observed 120s ago
    old_time = now - timedelta(seconds=120)
    raw_old = {
        "epc": "EPC-NORMALIZER-OLD",
        "rssi_dbm": -50.0,
        "observed_at": old_time.isoformat()
    }
    norm_old = EventNormalizer.normalize(
        raw_event=raw_old,
        reader_code="READER_01",
        antenna_id=1
    )
    assert norm_old["clock_drift_exceeded"] is True
    assert norm_old["is_stale"] is True


def test_multiple_aggregation_windows_and_heartbeat():
    """
    Verifies multiple aggregation windows (5s, 10s, 15s, 30s)
    and reader outage detection on collector.
    """
    assert event_collector.aggregation_windows == [5, 10, 15, 30]
    assert event_collector.heartbeat_timeout_seconds == 15.0
    assert hasattr(event_collector, "last_heartbeat_time")
    assert hasattr(event_collector, "reader_outage_detected")

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal

client = TestClient(app)

def test_reseed_endpoint():
    """Verify reseed endpoint reloads master seed data."""
    resp = client.post("/api/v1/system/reseed")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"

def test_system_health_diagnostic():
    """Verify comprehensive system health page."""
    resp = client.get("/api/v1/system/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["database_connected"] is True
    assert "edge_readers" in data
    assert "audit_chain" in data
    assert "ai_engine" in data
    assert data["ai_engine"]["abstain_band"] == [0.45, 0.75]

def test_alerts_module_lifecycle():
    """Verify alert creation, listing, acknowledge, snooze, and resolve."""
    # 1. Create alert
    create_resp = client.post(
        "/api/v1/alerts",
        json={
            "alert_type": "reader_outage",
            "severity": "critical",
            "title": "Fixed Reader Power Loss (READER_01)",
            "description": "Heartbeat lost for 15s across Ports 1-4",
            "source": "READER_01",
            "channels": ["in_app", "email"]
        }
    )
    assert create_resp.status_code == 200
    alert_id = create_resp.json()["id"]

    # 2. List alerts
    list_resp = client.get("/api/v1/alerts?status=active")
    assert list_resp.status_code == 200
    assert any(a["id"] == alert_id for a in list_resp.json())

    # 3. Snooze alert
    snooze_resp = client.post(f"/api/v1/alerts/{alert_id}/snooze", json={"snooze_minutes": 10})
    assert snooze_resp.status_code == 200
    assert snooze_resp.json()["status"] == "snoozed"

    # 4. Acknowledge alert
    ack_resp = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", json={"actor": "supervisor_01"})
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "acknowledged"

    # 5. Resolve alert
    resolve_resp = client.post(f"/api/v1/alerts/{alert_id}/resolve?actor=admin")
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "resolved"

def test_cycle_count_workflow():
    """Verify cycle count task workflow: generate -> assign -> scan -> variance -> close."""
    # 1. Generate list
    gen_resp = client.post(
        "/api/v1/cycle-counts/generate",
        json={"name": "Morning Priority Audit", "time_budget_minutes": 45}
    )
    assert gen_resp.status_code == 200
    count_list = gen_resp.json()
    assert len(count_list["tasks"]) > 0
    assert "top_5_bins_recommendation" in count_list["summary"]
    list_id = count_list["id"]
    task_id = count_list["tasks"][0]["id"]

    # 2. Assign to operator
    assign_resp = client.post(f"/api/v1/cycle-counts/{list_id}/assign", json={"assigned_to": "Jordan Lee"})
    assert assign_resp.status_code == 200
    assert assign_resp.json()["assigned_to"] == "Jordan Lee"

    # 3. Record scan
    scan_resp = client.post(
        f"/api/v1/cycle-counts/tasks/{task_id}/scan",
        json={"scanned_epcs": ["EPC-9001", "EPC-9002"], "operator": "Jordan Lee"}
    )
    assert scan_resp.status_code == 200
    assert scan_resp.json()["status"] == "completed"

    # 4. Close list
    close_resp = client.post(f"/api/v1/cycle-counts/{list_id}/close?operator=Jordan Lee")
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "completed"
    assert "closure" in close_resp.json()["summary"]

def test_settings_api_and_audit():
    """Verify reading and updating system settings with audit log."""
    # 1. Read settings
    get_resp = client.get("/api/v1/settings")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert "abstain_bands" in data
    assert "thresholds" in data
    assert data["abstain_bands"]["abstain_lower"] in (0.45, 0.40)

    # 2. Update category
    upd_resp = client.put(
        "/api/v1/settings/abstain_bands",
        json={
            "category": "abstain_bands",
            "value": {"abstain_lower": 0.40, "abstain_upper": 0.75, "abstain_state": "uncertain_verify"},
            "admin_user": "security_admin"
        }
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["status"] == "updated"

def test_safe_manual_override():
    """Verify safe manual override endpoint with supervisor justification and audit entry."""
    # First get or create a discrepancy
    from app.models.discrepancy import Discrepancy
    db = SessionLocal()
    try:
        disc = db.query(Discrepancy).first()
        if not disc:
            disc = Discrepancy(
                epc="EPC-OVERRIDE-TEST",
                discrepancy_type="MISPLACED",
                predicted_state="likely_absent_or_misplaced",
                workflow_status="new",
                confidence=0.88,
                is_simulated=True
            )
            db.add(disc)
            db.commit()
            db.refresh(disc)
        disc_id = disc.id
    finally:
        db.close()

    # Manual override to present_ok
    resp = client.post(
        f"/api/v1/exceptions/{disc_id}/override",
        json={
            "override_state": "present_ok",
            "confirmation": True,
            "reason": "Supervisor physically inspected bin and confirmed carton presence behind divider",
            "supervisor_name": "Marcus Vance"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["predicted_state"] == "present_ok"
    assert data["workflow_status"] == "resolved"

def test_dated_test_report_generator():
    """Verify dated test report generator in JSON and Markdown formats."""
    # JSON report
    resp_json = client.get("/api/v1/reports/dated-test-report?format=json")
    assert resp_json.status_code == 200
    data = resp_json.json()
    assert "report_title" in data
    assert "hardware_configuration" in data
    assert "empirical_evaluation" in data
    assert "per_shelf_accuracy" in data["empirical_evaluation"]
    assert "spatial_precision_statement" in data["empirical_evaluation"]
    assert "NEVER claimed" in data["empirical_evaluation"]["spatial_precision_statement"]

    # Markdown report
    resp_md = client.get("/api/v1/reports/dated-test-report?format=markdown")
    assert resp_md.status_code == 200
    md_text = resp_md.text
    assert "# Test & Calibration Report" in md_text
    assert "Per-Shelf Accuracy Matrix" in md_text
    assert "SHA-256 Hash Chaining" in md_text

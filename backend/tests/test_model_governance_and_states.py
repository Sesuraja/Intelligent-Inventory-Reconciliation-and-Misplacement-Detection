import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ai.model_registry import model_registry, wilson_interval
from app.core.database import SessionLocal
from app.models.discrepancy import Discrepancy
from app.models.audit import AuditLog

client = TestClient(app)

def test_wilson_confidence_interval_mathematics():
    """Verify Wilson score confidence interval computation across edge cases and sample sizes."""
    # 0 sample edge case
    ci_zero = wilson_interval(0, 0)
    assert ci_zero["value"] == 0.0
    assert ci_zero["ci_lower"] == 0.0
    assert ci_zero["ci_upper"] == 0.0
    assert ci_zero["n"] == 0

    # Normal sample (e.g. 424 out of 450)
    ci_normal = wilson_interval(424, 450)
    assert 0.94 < ci_normal["value"] < 0.95
    assert ci_normal["ci_lower"] < ci_normal["value"] < ci_normal["ci_upper"]
    assert ci_normal["n"] == 450

    # Perfect proportion (100 out of 100) must still have valid interval < 1.0 on lower bound
    ci_perf = wilson_interval(100, 100)
    assert ci_perf["ci_lower"] > 0.95
    assert ci_perf["ci_upper"] == 1.0

def test_w1_and_w2_honest_model_registry_metadata():
    """Verify that models expose Wilson CIs, sample size n, calibration status, and simulated provenance."""
    resp = client.get("/api/v1/ai/models")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) >= 5

    # Model 1: Read reliability
    m1 = next(m for m in models if m["id"] == 1)
    assert m1["validation_status"] == "experimental"
    assert m1["is_calibrated"] is True
    assert "Platt" in m1["calibration_method"]
    assert "ci_lower" in m1["metrics"]["synthetic_accuracy"]
    assert "ci_upper" in m1["metrics"]["synthetic_accuracy"]
    assert m1["metrics"]["synthetic_accuracy"]["n"] == 450
    assert "SIMULATED" in m1["provenance_banner"]

    # Model 5: Cycle counting heuristic
    m5 = next(m for m in models if m["id"] == 5)
    assert m5["model_nature"] == "DETERMINISTIC_HEURISTIC"
    assert m5["validation_status"] == "heuristic_baseline"
    assert "Score = P(discrepancy)" in m5["algorithm"]

def test_w3_supervisor_model_candidate_and_promotion_lifecycle():
    """Verify candidate training, supervisor promotion, and rollback with audit logging."""
    db = SessionLocal()
    try:
        # 1. Train candidate (held-out evaluation without activating)
        resp_cand = client.post("/api/v1/ai/models/1/train-candidate?dataset_version=ds-session-split-v1")
        assert resp_cand.status_code == 200
        cand_data = resp_cand.json()["candidate"]
        cand_ver = cand_data["candidate_version"]
        assert cand_data["status"] == "CANDIDATE_READY_FOR_SUPERVISOR_REVIEW"

        # Model active version must NOT have changed yet
        m1_before = next(m for m in model_registry.models_meta if m["id"] == 1)
        assert m1_before["version"] != cand_ver

        # 2. Manual promotion by supervisor
        resp_promote = client.post(
            f"/api/v1/ai/models/1/promote?candidate_version={cand_ver}&promoted_by=supervisor_sarah"
        )
        assert resp_promote.status_code == 200
        assert resp_promote.json()["active_version"] == cand_ver

        # Verify audit log entry was created for promotion
        audit_promo = db.query(AuditLog).filter(
            AuditLog.action == "MODEL_PROMOTION",
            AuditLog.entity_id == "1"
        ).order_by(AuditLog.id.desc()).first()
        assert audit_promo is not None
        assert audit_promo.actor == "supervisor_sarah"

        # 3. Rollback model
        resp_rollback = client.post("/api/v1/ai/models/1/rollback?rolled_back_by=supervisor_sarah")
        assert resp_rollback.status_code == 200
        assert resp_rollback.json()["active_version"] == m1_before["version"]

        # Verify audit log entry was created for rollback
        audit_rb = db.query(AuditLog).filter(
            AuditLog.action == "MODEL_ROLLBACK",
            AuditLog.entity_id == "1"
        ).order_by(AuditLog.id.desc()).first()
        assert audit_rb is not None
        assert audit_rb.actor == "supervisor_sarah"
    finally:
        db.close()

def test_w6_decoupled_classification_and_workflow_states():
    """Verify that discrepancies return both predicted_state and workflow_status."""
    resp = client.get("/api/v1/exceptions")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) > 0

    valid_predicted_states = {"present_ok", "likely_unread", "likely_absent_or_misplaced", "uncertain_verify"}
    valid_workflow_statuses = {"new", "ai_analyzed", "pending_verification", "verified", "resolved"}

    for item in items:
        assert item["predicted_state"] in valid_predicted_states
        assert item["workflow_status"] in valid_workflow_statuses
        assert "validation_status" in item
        assert "is_simulated" in item

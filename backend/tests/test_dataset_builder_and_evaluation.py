import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.ai.dataset_builder import dataset_builder
from app.ai.evaluation_engine import evaluation_engine
from app.ai.root_cause import root_cause_model
from app.models.dataset import Dataset, DatasetItem, EvaluationRun

client = TestClient(app)

def test_dataset_builder_leakage_detection():
    """Verify that DatasetBuilder strictly detects and blocks physical object leakage."""
    train_samples = [
        {"session_id": "S1", "epc": "EPC001", "ground_truth_label": "present_correct"},
        {"session_id": "S1", "epc": "EPC002", "ground_truth_label": "present_correct"},
    ]
    # Intentionally leak EPC002 into test set
    test_samples_leaked = [
        {"session_id": "S2", "epc": "EPC002", "ground_truth_label": "present_misplaced"},
        {"session_id": "S2", "epc": "EPC003", "ground_truth_label": "absent"},
    ]
    passed, msg = dataset_builder.check_data_leakage(train_samples, test_samples_leaked)
    assert passed is False
    assert "leakage detected" in msg.lower()

    # Disjoint sets must pass
    test_samples_clean = [
        {"session_id": "S2", "epc": "EPC003", "ground_truth_label": "absent"},
        {"session_id": "S2", "epc": "EPC004", "ground_truth_label": "present_correct"},
    ]
    passed_clean, msg_clean = dataset_builder.check_data_leakage(train_samples, test_samples_clean)
    assert passed_clean is True

def test_dataset_builder_refuses_mixing_without_flag():
    """Verify that dataset creation refuses to mix simulated and real data without allow_hybrid=True."""
    db = SessionLocal()
    try:
        # Create a mock session with both real and simulated samples
        from app.models.session import TestSession, GroundTruthLabel
        sess = db.query(TestSession).filter(TestSession.id == "S_MIX_1").first()
        if not sess:
            sess = TestSession(id="S_MIX_1", name="Mix Test Session", status="created", is_simulated=False)
            db.add(sess)
            db.flush()
        lbl1 = GroundTruthLabel(session_id="S_MIX_1", epc="EPC_REAL_01", label="present_correct", is_simulated=False)
        lbl2 = GroundTruthLabel(session_id="S_MIX_1", epc="EPC_SIM_01", label="present_misplaced", is_simulated=True)
        db.add(lbl1)
        db.add(lbl2)
        db.commit()

        # Building dataset with both without allow_hybrid must fail
        with pytest.raises(ValueError) as excinfo:
            dataset_builder.build_dataset(
                db=db,
                name="Illegal Mixed Dataset",
                version="ds-illegal-v1",
                session_ids=["S_MIX_1"],
                allow_hybrid=False
            )
        assert "Refusing to mix simulated" in str(excinfo.value)
    finally:
        db.close()

def test_dataset_builder_api_build_and_list():
    """Verify building and querying versioned datasets through the API."""
    resp = client.post(
        "/api/v1/datasets/build",
        json={
            "name": "Held-Out Verification Dataset",
            "version": "ds-v1.0.test",
            "allow_hybrid": True,
            "train_ratio": 0.75
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "dataset_id" in data
    assert data["leakage_check_passed"] is True
    assert data["train_items"] > 0
    assert data["test_items"] > 0

    # Query dataset list
    resp_list = client.get("/api/v1/datasets")
    assert resp_list.status_code == 200
    all_ds = resp_list.json()
    assert any(d["id"] == data["dataset_id"] for d in all_ds)

def test_held_out_evaluation_and_metrics():
    """Verify held-out evaluation metrics, Wilson CIs, ECE, per-shelf accuracy, and provenance."""
    # First build a dataset
    db = SessionLocal()
    try:
        build_res = dataset_builder.build_dataset(
            db=db,
            name="Evaluation Target Dataset",
            version="ds-eval-target-v1",
            allow_hybrid=True
        )
        ds_id = build_res["dataset_id"]

        resp_eval = client.post(
            f"/api/v1/datasets/{ds_id}/evaluate",
            json={
                "model_name": "Root-Cause & Location Fusion",
                "model_version": "v1.2.0"
            }
        )
        assert resp_eval.status_code == 200
        eval_data = resp_eval.json()
        assert "evaluation_id" in eval_data

        # Verify Wilson CIs on accuracy and precision
        metrics = eval_data["metrics"]
        assert "ci_lower" in metrics["accuracy"]
        assert "ci_upper" in metrics["accuracy"]
        assert metrics["accuracy"]["n"] > 0

        # Verify ECE
        assert "expected_calibration_error_ece" in metrics
        assert metrics["expected_calibration_error_ece"] >= 0.0

        # Verify per-shelf accuracy reporting (never cm)
        per_shelf = metrics["per_shelf"]
        assert "SHELF_A" in per_shelf
        assert "accuracy" in per_shelf["SHELF_A"]

        # Verify per-scenario accuracy
        per_scenario = metrics["per_scenario"]
        assert "physical_relocation" in per_scenario
        assert "unknown" in per_scenario

        # Verify resolution time comparison against baseline
        res_comp = metrics["resolution_comparison"]
        assert res_comp["mean_minutes_saved"] > 0

        # Test Model Card endpoint
        eval_id = eval_data["evaluation_id"]
        resp_card = client.get(f"/api/v1/datasets/model-card/{eval_id}")
        assert resp_card.status_code == 200
        card_content = resp_card.json()["markdown_card"]
        assert "# Model Card:" in card_content
        assert "Wilson 95% Confidence Intervals" in card_content
        assert "NEVER CLAIMED" in card_content
    finally:
        db.close()

def test_root_cause_multiclass_and_shap_contributions():
    """Verify that root cause engine outputs all 6 classes (including unknown) and SHAP feature contributions."""
    res = root_cause_model.explain_discrepancy(
        epc="TEST_EPC_001",
        discrepancy_type="MISPLACED",
        expected_shelf="SHELF_A",
        observed_shelf="SHELF_B",
        reader_online=True,
        unauthorized_move=False
    )
    assert "root_cause_json" in res
    rc_json = res["root_cause_json"]
    assert "label" in rc_json
    assert "probs" in rc_json

    # Must contain unknown cause
    probs = rc_json["probs"]
    assert "unknown" in probs
    assert "physical_relocation" in probs

    # Must contain feature contributions with direction
    contributions = res["feature_contributions"]
    assert len(contributions) > 0
    for feat in contributions:
        assert "feature" in feat
        assert "impact" in feat
        assert feat["direction"] in ("positive", "negative")

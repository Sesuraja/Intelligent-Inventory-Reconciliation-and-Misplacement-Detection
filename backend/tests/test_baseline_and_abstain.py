"""
Tests for W4 (Deterministic Rules-Only Baseline & AI Comparison)
and W6b (Abstain Logic and Acceptance Test for Occluded-but-not-moved tags).
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ai.rules_baseline import rules_baseline_engine, wilson_score_interval
from app.ai.location_inference import location_engine
from app.ai.read_reliability import read_reliability_model
from app.ai.root_cause import root_cause_model

client = TestClient(app)


def test_wilson_score_interval():
    """Verifies mathematically rigorous Wilson score 95% confidence intervals."""
    # Zero sample case
    zero_ci = wilson_score_interval(0, 0)
    assert zero_ci["proportion"] == 0.0
    assert zero_ci["ci_lower"] == 0.0
    assert zero_ci["ci_upper"] == 0.0

    # 18 successes out of 20 trials
    ci = wilson_score_interval(18, 20)
    assert ci["sample_size"] == 20
    assert ci["proportion"] == 0.90
    assert 0.69 <= ci["ci_lower"] <= 0.75
    assert 0.95 <= ci["ci_upper"] <= 1.0


def test_deterministic_rules_baseline_present_ok():
    """Seen on expected antenna -> present_ok."""
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}
    ant_stats = {1: {"read_count": 15, "median_rssi": -48.0}}

    res = rules_baseline_engine.evaluate_item(
        epc="EPC-BASE-01",
        expected_shelf="SHELF_A",
        antenna_stats=ant_stats,
        last_seen_seconds=2.0,
        sweep_count=10,
        port_shelf_map=port_shelf_map
    )

    assert res["predicted_state"] == "present_ok"
    assert res["baseline_state"] == "present_ok"
    assert res["score"] == 1.0
    assert "RULE_OBSERVED_ON_EXPECTED_ANTENNA" in res["reason_codes"]


def test_deterministic_rules_baseline_misplaced():
    """Seen on antenna not covering expected shelf -> misplaced_baseline."""
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}
    # Expected on SHELF_A, but seen on Port 2 (SHELF_B)
    ant_stats = {2: {"read_count": 20, "median_rssi": -46.0}}

    res = rules_baseline_engine.evaluate_item(
        epc="EPC-BASE-02",
        expected_shelf="SHELF_A",
        antenna_stats=ant_stats,
        last_seen_seconds=3.0,
        sweep_count=8,
        port_shelf_map=port_shelf_map
    )

    assert res["predicted_state"] == "likely_absent_or_misplaced"
    assert res["baseline_state"] == "misplaced_baseline"
    assert res["candidate_zones"][0]["zone"] == "SHELF_B"


def test_deterministic_rules_baseline_missing_after_timeout():
    """Not seen for T seconds across N sweeps -> missing_baseline."""
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}
    ant_stats = {}  # Zero reads

    res = rules_baseline_engine.evaluate_item(
        epc="EPC-BASE-03",
        expected_shelf="SHELF_A",
        antenna_stats=ant_stats,
        last_seen_seconds=45.0,  # > default 30s timeout
        sweep_count=5,           # >= default 3 sweeps
        port_shelf_map=port_shelf_map
    )

    assert res["predicted_state"] == "likely_absent_or_misplaced"
    assert res["baseline_state"] == "missing_baseline"


def test_deterministic_rules_baseline_abstain_before_threshold():
    """Not seen, but within timeout T or fewer than N sweeps -> uncertain_verify."""
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}
    ant_stats = {}  # Zero reads

    res = rules_baseline_engine.evaluate_item(
        epc="EPC-BASE-04",
        expected_shelf="SHELF_A",
        antenna_stats=ant_stats,
        last_seen_seconds=10.0,  # <= 30s timeout
        sweep_count=1,           # < 3 sweeps
        port_shelf_map=port_shelf_map
    )

    assert res["predicted_state"] == "uncertain_verify"
    assert res["baseline_state"] == "uncertain_verify"


def test_per_zone_configurable_thresholds():
    """Thresholds can be set and evaluated per zone."""
    rules_baseline_engine.set_zone_thresholds(
        zone_key="ZONE_CUSTOM",
        timeout_seconds=60.0,
        min_sweeps=6,
        min_rssi=-70.0
    )

    cfg = rules_baseline_engine.get_zone_thresholds("ZONE_CUSTOM")
    assert cfg["timeout_seconds"] == 60.0
    assert cfg["min_sweeps_for_missing"] == 6

    # 45s is below 60s, so should abstain
    port_shelf_map = {1: "SHELF_A"}
    res = rules_baseline_engine.evaluate_item(
        epc="EPC-ZONE",
        expected_shelf="SHELF_A",
        antenna_stats={},
        last_seen_seconds=45.0,
        sweep_count=4,
        port_shelf_map=port_shelf_map,
        zone_key="ZONE_CUSTOM"
    )
    assert res["baseline_state"] == "uncertain_verify"


def test_w6b_acceptance_occluded_tag_without_moving():
    """
    CRITICAL ACCEPTANCE TEST (W6b):
    Occlude a tag on SHELF_A without moving it.
    The system must answer "uncertain_verify" (rescan required),
    and must NEVER claim a confident misplacement on weak/stray evidence!
    """
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}

    # Scenario: Tag is physically on SHELF_A, but occluded by a metal sheet / liquid container.
    # Antenna 1 has 0 reads due to attenuation.
    # Antenna 2 (adjacent shelf) picks up 1 single weak stray cross-read bounce at -80 dBm.
    occluded_stats = {
        2: {"read_count": 1, "median_rssi": -80.0}
    }

    res = location_engine.infer_location(
        epc="EPC-OCCLUDED-01",
        expected_shelf="SHELF_A",
        antenna_stats=occluded_stats,
        port_shelf_map=port_shelf_map
    )

    # Acceptance criteria: Must be uncertain_verify, NOT MISPLACED!
    assert res["predicted_state"] == "uncertain_verify"
    assert res["verification_required"] is True
    assert res["predicted_location"] is None  # Refuses to relocate to Shelf B on weak evidence


def test_w6b_calibrated_abstain_band():
    """Scores inside the abstain band [0.45, 0.75] abstain to uncertain_verify."""
    port_shelf_map = {1: "SHELF_A", 2: "SHELF_B"}
    # Marginal reads on Shelf B, but low read count and borderline signal
    marginal_stats = {
        2: {"read_count": 4, "median_rssi": -73.0}
    }
    res = location_engine.infer_location(
        epc="EPC-BORDERLINE",
        expected_shelf="SHELF_A",
        antenna_stats=marginal_stats,
        port_shelf_map=port_shelf_map
    )
    assert res["predicted_state"] == "uncertain_verify"
    assert res["verification_required"] is True


def test_ai_vs_baseline_comparison_api():
    """Verifies GET /api/v1/ai/baseline-comparison returns matched pairs and stats."""
    resp = client.get("/api/v1/ai/baseline-comparison")
    assert resp.status_code == 200
    data = resp.json()

    assert "sample_size_n" in data
    assert "agreement_rate" in data
    assert "ai_abstain_rate" in data
    assert "items" in data
    assert data["sample_size_n"] > 0
    assert "ci_lower" in data["agreement_rate"]
    assert "ci_upper" in data["agreement_rate"]
    assert data["validation_status"] == "experimental"


def test_baseline_thresholds_api():
    """Verifies POST /api/v1/ai/baseline-thresholds configures thresholds."""
    post_resp = client.post("/api/v1/ai/baseline-thresholds?zone_key=ZONE_TEST&timeout_seconds=50&min_sweeps=5")
    assert post_resp.status_code == 200
    assert post_resp.json()["success"] is True

    get_resp = client.get("/api/v1/ai/baseline-thresholds")
    assert get_resp.status_code == 200
    assert "ZONE_TEST" in get_resp.json()
    assert get_resp.json()["ZONE_TEST"]["timeout_seconds"] == 50.0

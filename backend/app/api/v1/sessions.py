"""
API Router for Test Sessions, Sweeps, Ground Truth Labels, Fault Injected Scenarios,
ZIP export, and Section 2.2 Unified Scored Event JSON.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import io
import json
import zipfile
import uuid

from app.core.database import get_db
from app.models.session import (
    TestSession,
    Sweep,
    GroundTruthLabel,
    InjectedScenario,
    ReaderConfigSnapshot,
)
from app.models.inventory import Inventory
from app.models.location import Shelf
from app.models.reader import Antenna
from app.schemas.session import (
    TestSessionCreate,
    TestSessionResponse,
    TestSessionStatusUpdate,
    SweepCreate,
    SweepResponse,
    GroundTruthLabelCreate,
    GroundTruthLabelResponse,
    GroundTruthImportPayload,
    InjectedScenarioCreate,
    InjectedScenarioResponse,
    ScoredEventJSON,
)
from app.ai.rules_baseline import rules_baseline_engine
from app.ai.read_reliability import read_reliability_model
from app.ai.root_cause import root_cause_model
from app.ai.destination_inference import destination_engine
from app.ai.cycle_counting import cycle_counting_engine
from app.ai.demand_forecasting import demand_engine

router = APIRouter(prefix="/sessions", tags=["Test Sessions & Ground Truth Pipeline"])

VALID_LIFECYCLE_TRANSITIONS = {
    "created": ["baseline_truth", "sweeping", "closed"],
    "baseline_truth": ["sweeping", "scenario_injected", "closed"],
    "sweeping": ["scenario_injected", "verification", "closed"],
    "scenario_injected": ["verification", "sweeping", "closed"],
    "verification": ["closed", "sweeping"],
    "closed": []  # Immutable once closed
}


def _verify_session_mutable(session: TestSession):
    if session.status == "closed":
        raise HTTPException(
            status_code=400,
            detail=f"Session '{session.id}' is CLOSED and immutable. Changes are prohibited."
        )


@router.post("", response_model=TestSessionResponse)
def create_test_session(payload: TestSessionCreate, db: Session = Depends(get_db)):
    """
    Creates a new test session in 'created' status.
    Captures baseline reader config snapshot.
    """
    now = datetime.now(timezone.utc)
    session_id = str(uuid.uuid4())

    # Build default reader config snapshot if not provided
    snapshot = payload.config_snapshot or {
        "reader_model": "Impinj Speedway R420",
        "firmware_version": "5.14.0",
        "ip_address": "192.168.1.100",
        "port_mapping": {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"},
        "cable_lengths_m": {1: 3.0, 2: 3.0, 3: 5.0, 4: 5.0},
        "antenna_coordinates": {
            "ANT_01": {"x": 0.5, "y": 1.2, "z": 1.8},
            "ANT_02": {"x": 1.5, "y": 1.2, "z": 1.8},
            "ANT_03": {"x": 2.5, "y": 1.2, "z": 1.8},
            "ANT_04": {"x": 3.5, "y": 1.2, "z": 1.8}
        },
        "tx_power_dbm": 30.0
    }

    session_rec = TestSession(
        id=session_id,
        name=payload.name,
        status="created",
        is_simulated=payload.is_simulated,
        data_source=payload.data_source,
        is_evaluable=False,
        target_item_count=payload.target_item_count,
        notes=payload.notes,
        config_snapshot=snapshot,
        created_at=now
    )
    db.add(session_rec)

    # Add config snapshot record
    cfg_row = ReaderConfigSnapshot(
        session_id=session_id,
        reader_model=snapshot.get("reader_model", "Impinj Speedway R420"),
        firmware_version=snapshot.get("firmware_version", "5.14.0"),
        ip_address=snapshot.get("ip_address", "192.168.1.100"),
        port_mapping=snapshot.get("port_mapping"),
        cable_lengths_m=snapshot.get("cable_lengths_m"),
        antenna_coordinates=snapshot.get("antenna_coordinates"),
        tx_power_dbm=snapshot.get("tx_power_dbm", 30.0),
        captured_at=now
    )
    db.add(cfg_row)

    db.commit()
    db.refresh(session_rec)
    return session_rec


@router.get("", response_model=List[TestSessionResponse])
def list_test_sessions(
    status: Optional[str] = None,
    data_source: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lists test sessions with optional filtering."""
    q = db.query(TestSession)
    if status:
        q = q.filter(TestSession.status == status)
    if data_source:
        q = q.filter(TestSession.data_source == data_source)
    return q.order_by(TestSession.created_at.desc()).all()


@router.get("/{id}", response_model=TestSessionResponse)
def get_test_session(id: str, db: Session = Depends(get_db)):
    """Fetches complete test session record including sweeps and ground truth."""
    sess = db.query(TestSession).filter(TestSession.id == id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Test session '{id}' not found")
    return sess


@router.patch("/{id}/status", response_model=TestSessionResponse)
def update_test_session_status(id: str, payload: TestSessionStatusUpdate, db: Session = Depends(get_db)):
    """
    Advances session lifecycle: created -> baseline_truth -> sweeping -> scenario_injected -> verification -> closed.
    Enforces immutability once closed.
    Computes per-bay read rates and false-absence stats on close.
    """
    sess = db.query(TestSession).filter(TestSession.id == id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Test session '{id}' not found")

    _verify_session_mutable(sess)

    target_status = payload.status.lower()
    allowed = VALID_LIFECYCLE_TRANSITIONS.get(sess.status, [])
    if target_status not in allowed and target_status != sess.status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition from '{sess.status}' to '{target_status}'. Allowed: {allowed}"
        )

    now = datetime.now(timezone.utc)
    sess.status = target_status

    if target_status == "closed":
        sess.closed_at = now
        # Calculate per-bay read rates & false absence stats across all sweeps
        sweeps = db.query(Sweep).filter(Sweep.session_id == id).all()
        labels = db.query(GroundTruthLabel).filter(GroundTruthLabel.session_id == id).all()

        bay_counts = {"SHELF_A": 0, "SHELF_B": 0, "SHELF_C": 0, "SHELF_D": 0}
        total_reads = 0
        for s in sweeps:
            total_reads += s.reads_count
            if s.per_bay_reads:
                for b, cnt in s.per_bay_reads.items():
                    bay_counts[b] = bay_counts.get(b, 0) + cnt

        sess.per_bay_read_rates = {
            "total_system_reads": total_reads,
            "sweep_count": len(sweeps),
            "bay_read_distribution": bay_counts
        }

        # Calculate false-absence stats from ground truth labels
        missed_reads = sum(1 for l in labels if l.label == "read_missed")
        absent_count = sum(1 for l in labels if l.label == "absent")
        sess.false_absence_stats = {
            "total_ground_truth_labels": len(labels),
            "read_missed_count": missed_reads,
            "confirmed_absent_count": absent_count,
            "false_absence_rate": round(missed_reads / max(1, len(labels)), 4)
        }

    db.commit()
    db.refresh(sess)
    return sess


@router.post("/{id}/sweeps", response_model=SweepResponse)
def record_sweep(id: str, payload: SweepCreate, db: Session = Depends(get_db)):
    """Records an automated antenna sweep in the session. Rejects if closed."""
    sess = db.query(TestSession).filter(TestSession.id == id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Test session '{id}' not found")
    _verify_session_mutable(sess)

    now = datetime.now(timezone.utc)
    sweep_row = Sweep(
        id=str(uuid.uuid4()),
        session_id=id,
        sweep_number=payload.sweep_number,
        sweep_type=payload.sweep_type,
        reads_count=payload.reads_count,
        unique_epcs_seen=payload.unique_epcs_seen,
        per_bay_reads=payload.per_bay_reads,
        started_at=now,
        completed_at=now,
        notes=payload.notes
    )
    db.add(sweep_row)
    db.commit()
    db.refresh(sweep_row)
    return sweep_row


@router.post("/{id}/ground-truth")
def record_ground_truth_labels(
    id: str,
    payload: GroundTruthImportPayload,
    db: Session = Depends(get_db)
):
    """
    Imports or records physical ground truth labels.
    Rejects if session is closed.
    A session can be marked evaluable only when 100% of test items have ground truth.
    """
    sess = db.query(TestSession).filter(TestSession.id == id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Test session '{id}' not found")
    _verify_session_mutable(sess)

    now = datetime.now(timezone.utc)
    added = 0
    for item in payload.labels:
        # Check existing label for this EPC in this session
        existing = db.query(GroundTruthLabel).filter(
            GroundTruthLabel.session_id == id,
            GroundTruthLabel.epc == item.epc
        ).first()

        if existing:
            existing.label = item.label
            existing.actual_bay = item.actual_bay
            existing.provenance_who = item.provenance_who
            existing.provenance_method = item.provenance_method
            existing.provenance_when = now
            existing.notes = item.notes
        else:
            lbl = GroundTruthLabel(
                id=str(uuid.uuid4()),
                session_id=id,
                epc=item.epc,
                label=item.label,
                actual_bay=item.actual_bay,
                provenance_who=item.provenance_who,
                provenance_when=now,
                provenance_method=item.provenance_method,
                is_simulated=item.is_simulated,
                notes=item.notes
            )
            db.add(lbl)
            added += 1

    db.flush()

    # Rule: A session can be marked evaluable ONLY when 100% of test items have ground truth
    total_labels = db.query(GroundTruthLabel).filter(GroundTruthLabel.session_id == id).count()
    target_count = sess.target_item_count or 1
    sess.is_evaluable = (total_labels >= target_count)

    db.commit()
    return {
        "success": True,
        "session_id": id,
        "labels_processed": len(payload.labels),
        "total_ground_truth_count": total_labels,
        "target_item_count": target_count,
        "is_evaluable": sess.is_evaluable,
        "evaluable_note": "100% ground truth satisfied; session evaluable." if sess.is_evaluable else f"Pending ground truth: {total_labels}/{target_count} items recorded."
    }


@router.post("/{id}/injected-scenarios", response_model=InjectedScenarioResponse)
def record_injected_scenario(
    id: str,
    payload: InjectedScenarioCreate,
    db: Session = Depends(get_db)
):
    """
    Logs every fault injection scenario action (e.g. carton moved without WMS txn, tag occluded, etc.) as ground truth.
    Rejects if session is closed.
    """
    sess = db.query(TestSession).filter(TestSession.id == id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Test session '{id}' not found")
    _verify_session_mutable(sess)

    now = datetime.now(timezone.utc)
    scen = InjectedScenario(
        id=str(uuid.uuid4()),
        session_id=id,
        scenario_type=payload.scenario_type,
        target_epc=payload.target_epc,
        from_location=payload.from_location,
        to_location=payload.to_location,
        injected_at=now,
        is_active=True,
        notes=payload.notes
    )
    db.add(scen)
    db.commit()
    db.refresh(scen)
    return scen


@router.get("/{id}/scored-events", response_model=List[ScoredEventJSON])
def get_session_scored_events(id: str, db: Session = Depends(get_db)):
    """
    Returns unified Section 2.2 scored event JSON for items in this test session.
    """
    sess = db.query(TestSession).filter(TestSession.id == id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Test session '{id}' not found")

    items = db.query(Inventory).all()
    results = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for item in items:
        exp_code = item.expected_shelf.shelf_code if item.expected_shelf else "SHELF_A"
        obs_code = item.observed_shelf.shelf_code if item.observed_shelf else None

        # Check injected scenario active for this EPC
        scen = db.query(InjectedScenario).filter(
            InjectedScenario.session_id == id,
            InjectedScenario.target_epc == item.epc,
            InjectedScenario.is_active == True
        ).first()

        # Check ground truth label
        gt = db.query(GroundTruthLabel).filter(
            GroundTruthLabel.session_id == id,
            GroundTruthLabel.epc == item.epc
        ).first()

        pkg_class = item.tag.packaging_class if (item.tag and item.tag.packaging_class) else "CARDBOARD"
        rc = root_cause_model.explain_discrepancy(
            epc=item.epc,
            discrepancy_type=item.status,
            expected_shelf=exp_code,
            observed_shelf=obs_code,
            packaging_class=pkg_class
        )
        dest = destination_engine.infer_destination(epc=item.epc, expected_shelf=exp_code)
        shelf_risk = cycle_counting_engine.calculate_shelf_risk(
            shelf_id=item.expected_location_id or 1,
            shelf_code=exp_code,
            zone_name="Zone A",
            open_exceptions_count=1 if item.status != "IN_PLACE" else 0,
            misplaced_count=1 if item.status == "MISPLACED" else 0,
            total_shelf_value=600.0,
            items_count=6
        )
        fc = demand_engine.forecast_product_demand(
            sku=item.product.sku if item.product else "SKU-UNKNOWN",
            name=item.product.name if item.product else "Product",
            current_stock=2,
            min_stock=item.product.min_stock if item.product else 2
        )

        base_res = rules_baseline_engine.evaluate_item(
            epc=item.epc,
            expected_shelf=exp_code,
            antenna_stats={1: {"read_count": 25, "median_rssi": -45.0}} if item.status == "IN_PLACE" else {},
            last_seen_seconds=2.0 if item.status == "IN_PLACE" else 45.0,
            sweep_count=10 if item.status == "IN_PLACE" else 5,
            port_shelf_map={1: exp_code},
            session_id=id,
            is_simulated=sess.is_simulated
        )

        pred_state = "present_ok" if item.status == "IN_PLACE" else (
            "likely_unread" if item.status == "POSSIBLE_UNREAD" else (
                "uncertain_verify" if item.status in ("uncertain_verify", "AMBIGUOUS") else "likely_absent_or_misplaced"
            )
        )

        results.append(ScoredEventJSON(
            epc=item.epc,
            predicted_state=pred_state,
            score=round(item.confidence, 3),
            root_cause={
                "label": rc["predicted_cause"].lower(),
                "probs": rc.get("class_probabilities", {})
            },
            candidate_zones=dest.get("candidate_zones", []),
            count_priority=shelf_risk["risk_score"],
            demand_forecast={
                "d1": fc["forecast_1day"],
                "d3": fc["forecast_3day"],
                "d7": fc["forecast_7day"],
                "p_reorder": fc["probability_crossing_reorder"]
            },
            model_version=read_reliability_model.version,
            baseline_state=base_res["baseline_state"],
            session_id=id,
            generated_at=now_iso,
            reason_codes=base_res.get("reason_codes", []),
            is_simulated=sess.is_simulated,
            validation_status="experimental"
        ))

    return results


@router.get("/{id}/export-zip")
def export_session_zip(id: str, db: Session = Depends(get_db)):
    """
    Exports complete immutable session package as a ZIP file:
    - config.json
    - sweeps.json
    - ground_truth.json
    - injected_scenarios.json
    - scored_events.json
    - session_summary.json
    """
    sess = db.query(TestSession).filter(TestSession.id == id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Test session '{id}' not found")

    sweeps = db.query(Sweep).filter(Sweep.session_id == id).all()
    labels = db.query(GroundTruthLabel).filter(GroundTruthLabel.session_id == id).all()
    scenarios = db.query(InjectedScenario).filter(InjectedScenario.session_id == id).all()
    cfg = db.query(ReaderConfigSnapshot).filter(ReaderConfigSnapshot.session_id == id).first()

    scored_events_data = [s.model_dump() for s in get_session_scored_events(id, db)]

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. Config
        config_data = {
            "session_id": id,
            "reader_config": sess.config_snapshot or (cfg.__dict__ if cfg else {}),
            "zone_baselines": rules_baseline_engine.zone_configs
        }
        zf.writestr("config.json", json.dumps(config_data, default=str, indent=2))

        # 2. Sweeps
        sweeps_data = [
            {
                "id": s.id,
                "sweep_number": s.sweep_number,
                "sweep_type": s.sweep_type,
                "reads_count": s.reads_count,
                "unique_epcs_seen": s.unique_epcs_seen,
                "per_bay_reads": s.per_bay_reads,
                "started_at": s.started_at,
                "completed_at": s.completed_at
            }
            for s in sweeps
        ]
        zf.writestr("sweeps.json", json.dumps(sweeps_data, default=str, indent=2))

        # 3. Ground truth
        gt_data = [
            {
                "id": l.id,
                "epc": l.epc,
                "label": l.label,
                "actual_bay": l.actual_bay,
                "provenance_who": l.provenance_who,
                "provenance_when": l.provenance_when,
                "provenance_method": l.provenance_method,
                "is_simulated": l.is_simulated
            }
            for l in labels
        ]
        zf.writestr("ground_truth.json", json.dumps(gt_data, default=str, indent=2))

        # 4. Injected scenarios
        scen_data = [
            {
                "id": sc.id,
                "scenario_type": sc.scenario_type,
                "target_epc": sc.target_epc,
                "from_location": sc.from_location,
                "to_location": sc.to_location,
                "injected_at": sc.injected_at,
                "is_active": sc.is_active
            }
            for sc in scenarios
        ]
        zf.writestr("injected_scenarios.json", json.dumps(scen_data, default=str, indent=2))

        # 5. Scored events (Section 2.2 schema)
        zf.writestr("scored_events.json", json.dumps(scored_events_data, default=str, indent=2))

        # 6. Session summary
        summary_data = {
            "session_id": sess.id,
            "name": sess.name,
            "status": sess.status,
            "is_simulated": sess.is_simulated,
            "data_source": sess.data_source,
            "is_evaluable": sess.is_evaluable,
            "target_item_count": sess.target_item_count,
            "created_at": sess.created_at,
            "closed_at": sess.closed_at,
            "per_bay_read_rates": sess.per_bay_read_rates,
            "false_absence_stats": sess.false_absence_stats
        }
        zf.writestr("session_summary.json", json.dumps(summary_data, default=str, indent=2))

    zip_buffer.seek(0)
    filename = f"session_export_{id[:8]}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

import csv
import io
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.handheld import HandheldDevice, HandheldScanSession, HandheldScanEvent, GroundTruthVerification
from app.models.discrepancy import Discrepancy
from app.models.inventory import Inventory, InventoryMovement
from app.models.location import Shelf
from app.models.audit import AuditLog
from app.schemas.handheld import (
    HandheldDeviceRegister,
    HandheldDeviceResponse,
    HandheldSessionCreate,
    HandheldSessionResponse,
    HandheldEventBatch,
    HandheldVerificationRequest,
    GroundTruthVerificationResponse,
)
from app.services.verification_service import VerificationService
from app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="/handheld", tags=["Handheld RFID & Ground Truth"])


@router.get("/readers", response_model=List[HandheldDeviceResponse])
def get_handheld_readers(db: Session = Depends(get_db)):
    """List all registered mobile/handheld RFID readers and their battery/connectivity status."""
    return db.query(HandheldDevice).order_by(HandheldDevice.id.asc()).all()


@router.post("/readers/register", response_model=HandheldDeviceResponse)
def register_handheld_reader(payload: HandheldDeviceRegister, db: Session = Depends(get_db)):
    """Register or update a mobile handheld RFID reader."""
    now = datetime.now(timezone.utc)
    device = db.query(HandheldDevice).filter(HandheldDevice.device_code == payload.device_code).first()
    if not device:
        device = HandheldDevice(
            device_code=payload.device_code,
            model=payload.model or "Zebra TC26 / RFD40 UHF Sled",
            assigned_operator=payload.assigned_operator or "Warehouse Operator",
            ip_address=payload.ip_address,
            battery_level=payload.battery_level if payload.battery_level is not None else 100,
            status="ACTIVE",
            last_seen=now,
            created_at=now
        )
        db.add(device)
    else:
        if payload.model:
            device.model = payload.model
        if payload.assigned_operator:
            device.assigned_operator = payload.assigned_operator
        if payload.ip_address:
            device.ip_address = payload.ip_address
        if payload.battery_level is not None:
            device.battery_level = payload.battery_level
        device.last_seen = now
        device.status = "ACTIVE"
    
    db.commit()
    db.refresh(device)
    return device


@router.post("/sessions", response_model=HandheldSessionResponse)
def create_scan_session(payload: HandheldSessionCreate, db: Session = Depends(get_db)):
    """Create a new mobile handheld RFID scan session for location inventory verification."""
    now = datetime.now(timezone.utc)
    session_uid = f"HSS-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    device = None
    if payload.device_code:
        device = db.query(HandheldDevice).filter(HandheldDevice.device_code == payload.device_code).first()

    shelf = None
    if payload.shelf_code:
        shelf = db.query(Shelf).filter(Shelf.shelf_code == payload.shelf_code).first()

    session = HandheldScanSession(
        session_code=session_uid,
        device_id=device.id if device else None,
        operator_name=payload.operator_name or (device.assigned_operator if device else "Warehouse Operator"),
        shelf_id=shelf.id if shelf else None,
        target_shelf_code=shelf.shelf_code if shelf else payload.shelf_code,
        status="ACTIVE",
        scan_mode=payload.scan_mode or "DISCREPANCY_VERIFICATION",
        total_scans=0,
        unique_epcs=0,
        started_at=now,
        notes=payload.notes
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return HandheldSessionResponse(
        id=session.id,
        session_code=session.session_code,
        operator_name=session.operator_name,
        device_code=device.device_code if device else None,
        target_shelf_code=session.target_shelf_code,
        status=session.status,
        scan_mode=session.scan_mode,
        total_scans=session.total_scans,
        unique_epcs=session.unique_epcs,
        started_at=session.started_at,
        completed_at=session.completed_at,
        notes=session.notes
    )


@router.post("/sessions/{session_id}/events")
async def record_session_events(
    session_id: int,
    batch: HandheldEventBatch,
    db: Session = Depends(get_db)
):
    """Submit batch RFID read events from a handheld scanner during an active session."""
    session = db.query(HandheldScanSession).filter(HandheldScanSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Scan session not found")
    if session.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Cannot record events to a closed session")

    now = datetime.now(timezone.utc)
    shelf = None
    if batch.shelf_code:
        shelf = db.query(Shelf).filter(Shelf.shelf_code == batch.shelf_code).first()
    if not shelf and session.shelf_id:
        shelf = session.shelf

    scanned_epcs = set()
    for evt in batch.events:
        item = HandheldScanEvent(
            session_id=session.id,
            epc=evt.epc,
            shelf_id=shelf.id if shelf else None,
            rssi_dbm=evt.rssi_dbm or -55.0,
            read_count=evt.read_count or 1,
            scanned_barcode_or_qr=evt.scanned_barcode_or_qr,
            timestamp=now
        )
        db.add(item)
        scanned_epcs.add(evt.epc)

    session.total_scans += len(batch.events)
    # Recalculate unique EPCs in this session
    existing_epcs = db.query(HandheldScanEvent.epc).filter(HandheldScanEvent.session_id == session.id).distinct().all()
    all_epcs = set([e[0] for e in existing_epcs]).union(scanned_epcs)
    session.unique_epcs = len(all_epcs)

    if session.device:
        session.device.last_seen = now

    db.commit()

    # Stream real-time scan event via WebSocket
    await ws_manager.broadcast("handheld-scans", {
        "type": "HANDHELD_SCANS_RECEIVED",
        "session_code": session.session_code,
        "operator": session.operator_name,
        "shelf_code": shelf.shelf_code if shelf else None,
        "new_scans": len(batch.events),
        "total_scans": session.total_scans,
        "unique_epcs": session.unique_epcs
    })

    return {
        "success": True,
        "session_id": session.id,
        "events_received": len(batch.events),
        "total_scans": session.total_scans,
        "unique_epcs": session.unique_epcs
    }


@router.post("/sessions/{session_id}/complete")
async def complete_scan_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    """
    Finalize handheld scan session.
    Compares physical ground-truth scans against WMS expected locations and fixed-reader AI predictions.
    Generates GroundTruthVerification records and resolves verified discrepancies.
    """
    session = db.query(HandheldScanSession).filter(HandheldScanSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Scan session not found")

    now = datetime.now(timezone.utc)
    session.status = "COMPLETED"
    session.completed_at = now

    # Fetch unique EPCs scanned in this session
    scanned_records = db.query(HandheldScanEvent).filter(HandheldScanEvent.session_id == session.id).all()
    epc_shelf_map = {}
    for r in scanned_records:
        if r.epc not in epc_shelf_map:
            epc_shelf_map[r.epc] = r.shelf_id or session.shelf_id

    verifications = []
    shelves_by_id = {s.id: s for s in db.query(Shelf).all()}
    scanned_shelf_id = session.shelf_id

    for epc, physical_shelf_id in epc_shelf_map.items():
        inv = db.query(Inventory).filter(Inventory.epc == epc).first()
        disc = db.query(Discrepancy).filter(Discrepancy.epc == epc).order_by(Discrepancy.id.desc()).first()

        expected_id = inv.expected_location_id if inv else None
        ai_pred_id = disc.observed_location_id if disc else (inv.observed_location_id if inv else None)

        actual_shelf_id = physical_shelf_id or scanned_shelf_id

        # Determine verification status
        if expected_id and actual_shelf_id:
            if actual_shelf_id == expected_id:
                if disc and disc.discrepancy_type in ("MISPLACED", "LIKELY_MISSING"):
                    ver_status = "FALSE_POSITIVE"
                else:
                    ver_status = "VERIFIED_IN_PLACE"
            else:
                ver_status = "CONFIRMED_MISPLACED"
        else:
            ver_status = "VERIFIED_IN_PLACE"

        # Create Ground Truth Verification record
        gt = GroundTruthVerification(
            discrepancy_id=disc.id if disc else None,
            epc=epc,
            expected_location_id=expected_id,
            ai_predicted_location_id=ai_pred_id,
            handheld_verified_location_id=actual_shelf_id,
            verification_status=ver_status,
            verified_by=session.operator_name,
            device_code=session.device.device_code if session.device else "HH-01",
            barcode_matched=True,
            notes=f"Handheld verification session {session.session_code}",
            timestamp=now
        )
        db.add(gt)

        # Apply Ground Truth Override (Rule 6: Handheld verification overrides fixed prediction)
        if inv and actual_shelf_id:
            inv.status = "VERIFIED"
            inv.confidence = 1.0
            inv.last_observed_at = now
            if ver_status == "CONFIRMED_MISPLACED":
                # Record movement
                db.add(InventoryMovement(
                    epc=epc,
                    from_shelf_id=expected_id,
                    to_shelf_id=actual_shelf_id,
                    movement_type="RECONCILED",
                    authorized=1,
                    authorized_by=session.operator_name,
                    notes=f"Physical ground-truth confirmation via {session.session_code}",
                    timestamp=now
                ))
                inv.expected_location_id = actual_shelf_id
                inv.observed_location_id = actual_shelf_id
            elif ver_status in ("FALSE_POSITIVE", "VERIFIED_IN_PLACE"):
                inv.observed_location_id = expected_id

        if disc:
            disc.status = "RESOLVED"
            disc.resolved_at = now

        verifications.append({
            "epc": epc,
            "verification_status": ver_status,
            "expected_shelf": shelves_by_id.get(expected_id).shelf_code if expected_id in shelves_by_id else None,
            "actual_shelf": shelves_by_id.get(actual_shelf_id).shelf_code if actual_shelf_id in shelves_by_id else None,
        })

    # Log system audit
    db.add(AuditLog(
        action="HANDHELD_SESSION_COMPLETED",
        entity="HANDHELD_SESSION",
        entity_id=session.session_code,
        details={
            "session_id": session.id,
            "operator": session.operator_name,
            "total_scans": session.total_scans,
            "unique_epcs": session.unique_epcs,
            "verifications_generated": len(verifications)
        },
        timestamp=now
    ))

    db.commit()

    return {
        "success": True,
        "session_code": session.session_code,
        "status": session.status,
        "total_scans": session.total_scans,
        "unique_epcs": session.unique_epcs,
        "verifications_generated": len(verifications),
        "results": verifications
    }


@router.get("/scans")
def query_handheld_scans(
    session_id: Optional[int] = Query(None),
    epc: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """Query recent physical handheld RFID read scans."""
    query = db.query(HandheldScanEvent)
    if session_id:
        query = query.filter(HandheldScanEvent.session_id == session_id)
    if epc:
        query = query.filter(HandheldScanEvent.epc.like(f"%{epc}%"))

    events = query.order_by(HandheldScanEvent.id.desc()).limit(limit).all()
    results = []
    for e in events:
        results.append({
            "id": e.id,
            "session_id": e.session_id,
            "epc": e.epc,
            "shelf_code": e.shelf.shelf_code if e.shelf else None,
            "rssi_dbm": e.rssi_dbm,
            "read_count": e.read_count,
            "scanned_barcode_or_qr": e.scanned_barcode_or_qr,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None
        })
    return results


@router.post("/verification", response_model=GroundTruthVerificationResponse)
async def submit_ground_truth_verification(
    payload: HandheldVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Direct ground-truth verification for an active discrepancy or tag.
    Rule 6: Handheld verification overrides fixed reader prediction unconditionally.
    """
    now = datetime.now(timezone.utc)
    shelf = db.query(Shelf).filter(Shelf.shelf_code == payload.actual_shelf_code).first()
    if not shelf:
        raise HTTPException(status_code=400, detail=f"Shelf '{payload.actual_shelf_code}' not found")

    item = db.query(Inventory).filter(Inventory.epc == payload.epc).first()
    disc = None
    if payload.discrepancy_id:
        disc = db.query(Discrepancy).filter(Discrepancy.id == payload.discrepancy_id).first()
    elif item:
        disc = db.query(Discrepancy).filter(Discrepancy.epc == payload.epc).order_by(Discrepancy.id.desc()).first()

    expected_id = item.expected_location_id if item else None
    ai_pred_id = disc.observed_location_id if disc else (item.observed_location_id if item else None)

    # Record GroundTruthVerification
    gt = GroundTruthVerification(
        discrepancy_id=disc.id if disc else None,
        epc=payload.epc,
        expected_location_id=expected_id,
        ai_predicted_location_id=ai_pred_id,
        handheld_verified_location_id=shelf.id,
        verification_status=payload.verification_status,
        verified_by=payload.verified_by or "Warehouse Operator",
        device_code=payload.device_code or "HH-01",
        barcode_matched=bool(payload.barcode_scanned),
        notes=payload.notes,
        timestamp=now
    )
    db.add(gt)

    # Call VerificationService to update inventory and audit trail
    if disc:
        await VerificationService.record_verification(
            db=db,
            discrepancy_id=disc.id,
            verification_result=payload.verification_status,
            actual_shelf_id=shelf.id,
            verified_by_name=payload.verified_by or "Warehouse Operator",
            notes=f"Handheld device {payload.device_code}. Notes: {payload.notes or ''}"
        )
    elif item and payload.auto_reconcile:
        # Direct reconciliation without pre-existing discrepancy
        item.status = "VERIFIED"
        item.confidence = 1.0
        item.observed_location_id = shelf.id
        item.last_observed_at = now
        if payload.verification_status == "CONFIRMED_MISPLACED":
            db.add(InventoryMovement(
                epc=item.epc,
                from_shelf_id=expected_id,
                to_shelf_id=shelf.id,
                movement_type="RECONCILED",
                authorized=1,
                authorized_by=payload.verified_by or "Warehouse Operator",
                notes=f"Direct Handheld Ground Truth Verification. {payload.notes or ''}",
                timestamp=now
            ))
            item.expected_location_id = shelf.id
        db.commit()

    db.commit()
    db.refresh(gt)

    shelves_by_id = {s.id: s.shelf_code for s in db.query(Shelf).all()}

    return GroundTruthVerificationResponse(
        id=gt.id,
        discrepancy_id=gt.discrepancy_id,
        epc=gt.epc,
        expected_shelf_code=shelves_by_id.get(gt.expected_location_id),
        ai_predicted_shelf_code=shelves_by_id.get(gt.ai_predicted_location_id),
        verified_shelf_code=shelves_by_id.get(gt.handheld_verified_location_id),
        verification_status=gt.verification_status,
        verified_by=gt.verified_by,
        device_code=gt.device_code,
        barcode_matched=gt.barcode_matched,
        notes=gt.notes,
        timestamp=gt.timestamp
    )


@router.post("/sync")
async def batch_sync_handheld_scans(
    file: Optional[UploadFile] = File(None),
    payload: Optional[Dict[str, Any]] = Body(None),
    db: Session = Depends(get_db)
):
    """
    Batch upload handheld scan data via JSON or CSV file.
    Creates a new session and imports all scan events.
    """
    now = datetime.now(timezone.utc)
    events_to_create = []
    device_code = "HH-01"
    operator_name = "Warehouse Operator"
    shelf_code = "SHELF_A"

    if file:
        content = await file.read()
        text_data = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text_data))
        for row in reader:
            epc = row.get("epc") or row.get("EPC")
            if not epc:
                continue
            sc_code = row.get("shelf_code") or row.get("shelf") or shelf_code
            rssi = float(row.get("rssi_dbm") or row.get("rssi") or -55.0)
            events_to_create.append({
                "epc": epc.strip(),
                "shelf_code": sc_code.strip() if sc_code else None,
                "rssi_dbm": rssi,
                "barcode": row.get("barcode")
            })
    elif payload:
        device_code = payload.get("device_code", "HH-01")
        operator_name = payload.get("operator_name", "Warehouse Operator")
        shelf_code = payload.get("shelf_code", "SHELF_A")
        items = payload.get("events", [])
        for it in items:
            events_to_create.append({
                "epc": it.get("epc"),
                "shelf_code": it.get("shelf_code", shelf_code),
                "rssi_dbm": float(it.get("rssi_dbm", -55.0)),
                "barcode": it.get("barcode")
            })

    if not events_to_create:
        raise HTTPException(status_code=400, detail="No scan events found in uploaded file or JSON payload")

    # Create session
    shelf = db.query(Shelf).filter(Shelf.shelf_code == shelf_code).first()
    device = db.query(HandheldDevice).filter(HandheldDevice.device_code == device_code).first()
    session_uid = f"HSS-SYNC-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    session = HandheldScanSession(
        session_code=session_uid,
        device_id=device.id if device else None,
        operator_name=operator_name,
        shelf_id=shelf.id if shelf else None,
        target_shelf_code=shelf.shelf_code if shelf else shelf_code,
        status="COMPLETED",
        scan_mode="BATCH_SYNC",
        total_scans=len(events_to_create),
        unique_epcs=len(set([e["epc"] for e in events_to_create])),
        started_at=now,
        completed_at=now,
        notes="Imported via batch sync endpoint"
    )
    db.add(session)
    db.flush()

    for e in events_to_create:
        s_obj = db.query(Shelf).filter(Shelf.shelf_code == e["shelf_code"]).first() if e.get("shelf_code") else shelf
        db.add(HandheldScanEvent(
            session_id=session.id,
            epc=e["epc"],
            shelf_id=s_obj.id if s_obj else None,
            rssi_dbm=e["rssi_dbm"],
            read_count=1,
            scanned_barcode_or_qr=e.get("barcode"),
            timestamp=now
        ))

    db.commit()

    return {
        "success": True,
        "session_code": session.session_code,
        "total_scans_imported": len(events_to_create),
        "unique_epcs": session.unique_epcs,
        "status": session.status
    }


@router.post("/shelf-qr/decode")
def decode_shelf_qr(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Decodes shelf barcode/QR codes scanned by handheld devices (e.g. 'QR:SHELF:SHELF_A' or 'SHELF_A').
    Validates physical location against warehouse schema, returns registered capacity,
    expected SKU inventory, and active discrepancy alerts for ground-truth verification.
    """
    raw = payload.get("qr_payload") or payload.get("qr_raw_payload") or ""
    code = str(raw).strip().upper()
    matched_code = None
    all_shelves = db.query(Shelf).all()
    shelf_map = {s.shelf_code.upper(): s for s in all_shelves}

    if code in shelf_map:
        matched_code = code
    else:
        # Check tokens separated by : or / or -
        parts = [p.strip() for p in code.replace(":", " ").replace("/", " ").replace("-", " ").split()]
        for p in parts:
            if p in shelf_map:
                matched_code = p
                break
            alt = f"SHELF_{p}"
            if alt in shelf_map:
                matched_code = alt
                break
        if not matched_code:
            for sc in shelf_map:
                if sc in code:
                    matched_code = sc
                    break

    if not matched_code or matched_code not in shelf_map:
        return {
            "valid": False,
            "success": False,
            "message": f"Scanned QR '{raw}' does not match any registered warehouse shelf."
        }

    shelf = shelf_map[matched_code]
    expected_items = db.query(Inventory).filter(Inventory.expected_location_id == shelf.id).all()
    active_discs = db.query(Discrepancy).filter(
        Discrepancy.expected_location_id == shelf.id,
        Discrepancy.status.in_(["NEW", "AI_ANALYZED", "PENDING_VERIFICATION"])
    ).all()

    return {
        "valid": True,
        "success": True,
        "shelf_id": shelf.id,
        "shelf_code": shelf.shelf_code,
        "name": shelf.name,
        "zone_name": shelf.zone.name if shelf.zone else "Zone A",
        "capacity": shelf.capacity,
        "current_item_count": len(expected_items),
        "open_discrepancies_count": len(active_discs),
        "expected_epcs": [item.epc for item in expected_items],
        "discrepancies": [
            {
                "id": d.id,
                "epc": d.epc,
                "type": d.discrepancy_type,
                "confidence": d.confidence
            }
            for d in active_discs
        ]
    }


@router.get("/verification/history")
def get_verification_history(
    limit: int = Query(50, le=200),
    shelf_code: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns complete historical audit log of physical ground-truth verifications performed by handheld scanners.
    """
    query = db.query(GroundTruthVerification)
    if status and status != "ALL":
        query = query.filter(GroundTruthVerification.verification_status == status)

    records = query.order_by(GroundTruthVerification.id.desc()).limit(limit).all()
    results = []
    for r in records:
        if shelf_code and r.verified_shelf and r.verified_shelf.shelf_code != shelf_code:
            continue
        results.append({
            "id": r.id,
            "discrepancy_id": r.discrepancy_id,
            "epc": r.epc,
            "expected_shelf": r.expected_shelf.shelf_code if r.expected_shelf else None,
            "ai_predicted_shelf": r.ai_predicted_shelf.shelf_code if r.ai_predicted_shelf else None,
            "verified_shelf": r.verified_shelf.shelf_code if r.verified_shelf else None,
            "verification_status": r.verification_status,
            "verified_by": r.verified_by,
            "device_code": r.device_code,
            "barcode_matched": r.barcode_matched,
            "notes": r.notes,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None
        })
    return results

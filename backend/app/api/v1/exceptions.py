from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.discrepancy import Discrepancy, VerificationLog
from app.models.inventory import Inventory
from app.models.ai_model import AIPrediction
from app.schemas.discrepancy import (
    DiscrepancyResponse, VerificationCreate,
    VerificationLogResponse, ResolveExceptionRequest
)
from app.services.verification_service import VerificationService
from app.services.audit_service import audit_service

router = APIRouter(prefix="/exceptions", tags=["AI Exceptions"])

# Documented state mappings (W6 compliance)
DISCREPANCY_TO_PREDICTED_STATE_MAP = {
    "IN_PLACE": "present_ok",
    "PRESENT_OK": "present_ok",
    "POSSIBLE_UNREAD": "likely_unread",
    "LIKELY_UNREAD": "likely_unread",
    "MISPLACED": "likely_absent_or_misplaced",
    "LIKELY_MISSING": "likely_absent_or_misplaced",
    "LIKELY_ABSENT_OR_MISPLACED": "likely_absent_or_misplaced",
    "AMBIGUOUS": "uncertain_verify",
    "UNCERTAIN_VERIFY": "uncertain_verify"
}

STATUS_TO_WORKFLOW_STATUS_MAP = {
    "NEW": "new",
    "AI_ANALYZED": "ai_analyzed",
    "PENDING_VERIFICATION": "pending_verification",
    "ASSIGNED": "pending_verification",
    "VERIFIED": "verified",
    "RESOLVED": "resolved"
}

@router.get("", response_model=List[DiscrepancyResponse])
def get_exceptions(
    status: Optional[str] = Query(None),
    shelf: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Discrepancy).options(
        joinedload(Discrepancy.inventory_item).joinedload(Inventory.product),
        joinedload(Discrepancy.expected_shelf),
        joinedload(Discrepancy.observed_shelf),
        joinedload(Discrepancy.ai_predictions)
    )
    if status and status != "ALL":
        query = query.filter(Discrepancy.status == status)
    elif not status:
        query = query.filter(Discrepancy.status != "RESOLVED")
    if type and type != "ALL":
        query = query.filter(Discrepancy.discrepancy_type == type)

    exceptions = query.order_by(Discrepancy.id.desc()).all()
    results = []

    for d in exceptions:
        inv = d.inventory_item
        prod = inv.product if inv else None
        
        # Filter by shelf if provided
        exp_code = d.expected_shelf.shelf_code if d.expected_shelf else "UNKNOWN"
        obs_code = d.observed_shelf.shelf_code if d.observed_shelf else None
        if shelf and (shelf != exp_code and shelf != obs_code):
            continue

        ai_pred = d.ai_predictions[0] if d.ai_predictions else None

        results.append(DiscrepancyResponse(
            id=d.id,
            epc=d.epc,
            product_name=prod.name if prod else "Unknown Item",
            product_sku=prod.sku if prod else "SKU-UNKNOWN",
            category=prod.category if prod else "General",
            discrepancy_type=d.discrepancy_type,
            expected_location_id=d.expected_location_id,
            expected_shelf_code=exp_code,
            observed_location_id=d.observed_location_id,
            observed_shelf_code=obs_code,
            confidence=d.confidence,
            root_cause=d.root_cause,
            status=d.status,
            predicted_state=d.predicted_state or DISCREPANCY_TO_PREDICTED_STATE_MAP.get(d.discrepancy_type.upper(), "uncertain_verify"),
            workflow_status=d.workflow_status or STATUS_TO_WORKFLOW_STATUS_MAP.get(d.status.upper(), "new"),
            is_simulated=bool(d.is_simulated) if d.is_simulated is not None else False,
            validation_status=d.validation_status or "experimental",
            assigned_to=d.assigned_to,
            verification_required=d.verification_required,
            created_at=d.created_at,
            resolved_at=d.resolved_at,
            ai_evidence=ai_pred.evidence if ai_pred else [f"System detected discrepancy {d.discrepancy_type}"],
            recommended_action=ai_pred.recommended_action if ai_pred else "VERIFY_PHYSICAL_LOCATION",
            candidate_locations=[
                {"shelf_code": obs_code or "SHELF_C", "probability": round(d.confidence, 2)},
                {"shelf_code": exp_code, "probability": round(max(0.05, 1.0 - d.confidence), 2)}
            ] if obs_code else []
        ))
    return results

@router.get("/{id}", response_model=DiscrepancyResponse)
def get_exception_details(id: int, db: Session = Depends(get_db)):
    d = db.query(Discrepancy).filter(Discrepancy.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    
    inv = d.inventory_item
    prod = inv.product if inv else None
    ai_pred = d.ai_predictions[0] if d.ai_predictions else None
    exp_code = d.expected_shelf.shelf_code if d.expected_shelf else "UNKNOWN"
    obs_code = d.observed_shelf.shelf_code if d.observed_shelf else None

    return DiscrepancyResponse(
        id=d.id,
        epc=d.epc,
        product_name=prod.name if prod else "Unknown Item",
        product_sku=prod.sku if prod else "SKU-UNKNOWN",
        category=prod.category if prod else "General",
        discrepancy_type=d.discrepancy_type,
        expected_location_id=d.expected_location_id,
        expected_shelf_code=exp_code,
        observed_location_id=d.observed_location_id,
        observed_shelf_code=obs_code,
        confidence=d.confidence,
        root_cause=d.root_cause,
        status=d.status,
        predicted_state=d.predicted_state or DISCREPANCY_TO_PREDICTED_STATE_MAP.get(d.discrepancy_type.upper(), "uncertain_verify"),
        workflow_status=d.workflow_status or STATUS_TO_WORKFLOW_STATUS_MAP.get(d.status.upper(), "new"),
        is_simulated=bool(d.is_simulated) if d.is_simulated is not None else False,
        validation_status=d.validation_status or "experimental",
        assigned_to=d.assigned_to,
        verification_required=d.verification_required,
        created_at=d.created_at,
        resolved_at=d.resolved_at,
        ai_evidence=ai_pred.evidence if ai_pred else [],
        recommended_action=ai_pred.recommended_action if ai_pred else "VERIFY_PHYSICAL_LOCATION",
        candidate_locations=[
            {"shelf_code": obs_code or "SHELF_C", "probability": round(d.confidence, 2)},
            {"shelf_code": exp_code, "probability": round(max(0.05, 1.0 - d.confidence), 2)}
        ] if obs_code else []
    )

@router.post("/{id}/assign")
def assign_exception(id: int, operator_name: str = Query("Alex Rivera"), db: Session = Depends(get_db)):
    """Assigns an exception to a designated warehouse operator for investigation."""
    d = db.query(Discrepancy).filter(Discrepancy.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    d.assigned_to = operator_name
    d.status = "ASSIGNED"
    db.commit()
    db.refresh(d)
    return {"success": True, "discrepancy_id": d.id, "assigned_to": d.assigned_to, "status": d.status}

@router.post("/{id}/acknowledge")
def acknowledge_exception(id: int, db: Session = Depends(get_db)):
    """Marks an exception as acknowledged and in progress."""
    d = db.query(Discrepancy).filter(Discrepancy.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    d.status = "PENDING_VERIFICATION"
    db.commit()
    db.refresh(d)
    return {"success": True, "discrepancy_id": d.id, "status": d.status}

@router.post("/{id}/verify")
async def verify_exception(id: int, verif_in: VerificationCreate, db: Session = Depends(get_db)):
    try:
        return await VerificationService.record_verification(
            db=db,
            discrepancy_id=id,
            verification_result=verif_in.verification_result,
            actual_shelf_id=verif_in.actual_location_id,
            verified_by_name=verif_in.verified_by_name,
            notes=verif_in.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{id}/resolve")
async def resolve_exception(id: int, res_in: ResolveExceptionRequest, db: Session = Depends(get_db)):
    try:
        return await VerificationService.resolve_exception(
            db=db,
            discrepancy_id=id,
            resolution_action=res_in.resolution_action,
            notes=res_in.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

class SafeOverrideRequest(BaseModel):
    override_state: str  # present_ok, likely_unread, likely_absent_or_misplaced, uncertain_verify
    confirmation: bool = True
    reason: str  # Mandatory justification
    supervisor_name: str = "supervisor"

@router.post("/{id}/override", response_model=DiscrepancyResponse)
def safe_manual_override(
    id: int,
    body: SafeOverrideRequest,
    db: Session = Depends(get_db)
):
    """
    Safe manual override with mandatory supervisor confirmation reason and audit log entry.
    Allows manual elevation or dismissal of AI discrepancy states.
    """
    if not body.confirmation:
        raise HTTPException(status_code=400, detail="Explicit confirmation is required for manual override")
    if not body.reason or len(body.reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="A detailed supervisor reason (min 5 chars) is mandatory for override")

    d = db.query(Discrepancy).filter(Discrepancy.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Discrepancy not found")

    old_state = d.predicted_state
    d.predicted_state = body.override_state
    d.workflow_status = "resolved"
    d.resolved_at = datetime.now(timezone.utc)
    d.notes = f"MANUAL OVERRIDE by {body.supervisor_name}: {body.reason}"
    db.commit()
    db.refresh(d)

    audit_service.log(
        db=db,
        action="SAFE_MANUAL_OVERRIDE",
        actor=body.supervisor_name,
        entity="DISCREPANCY",
        entity_id=str(d.id),
        details={
            "epc": d.epc,
            "old_state": old_state,
            "new_state": body.override_state,
            "reason": body.reason,
            "confirmed": True
        }
    )

    exp_code = d.expected_shelf.shelf_code if d.expected_shelf else "UNKNOWN"
    obs_code = d.observed_shelf.shelf_code if d.observed_shelf else None
    inv = d.inventory_item
    prod = inv.product if inv else None

    return DiscrepancyResponse(
        id=d.id,
        epc=d.epc,
        product_name=prod.name if prod else "Unknown Item",
        product_sku=prod.sku if prod else "SKU-UNKNOWN",
        category=prod.category if prod else "General",
        discrepancy_type=d.discrepancy_type,
        expected_location_id=d.expected_location_id,
        expected_shelf_code=exp_code,
        observed_location_id=d.observed_location_id,
        observed_shelf_code=obs_code,
        confidence=d.confidence,
        root_cause=d.root_cause,
        status="RESOLVED",
        predicted_state=d.predicted_state,
        workflow_status=d.workflow_status,
        is_simulated=bool(d.is_simulated) if d.is_simulated is not None else False,
        validation_status=d.validation_status or "experimental",
        assigned_to=d.assigned_to,
        verification_required=False,
        created_at=d.created_at,
        resolved_at=d.resolved_at,
        ai_evidence=[f"Manual supervisor override applied: {body.reason}"],
        recommended_action="OVERRIDE_CONFIRMED",
        candidate_locations=[]
    )

@router.post("/{id}/reopen")
def reopen_exception(id: int, reason: str = Query("Re-observed or contested resolution"), db: Session = Depends(get_db)):
    """Reopens a previously resolved exception for fresh physical audit."""
    d = db.query(Discrepancy).filter(Discrepancy.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    d.status = "PENDING_VERIFICATION"
    d.resolved_at = None
    db.commit()
    db.refresh(d)
    return {"success": True, "discrepancy_id": d.id, "status": d.status, "reason": reason}


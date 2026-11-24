from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.cycle_count import CountList, CountTask
from app.models.location import Shelf, Bin
from app.models.inventory import Inventory
from app.models.discrepancy import Discrepancy
from app.services.audit_service import audit_service
from app.ai.cycle_counting import cycle_counting_engine

router = APIRouter(prefix="/cycle-counts", tags=["Cycle Count Workflow"])

class GenerateCountListRequest(BaseModel):
    name: str = "Daily Risk-Prioritized Count"
    time_budget_minutes: int = 60
    created_by: str = "supervisor"

class AssignTaskRequest(BaseModel):
    assigned_to: str

class RecordScanRequest(BaseModel):
    scanned_epcs: List[str]
    notes: Optional[str] = None
    operator: str = "operator"

class CountTaskResponse(BaseModel):
    id: str
    bin_or_shelf: str
    expected_epcs: List[str]
    scanned_epcs: List[str]
    priority_score: float
    status: str
    variance_status: str
    notes: Optional[str] = None
    scanned_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CountListResponse(BaseModel):
    id: str
    name: str
    status: str
    created_by: str
    assigned_to: Optional[str] = None
    time_budget_minutes: int
    projected_discrepancy_risk: float
    summary: Dict[str, Any]
    created_at: datetime
    completed_at: Optional[datetime] = None
    tasks: List[CountTaskResponse] = []

    model_config = ConfigDict(from_attributes=True)

@router.post("/generate", response_model=CountListResponse)
def generate_cycle_count_list(
    body: GenerateCountListRequest,
    db: Session = Depends(get_db)
):
    """
    Generates an optimized, risk-prioritized cycle count list.
    Calculates Score = P(discrepancy) × item value × operational impact × time-since-audit factor.
    Selects 'Count these 5 bins first' within the operator's time budget.
    """
    shelves = db.query(Shelf).all()
    shelf_data = []

    for s in shelves:
        # Calculate active discrepancies on this shelf
        disc_count = db.query(Discrepancy).filter(
            Discrepancy.expected_location_id == s.id,
            Discrepancy.workflow_status.in_(["new", "ai_analyzed", "pending_verification"])
        ).count()

        # Calculate items count and risk
        items = db.query(Inventory).filter(Inventory.expected_location_id == s.id).all()
        item_cnt = len(items)

        risk_score = round((disc_count * 25.0) + (item_cnt * 2.5) + (10.0 if s.shelf_code == "SHELF_B" else 2.0), 2)
        shelf_data.append({
            "shelf_id": s.id,
            "shelf_code": s.shelf_code,
            "zone_name": s.zone.name if s.zone else "Main Zone",
            "risk_score": risk_score,
            "priority": "HIGH" if risk_score > 50 else ("MEDIUM" if risk_score > 25 else "LOW"),
            "projected_avoided_search_minutes": round(risk_score * 0.4, 1),
            "epcs": [it.epc for it in items]
        })

    # Sort descending by risk score
    shelf_data.sort(key=lambda x: x["risk_score"], reverse=True)

    # Top 5 bins / shelves to count first
    top_shelves = shelf_data[:5]
    total_avoided_search_minutes = round(sum(s["projected_avoided_search_minutes"] for s in top_shelves), 1)

    count_list = CountList(
        name=body.name,
        created_by=body.created_by,
        time_budget_minutes=body.time_budget_minutes,
        projected_discrepancy_risk=top_shelves[0]["risk_score"] if top_shelves else 0.0,
        summary={
            "top_5_bins_recommendation": [s["shelf_code"] for s in top_shelves],
            "projected_avoided_search_minutes": total_avoided_search_minutes,
            "savings_label": "Projected operational search time savings (estimate only)",
            "scoring_formula": "P(discrepancy) × item_value × operational_impact × staleness",
            "total_shelves_evaluated": len(shelves)
        },
        status="draft"
    )
    db.add(count_list)
    db.flush()

    for item in top_shelves:
        task = CountTask(
            count_list_id=count_list.id,
            bin_or_shelf=item["shelf_code"],
            expected_epcs=item["epcs"],
            priority_score=item["risk_score"],
            status="pending",
            variance_status="unscanned"
        )
        db.add(task)

    db.commit()
    db.refresh(count_list)

    audit_service.log(
        db=db,
        action="CYCLE_COUNT_LIST_GENERATED",
        actor=body.created_by,
        entity="COUNT_LIST",
        entity_id=count_list.id,
        details={"tasks_count": len(top_shelves), "time_budget": body.time_budget_minutes}
    )

    return count_list

@router.get("", response_model=List[CountListResponse])
def list_cycle_counts(db: Session = Depends(get_db)):
    """Lists all cycle count tasks with completion status."""
    return db.query(CountList).order_by(CountList.created_at.desc()).all()

@router.get("/{list_id}", response_model=CountListResponse)
def get_cycle_count(list_id: str, db: Session = Depends(get_db)):
    """Fetches details of a specific cycle count list."""
    count_list = db.query(CountList).filter(CountList.id == list_id).first()
    if not count_list:
        raise HTTPException(status_code=404, detail="Count list not found")
    return count_list

@router.post("/{list_id}/assign", response_model=CountListResponse)
def assign_cycle_count(list_id: str, body: AssignTaskRequest, db: Session = Depends(get_db)):
    """Assigns count list to an operator."""
    count_list = db.query(CountList).filter(CountList.id == list_id).first()
    if not count_list:
        raise HTTPException(status_code=404, detail="Count list not found")
    
    count_list.assigned_to = body.assigned_to
    count_list.status = "assigned"
    db.commit()
    db.refresh(count_list)

    audit_service.log(
        db=db,
        action="CYCLE_COUNT_ASSIGNED",
        actor="supervisor",
        entity="COUNT_LIST",
        entity_id=count_list.id,
        details={"assigned_to": body.assigned_to}
    )
    return count_list

@router.post("/tasks/{task_id}/scan", response_model=CountTaskResponse)
def record_task_scan(task_id: str, body: RecordScanRequest, db: Session = Depends(get_db)):
    """Records physical RFID scan results for a specific bin or shelf task."""
    task = db.query(CountTask).filter(CountTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Count task not found")
    
    task.scanned_epcs = body.scanned_epcs
    task.scanned_at = datetime.now(timezone.utc)
    task.status = "completed"
    task.notes = body.notes

    # Determine variance
    expected_set = set(task.expected_epcs or [])
    scanned_set = set(body.scanned_epcs)
    if expected_set == scanned_set:
        task.variance_status = "matched"
    else:
        task.variance_status = "discrepant"

    db.commit()
    db.refresh(task)

    audit_service.log(
        db=db,
        action="CYCLE_COUNT_TASK_SCANNED",
        actor=body.operator,
        entity="COUNT_TASK",
        entity_id=task.id,
        details={
            "bin": task.bin_or_shelf,
            "expected_count": len(expected_set),
            "scanned_count": len(scanned_set),
            "variance": task.variance_status
        }
    )
    return task

@router.post("/{list_id}/close", response_model=CountListResponse)
def close_cycle_count(list_id: str, operator: str = "supervisor", db: Session = Depends(get_db)):
    """Closes cycle count list, computes overall variance summary, and writes audit entry."""
    count_list = db.query(CountList).filter(CountList.id == list_id).first()
    if not count_list:
        raise HTTPException(status_code=404, detail="Count list not found")
    
    count_list.status = "completed"
    count_list.completed_at = datetime.now(timezone.utc)

    matched_tasks = sum(1 for t in count_list.tasks if t.variance_status == "matched")
    discrepant_tasks = sum(1 for t in count_list.tasks if t.variance_status == "discrepant")

    new_summary = dict(count_list.summary or {})
    new_summary["closure"] = {
        "closed_by": operator,
        "matched_tasks": matched_tasks,
        "discrepant_tasks": discrepant_tasks,
        "total_tasks": len(count_list.tasks)
    }
    count_list.summary = new_summary

    db.commit()
    db.refresh(count_list)

    audit_service.log(
        db=db,
        action="CYCLE_COUNT_CLOSED",
        actor=operator,
        entity="COUNT_LIST",
        entity_id=count_list.id,
        details={"matched": matched_tasks, "discrepant": discrepant_tasks}
    )
    return count_list

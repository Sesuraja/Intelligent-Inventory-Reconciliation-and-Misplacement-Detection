from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.services.inventory_service import InventoryService
from app.schemas.dashboard import DashboardSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Provides high-level KPIs, inventory status donut, discrepancy trends, and shelf distributions."""
    return InventoryService.get_dashboard_summary(db)

@router.get("/inventory-status")
def get_inventory_status_breakdown(db: Session = Depends(get_db)):
    """Returns inventory status distribution breakdown for donut chart."""
    summary = InventoryService.get_dashboard_summary(db)
    return {"status_distribution": summary["status_distribution"]}

@router.get("/rfid-activity")
def get_rfid_activity_timeline(db: Session = Depends(get_db)):
    """Returns 24-hour / weekly RFID read activity histogram."""
    summary = InventoryService.get_dashboard_summary(db)
    return {"rfid_activity": summary.get("scanning_activity", [])}

@router.get("/shelf-summary")
def get_shelf_inventory_summary(db: Session = Depends(get_db)):
    """Returns shelf-wise capacity utilization and discrepancy density."""
    summary = InventoryService.get_dashboard_summary(db)
    return {"shelf_distribution": summary.get("shelf_distribution", [])}

@router.get("/recent-exceptions")
def get_recent_dashboard_exceptions(db: Session = Depends(get_db)):
    """Returns the most recent unresolved AI exceptions for immediate operator attention."""
    from app.models.discrepancy import Discrepancy
    recent_discs = db.query(Discrepancy).filter(Discrepancy.status != "RESOLVED").order_by(Discrepancy.id.desc()).limit(5).all()
    res = []
    for d in recent_discs:
        res.append({
            "id": d.id,
            "epc": d.epc,
            "discrepancy_type": d.discrepancy_type,
            "confidence": d.confidence,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None
        })
    return {"recent_discrepancies": res}


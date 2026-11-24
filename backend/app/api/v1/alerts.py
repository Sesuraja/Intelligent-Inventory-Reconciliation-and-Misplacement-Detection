from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.alert import Alert
from app.services.audit_service import audit_service
from app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="/alerts", tags=["Alerts Management"])

class AlertCreate(BaseModel):
    alert_type: str  # reader_outage, high_confidence_discrepancy, stale_data, model_drift, failed_job
    severity: str = "warning"  # info, warning, critical
    title: str
    description: str
    source: str
    channels: List[str] = ["in_app"]
    metadata_json: Dict[str, Any] = {}

class AlertAcknowledge(BaseModel):
    actor: str = "operator"
    notes: Optional[str] = None

class AlertSnooze(BaseModel):
    snooze_minutes: int = 30
    actor: str = "operator"

class AlertResponse(BaseModel):
    id: str
    alert_type: str
    severity: str
    title: str
    description: str
    source: str
    channels: List[str]
    status: str
    snoozed_until: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    metadata_json: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    alert_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Lists alerts with optional filtering by status, severity, and type."""
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status)
    if severity:
        query = query.filter(Alert.severity == severity)
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)
    
    alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()

    # Check for auto-un-snoozing expired snoozes
    now = datetime.now(timezone.utc)
    for a in alerts:
        if a.status == "snoozed" and a.snoozed_until:
            snoozed_dt = a.snoozed_until.replace(tzinfo=timezone.utc) if a.snoozed_until.tzinfo is None else a.snoozed_until
            if snoozed_dt <= now:
                a.status = "active"
                db.commit()
    return alerts

@router.post("", response_model=AlertResponse)
async def create_alert(alert_in: AlertCreate, db: Session = Depends(get_db)):
    """Creates a new alert and broadcasts to configured channels."""
    alert = Alert(
        alert_type=alert_in.alert_type,
        severity=alert_in.severity,
        title=alert_in.title,
        description=alert_in.description,
        source=alert_in.source,
        channels=alert_in.channels,
        metadata_json=alert_in.metadata_json,
        status="active"
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Broadcast via WebSocket for in_app notifications
    await ws_manager.broadcast("ai-alerts", {
        "type": "ALERT_NOTIFICATION",
        "alert_id": alert.id,
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "title": alert.title,
        "source": alert.source
    })

    audit_service.log(
        db=db,
        action="ALERT_TRIGGERED",
        actor="system",
        entity="ALERT",
        entity_id=alert.id,
        details={"alert_type": alert.alert_type, "severity": alert.severity, "source": alert.source}
    )

    return alert

@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(alert_id: str, body: AlertAcknowledge, db: Session = Depends(get_db)):
    """Acknowledges an active alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = "acknowledged"
    alert.acknowledged_by = body.actor
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)

    audit_service.log(
        db=db,
        action="ALERT_ACKNOWLEDGED",
        actor=body.actor,
        entity="ALERT",
        entity_id=alert.id,
        details={"notes": body.notes}
    )

    return alert

@router.post("/{alert_id}/snooze", response_model=AlertResponse)
def snooze_alert(alert_id: str, body: AlertSnooze, db: Session = Depends(get_db)):
    """Snoozes an alert for a specified duration in minutes."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = "snoozed"
    alert.snoozed_until = datetime.now(timezone.utc) + timedelta(minutes=body.snooze_minutes)
    db.commit()
    db.refresh(alert)

    audit_service.log(
        db=db,
        action="ALERT_SNOOZED",
        actor=body.actor,
        entity="ALERT",
        entity_id=alert.id,
        details={"snooze_minutes": body.snooze_minutes, "until": alert.snoozed_until.isoformat()}
    )

    return alert

@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(alert_id: str, actor: str = "operator", db: Session = Depends(get_db)):
    """Resolves an alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = "resolved"
    db.commit()
    db.refresh(alert)

    audit_service.log(
        db=db,
        action="ALERT_RESOLVED",
        actor=actor,
        entity="ALERT",
        entity_id=alert.id
    )

    return alert

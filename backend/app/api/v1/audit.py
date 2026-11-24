from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.core.database import get_db
from app.models.audit import AuditLog
from app.services.audit_service import audit_service
from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/audit", tags=["Audit Log & Hash Verification"])

@router.get("/logs")
def get_audit_logs(
    entity: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns audit trail records with SHA-256 cryptographic chaining metadata.
    """
    query = db.query(AuditLog)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if action:
        query = query.filter(AuditLog.action == action)
    
    total = query.count()
    records = query.order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": [
            {
                "id": r.id,
                "actor": r.actor,
                "action": r.action,
                "entity": r.entity,
                "entity_id": r.entity_id,
                "details": r.details,
                "prev_hash": r.prev_hash,
                "entry_hash": r.entry_hash,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None
            }
            for r in records
        ]
    }

@router.get("/verify-chain")
def verify_audit_chain(db: Session = Depends(get_db)):
    """
    Validates the cryptographic SHA-256 hash chain of the audit log.
    Ensures that no records have been modified, deleted, or inserted out of order.
    """
    res = audit_service.verify_chain(db)
    return res

@router.get("/export")
def export_audit_trail(db: Session = Depends(get_db)):
    """
    Exports full audit trail for external compliance / regulatory verification.
    """
    records = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    verification = audit_service.verify_chain(db)
    
    return {
        "export_timestamp": verification.get("verified_at"),
        "integrity_verified": verification.get("valid", False),
        "total_records": len(records),
        "audit_trail": [
            {
                "id": r.id,
                "actor": r.actor,
                "action": r.action,
                "entity": r.entity,
                "entity_id": r.entity_id,
                "details": r.details,
                "prev_hash": r.prev_hash,
                "entry_hash": r.entry_hash,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None
            }
            for r in records
        ]
    }

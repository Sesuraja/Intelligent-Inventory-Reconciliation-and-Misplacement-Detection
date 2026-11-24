from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    entity_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    actor = Column(String(100), default="system", nullable=False)
    prev_hash = Column(String(64), nullable=True)
    entry_hash = Column(String(64), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="audit_logs")

from sqlalchemy import event

@event.listens_for(AuditLog, "before_insert")
def audit_log_before_insert(mapper, connection, target):
    """
    Ensures every AuditLog record has a valid SHA-256 hash chaining to the previous record,
    even if created via direct db.add(AuditLog(...)).
    """
    if not target.prev_hash or not target.entry_hash:
        from app.services.audit_service import audit_service
        try:
            result = connection.exec_driver_sql(
                "SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1"
            ).fetchone()
            prev = result[0] if (result and result[0]) else audit_service.GENESIS_HASH
        except Exception:
            prev = audit_service.GENESIS_HASH
        
        target.prev_hash = prev
        target.actor = target.actor or "system"
        target.entry_hash = audit_service.compute_hash(
            prev_hash=prev,
            timestamp=target.timestamp or datetime.now(timezone.utc),
            action=target.action,
            entity=target.entity,
            entity_id=target.entity_id,
            actor=target.actor,
            details=target.details
        )

class SystemEvent(Base):
    __tablename__ = "system_events"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(100), nullable=False)  # RFID_COLLECTOR, AI_ENGINE, RECONCILIATION, API
    event_type = Column(String(100), nullable=False)  # INFO, WARNING, ERROR, READER_DISCONNECTED, RECONNECTED
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


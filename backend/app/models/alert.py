import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON, Text
from app.core.database import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_type = Column(String, nullable=False, index=True)  # reader_outage, high_confidence_discrepancy, stale_data, model_drift, failed_job
    severity = Column(String, default="warning", index=True)  # info, warning, critical
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    source = Column(String, nullable=False)  # e.g. READER_01, SHELF_B, AI_MODEL
    channels = Column(JSON, default=lambda: ["in_app"])  # ["in_app", "email", "webhook"]
    status = Column(String, default="active", index=True)  # active, acknowledged, snoozed, resolved
    snoozed_until = Column(DateTime, nullable=True)
    acknowledged_by = Column(String, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

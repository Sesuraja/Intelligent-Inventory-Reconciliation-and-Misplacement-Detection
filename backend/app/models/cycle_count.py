import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class CountList(Base):
    __tablename__ = "count_lists"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    status = Column(String, default="draft", index=True)  # draft, assigned, in_progress, completed, cancelled
    created_by = Column(String, default="supervisor")
    assigned_to = Column(String, nullable=True)
    time_budget_minutes = Column(Integer, default=60)
    projected_discrepancy_risk = Column(Float, default=0.0)
    summary = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    completed_at = Column(DateTime, nullable=True)

    tasks = relationship("CountTask", back_populates="count_list", cascade="all, delete-orphan")


class CountTask(Base):
    __tablename__ = "count_tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    count_list_id = Column(String, ForeignKey("count_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    bin_or_shelf = Column(String, nullable=False, index=True)
    expected_epcs = Column(JSON, default=list)
    scanned_epcs = Column(JSON, default=list)
    priority_score = Column(Float, default=0.0)
    status = Column(String, default="pending", index=True)  # pending, scanning, completed
    variance_status = Column(String, default="unscanned")  # matched, discrepant, unscanned
    notes = Column(Text, nullable=True)
    scanned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    count_list = relationship("CountList", back_populates="tasks")

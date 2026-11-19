from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class LocationPrediction(Base):
    __tablename__ = "location_predictions"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), index=True, nullable=False)
    predicted_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    confidence = Column(Float, nullable=False)
    candidate_locations = Column(JSON, nullable=True)  # [{"shelf_code": "SHELF_A", "probability": 0.92}]
    predicted_state = Column(String(50), nullable=False)  # IN_PLACE, MISPLACED, AMBIGUOUS, UNREAD, MISSING
    verification_required = Column(Boolean, default=False)
    model_version = Column(String(50), default="v1.0.0")
    predicted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    predicted_shelf = relationship("Shelf")

class Discrepancy(Base):
    __tablename__ = "discrepancies"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), ForeignKey("inventory.epc"), index=True, nullable=False)
    discrepancy_type = Column(String(50), nullable=False)  # MISPLACED, LIKELY_MISSING, POSSIBLE_UNREAD, AMBIGUOUS
    expected_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    observed_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    confidence = Column(Float, default=0.0)
    root_cause = Column(String(100), nullable=True)
    status = Column(String(50), default="NEW")  # NEW, AI_ANALYZED, PENDING_VERIFICATION, ASSIGNED, VERIFIED, RESOLVED
    assigned_to = Column(String(100), nullable=True)
    verification_required = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    resolved_at = Column(DateTime, nullable=True)

    inventory_item = relationship("Inventory", back_populates="discrepancies")
    expected_shelf = relationship("Shelf", foreign_keys=[expected_location_id])
    observed_shelf = relationship("Shelf", foreign_keys=[observed_location_id])
    ai_predictions = relationship("AIPrediction", back_populates="discrepancy", cascade="all, delete-orphan")
    verification_logs = relationship("VerificationLog", back_populates="discrepancy", cascade="all, delete-orphan")

class VerificationLog(Base):
    __tablename__ = "verification_logs"

    id = Column(Integer, primary_key=True, index=True)
    discrepancy_id = Column(Integer, ForeignKey("discrepancies.id"), nullable=False)
    epc = Column(String(64), index=True, nullable=False)
    actual_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    verified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_by_name = Column(String(100), default="Warehouse Operator")
    verification_result = Column(String(50), nullable=False)  # CONFIRMED_PRESENT, CONFIRMED_MISPLACED, CONFIRMED_MISSING, CONFIRMED_MISSED_READ
    before_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    after_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    discrepancy = relationship("Discrepancy", back_populates="verification_logs")
    verifier = relationship("User", back_populates="verifications")
    actual_shelf = relationship("Shelf", foreign_keys=[actual_location_id])


from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class HandheldDevice(Base):
    __tablename__ = "handheld_devices"

    id = Column(Integer, primary_key=True, index=True)
    device_code = Column(String(50), unique=True, index=True, nullable=False)
    model = Column(String(100), default="Zebra TC26 / RFD40 UHF Sled")
    assigned_operator = Column(String(100), default="Alex Rivera")
    status = Column(String(50), default="ACTIVE")  # ACTIVE, IDLE, OFFLINE, CHARGING
    battery_level = Column(Integer, default=95)
    ip_address = Column(String(50), nullable=True)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    sessions = relationship("HandheldScanSession", back_populates="device")


class HandheldScanSession(Base):
    __tablename__ = "handheld_scan_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_code = Column(String(64), unique=True, index=True, nullable=False)
    device_id = Column(Integer, ForeignKey("handheld_devices.id"), nullable=True)
    operator_name = Column(String(100), default="Warehouse Operator")
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    target_shelf_code = Column(String(50), nullable=True)
    status = Column(String(50), default="ACTIVE")  # ACTIVE, COMPLETED, CANCELLED
    scan_mode = Column(String(50), default="DISCREPANCY_VERIFICATION")  # SINGLE_LOCATION, CYCLE_COUNT, DISCREPANCY_VERIFICATION
    total_scans = Column(Integer, default=0)
    unique_epcs = Column(Integer, default=0)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    device = relationship("HandheldDevice", back_populates="sessions")
    shelf = relationship("Shelf")
    events = relationship("HandheldScanEvent", back_populates="session", cascade="all, delete-orphan")


class HandheldScanEvent(Base):
    __tablename__ = "handheld_scan_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("handheld_scan_sessions.id"), nullable=False, index=True)
    epc = Column(String(64), index=True, nullable=False)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    rssi_dbm = Column(Float, default=-55.0)
    read_count = Column(Integer, default=1)
    scanned_barcode_or_qr = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    session = relationship("HandheldScanSession", back_populates="events")
    shelf = relationship("Shelf")


class GroundTruthVerification(Base):
    __tablename__ = "ground_truth_verifications"

    id = Column(Integer, primary_key=True, index=True)
    discrepancy_id = Column(Integer, ForeignKey("discrepancies.id"), nullable=True)
    epc = Column(String(64), index=True, nullable=False)
    expected_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    ai_predicted_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    handheld_verified_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    verification_status = Column(String(50), nullable=False)  # CONFIRMED_MISPLACED, FALSE_POSITIVE, CONFIRMED_MISSING, CONFIRMED_MISSED_READ, VERIFIED_IN_PLACE
    verified_by = Column(String(100), default="Warehouse Operator")
    device_code = Column(String(50), nullable=True)
    barcode_matched = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    expected_shelf = relationship("Shelf", foreign_keys=[expected_location_id])
    ai_predicted_shelf = relationship("Shelf", foreign_keys=[ai_predicted_location_id])
    verified_shelf = relationship("Shelf", foreign_keys=[handheld_verified_location_id])
    discrepancy = relationship("Discrepancy")

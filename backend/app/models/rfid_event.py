from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class RFIDEvent(Base):
    __tablename__ = "rfid_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    epc = Column(String(64), index=True, nullable=False)
    reader_id = Column(String(50), index=True, nullable=False)
    antenna_id = Column(Integer, ForeignKey("antennas.id"), index=True, nullable=False)
    rssi_dbm = Column(Float, nullable=False)
    frequency = Column(Float, nullable=True)
    observed_at = Column(DateTime, nullable=False, index=True)
    received_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    valid = Column(Boolean, default=True)
    source = Column(String(20), default="SIMULATION", nullable=False, index=True)  # SIMULATION or PHYSICAL
    raw_payload = Column(JSON, nullable=True)

    antenna = relationship("Antenna", back_populates="rfid_events")

class ObservationWindow(Base):
    __tablename__ = "observation_windows"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), index=True, nullable=False)
    window_start = Column(DateTime, nullable=False, index=True)
    window_end = Column(DateTime, nullable=False)
    features = Column(JSON, nullable=False)  # Map of antenna counts, rssi stats, etc.
    primary_antenna_id = Column(Integer, nullable=True)
    total_read_count = Column(Integer, default=0)
    median_rssi = Column(Float, nullable=True)
    source = Column(String(20), default="SIMULATION", nullable=False, index=True)  # SIMULATION or PHYSICAL
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Reader(Base):
    __tablename__ = "readers"

    id = Column(Integer, primary_key=True, index=True)
    reader_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=True)
    model = Column(String(100), default="Impinj Speedway R420 (4-Port UHF)")
    ip_address = Column(String(50), default="192.168.1.100")
    port = Column(Integer, default=5084)
    protocol = Column(String(30), default="LLRP")  # LLRP, VENDOR_SDK, MOCK_SIMULATOR
    status = Column(String(30), default="ONLINE")   # ONLINE, OFFLINE, RECONNECTING, ERROR
    last_heartbeat = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    location_desc = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    antennas = relationship("Antenna", back_populates="reader", cascade="all, delete-orphan")

class Antenna(Base):
    __tablename__ = "antennas"

    id = Column(Integer, primary_key=True, index=True)
    reader_id = Column(Integer, ForeignKey("readers.id"), nullable=False)
    antenna_code = Column(String(50), unique=True, index=True, nullable=False)
    port_number = Column(Integer, nullable=False)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    tx_power_dbm = Column(Float, default=30.0)
    gain_dbi = Column(Float, default=6.0)
    beam_angle_deg = Column(Float, default=70.0)
    is_active = Column(Boolean, default=True)
    purpose = Column(String(50), default="Primary detection")

    reader = relationship("Reader", back_populates="antennas")
    shelf = relationship("Shelf", back_populates="antennas")
    calibrations = relationship("AntennaCalibration", back_populates="antenna", cascade="all, delete-orphan")
    rfid_events = relationship("RFIDEvent", back_populates="antenna")

class AntennaCalibration(Base):
    __tablename__ = "antenna_calibrations"

    id = Column(Integer, primary_key=True, index=True)
    antenna_id = Column(Integer, ForeignKey("antennas.id"), nullable=False)
    median_rssi_baseline = Column(Float, default=-45.0)
    noise_floor_dbm = Column(Float, default=-85.0)
    cross_read_leakage_dbm = Column(Float, default=-68.0)
    config = Column(JSON, nullable=True)
    calibration_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    antenna = relationship("Antenna", back_populates="calibrations")


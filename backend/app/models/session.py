"""
Session, Sweep, Ground Truth Label, Injected Scenario, and Reader Config Snapshot Models.
Implements Section 2.1 data pipeline requirements.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean, JSON, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class TestSession(Base):
    """
    Test session for evaluating inventory reconciliation.
    Lifecycle: created -> baseline_truth -> sweeping -> scenario_injected -> verification -> closed.
    Immutable once closed.
    A session can be marked evaluable only when 100% of test items have ground truth.
    """
    __tablename__ = "test_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    status = Column(String(50), default="created", nullable=False, index=True)
    is_simulated = Column(Boolean, default=True, nullable=False)
    data_source = Column(String(20), default="simulated", nullable=False)  # real | simulated | hybrid
    is_evaluable = Column(Boolean, default=False, nullable=False)
    target_item_count = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    per_bay_read_rates = Column(JSON, nullable=True)
    false_absence_stats = Column(JSON, nullable=True)
    config_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    closed_at = Column(DateTime, nullable=True)

    sweeps = relationship("Sweep", back_populates="session", cascade="all, delete-orphan", order_by="Sweep.sweep_number")
    ground_truth_labels = relationship("GroundTruthLabel", back_populates="session", cascade="all, delete-orphan")
    injected_scenarios = relationship("InjectedScenario", back_populates="session", cascade="all, delete-orphan")
    reader_config_snapshots = relationship("ReaderConfigSnapshot", back_populates="session", cascade="all, delete-orphan")


class Sweep(Base):
    """
    An individual sweep pass in a test session (5-10 sweeps per session).
    """
    __tablename__ = "sweeps"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sweep_number = Column(Integer, nullable=False)
    sweep_type = Column(String(50), default="normal", nullable=False)  # baseline | normal | scenario_injected | verification
    reads_count = Column(Integer, default=0, nullable=False)
    unique_epcs_seen = Column(Integer, default=0, nullable=False)
    per_bay_reads = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    session = relationship("TestSession", back_populates="sweeps")


class GroundTruthLabel(Base):
    """
    Physical ground truth label recorded for an EPC in a test session.
    Label: present_correct | present_misplaced | absent | read_missed | duplicate_epc | wms_error.
    """
    __tablename__ = "ground_truth_labels"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    epc = Column(String(64), nullable=False, index=True)
    label = Column(String(50), nullable=False)  # present_correct | present_misplaced | absent | read_missed | duplicate_epc | wms_error
    actual_bay = Column(String(50), nullable=True)
    provenance_who = Column(String(100), default="Warehouse Operator", nullable=False)
    provenance_when = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    provenance_method = Column(String(50), default="handheld_rfid_scan", nullable=False)  # handheld_barcode_scan | handheld_rfid_scan | visual_inspection
    is_simulated = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    session = relationship("TestSession", back_populates="ground_truth_labels")


class InjectedScenario(Base):
    """
    Logs every scenario/test fault injection action as ground truth.
    Type: move_carton_without_wms | occlude_tag | rotate_tag | unplug_reader | shadowing_carton.
    """
    __tablename__ = "injected_scenarios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_type = Column(String(50), nullable=False)
    target_epc = Column(String(64), nullable=False, index=True)
    from_location = Column(String(50), nullable=False)
    to_location = Column(String(50), nullable=True)
    injected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    restored_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    session = relationship("TestSession", back_populates="injected_scenarios")


class ReaderConfigSnapshot(Base):
    """
    Captures reader hardware and RF geometry configuration per session.
    """
    __tablename__ = "reader_config_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    reader_model = Column(String(100), default="Impinj Speedway R420", nullable=False)
    firmware_version = Column(String(50), default="5.14.0", nullable=False)
    ip_address = Column(String(50), default="192.168.1.100", nullable=False)
    port_mapping = Column(JSON, nullable=True)
    cable_lengths_m = Column(JSON, nullable=True)
    antenna_coordinates = Column(JSON, nullable=True)
    tx_power_dbm = Column(Float, default=30.0, nullable=False)
    captured_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    session = relationship("TestSession", back_populates="reader_config_snapshots")

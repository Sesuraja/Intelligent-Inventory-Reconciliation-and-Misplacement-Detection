import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Dataset(Base):
    """
    Versioned dataset for training and held-out evaluation (W2, W3, Section 2.2).
    Enforces strict physical session & object partition to prevent data leakage.
    Refuses to mix real and simulated data unless allow_hybrid=True.
    """
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False, index=True)
    data_source = Column(String(20), nullable=False)  # real, simulated, hybrid
    total_items = Column(Integer, default=0, nullable=False)
    train_items = Column(Integer, default=0, nullable=False)
    test_items = Column(Integer, default=0, nullable=False)
    session_count = Column(Integer, default=0, nullable=False)
    leakage_check_passed = Column(Boolean, default=True, nullable=False)
    allow_hybrid = Column(Boolean, default=False, nullable=False)
    created_by = Column(String(100), default="supervisor", nullable=False)
    summary = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    items = relationship("DatasetItem", back_populates="dataset", cascade="all, delete-orphan")
    evaluations = relationship("EvaluationRun", back_populates="dataset", cascade="all, delete-orphan")


class DatasetItem(Base):
    """
    Individual sample in a versioned dataset with physical provenance.
    """
    __tablename__ = "dataset_items"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), index=True, nullable=False)
    session_id = Column(String(36), nullable=False, index=True)
    epc = Column(String(64), nullable=False, index=True)
    split = Column(String(10), nullable=False)  # train, test
    ground_truth_label = Column(String(50), nullable=False)
    features = Column(JSON, nullable=True)
    is_simulated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    dataset = relationship("Dataset", back_populates="items")


class EvaluationRun(Base):
    """
    Comprehensive held-out model evaluation result (Section 2.2).
    Includes precision, recall, F1, calibration curve + ECE,
    per-scenario and per-shelf accuracy, mAP, and provenance banners.
    """
    __tablename__ = "evaluation_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    model_name = Column(String(100), nullable=False, index=True)
    model_version = Column(String(50), nullable=False)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), nullable=False)
    data_source = Column(String(20), nullable=False)  # real, simulated, hybrid
    metrics = Column(JSON, nullable=False)
    calibration_curve = Column(JSON, nullable=True)
    confusion_matrix = Column(JSON, nullable=True)
    provenance_banner = Column(String(200), nullable=True)
    evaluated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    dataset = relationship("Dataset", back_populates="evaluations")

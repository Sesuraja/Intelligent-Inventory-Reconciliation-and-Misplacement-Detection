from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(Integer, primary_key=True, index=True)
    discrepancy_id = Column(Integer, ForeignKey("discrepancies.id"), nullable=True)
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(50), default="v1.0.0")
    prediction = Column(String(100), nullable=False)
    score = Column(Float, nullable=False)
    evidence = Column(JSON, nullable=True)  # List of textual explanation strings or metric contributions
    recommended_action = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    discrepancy = relationship("Discrepancy", back_populates="ai_predictions")

class AIModel(Base):
    __tablename__ = "ai_models"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), index=True, nullable=False)
    version = Column(String(50), nullable=False)
    model_type = Column(String(50), nullable=False)  # READ_RELIABILITY, ROOT_CAUSE, LOCATION_INFERENCE, DEMAND_FORECAST, CYCLE_COUNT
    status = Column(String(30), default="ACTIVE")    # ACTIVE, CANDIDATE, ARCHIVED
    metrics = Column(JSON, nullable=True)            # precision, recall, f1, brier_score, confusion_matrix
    trained_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    training_runs = relationship("ModelTrainingRun", back_populates="model", cascade="all, delete-orphan")

class ModelTrainingRun(Base):
    __tablename__ = "model_training_runs"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("ai_models.id"), nullable=False)
    dataset_version = Column(String(50), default="v1.0")
    training_samples = Column(Integer, default=0)
    metrics = Column(JSON, nullable=True)
    hyperparameters = Column(JSON, nullable=True)
    trained_by = Column(String(100), default="AutoPipeline")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    model = relationship("AIModel", back_populates="training_runs")


from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.models.dataset import Dataset, DatasetItem, EvaluationRun
from app.ai.dataset_builder import dataset_builder
from app.ai.evaluation_engine import evaluation_engine

router = APIRouter(prefix="/datasets", tags=["Dataset Builder & Evaluation"])


class DatasetBuildRequest(BaseModel):
    name: str = "Warehouse Physical Baseline Dataset"
    version: str = "ds-v1.0"
    session_ids: Optional[List[str]] = None
    allow_hybrid: bool = False
    train_ratio: float = 0.8


class ModelEvaluationRequest(BaseModel):
    model_name: str = "Root-Cause & Location Fusion"
    model_version: str = "v1.2.0"


@router.post("/build")
def build_dataset_endpoint(
    req: DatasetBuildRequest,
    db: Session = Depends(get_db)
):
    """
    Builds a versioned dataset with physical session & EPC object partition (W2, W3, Section 2.2).
    Refuses to mix simulated and real data without allow_hybrid=True.
    """
    try:
        res = dataset_builder.build_dataset(
            db=db,
            name=req.name,
            version=req.version,
            session_ids=req.session_ids,
            allow_hybrid=req.allow_hybrid,
            train_ratio=req.train_ratio
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
def list_datasets(db: Session = Depends(get_db)):
    """Lists all versioned datasets with partition summaries and provenance."""
    datasets = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "version": d.version,
            "data_source": d.data_source,
            "total_items": d.total_items,
            "train_items": d.train_items,
            "test_items": d.test_items,
            "session_count": d.session_count,
            "leakage_check_passed": d.leakage_check_passed,
            "allow_hybrid": d.allow_hybrid,
            "created_by": d.created_by,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "summary": d.summary
        }
        for d in datasets
    ]


@router.get("/{id}")
def get_dataset_details(id: str, db: Session = Depends(get_db)):
    """Returns dataset partition metadata and items count."""
    d = db.query(Dataset).filter(Dataset.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail=f"Dataset {id} not found")
    return {
        "id": d.id,
        "name": d.name,
        "version": d.version,
        "data_source": d.data_source,
        "total_items": d.total_items,
        "train_items": d.train_items,
        "test_items": d.test_items,
        "session_count": d.session_count,
        "leakage_check_passed": d.leakage_check_passed,
        "allow_hybrid": d.allow_hybrid,
        "created_by": d.created_by,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "summary": d.summary
    }


@router.post("/{id}/evaluate")
def evaluate_on_dataset(
    id: str,
    req: ModelEvaluationRequest,
    db: Session = Depends(get_db)
):
    """
    Runs held-out model evaluation against dataset test fold (Section 2.2).
    Computes precision/recall with Wilson CIs, calibration curve, ECE,
    per-scenario and per-shelf accuracy, and ranking mAP.
    """
    try:
        res = evaluation_engine.evaluate_model_on_dataset(
            db=db,
            model_name=req.model_name,
            model_version=req.model_version,
            dataset_id=id
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{id}/evaluations")
def list_dataset_evaluations(id: str, db: Session = Depends(get_db)):
    """Lists held-out evaluation runs recorded for this dataset."""
    runs = db.query(EvaluationRun).filter(EvaluationRun.dataset_id == id).order_by(EvaluationRun.evaluated_at.desc()).all()
    return [
        {
            "id": r.id,
            "model_name": r.model_name,
            "model_version": r.model_version,
            "dataset_id": r.dataset_id,
            "data_source": r.data_source,
            "metrics": r.metrics,
            "provenance_banner": r.provenance_banner,
            "evaluated_at": r.evaluated_at.isoformat() if r.evaluated_at else None
        }
        for r in runs
    ]


@router.get("/model-card/{id}")
def get_model_card_for_evaluation(id: str, db: Session = Depends(get_db)):
    """
    Auto-generates standardized Markdown Model Card for a completed evaluation run (Section 2.2).
    """
    run = db.query(EvaluationRun).filter(EvaluationRun.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"Evaluation run {id} not found")

    summary = {
        "dataset_id": run.dataset_id,
        "data_source": run.data_source,
        "provenance_banner": run.provenance_banner,
        "metrics": run.metrics,
        "evaluated_at": run.evaluated_at.isoformat() if run.evaluated_at else None
    }
    card_md = evaluation_engine.generate_model_card(
        model_name=run.model_name,
        version=run.model_version,
        eval_summary=summary
    )
    return {
        "evaluation_id": run.id,
        "model_name": run.model_name,
        "model_version": run.model_version,
        "markdown_card": card_md
    }

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.system_setting import SystemSetting
from app.services.audit_service import audit_service
from app.core.config import settings as app_settings

router = APIRouter(prefix="/settings", tags=["Admin System Settings"])

class UpdateSettingRequest(BaseModel):
    category: str
    value: Dict[str, Any]
    description: Optional[str] = None
    admin_user: str = "admin"

DEFAULT_SETTINGS = {
    "thresholds": {
        "discrepancy_score_threshold": 0.75,
        "missing_timeout_seconds": 20.0,
        "minimum_sweep_cycles": 3,
        "rssi_noise_floor_dbm": -80.0
    },
    "abstain_bands": {
        "abstain_lower": 0.45,
        "abstain_upper": 0.75,
        "abstain_state": "uncertain_verify",
        "description": "Band [0.45, 0.75] within which system abstains and requests operator rescan"
    },
    "windows": {
        "aggregation_windows_seconds": [5, 15, 30],
        "default_window_seconds": 15,
        "watermark_lag_seconds": 3.0,
        "reader_heartbeat_timeout_seconds": 15.0
    },
    "retention": {
        "raw_event_retention_days": 30,
        "audit_log_retention_days": 365,
        "dataset_export_retention_days": 90
    },
    "feature_flags": {
        "enable_simulator": app_settings.ENABLE_SIMULATOR,
        "enable_shadow_mode": True,
        "strict_wms_tolerance": False,
        "require_operator_override_reason": True
    }
}

@router.get("")
def get_all_settings(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieves all system configuration categories."""
    db_settings = db.query(SystemSetting).all()
    out = dict(DEFAULT_SETTINGS)

    for s in db_settings:
        out[s.category] = s.value

    return out

@router.put("/{category}")
def update_category_settings(
    category: str,
    body: UpdateSettingRequest,
    db: Session = Depends(get_db)
):
    """Updates settings for a specific category (admin only) and writes to audit log."""
    if category not in DEFAULT_SETTINGS:
        raise HTTPException(status_code=400, detail=f"Invalid category '{category}'")

    setting_row = db.query(SystemSetting).filter(SystemSetting.category == category).first()
    old_val = setting_row.value if setting_row else DEFAULT_SETTINGS.get(category)

    if not setting_row:
        setting_row = SystemSetting(
            key=f"category.{category}",
            category=category,
            value=body.value,
            description=body.description or f"Settings for {category}",
            last_modified_by=body.admin_user
        )
        db.add(setting_row)
    else:
        setting_row.value = body.value
        setting_row.last_modified_by = body.admin_user
        setting_row.updated_at = datetime.now(timezone.utc)

    db.commit()

    audit_service.log(
        db=db,
        action=f"SETTINGS_UPDATED_{category.upper()}",
        actor=body.admin_user,
        entity="SYSTEM_SETTINGS",
        entity_id=category,
        details={"category": category, "old_value": old_val, "new_value": body.value}
    )

    return {
        "category": category,
        "status": "updated",
        "value": setting_row.value,
        "updated_at": setting_row.updated_at.isoformat()
    }

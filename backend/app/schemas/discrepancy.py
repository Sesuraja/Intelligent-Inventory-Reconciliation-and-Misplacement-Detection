from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DiscrepancyResponse(BaseModel):
    id: int
    epc: str
    product_name: str
    product_sku: str
    category: str
    unit_cost: float
    discrepancy_type: str
    expected_location_id: int
    expected_shelf_code: str
    observed_location_id: Optional[int] = None
    observed_shelf_code: Optional[str] = None
    confidence: float
    root_cause: Optional[str] = None
    status: str
    assigned_to: Optional[str] = None
    verification_required: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None
    ai_evidence: Optional[List[str]] = None
    recommended_action: Optional[str] = None
    candidate_locations: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True

class VerificationCreate(BaseModel):
    verification_result: str  # CONFIRMED_PRESENT, CONFIRMED_MISPLACED, CONFIRMED_MISSING, CONFIRMED_MISSED_READ
    actual_location_id: Optional[int] = None
    notes: Optional[str] = None
    verified_by_name: str = "Warehouse Specialist"

class ResolveExceptionRequest(BaseModel):
    resolution_action: str  # UPDATE_WMS_LOCATION, RETURN_TO_EXPECTED, WRITE_OFF_MISSING, DISMISS_FALSE_ALARM
    notes: Optional[str] = None

class VerificationLogResponse(BaseModel):
    id: int
    discrepancy_id: int
    epc: str
    actual_shelf_code: Optional[str] = None
    verified_by_name: str
    verification_result: str
    before_shelf_code: Optional[str] = None
    after_shelf_code: Optional[str] = None
    notes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


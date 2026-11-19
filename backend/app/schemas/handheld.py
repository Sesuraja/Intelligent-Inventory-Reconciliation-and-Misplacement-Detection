from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class HandheldDeviceRegister(BaseModel):
    device_code: str
    model: Optional[str] = "Zebra TC26 / RFD40 UHF Sled"
    assigned_operator: Optional[str] = "Warehouse Operator"
    ip_address: Optional[str] = None
    battery_level: Optional[int] = 100

class HandheldDeviceResponse(BaseModel):
    id: int
    device_code: str
    model: str
    assigned_operator: str
    status: str
    battery_level: int
    ip_address: Optional[str]
    last_seen: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class HandheldSessionCreate(BaseModel):
    operator_name: Optional[str] = "Warehouse Operator"
    device_code: Optional[str] = "HH-01"
    shelf_code: Optional[str] = None
    scan_mode: Optional[str] = "DISCREPANCY_VERIFICATION"  # SINGLE_LOCATION, CYCLE_COUNT, DISCREPANCY_VERIFICATION
    notes: Optional[str] = None

class HandheldEventInput(BaseModel):
    epc: str
    rssi_dbm: Optional[float] = -55.0
    read_count: Optional[int] = 1
    scanned_barcode_or_qr: Optional[str] = None

class HandheldEventBatch(BaseModel):
    shelf_code: Optional[str] = None
    events: List[HandheldEventInput]

class HandheldSessionResponse(BaseModel):
    id: int
    session_code: str
    operator_name: str
    device_code: Optional[str]
    target_shelf_code: Optional[str]
    status: str
    scan_mode: str
    total_scans: int
    unique_epcs: int
    started_at: datetime
    completed_at: Optional[datetime]
    notes: Optional[str]

    class Config:
        from_attributes = True

class HandheldVerificationRequest(BaseModel):
    discrepancy_id: Optional[int] = None
    epc: str
    actual_shelf_code: str
    verification_status: str  # CONFIRMED_MISPLACED, FALSE_POSITIVE, CONFIRMED_MISSING, CONFIRMED_MISSED_READ, VERIFIED_IN_PLACE
    verified_by: Optional[str] = "Warehouse Operator"
    device_code: Optional[str] = "HH-01"
    barcode_scanned: Optional[str] = None
    notes: Optional[str] = None
    auto_reconcile: Optional[bool] = True

class GroundTruthVerificationResponse(BaseModel):
    id: int
    discrepancy_id: Optional[int]
    epc: str
    expected_shelf_code: Optional[str]
    ai_predicted_shelf_code: Optional[str]
    verified_shelf_code: Optional[str]
    verification_status: str
    verified_by: str
    device_code: Optional[str]
    barcode_matched: bool
    notes: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

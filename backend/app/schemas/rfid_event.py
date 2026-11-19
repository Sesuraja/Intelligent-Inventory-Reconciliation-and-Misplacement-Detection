from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Any, Dict

class RFIDEventBase(BaseModel):
    event_id: str
    epc: str
    reader_id: str
    antenna_id: int
    rssi_dbm: float
    frequency: Optional[float] = None
    observed_at: datetime
    received_at: Optional[datetime] = None
    valid: bool = True
    source: str = "SIMULATION"  # SIMULATION or PHYSICAL
    raw_payload: Optional[Dict[str, Any]] = None

class RFIDEventCreate(RFIDEventBase):
    pass

class RFIDEventResponse(RFIDEventBase):
    id: int
    antenna_code: Optional[str] = None
    shelf_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ObservationWindowResponse(BaseModel):
    id: int
    epc: str
    window_start: datetime
    window_end: datetime
    features: Dict[str, Any]
    primary_antenna_id: Optional[int] = None
    total_read_count: int
    median_rssi: Optional[float] = None
    source: str = "SIMULATION"

    model_config = ConfigDict(from_attributes=True)

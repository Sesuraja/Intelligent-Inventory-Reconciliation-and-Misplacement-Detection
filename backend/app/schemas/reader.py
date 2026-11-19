from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class AntennaResponse(BaseModel):
    id: int
    reader_id: int
    antenna_code: str
    port_number: int
    shelf_id: Optional[int] = None
    shelf_code: Optional[str] = None
    tx_power_dbm: float
    gain_dbi: float
    beam_angle_deg: float
    is_active: bool
    purpose: str
    recent_read_count: int = 0
    median_rssi: Optional[float] = None

    class Config:
        from_attributes = True

class ReaderResponse(BaseModel):
    id: int
    reader_code: str
    name: Optional[str] = None
    model: str
    ip_address: str
    port: int
    protocol: str
    status: str
    last_heartbeat: datetime
    location_desc: Optional[str] = None
    antennas: List[AntennaResponse] = []

    class Config:
        from_attributes = True

class CalibrationConfig(BaseModel):
    antenna_id: int
    median_rssi_baseline: float
    noise_floor_dbm: float
    cross_read_leakage_dbm: float
    config: Optional[Dict[str, Any]] = None

class AntennaAssignRequest(BaseModel):
    reader_id: int
    port_number: int
    antenna_code: Optional[str] = None
    shelf_id: int
    tx_power_dbm: float = 30.0
    gain_dbi: float = 6.0
    purpose: str = "PRIMARY_DETECTION"
    is_active: bool = True


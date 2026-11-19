from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class CandidateLocation(BaseModel):
    shelf_code: str
    probability: float
    antenna_code: Optional[str] = None
    median_rssi: Optional[float] = None
    read_count: Optional[int] = None

class LocationPredictionSchema(BaseModel):
    epc: str
    expected_location: str
    predicted_location: Optional[str] = None
    confidence: float
    predicted_state: str  # IN_PLACE, MISPLACED, AMBIGUOUS, POSSIBLE_UNREAD, LIKELY_MISSING
    verification_required: bool
    candidate_locations: List[CandidateLocation] = []
    model_version: str = "v1.0.0"

class ReadReliabilityInput(BaseModel):
    epc: str
    expected_shelf: str
    antenna_observations: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    # e.g. {"ANT_01": {"read_count": 25, "rssi_median": -42, "rssi_std": 1.2}}
    last_seen_seconds_ago: float = 0.0
    first_seen_seconds_ago: float = 60.0
    reader_health_status: str = "ONLINE"
    has_recent_movement: bool = False
    packaging_class: str = "CARDBOARD"

class ReadReliabilityOutput(BaseModel):
    epc: str
    status: str  # LIKELY_PRESENT, LIKELY_ABSENT, LIKELY_UNREAD, UNCERTAIN
    reliability_score: float
    evidence: List[str]
    model_version: str

class RootCauseInput(BaseModel):
    epc: str
    discrepancy_type: str
    expected_location: str
    observed_location: Optional[str] = None
    reader_health: str = "ONLINE"
    recent_movement_authorized: Optional[bool] = None
    antenna_cross_read_detected: bool = False
    duplicate_epc_count: int = 1
    rf_shadowing_suspected: bool = False

class RootCauseOutput(BaseModel):
    epc: str
    predicted_cause: str  # PHYSICAL_RELOCATION, RF_SHADOWING, INCORRECT_WMS_TRANSACTION, DUPLICATE_EPC_MAPPING, READER_OUTAGE
    confidence: float
    evidence: List[str]
    recommended_action: str

class DemandForecastOutput(BaseModel):
    product_sku: str
    product_name: str
    forecast_1day: float
    forecast_3day: float
    forecast_7day: float
    current_stock: int
    reorder_point: int
    stockout_risk: str  # LOW, MEDIUM, HIGH, CRITICAL
    reorder_recommended: bool

class CycleCountingRecommendation(BaseModel):
    shelf_id: int
    shelf_code: str
    zone_name: str
    risk_score: float  # 0-100
    priority: str      # HIGH, MEDIUM, LOW
    factors: Dict[str, Any]
    items_count: int
    last_audit_date: Optional[str] = None

class MisplacementDestinationOutput(BaseModel):
    epc: str
    expected_shelf: str
    candidate_locations: List[CandidateLocation]
    top_predicted_shelf: Optional[str] = None
    confidence: float


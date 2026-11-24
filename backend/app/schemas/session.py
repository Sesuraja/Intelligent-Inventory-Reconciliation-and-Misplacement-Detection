"""
Pydantic Schemas for Test Sessions, Sweeps, Ground Truth Labels, Scenarios, and Scored Event JSON.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TestSessionCreate(BaseModel):
    name: str = Field(..., example="Warehouse Sweep Calibration Session #1")
    is_simulated: bool = True
    data_source: str = "simulated"  # real | simulated | hybrid
    target_item_count: int = 150
    notes: Optional[str] = None
    config_snapshot: Optional[Dict[str, Any]] = None


class TestSessionStatusUpdate(BaseModel):
    status: str = Field(..., example="sweeping")  # created -> baseline_truth -> sweeping -> scenario_injected -> verification -> closed


class SweepCreate(BaseModel):
    sweep_number: int
    sweep_type: str = "normal"  # baseline | normal | scenario_injected | verification
    reads_count: int = 0
    unique_epcs_seen: int = 0
    per_bay_reads: Optional[Dict[str, int]] = None
    notes: Optional[str] = None


class SweepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    sweep_number: int
    sweep_type: str
    reads_count: int
    unique_epcs_seen: int
    per_bay_reads: Optional[Dict[str, Any]] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None


class GroundTruthLabelCreate(BaseModel):
    epc: str
    label: str  # present_correct | present_misplaced | absent | read_missed | duplicate_epc | wms_error
    actual_bay: Optional[str] = None
    provenance_who: str = "Warehouse Operator"
    provenance_method: str = "handheld_rfid_scan"  # handheld_barcode_scan | handheld_rfid_scan | visual_inspection
    is_simulated: bool = True
    notes: Optional[str] = None


class GroundTruthLabelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    epc: str
    label: str
    actual_bay: Optional[str] = None
    provenance_who: str
    provenance_when: datetime
    provenance_method: str
    is_simulated: bool
    notes: Optional[str] = None


class GroundTruthImportPayload(BaseModel):
    labels: List[GroundTruthLabelCreate]


class InjectedScenarioCreate(BaseModel):
    scenario_type: str  # move_carton_without_wms | occlude_tag | rotate_tag | unplug_reader | shadowing_carton
    target_epc: str
    from_location: str
    to_location: Optional[str] = None
    notes: Optional[str] = None


class InjectedScenarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    scenario_type: str
    target_epc: str
    from_location: str
    to_location: Optional[str] = None
    injected_at: datetime
    restored_at: Optional[datetime] = None
    is_active: bool
    notes: Optional[str] = None


class ReaderConfigSnapshotCreate(BaseModel):
    reader_model: str = "Impinj Speedway R420"
    firmware_version: str = "5.14.0"
    ip_address: str = "192.168.1.100"
    port_mapping: Optional[Dict[str, Any]] = None
    cable_lengths_m: Optional[Dict[str, float]] = None
    antenna_coordinates: Optional[Dict[str, Any]] = None
    tx_power_dbm: float = 30.0


class ReaderConfigSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: Optional[str] = None
    reader_model: str
    firmware_version: str
    ip_address: str
    port_mapping: Optional[Dict[str, Any]] = None
    cable_lengths_m: Optional[Dict[str, Any]] = None
    antenna_coordinates: Optional[Dict[str, Any]] = None
    tx_power_dbm: float
    captured_at: datetime


class TestSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: str
    is_simulated: bool
    data_source: str
    is_evaluable: bool
    target_item_count: int
    notes: Optional[str] = None
    per_bay_read_rates: Optional[Dict[str, Any]] = None
    false_absence_stats: Optional[Dict[str, Any]] = None
    config_snapshot: Optional[Dict[str, Any]] = None
    created_at: datetime
    closed_at: Optional[datetime] = None
    sweeps: List[SweepResponse] = []
    ground_truth_labels: List[GroundTruthLabelResponse] = []
    injected_scenarios: List[InjectedScenarioResponse] = []


class ScoredEventJSON(BaseModel):
    """Exact Section 2.2 scored event JSON schema."""
    epc: str
    predicted_state: str  # present_ok|likely_unread|likely_absent_or_misplaced|uncertain_verify
    score: float
    root_cause: Dict[str, Any]
    candidate_zones: List[Dict[str, Any]]
    count_priority: float
    demand_forecast: Dict[str, Any]
    model_version: str
    baseline_state: str
    session_id: str
    generated_at: str
    reason_codes: List[str]
    is_simulated: bool
    validation_status: str

from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class KPISummary(BaseModel):
    total_products: int
    total_tags: int
    correctly_located: int
    misplaced: int
    likely_missing: int
    possible_unread: int
    ambiguous: int
    pending_verification: int
    accuracy_percentage: float
    readers_online: int
    readers_total: int
    active_antennas: int

class StatusDistribution(BaseModel):
    name: str
    count: int
    color: str

class DiscrepancyTrendItem(BaseModel):
    timestamp: str
    in_place: int
    misplaced: int
    missing: int
    unread: int
    ambiguous: int

class ShelfDistributionItem(BaseModel):
    shelf_code: str
    zone_name: str
    expected_count: int
    observed_count: int
    misplaced_count: int
    capacity: int

class ScanningActivityItem(BaseModel):
    hour: str
    reads_count: int
    unique_epcs: int

class DashboardSummaryResponse(BaseModel):
    kpis: KPISummary
    status_distribution: List[StatusDistribution]
    discrepancy_trends: List[DiscrepancyTrendItem]
    shelf_distribution: List[ShelfDistributionItem]
    scanning_activity: List[ScanningActivityItem]
    recent_events: List[Dict[str, Any]]
    latest_verifications: List[Dict[str, Any]]


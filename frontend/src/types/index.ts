export type NavigationTab =
  | 'dashboard'
  | 'inventory'
  | 'monitoring'
  | 'exceptions'
  | 'reports'
  | 'settings'
  | 'users'
  | 'help';

export type SubPageId =
  // 1. Dashboard (1 Page)
  | 'dashboard-home'
  // 2. Inventory (6 Pages)
  | 'inventory-products'
  | 'inventory-tags'
  | 'inventory-layout'
  | 'inventory-wms'
  | 'inventory-history'
  | 'inventory-cycle-counts'
  // 3. Live Monitoring (6 Pages)
  | 'monitoring-readers'
  | 'monitoring-reads'
  | 'monitoring-handheld'
  | 'monitoring-calibration'
  | 'monitoring-stream'
  | 'monitoring-alerts'
  // 4. AI Exceptions (5 Pages)
  | 'exceptions-discrepancies'
  | 'exceptions-root-cause'
  | 'exceptions-actions'
  | 'exceptions-ground-truth'
  | 'exceptions-insights'
  // 5. Reports (6 Pages)
  | 'reports-reconciliation'
  | 'reports-performance'
  | 'reports-reader'
  | 'reports-forecast'
  | 'reports-exports'
  | 'reports-dated-report'
  // Supporting (3 Pages)
  | 'supporting-settings'
  | 'supporting-users'
  | 'supporting-help';

export interface KPISummary {
  total_products: number;
  total_tags: number;
  correctly_located: number;
  misplaced: number;
  likely_missing: number;
  possible_unread: number;
  ambiguous: number;
  pending_verification: number;
  accuracy_percentage: number;
  readers_online: number;
  readers_total: number;
  active_antennas: number;
}

export interface StatusDistribution {
  name: string;
  count: number;
  color: string;
}

export interface DiscrepancyTrendItem {
  timestamp: string;
  in_place: number;
  misplaced: number;
  missing: number;
  unread: number;
  ambiguous: number;
}

export interface ShelfDistributionItem {
  shelf_code: string;
  zone_name: string;
  expected_count: number;
  observed_count: number;
  misplaced_count: number;
  capacity: number;
}

export interface ScanningActivityItem {
  hour: string;
  reads_count: number;
  unique_epcs: number;
}

export interface DashboardSummary {
  kpis: KPISummary;
  status_distribution: StatusDistribution[];
  discrepancy_trends: DiscrepancyTrendItem[];
  shelf_distribution: ShelfDistributionItem[];
  scanning_activity: ScanningActivityItem[];
  recent_events: RFIDEvent[];
  latest_verifications: any[];
}

export interface InventoryItem {
  id: number;
  epc: string;
  product_id: number;
  product_name: string;
  product_sku: string;
  category: string;
  expected_location_id: number;
  expected_shelf_code: string;
  observed_location_id: number | null;
  observed_shelf_code: string | null;
  status: 'IN_PLACE' | 'MISPLACED' | 'LIKELY_MISSING' | 'POSSIBLE_UNREAD' | 'AMBIGUOUS' | 'PENDING_VERIFICATION' | 'VERIFIED';
  confidence: number;
  last_reconciled_at: string | null;
  last_observed_at: string | null;
  discrepancy_id: number | null;
}

export interface ProductItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  description: string | null;
  created_at: string;
}

export interface RFIDTagItem {
  id: number;
  epc: string;
  product_id: number;
  product_name: string | null;
  product_sku: string | null;
  status: string;
  tag_type: string;
  packaging_class: string;
  assigned_at: string;
}

export interface ShelfItem {
  id: number;
  zone_id: number;
  shelf_code: string;
  name: string | null;
  capacity: number;
  category_restriction: string | null;
  coord_x: number;
  coord_y: number;
  current_items_count: number;
  assigned_antenna_code: string | null;
}

export interface ReaderItem {
  id: number;
  reader_code: string;
  name: string | null;
  model: string;
  ip_address: string;
  port: number;
  protocol: string;
  status: 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'ERROR';
  last_heartbeat: string;
  location_desc: string | null;
  antennas: AntennaItem[];
}

export interface AntennaItem {
  id: number;
  reader_id: number;
  antenna_code: string;
  port_number: number;
  shelf_id: number | null;
  shelf_code: string | null;
  tx_power_dbm: number;
  gain_dbi: number;
  beam_angle_deg?: number;
  beam_angle?: number;
  polarization?: string;
  status?: string;
  is_active?: boolean;
  purpose?: string;
  recent_read_count?: number;
  median_rssi?: number | null;
  median_rssi_baseline?: number | null;
  noise_floor_dbm?: number | null;
}

export interface RFIDEvent {
  id?: number;
  event_id: string;
  epc: string;
  reader_id: string;
  reader_code?: string;
  antenna_id?: number;
  antenna_port?: number;
  antenna_code?: string;
  shelf_code?: string | null;
  rssi_dbm: number;
  frequency?: number | null;
  observed_at: string;
  valid?: boolean;
}

export interface DiscrepancyItem {
  id: number;
  epc: string;
  product_name: string;
  product_sku: string;
  category: string;
  discrepancy_type: 'MISPLACED' | 'LIKELY_MISSING' | 'POSSIBLE_UNREAD' | 'AMBIGUOUS';
  expected_location_id: number;
  expected_shelf_code: string;
  observed_location_id: number | null;
  observed_shelf_code: string | null;
  confidence: number;
  root_cause: string | null;
  status: 'NEW' | 'AI_ANALYZED' | 'PENDING_VERIFICATION' | 'ASSIGNED' | 'VERIFIED' | 'RESOLVED';
  predicted_state?: 'present_ok' | 'likely_unread' | 'likely_absent_or_misplaced' | 'uncertain_verify' | string;
  workflow_status?: 'new' | 'ai_analyzed' | 'pending_verification' | 'verified' | 'resolved' | string;
  is_simulated?: boolean;
  validation_status?: string;
  assigned_to: string | null;
  verification_required: boolean;
  created_at: string;
  resolved_at: string | null;
  ai_evidence: string[] | null;
  recommended_action: string | null;
  candidate_locations: { shelf_code: string; probability: number }[] | null;
  observed_antenna_id?: number | null;
  cause_distribution?: Record<string, number> | null;
  feature_contributions?: { feature: string; impact: number; direction: 'positive' | 'negative' }[] | null;
  ai_reasoning?: string | null;
}

export interface AIModelItem {
  id: number;
  model_name: string;
  version: string;
  model_type: string;
  model_nature?: string;
  priority: string;
  algorithm: string;
  status: string;
  validation_status?: string;
  is_calibrated?: boolean;
  calibration_method?: string;
  data_provenance?: string;
  disclaimer?: string;
  provenance_banner?: string;
  metrics: Record<string, any>;
  last_trained: string;
}

export interface DemandForecastItem {
  product_sku: string;
  product_name: string;
  forecast_1day: number;
  forecast_3day: number;
  forecast_7day: number;
  current_stock: number;
  reorder_point: number;
  stockout_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reorder_recommended: boolean;
}

export interface CycleCountingItem {
  shelf_id: number;
  shelf_code: string;
  zone_name: string;
  risk_score: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  factors: {
    discrepancy_score: number;
    valuation_score: number;
    velocity_score: number;
    audit_staleness: number;
    days_since_last_audit: number;
    total_shelf_value: number;
  };
  items_count: number;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  token?: string;
  created_at?: string;
}

export interface AppSettings {
  brandName: string;
  brandSubtitle: string;
  companyName: string;
  facilityCode: string;
  systemTitle: string;
  apiHost: string;
  wsHost: string;
  gatewayHost?: string;
  gatewayLatestEndpoint?: string;
  gatewayHistoryEndpoint?: string;
  pollingIntervalMs?: number;
  currentUser: AuthUser;
}


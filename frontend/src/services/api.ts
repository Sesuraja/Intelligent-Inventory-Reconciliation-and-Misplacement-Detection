import {
  DashboardSummary,
  InventoryItem,
  ProductItem,
  RFIDTagItem,
  ShelfItem,
  ReaderItem,
  AntennaItem,
  RFIDEvent,
  DiscrepancyItem,
  AIModelItem,
  DemandForecastItem,
  CycleCountingItem
} from '../types';

function getBaseUrl(): string {
  try {
    const customHost = localStorage.getItem('app_api_host');
    if (customHost) {
      return customHost.replace(/\/+$/, '') + '/api/v1';
    }
  } catch {}
  return '/api/v1';
}

interface CacheEntry {
  timestamp: number;
  data: any;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

export function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    memoryCache.clear();
  } else {
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
      }
    }
  }
}

async function fetchCachedJSON<T>(endpoint: string, ttlMs: number = 10000): Promise<T> {
  const cached = memoryCache.get(endpoint);
  if (cached && (Date.now() - cached.timestamp) < ttlMs) {
    return cached.data as T;
  }
  
  if (inFlightRequests.has(endpoint)) {
    return inFlightRequests.get(endpoint)! as Promise<T>;
  }

  const p = fetchJSON<T>(endpoint).then((data) => {
    memoryCache.set(endpoint, { timestamp: Date.now(), data });
    inFlightRequests.delete(endpoint);
    return data;
  }).catch((err) => {
    inFlightRequests.delete(endpoint);
    throw err;
  });

  inFlightRequests.set(endpoint, p);
  return p;
}

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('app_auth_token') : null;
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {})
    },
    ...options
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Dashboard
  getDashboardSummary: () => fetchCachedJSON<DashboardSummary>('/dashboard/summary', 3000),

  // Inventory
  getInventory: (status?: string, shelf?: string, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (shelf) params.append('shelf', shelf);
    if (search) params.append('search', search);
    return fetchJSON<InventoryItem[]>(`/inventory?${params.toString()}`);
  },
  getInventoryItem: (id: number) => fetchJSON<InventoryItem>(`/inventory/${id}`),

  // Products
  getProducts: () => fetchCachedJSON<ProductItem[]>('/products', 15000),
  createProduct: (data: Partial<ProductItem>) => {
    invalidateApiCache('/products');
    return fetchJSON<ProductItem>('/products', { method: 'POST', body: JSON.stringify(data) });
  },

  // Tags
  getRFIDTags: () => fetchJSON<RFIDTagItem[]>('/rfid-tags'),
  registerRFIDTag: (data: { epc: string; product_id: number; packaging_class: string }) => {
    invalidateApiCache();
    return fetchJSON<RFIDTagItem>('/rfid-tags', { method: 'POST', body: JSON.stringify(data) });
  },
  assignTagToProduct: (data: { epc: string; product_id: number; expected_shelf_id: number; packaging_class: string; tag_type?: string }) => {
    invalidateApiCache();
    return fetchJSON<any>('/inventory/assign-tag', { method: 'POST', body: JSON.stringify(data) });
  },

  // Movements
  getMovements: () => fetchJSON<any[]>('/movements'),
  recordMovement: (data: { epc: string; to_shelf_id: number; movement_type: string; authorized_by: string; notes?: string }) => {
    invalidateApiCache();
    return fetchJSON<any>('/movements', { method: 'POST', body: JSON.stringify(data) });
  },

  // Locations
  getShelves: () => fetchCachedJSON<ShelfItem[]>('/locations/shelves', 15000),
  createShelf: (data: { shelf_code: string; name?: string; zone_id?: number; capacity?: number; category_restriction?: string }) => {
    invalidateApiCache('/locations');
    return fetchJSON<ShelfItem>('/locations/shelves', { method: 'POST', body: JSON.stringify(data) });
  },
  getLocations: () => fetchCachedJSON<any[]>('/locations', 15000),

  // Readers & Antennas
  getReaders: () => fetchCachedJSON<ReaderItem[]>('/readers', 15000),
  getAntennas: () => fetchCachedJSON<AntennaItem[]>('/antennas', 15000),
  assignAntenna: (data: { reader_id: number; port_number: number; shelf_id: number; antenna_code?: string; tx_power_dbm?: number; gain_dbi?: number; purpose?: string }) => {
    invalidateApiCache('/antennas');
    invalidateApiCache('/readers');
    return fetchJSON<AntennaItem>('/readers/antennas/assign', { method: 'POST', body: JSON.stringify(data) });
  },

  // Events
  getRFIDEvents: (limit: number = 50) => fetchJSON<RFIDEvent[]>(`/rfid-events?limit=${limit}`),

  // Exceptions & Discrepancies
  getExceptions: (status?: string, shelf?: string, type?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (shelf) params.append('shelf', shelf);
    if (type) params.append('type', type);
    return fetchJSON<DiscrepancyItem[]>(`/exceptions?${params.toString()}`);
  },
  getExceptionDetails: (id: number) => fetchJSON<DiscrepancyItem>(`/exceptions/${id}`),
  verifyException: (id: number, data: { verification_result: string; actual_location_id?: number | null; notes?: string; verified_by_name?: string }) => {
    invalidateApiCache();
    return fetchJSON<any>(`/exceptions/${id}/verify`, { method: 'POST', body: JSON.stringify(data) });
  },
  resolveException: (id: number, data: { resolution_action: string; notes?: string }) => {
    invalidateApiCache();
    return fetchJSON<any>(`/exceptions/${id}/resolve`, { method: 'POST', body: JSON.stringify(data) });
  },

  // AI & Models
  getAIModels: () => fetchCachedJSON<AIModelItem[]>('/ai/models', 20000),
  getAIEvaluation: () => fetchCachedJSON<any>('/ai/evaluation', 20000),
  retrainModel: (id: number) => fetchJSON<any>(`/ai/models/${id}/retrain`, { method: 'POST' }),
  getDemandForecast: () => fetchJSON<DemandForecastItem[]>('/ai/demand-forecast'),
  getCycleCountingPriorities: () => fetchJSON<CycleCountingItem[]>('/ai/cycle-counting'),
  getMisplacementDestination: (epc: string) => fetchJSON<any>(`/ai/destination/${epc}`),

  // Calibration
  runCalibrationExperiment: (data: any) =>
    fetchJSON<any>('/antennas/calibrate', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getReconciliationReport: () => fetchJSON<any>('/reports/reconciliation'),
  getAccuracyReport: () => fetchJSON<any>('/reports/accuracy'),

  // Hardware Simulator Controls
  getSimulatorStatus: () => fetchJSON<any>('/simulator/status'),
  executeSimulatorAction: (action: string, epc?: string, target_shelf?: string, enabled?: boolean) =>
    fetchJSON<any>('/simulator/action', {
      method: 'POST',
      body: JSON.stringify({ action, epc, target_shelf, enabled })
    }),

  // System Mode & Hardware Verification
  getOperatingMode: () =>
    fetchJSON<{ mode: string; is_simulation: boolean; is_physical: boolean; is_offline: boolean; description: string }>('/system/mode'),
  setOperatingMode: (mode: string) =>
    fetchJSON<any>('/system/mode', { method: 'POST', body: JSON.stringify({ mode }) }),
  testReaderPhysicalConnection: (readerId: number = 1) =>
    fetchJSON<any>(`/readers/${readerId}/test-connection`, { method: 'POST' }),

  // Handheld RFID & Ground Truth Verification
  getHandheldReaders: () => fetchJSON<any[]>('/handheld/readers'),
  getHandheldSessions: () => fetchJSON<any[]>('/handheld/sessions'),
  registerHandheldReader: (data: any) =>
    fetchJSON<any>('/handheld/readers/register', { method: 'POST', body: JSON.stringify(data) }),
  createHandheldSession: (data: any) =>
    fetchJSON<any>('/handheld/sessions', { method: 'POST', body: JSON.stringify(data) }),
  recordHandheldEvents: (sessionId: number, data: any) =>
    fetchJSON<any>(`/handheld/sessions/${sessionId}/events`, { method: 'POST', body: JSON.stringify(data) }),
  completeHandheldSession: (sessionId: number) =>
    fetchJSON<any>(`/handheld/sessions/${sessionId}/complete`, { method: 'POST' }),
  submitGroundTruthVerification: (data: {
    discrepancy_id?: number;
    epc: string;
    actual_shelf_code: string;
    verification_status: string;
    verified_by?: string;
    device_code?: string;
    barcode_scanned?: string;
    notes?: string;
    auto_reconcile?: boolean;
  }) => fetchJSON<any>('/handheld/verification', { method: 'POST', body: JSON.stringify(data) }),
  getHandheldScans: (limit: number = 50) => fetchJSON<any[]>(`/handheld/scans?limit=${limit}`),
  syncHandheldBatch: (data: any) =>
    fetchJSON<any>('/handheld/sync', { method: 'POST', body: JSON.stringify(data) }),

  // WMS Sandbox & Inventory State Engine
  getWMSInventory: (status?: string, shelf?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (shelf) params.append('shelf', shelf);
    return fetchJSON<any[]>(`/wms/inventory?${params.toString()}`);
  },
  wmsReceive: (data: { sku: string; quantity: number; target_shelf_code: string; lot_number?: string; epc_prefix?: string }) =>
    fetchJSON<any>('/wms/receive', { method: 'POST', body: JSON.stringify(data) }),
  wmsPutaway: (data: { epc: string; to_shelf_code: string; user_name?: string }) =>
    fetchJSON<any>('/wms/putaway', { method: 'POST', body: JSON.stringify(data) }),
  wmsMove: (data: { epc: string; to_shelf_code: string; user_name?: string; reason?: string }) =>
    fetchJSON<any>('/wms/move', { method: 'POST', body: JSON.stringify(data) }),
  wmsPick: (data: { epc?: string; sku?: string; order_number?: string }) =>
    fetchJSON<any>('/wms/pick', { method: 'POST', body: JSON.stringify(data) }),
  wmsShip: (data: { epc?: string; order_number?: string }) =>
    fetchJSON<any>('/wms/ship', { method: 'POST', body: JSON.stringify(data) }),
  wmsAdjust: (data: { epc: string; new_shelf_code?: string; quantity?: number; reason: string }) =>
    fetchJSON<any>('/wms/adjust', { method: 'POST', body: JSON.stringify(data) }),
  wmsSync: () => fetchJSON<any>('/wms/sync', { method: 'POST' }),
  wmsInjectError: (data: { error_type: string; epc?: string; target_shelf_code?: string; notes?: string }) =>
    fetchJSON<any>('/wms/inject-error', { method: 'POST', body: JSON.stringify(data) }),
  getWMSTransactions: (limit: number = 50) => fetchJSON<any[]>(`/wms/transactions?limit=${limit}`),

  // Reconciliation Engine
  triggerReconciliation: () => fetchJSON<any>('/reconciliation/run', { method: 'POST' }),
  getReconciliationStatus: () => fetchJSON<any>('/reconciliation/status'),

  // Auth & System Administration
  getUsers: () => fetchJSON<any[]>('/auth/users'),
  getMe: () => fetchJSON<any>('/auth/me'),
  login: async (email: string, pass: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', pass);
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    if (!res.ok) throw new Error('Authentication failed');
    return res.json();
  },
  getSystemSettings: () => fetchJSON<any>('/system/settings'),
  updateSystemSettings: (data: any) =>
    fetchJSON<any>('/system/settings', { method: 'POST', body: JSON.stringify(data) }),
  testConnection: async (host?: string) => {
    const targetUrl = host ? `${host.replace(/\/+$/, '')}/api/v1/system/health` : `${getBaseUrl()}/system/health`;
    const t0 = performance.now();
    const res = await fetch(targetUrl);
    const dt = Math.round(performance.now() - t0);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { status: data.status, latencyMs: dt };
  }
};


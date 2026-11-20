export interface RawRFIDObservation {
  epc: string;
  antennaPort: number;
  rssi: number;
  timestamp?: number | string;
  frequency?: number;
  phaseAngle?: number;
  dopplerShift?: number;
  readerId?: string;
  source?: 'PHYSICAL' | 'SIMULATION' | 'CSV_REPLAY';
}

export interface NormalizedRFIDEvent {
  event_id: string;
  epc: string;
  reader_id: string;
  antenna_port: number;
  rssi_dbm: number;
  frequency_mhz?: number;
  observed_at: string;
  received_at: string;
  source: 'PHYSICAL' | 'SIMULATION' | 'CSV_REPLAY';
  valid: boolean;
  raw_payload?: Record<string, any>;
}

export interface EdgeCollectorConfig {
  readerHost: string;
  readerPort: number;
  readerId: string;
  operatingMode: 'PHYSICAL' | 'SIMULATION' | 'OFFLINE';
  backendApiUrl: string;
  batchSize: number;
  flushIntervalMs: number;
  debounceWindowMs: number;
  mqttBrokerUrl?: string;
}

export interface CollectorStats {
  operatingMode: string;
  totalIngested: number;
  totalNormalized: number;
  duplicatesSuppressed: number;
  forwardedToBackend: number;
  bufferQueueLength: number;
  readerConnected: boolean;
  lastObservationAt: string | null;
  uptimeSeconds: number;
}

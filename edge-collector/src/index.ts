import { EdgeCollectorConfig, RawRFIDObservation, CollectorStats } from './types';
import { EventNormalizer } from './normalizer/event-normalizer';
import { LocalBuffer } from './buffer/local-buffer';
import { RestForwarder } from './forwarder/rest-forwarder';
import { LLRPAdapter } from './adapters/llrp-adapter';
import { SimulatorAdapter } from './adapters/simulator-adapter';

// Load configuration
const config: EdgeCollectorConfig = {
  readerHost: process.env.READER_HOST || '192.168.1.100',
  readerPort: parseInt(process.env.READER_PORT || '5084', 10),
  readerId: process.env.READER_ID || 'READER_01',
  operatingMode: (process.env.OPERATING_MODE as any) || 'SIMULATION',
  backendApiUrl: process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1/rfid-events/ingest',
  batchSize: parseInt(process.env.BATCH_SIZE || '50', 10),
  flushIntervalMs: parseInt(process.env.FLUSH_INTERVAL_MS || '600', 10),
  debounceWindowMs: parseInt(process.env.DEBOUNCE_WINDOW_MS || '400', 10)
};

console.log('====================================================');
console.log(' Autonomous AIoT RFID Edge Collector Service Starting ');
console.log('====================================================');
console.log(`Operating Mode: ${config.operatingMode}`);
console.log(`Target Backend: ${config.backendApiUrl}`);
console.log(`Reader Target:  ${config.readerHost}:${config.readerPort} (${config.readerId})`);

const normalizer = new EventNormalizer(config.debounceWindowMs);
const buffer = new LocalBuffer(25000);
const forwarder = new RestForwarder(config.backendApiUrl);

let totalIngested = 0;
let totalNormalized = 0;
let forwardedToBackend = 0;
let lastObservationAt: string | null = null;
const startTime = Date.now();

// Ingestion Pipeline
const handleRawObservation = (obs: RawRFIDObservation) => {
  totalIngested++;
  lastObservationAt = new Date().toISOString();

  const normalized = normalizer.normalize(obs, config.readerId);
  if (normalized) {
    totalNormalized++;
    buffer.push(normalized);
  }
};

// Start Selected Adapter
let llrpAdapter: LLRPAdapter | null = null;
let simAdapter: SimulatorAdapter | null = null;

if (config.operatingMode === 'PHYSICAL') {
  console.log(`[EdgeCollector] Initializing LLRP TCP Socket to ${config.readerHost}:${config.readerPort}...`);
  llrpAdapter = new LLRPAdapter(config.readerHost, config.readerPort, config.readerId, handleRawObservation);
  llrpAdapter.connect();
} else if (config.operatingMode === 'SIMULATION') {
  console.log('[EdgeCollector] Initializing Synthetic RFID Simulator Adapter...');
  simAdapter = new SimulatorAdapter(handleRawObservation, 800);
  simAdapter.start();
} else {
  console.log('[EdgeCollector] OFFLINE Mode - No hardware ingestion active.');
}

// Periodic Flush Worker
setInterval(async () => {
  const batch = buffer.drain(config.batchSize);
  if (batch.length === 0) return;

  const success = await forwarder.forwardBatch(batch);
  if (success) {
    forwardedToBackend += batch.length;
  } else {
    // Re-buffer for retry
    buffer.retry(batch);
  }
}, config.flushIntervalMs);

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n[EdgeCollector] Stopping edge collector service...');
  if (llrpAdapter) llrpAdapter.disconnect();
  if (simAdapter) simAdapter.stop();
  process.exit(0);
});

export const getStats = (): CollectorStats => ({
  operatingMode: config.operatingMode,
  totalIngested,
  totalNormalized,
  duplicatesSuppressed: normalizer.getDuplicatesSuppressed(),
  forwardedToBackend,
  bufferQueueLength: buffer.size(),
  readerConnected: llrpAdapter ? llrpAdapter.getStatus().connected : (config.operatingMode === 'SIMULATION'),
  lastObservationAt,
  uptimeSeconds: Math.floor((Date.now() - startTime) / 1000)
});

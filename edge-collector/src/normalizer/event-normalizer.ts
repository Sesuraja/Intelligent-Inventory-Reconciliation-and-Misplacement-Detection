import { RawRFIDObservation, NormalizedRFIDEvent } from '../types';
import * as crypto from 'crypto';

export class EventNormalizer {
  private lastSeenMap: Map<string, number> = new Map();
  private debounceWindowMs: number;
  private duplicatesSuppressedCount: number = 0;

  constructor(debounceWindowMs: number = 500) {
    this.debounceWindowMs = debounceWindowMs;
  }

  public normalize(raw: RawRFIDObservation, defaultReaderId: string = 'READER_01'): NormalizedRFIDEvent | null {
    if (!raw.epc || typeof raw.epc !== 'string') {
      return null;
    }

    const cleanEpc = raw.epc.trim().toUpperCase().replace(/[^0-9A-F-]/g, '');
    if (cleanEpc.length < 4) {
      return null;
    }

    const antennaPort = Math.max(1, Math.min(8, raw.antennaPort || 1));
    const now = Date.now();
    const dedupKey = `${cleanEpc}:${antennaPort}`;

    // Duplicate suppression check
    const lastSeen = this.lastSeenMap.get(dedupKey);
    if (lastSeen && (now - lastSeen) < this.debounceWindowMs) {
      this.duplicatesSuppressedCount++;
      return null; // Suppressed duplicate frame
    }
    this.lastSeenMap.set(dedupKey, now);

    // Prune stale cache if it grows too large
    if (this.lastSeenMap.size > 20000) {
      for (const [key, ts] of this.lastSeenMap.entries()) {
        if (now - ts > 30000) {
          this.lastSeenMap.delete(key);
        }
      }
    }

    // Normalizing RSSI: physical range is typically -90 to -20 dBm
    let rssi = typeof raw.rssi === 'number' ? raw.rssi : -50.0;
    if (rssi > 0) rssi = -rssi; // if reported positive
    if (rssi < -110.0) rssi = -110.0;
    if (rssi > -15.0) rssi = -15.0;

    const observedTimestamp = raw.timestamp
      ? (typeof raw.timestamp === 'number' ? new Date(raw.timestamp).toISOString() : new Date(raw.timestamp).toISOString())
      : new Date(now).toISOString();

    const eventId = `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    return {
      event_id: eventId,
      epc: cleanEpc,
      reader_id: raw.readerId || defaultReaderId,
      antenna_port: antennaPort,
      rssi_dbm: Math.round(rssi * 10) / 10,
      frequency_mhz: raw.frequency || 865.7,
      observed_at: observedTimestamp,
      received_at: new Date(now).toISOString(),
      source: raw.source || 'PHYSICAL',
      valid: true,
      raw_payload: {
        phase: raw.phaseAngle,
        doppler: raw.dopplerShift
      }
    };
  }

  public getDuplicatesSuppressed(): number {
    return this.duplicatesSuppressedCount;
  }
}

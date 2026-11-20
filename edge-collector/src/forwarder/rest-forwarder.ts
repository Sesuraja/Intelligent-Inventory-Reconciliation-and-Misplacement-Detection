import { NormalizedRFIDEvent } from '../types';

export class RestForwarder {
  private endpointUrl: string;
  private timeoutMs: number;

  constructor(endpointUrl: string, timeoutMs: number = 5000) {
    this.endpointUrl = endpointUrl;
    this.timeoutMs = timeoutMs;
  }

  public async forwardBatch(events: NormalizedRFIDEvent[]): Promise<boolean> {
    if (events.length === 0) return true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      // Ingest each or post batch
      const res = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'RFID-EDGE-COLLECTOR-V1'
        },
        body: JSON.stringify(events.length === 1 ? events[0] : { batch: events }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return res.ok;
    } catch (err: any) {
      console.warn(`[RestForwarder] Delivery failed to ${this.endpointUrl}:`, err.message);
      return false;
    }
  }
}

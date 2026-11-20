import { NormalizedRFIDEvent } from '../types';

export class LocalBuffer {
  private queue: NormalizedRFIDEvent[] = [];
  private maxCapacity: number;

  constructor(maxCapacity: number = 20000) {
    this.maxCapacity = maxCapacity;
  }

  public push(event: NormalizedRFIDEvent): void {
    if (this.queue.length >= this.maxCapacity) {
      // Drop oldest 5% to prevent memory exhaustion under long network partitions
      this.queue.splice(0, Math.floor(this.maxCapacity * 0.05));
    }
    this.queue.push(event);
  }

  public drain(batchSize: number = 50): NormalizedRFIDEvent[] {
    if (this.queue.length === 0) return [];
    return this.queue.splice(0, Math.min(batchSize, this.queue.length));
  }

  public retry(failedEvents: NormalizedRFIDEvent[]): void {
    // Re-insert at the head of queue
    this.queue.unshift(...failedEvents);
    if (this.queue.length > this.maxCapacity) {
      this.queue = this.queue.slice(0, this.maxCapacity);
    }
  }

  public size(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
  }
}

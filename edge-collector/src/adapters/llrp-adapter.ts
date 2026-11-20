import * as net from 'net';
import { RawRFIDObservation } from '../types';

export class LLRPAdapter {
  private host: string;
  private port: number;
  private readerId: string;
  private socket: net.Socket | null = null;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private onObservation: (obs: RawRFIDObservation) => void;
  private shouldRun: boolean = false;

  constructor(
    host: string,
    port: number,
    readerId: string,
    onObservation: (obs: RawRFIDObservation) => void
  ) {
    this.host = host;
    this.port = port;
    this.readerId = readerId;
    this.onObservation = onObservation;
  }

  public connect(): void {
    this.shouldRun = true;
    this.initSocket();
  }

  private initSocket(): void {
    if (!this.shouldRun) return;

    this.socket = new net.Socket();
    this.socket.setTimeout(10000);

    this.socket.connect(this.port, this.host, () => {
      this.isConnected = true;
      console.log(`[LLRP] Connected to physical RFID reader at ${this.host}:${this.port}`);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.socket.on('data', (data: Buffer) => {
      this.handleIncomingFrame(data);
    });

    this.socket.on('error', (err: Error) => {
      console.warn(`[LLRP] Connection error (${this.host}:${this.port}):`, err.message);
      this.isConnected = false;
    });

    this.socket.on('close', () => {
      this.isConnected = false;
      if (this.shouldRun && !this.reconnectTimer) {
        console.log(`[LLRP] Socket disconnected, scheduling reconnect in 5000ms...`);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.initSocket();
        }, 5000);
      }
    });

    this.socket.on('timeout', () => {
      console.warn(`[LLRP] Keepalive timeout reached on socket`);
      this.socket?.destroy();
    });
  }

  private handleIncomingFrame(buffer: Buffer): void {
    // Simple LLRP Type Header check: 10-byte binary header
    // Type 61 = RO_ACCESS_REPORT
    if (buffer.length < 10) return;

    const messageType = ((buffer[0] & 0x03) << 8) | buffer[1];
    const messageLength = buffer.readUInt32BE(2);

    if (messageType === 61) { // RO_ACCESS_REPORT
      this.parseROAccessReport(buffer.subarray(10, Math.min(buffer.length, messageLength)));
    }
  }

  private parseROAccessReport(payload: Buffer): void {
    // Basic parser for TagReportData parameter inside RO_ACCESS_REPORT
    let offset = 0;
    while (offset < payload.length - 4) {
      const paramHeader = payload.readUInt16BE(offset);
      const isTV = (paramHeader & 0x8000) !== 0;

      if (!isTV) {
        const paramType = paramHeader & 0x03ff;
        const paramLength = payload.readUInt16BE(offset + 2);
        if (paramLength === 0 || offset + paramLength > payload.length) break;

        if (paramType === 241) { // TagReportData
          this.extractTagParameters(payload.subarray(offset + 4, offset + paramLength));
        }
        offset += paramLength;
      } else {
        offset += 1;
      }
    }
  }

  private extractTagParameters(tagPayload: Buffer): void {
    let offset = 0;
    let epcHex = '';
    let antennaPort = 1;
    let rssi = -50.0;

    while (offset < tagPayload.length - 2) {
      const pHeader = tagPayload.readUInt16BE(offset);
      const isTV = (pHeader & 0x8000) !== 0;

      if (isTV) {
        const tvType = (pHeader >> 8) & 0x7f;
        if (tvType === 1) { // AntennaID TV parameter
          antennaPort = tagPayload.readUInt8(offset + 1);
          offset += 2;
          continue;
        } else if (tvType === 2) { // FirstSeenTimestampUTC
          offset += 9;
          continue;
        } else if (tvType === 6) { // PeakRSSI TV parameter
          const rawRssi = tagPayload.readInt8(offset + 1);
          rssi = rawRssi; // typical signed dBm or vendor units
          offset += 2;
          continue;
        }
        offset += 2;
      } else {
        const pType = pHeader & 0x03ff;
        const pLen = tagPayload.readUInt16BE(offset + 2);
        if (pLen === 0 || offset + pLen > tagPayload.length) break;

        if (pType === 242) { // EPC-96 parameter
          epcHex = tagPayload.subarray(offset + 4, offset + 16).toString('hex').toUpperCase();
        }
        offset += pLen;
      }
    }

    if (epcHex) {
      this.onObservation({
        epc: epcHex,
        antennaPort: antennaPort || 1,
        rssi: rssi < 0 ? rssi : -rssi,
        timestamp: Date.now(),
        readerId: this.readerId,
        source: 'PHYSICAL'
      });
    }
  }

  public disconnect(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
  }

  public getStatus(): { connected: boolean; host: string; port: number } {
    return {
      connected: this.isConnected,
      host: this.host,
      port: this.port
    };
  }
}

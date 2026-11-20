import { RawRFIDObservation } from '../types';

export class SimulatorAdapter {
  private timer: NodeJS.Timeout | null = null;
  private onObservation: (obs: RawRFIDObservation) => void;
  private isRunning: boolean = false;
  private intervalMs: number;

  private mockTags = [
    { epc: 'E200001722000245', basePort: 1, baseRssi: -42.0 },
    { epc: 'E200001722000246', basePort: 1, baseRssi: -45.0 },
    { epc: 'E200001722000247', basePort: 1, baseRssi: -40.5 },
    { epc: 'E200001722000248', basePort: 2, baseRssi: -43.0 },
    { epc: 'E200001722000249', basePort: 2, baseRssi: -46.5 },
    { epc: 'E200001722000250', basePort: 3, baseRssi: -44.0 },
    { epc: 'E200001722000251', basePort: 3, baseRssi: -48.0 },
    { epc: 'E200001722000252', basePort: 4, baseRssi: -43.5 },
    { epc: 'E200001722000253', basePort: 4, baseRssi: -47.0 }
  ];

  constructor(onObservation: (obs: RawRFIDObservation) => void, intervalMs: number = 800) {
    this.onObservation = onObservation;
    this.intervalMs = intervalMs;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(() => {
      // Pick 2-4 tags randomly
      const numTags = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numTags; i++) {
        const tag = this.mockTags[Math.floor(Math.random() * this.mockTags.length)];
        
        // 90% read on basePort, 10% potential cross-read leakage on adjacent port
        let port = tag.basePort;
        let rssi = tag.baseRssi + (Math.random() * 4.0 - 2.0);

        if (Math.random() < 0.12) {
          // Leakage on adjacent port
          port = port === 1 ? 2 : (port === 4 ? 3 : (Math.random() > 0.5 ? port + 1 : port - 1));
          rssi = -68.0 - (Math.random() * 8.0); // significantly weaker
        }

        this.onObservation({
          epc: tag.epc,
          antennaPort: port,
          rssi: Math.round(rssi * 10) / 10,
          timestamp: Date.now(),
          frequency: 865.7 + (port * 0.4),
          readerId: 'READER_01',
          source: 'SIMULATION'
        });
      }
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}

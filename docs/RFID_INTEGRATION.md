# UHF RFID Hardware Integration & RF Physics Engine

## 1. Hardware Integration Architecture

The system interfaces with standard enterprise fixed 4-port UHF RFID readers (Impinj Speedway R420/Revolution, Zebra FX9600, Alien F800, GAO RFID UHF readers) operating in EPC Gen 2 / ISO 18000-6C compliant 860-960 MHz bands.

```
       +---------------------------------------------+
       |           FIXED MULTIPORT UHF READER        |
       |  Port 1: Shelf A Antenna (e.g. 6 dBi Patch) |
       |  Port 2: Shelf B Antenna                    |
       |  Port 3: Shelf C Antenna                    |
       |  Port 4: Verification / Auxiliary Antenna   |
       +---------------------------------------------+
                              |
                     [LLRP / TCP Stream]
                              v
       +---------------------------------------------+
       |          app/rfid/reader_adapter.py         |
       |  - Managed TCP connection with auto-retry   |
       |  - LLRP RO_ACCESS_REPORT frame parser       |
       |  - Raw payload preservation                 |
       +---------------------------------------------+
                              v
       +---------------------------------------------+
       |         app/rfid/event_normalizer.py        |
       |  - Standardizes canonical JSON structure    |
       |  - Validates RSSI range (-85 dBm to -30 dBm)|
       |  - Normalizes EPC format & timestamps (UTC) |
       +---------------------------------------------+
```

---

## 2. Canonical RFID Event Schema

Every observation received from physical readers or the simulator conforms to the canonical JSON contract:

```json
{
  "event_id": "EVT-d4b912c0-8a1e-45fa-bb20-4e4f71a4f102",
  "source": "uhf_reader",
  "epc": "EPC-AUTO-1001",
  "reader_id": "READER_01",
  "antenna_id": 1,
  "antenna_port": 1,
  "rssi_dbm": -42.5,
  "frequency": 866.3,
  "phase": null,
  "doppler": null,
  "observed_at": "2026-11-17T12:00:00.000000Z",
  "received_at": "2026-11-17T12:00:00.050000Z",
  "valid": true,
  "raw_payload": {
    "antennaPort": 1,
    "peakRssi": -42.5,
    "epcHex": "E280117000000201001001A",
    "channelMhz": 866.3
  }
}
```

*Note: Optional physical parameters like `phase` or `doppler` are set to `null` if the connected hardware model does not expose them. Values are never fabricated.*

---

## 3. RF Physics & Multi-Antenna Disambiguation

### 3.1 The Cross-Reading Challenge
Passive UHF RFID radio waves penetrate non-metallic materials and reflect off warehouse steel racking. A tag placed on **Shelf A** will frequently be observed by the antenna on **Shelf B** with a lower Received Signal Strength Indicator (RSSI), e.g. -68 dBm vs -42 dBm.

### 3.2 Non-Negotiable Disambiguation Rules
1. **Never use strongest RSSI alone**: Multipath reflections and tag orientation can cause sporadic spikes.
2. **Sliding Time Window Aggregation**: Reads are collected over a configurable window ($T \in [5, 30]$ seconds).
3. **Multi-Feature Bayesian Inference**:
   - $\text{Read Count Weight } w_c$: Primary antenna receives $85-95\%$ of read cycles.
   - $\text{Median RSSI Weight } w_r$: Accounts for path loss ($P_{\text{rx}} \propto 1/d^2$).
   - $\text{Spatial Adjacency Prior}$: Shelf layout topology constraints.
4. **Ambiguity Abstention**: If the difference in posterior probability between the top-2 candidate shelves is less than $\Delta p < 0.15$, the state is declared **`AMBIGUOUS`** and flagged for human verification.
5. **Reader Outage Guard**: If a reader or antenna goes offline, the system marks the zone as `DEGRADED` and suppresses false missing discrepancies.

---

## 4. Physical UHF Simulator (`app/rfid/simulator.py`)

For end-to-end demonstrations, continuous automated testing, and development without hardware access, the system includes a high-fidelity RF physics simulator:
- Simulates tag position along a 1D warehouse aisle coordinate axis ($x$-coordinate).
- Calculates log-distance path loss with Gaussian shadow fading:
  $$\text{RSSI}(d) = P_0 - 10 \cdot n \cdot \log_{10}(d) + \mathcal{N}(0, \sigma^2)$$
- Simulates tag packaging effects (Cardboard = normal, Liquid Proximity = $-12$ dBm loss, Metal Shielded = $-25$ dBm loss / occlusion).
- Simulates hardware outages (e.g. reader disconnect, antenna RF port detachment).
- Supports live scenario injections via the API:
  - `POST /api/v1/simulator/move-tag`
  - `POST /api/v1/simulator/set-shadowing`
  - `POST /api/v1/simulator/set-reader-status`


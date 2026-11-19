# System Architecture & Event Pipeline

## 1. System Overview

The **Intelligent Inventory Reconciliation and Misplacement Detection System** bridges physical UHF RFID sensor observations with enterprise warehouse expected stock records. It transforms noisy, multi-path RF telemetry into actionable inventory intelligence, providing explainable discrepancy detection and human-in-the-loop verification.

```
       +-------------------------------------------------------------+
       |             PHYSICAL FIXED UHF RFID READER                  |
       |  (e.g., 4-Port Impinj Speedway / Zebra FX9600 / Alien F800) |
       +-------------------------------------------------------------+
                                      |
                      [EPCglobal LLRP Protocol / TCP Port 5084]
                                      v
       +-------------------------------------------------------------+
       |               STAGE 1: LLRP READER ADAPTER                  |
       |  - Binary frame codec & capability discovery                |
       |  - Persistent TCP connection & exponential backoff          |
       |  - Mode isolation (PHYSICAL vs SIMULATION vs OFFLINE)       |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |               STAGE 2: RAW EVENT CAPTURE                    |
       |  - Provenance tagging (source: 'PHYSICAL' | 'SIMULATION')   |
       |  - Zero-drop async queue with SQLite WAL / PostgreSQL       |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |        STAGE 3: EVENT VALIDATION & NORMALIZATION            |
       |  - Canonical schema validation (EPC syntax, UHF RSSI range) |
       |  - Antenna port to database Shelf mapping                   |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |            STAGE 4: DURABLE EVENT STORAGE                   |
       |  - Insert into `rfid_events` with indexed provenance        |
       |  - Sliding observation windows in `observation_windows`     |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |       STAGE 5: MULTI-ANTENNA FEATURE AGGREGATION            |
       |  - 10-second sliding observation windows                    |
       |  - Per-antenna read counts, median RSSI, and variance       |
       |  - Dynamic baseline subtraction from `antenna_calibrations` |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |        STAGE 6: READER & ANTENNA HEALTH MONITOR             |
       |  - Continuous heartbeat probe & active port tracking        |
       |  - Suppress false missing alarms during hardware outage     |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |           STAGE 7: SHELF LOCATION INFERENCE                 |
       |  - Multi-antenna energy model (power + read preponderance)  |
       |  - Cross-reading leakage filtering (separation delta < 6dB) |
       |  - Calibrated Softmax probability distribution              |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |      STAGE 8: P0 READ-RELIABILITY CLASSIFIER                |
       |  - Distinguish 'POSSIBLE_UNREAD' from 'LIKELY_ABSENT'       |
       |  - Packaging attenuation & tag orientation compensation     |
       |  - Deterministic rules baseline fallback                    |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |      STAGE 9: P0 ROOT-CAUSE EXPLANATION ENGINE              |
       |  - Multiclass diagnosis across 5 candidate causes           |
       |  - Generates empirical evidence trail & verification scan   |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |       STAGE 10: HUMAN VERIFICATION & GROUND TRUTH           |
       |  - Exception assignment to warehouse operator               |
       |  - Handheld RFID physical audit / bar-code confirmation     |
       |  - Immutable audit trail & online ground-truth capture      |
       +-------------------------------------------------------------+
```

---

## 2. Operating Modes & Data Source Separation

The system implements three mutually exclusive operating modes enforced by `OperatingModeManager`:

| Operating Mode | Observation Source | Hardware State | Description |
| :--- | :--- | :--- | :--- |
| **`SIMULATION`** | `UHFHardwareSimulator` | Simulated RF Physics | Synthetic reads generated via Friis path-loss, multi-path noise, and RF shadowing models. |
| **`PHYSICAL`** | `LLRPReaderAdapter` | Active TCP Socket | Real binary observations received from physical 4-port reader. No simulated data is accepted. |
| **`OFFLINE`** | None | Standby / Paused | Active RFID collection is suspended. Existing database records and exceptions remain accessible. |

**Data Integrity Invariant:** Every event recorded in `rfid_events` and `observation_windows` carries a mandatory `source` column (`SIMULATION` or `PHYSICAL`). Synthetic observations are never conflated with live hardware data.

---

## 3. Physical LLRP Reader Integration

The reader integration layer (`backend/app/rfid/llrp_adapter.py`) connects directly to standard EPCglobal LLRP fixed readers:
- **Protocol:** Low-Level Reader Protocol (LLRP) v1.0.1 over TCP port `5084`.
- **Capability Discovery:** Dispatches `GET_READER_CAPABILITIES` to extract antenna count, transmitter power ranges, and frequency tables.
- **Inventory Control:** Uses `ADD_ROSPEC`, `ENABLE_ROSPEC`, and `START_ROSPEC` to activate autonomous sweeps.
- **Data Streaming:** Decodes `RO_ACCESS_REPORT` binary frames, parsing 96-bit EPCs, antenna port numbers, peak RSSI (dBm), and microsecond timestamps.
- **Resilience:** Background socket heartbeat loop with automatic exponential reconnection and non-blocking TCP socket health probes.

---

## 4. Multi-Antenna Spatial Intelligence

Location estimation does not rely on strongest RSSI alone:
1. **Antenna Calibration:** Evaluates signal deltas against per-antenna noise floors and baseline RSSI from `antenna_calibrations`.
2. **Read-Count Preponderance:** Weighting combines 50% normalized RF power, 30% relative count, and 20% total system preponderance.
3. **Cross-Read Filtering:** When adjacent antenna beams detect an EPC with RSSI difference `< 6.0 dB`, the system flags `cross_reading_detected = True` and sets state to `AMBIGUOUS`.
4. **Antenna Fault Tolerance:** If an antenna is offline, absence of reads on that shelf is classified as `POSSIBLE_UNREAD` rather than false shrinkage.

---

## 5. Security Architecture

- **Authentication:** Standardized on `JWT_SECRET` with bcrypt password hashing (`HS256`). Unauthenticated bypass logic has been eliminated.
- **Network Isolation:** In Docker Compose, the PostgreSQL container is bound strictly to `127.0.0.1:5432` to prevent external network exposure.
- **Input Validation:** Canonical validation regex for EPCs (`^[A-Za-z0-9\-_]{4,64}$`) and physical UHF RSSI bounds `[-95.0, -10.0]` dBm.

# System Architecture & Event Pipeline

## 1. System Overview

The **Intelligent Inventory Reconciliation and Misplacement Detection System** bridges physical UHF RFID sensor observations with enterprise warehouse expected stock records. It transforms noisy, multi-path RF telemetry into actionable inventory intelligence, providing explainable discrepancy detection and human-in-the-loop verification.

```
       +-------------------------------------------------------------+
       |             PHYSICAL FIXED UHF RFID READER                  |
       |  (e.g., 4-Port Impinj Speedway / Zebra FX9600 / Alien F800) |
       +-------------------------------------------------------------+
                                      |
                      [LLRP / Raw Vendor Socket / SDK]
                                      v
       +-------------------------------------------------------------+
       |               STAGE 1: PYTHON READER ADAPTER                |
       |  - Persistent TCP connection & auto-reconnect backoff       |
       |  - Tag observation streaming & heartbeat monitor            |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |               STAGE 2: RAW EVENT CAPTURE                    |
       |  - Timestamped raw payloads captured in UTC                 |
       |  - Zero-drop queue with local SQLite/PostgreSQL WAL         |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |        STAGE 3: EVENT VALIDATION & NORMALIZATION            |
       |  - Canonical schema validation (EPC format, RSSI range)     |
       |  - Antenna ID and logical reader port mapping               |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |            STAGE 4: DURABLE EVENT STORAGE                   |
       |  - Insert into `rfid_events` table (PostgreSQL / SQLite)    |
       |  - Indexes on (epc, observed_at, reader_id, antenna_id)    |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |       STAGE 5: TIME-WINDOW FEATURE AGGREGATION              |
       |  - Configurable 5s - 30s sliding observation window         |
       |  - Per-antenna read counts, median RSSI, variance           |
       |  - First-seen / last-seen elapsed time calculation          |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |        STAGE 6: READER & ANTENNA HEALTH CHECK               |
       |  - Check hardware heartbeat & RF port continuity            |
       |  - Suppress false missing inferences during outage          |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |           STAGE 7: SHELF LOCATION INFERENCE                 |
       |  - Multi-antenna cross-read disambiguation                  |
       |  - Calibrated Bayesian probability across candidate shelves |
       |  - Ambiguity detection (abstains if top candidates close)   |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |       STAGE 8: P0 READ-RELIABILITY PREDICTION               |
       |  - Gradient Boosted Classifier + Sigmoid Calibration        |
       |  - Distinguishes LIKELY_UNREAD (occlusion) vs LIKELY_ABSENT |
       |  - Evaluates against deterministic rules baseline           |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |          STAGE 9: P0 ROOT-CAUSE HYPOTHESIS                  |
       |  - Explains discrepancy cause across 5 calibrated classes   |
       |  - Preserves hypothesis uncertainty and evidence trail      |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |          STAGE 10: INVENTORY RECONCILIATION                 |
       |  - Compares inferred shelf vs expected WMS location         |
       |  - Reconciles authorized vs unauthorized stock movements    |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |            STAGE 11: EXCEPTION GENERATION                   |
       |  - Lifecycle: NEW -> AI_ANALYZED -> PENDING_VERIFICATION    |
       |  - Broadcasts via WebSocket (/ws/rfid-events, /ws/ai-alerts)|
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |       STAGE 12: HUMAN OPERATOR VERIFICATION                 |
       |  - Handheld rescan or physical bin verification             |
       |  - Records ground-truth audit log; controlled stock update  |
       +-------------------------------------------------------------+
```

---

## 2. Component Architecture

### 2.1 Backend (FastAPI + Python 3.12+)
- **`app/main.py`**: Application factory, lifespan management, WebSocket multiplexer, and static SPA serving.
- **`app/api/v1/`**: Modular REST routes (`auth`, `dashboard`, `inventory`, `locations`, `readers`, `events`, `exceptions`, `reports`, `ai`, `reconciliation`, `simulator`).
- **`app/rfid/`**: Reader adapter layer, event validator, normalizer, background collector worker, and RF physics simulator.
- **`app/ai/`**: Independent intelligence package:
  - `read_reliability.py`: Calibrated classifier & rules baseline comparator.
  - `root_cause.py`: Multi-class discrepancy explainer with evidence reasoning.
  - `location_inference.py`: Bayesian antenna array inference engine.
  - `destination_inference.py`: Spatial proximity & RF gradient destination ranker.
  - `demand_forecasting.py`: 1d/3d/7d stockout risk forecaster.
  - `cycle_counting.py`: Risk-budgeted physical audit prioritizer.
- **`app/services/`**: Business logic orchestration (`reconciliation_service`, `inventory_service`, `verification_service`).
- **`app/core/`**: Configuration, database connection pooling, JWT security, and structured logging.

### 2.2 Frontend (React 18 + TypeScript + Tailwind CSS)
- **Design System**: Dark navy navigation sidebar (`#0B132B`), slate-50 light workspace background, clean rounded white cards (`shadow-sm border border-slate-200/80`).
- **5 Navigation Pillars**:
  1. `Dashboard`: Executive KPI telemetry, status donuts, read activity charts, recent exceptions.
  2. `Inventory`: SKU records, serialized EPC tags, warehouse shelf map, tag assignment modal, new shelf provisioning modal.
  3. `Live Monitoring`: Multiport antenna matrix, real-time RF event terminal, antenna assignment modal, connection health.
  4. `AI Exceptions`: Filterable exception workbench, confidence badges, root-cause evidence breakdowns, verification workflow.
  5. `Reports`: Audit exports, discrepancy summaries, reader uptime, AI validation reports.


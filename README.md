# Intelligent Inventory Reconciliation & Misplacement Detection System

A complete enterprise-grade warehouse intelligence and UHF RFID reconciliation application built with **Python, FastAPI, Scikit-learn, React, TypeScript, Tailwind CSS, and SQLAlchemy**.

Designed specifically for automated logistics centers and distribution facilities to differentiate between:
1. **Correctly stored in expected shelf** (`IN_PLACE`)
2. **Detected in wrong shelf** (`MISPLACED`)
3. **Physically present but missed by RFID** (`POSSIBLE_UNREAD` due to RF shadowing, liquid/metal proximity, or reader outages)
4. **Genuinely missing** (`LIKELY_MISSING` / physical shrinkage)
5. **Ambiguous multi-antenna detection** (`AMBIGUOUS` where adjacent antenna beams receive overlapping signal below separation threshold)
6. **Human verification states** (`PENDING_VERIFICATION`, `VERIFIED`, `RESOLVED`)

---

## 1. System Architecture

The architecture separates responsibilities into three distinct, decoupled engines coordinated by FastAPI:

```
+-----------------------------------------------------------------------------------------+
|                                   PHYSICAL HARDWARE LAYER                               |
|   Fixed 4-Port UHF RFID Reader (Impinj Speedway R420) • LLRP / Vendor SDK Adapter        |
|   Antenna Array: Port 1 (Shelf A), Port 2 (Shelf B), Port 3 (Shelf C), Port 4 (Shelf D) |
+-----------------------------------------------------------------------------------------+
                                             |
                                  Raw Tag Observations (RSSI, Freq, EPC)
                                             v
+-----------------------------------------------------------------------------------------+
|                              ENGINE 1: RFID HARDWARE ENGINE                             |
|   • reader_adapter.py (Abstract Base Class & LLRP driver)                               |
|   • simulator.py (Friis path-loss, beam angles, RF shadowing, cross-reading leakage)   |
|   • event_validator.py & event_normalizer.py (EVT Gen2 schema & UTC timestamps)         |
|   • event_collector.py (Asynchronous 10s sliding window aggregation & WebSocket feed)   |
+-----------------------------------------------------------------------------------------+
                                             |
                                 Normalized RFID Events
                                             v
+-----------------------------------------------------------------------------------------+
|                        ENGINE 2: INVENTORY & RECONCILIATION ENGINE                      |
|   • Expected vs Observed comparison against WMS Master Records                          |
|   • Authorized Movement Enforcement (Only authorized transactions update official stock)|
|   • Discrepancy Lifecycle: NEW -> AI_ANALYZED -> PENDING_VERIFICATION -> VERIFIED       |
|   • Verification Audit Trail (Captures physical ground truth for supervised retraining) |
+-----------------------------------------------------------------------------------------+
                                             ^
                                             | Versioned Predictions & Probabilities
                                             v
+-----------------------------------------------------------------------------------------+
|                                ENGINE 3: AI INTELLIGENCE ENGINE                         |
|   • feature_engineering.py (14-dim feature vector per EPC & time window)               |
|   • P0 Model 1: Read-Reliability Predictor (Calibrated Gradient Boosting Classifier)    |
|   • P0 Model 2: Root-Cause Explanation Engine (Multi-Class Gradient Boosting)          |
|   • Location Inference Engine (Softmax multi-antenna energy model)                     |
|   • P1 Extensions: Demand Forecaster, Risk-Based Cycle Counting, Destination Inference  |
+-----------------------------------------------------------------------------------------+
                                             |
                                  REST APIs & WebSockets
                                             v
+-----------------------------------------------------------------------------------------+
|                               FRONTEND APPLICATION (REACT + TS)                        |
|   1. Dashboard (KPIs, status donut, discrepancy timeline, shelf-wise distribution)      |
|   2. Inventory (Product master, EPC registry, shelf map, authorized movement logger)    |
|   3. Live Monitoring (Fixed reader telemetry, antenna ports, live feed, simulator console)|
|   4. AI Exceptions (Discrepancy lifecycle, empirical evidence breakdown, audit modal)  |
|   5. Reports (Audit reconciliation, accuracy metrics, cycle counting ranks, CSV export) |
|   + Settings & Device Administration (RBAC, antenna calibration baselines, AI models)   |
+-----------------------------------------------------------------------------------------+
```

---

## 2. 5 Primary Navigation Sections

As specified in the warehouse requirements, all features are organized strictly within **five clean navigation items**:

1. **Dashboard**: High-level warehouse KPIs (`Registered Tags`, `In-Place`, `Misplaced`, `Likely Missing`, `RF Unread`, `Ambiguous`, `Reader Status`), status distribution donut chart, discrepancy shift timeline, and shelf-wise expected vs observed bar chart.
2. **Inventory**: Product SKU master records, EPC tag registry (packaging classes: Cardboard, Plastic, Metal shielded, Liquid proximity), warehouse hierarchy (Warehouse -> Zones -> Shelves A, B, C, D), and authorized movement logger.
3. **Live Monitoring**: Hardware health for fixed 4-port reader, antenna beam array matrix, live streaming EPC observation feed with animated RSSI signal meters, and an interactive **Hardware Simulation Console** (allows injecting physical misplacement, RF metal shadowing, reader power cuts, and shrinkage).
4. **AI Exceptions**: Exception queue filtered by discrepancy type, deep AI inspection drawer with empirical evidence clues (`Repeated detections on ANT-03`, `No authorized WMS movement order`, `Antenna ANT-01 has 0 reads`), candidate shelf probabilities, root-cause confidence score, and the **Verification & Ground Truth Modal**.
5. **Reports**: Inventory reconciliation table, accuracy statistics, AI model performance evaluation metrics, CSV export, print layout, and **P1 Extensions** (Demand Forecasting table and Risk-Based Cycle Counting prioritizer).
   - **Settings & Profile**: Accessible via the top-right settings icon & profile badge (covers device parameters, reader IP/port, antenna calibrations, model retraining, and RBAC matrix).

---

## 3. Mandatory AI Models (P0) & Extensions (P1)

### Model 1: RFID Read-Reliability Prediction (P0 - Mandatory)
- **Purpose**: Distinguishes whether an unobserved item is genuinely absent from the warehouse or whether the RFID system missed the tag.
- **Algorithm**: Calibrated `GradientBoostingClassifier` with isotonic calibration + rules baseline.
- **Inputs**: EPC, expected shelf, antenna read counts, median RSSI, RSSI variance, time delta since last seen, reader health status, packaging class attenuation.
- **Outputs**: `LIKELY_PRESENT`, `LIKELY_ABSENT`, `LIKELY_UNREAD` (shadowed/outage), `UNCERTAIN` + confidence score + diagnostic explanation.
- **Critical Business Rule**: When a reader is disconnected, absence of reads is **never** declared as missing; missing reads are suspended and flagged as `POSSIBLE_UNREAD` due to `READER_OUTAGE`.

### Model 2: Root-Cause Explanation Engine (P0 - Mandatory)
- **Purpose**: Diagnoses the underlying operational cause behind any inventory exception.
- **Classes**:
  1. `PHYSICAL_RELOCATION`: Item moved without WMS authorization.
  2. `RF_SHADOWING`: Physically present but obstructed by metal/liquid packaging.
  3. `INCORRECT_WMS_TRANSACTION`: Clerical error or unauthorized movement.
  4. `DUPLICATE_EPC_MAPPING`: Multiple tags sharing identical serialized EPC.
  5. `READER_OUTAGE`: Hardware power cut or Ethernet disconnection.
- **Outputs**: Hypothesis cause, probability confidence, structured list of empirical clues, and recommended action.

### Model 3: Inventory Demand Forecasting (P1 - Extension)
- **Algorithm**: `GradientBoostingRegressor` multi-horizon forecaster.
- **Outputs**: 1-day, 3-day, and 7-day consumption forecasts, stockout risk rating (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), and reorder recommendation.

### Model 4: Risk-Based Cycle Counting Prioritizer (P1 - Extension)
- **Purpose**: Calculates operational risk score (0-100) per shelf to optimize audit routes.
- **Weights**: Discrepancy probability (40%), Dollar valuation (25%), Item velocity (20%), Audit staleness (15%).

### Model 5: Misplacement Destination Inference (P1 - Extension)
- **Purpose**: Estimates most probable alternative shelf destination when an item goes missing.

---

## 4. Normalized RFID Event Schema

Every event is normalized by `event_normalizer.py` into a standardized format with UTC timestamps, source offsets, and raw payload preservation:

```json
{
  "event_id": "EVT-A3F190B2",
  "epc": "EPC-9002",
  "reader_id": "READER_01",
  "antenna_id": 3,
  "rssi_dbm": -41.5,
  "frequency": 866.3,
  "observed_at": "2026-11-17T14:30:00Z",
  "received_at": "2026-11-17T14:30:00.120Z",
  "valid": true,
  "raw_payload": {
    "antenna_port": 3,
    "epc": "EPC-9002",
    "rssi_dbm": -41.5
  }
}
```

---

## 5. Getting Started & Deployment

### 5.1 Single-Command Python Server (Frontend + Backend + WebSockets)
```bash
# From repository root:
python run_server.py
```
This single command automatically serves:
- **Production React Web Application**: [http://localhost:8000/](http://localhost:8000/)
- **FastAPI REST API v1**: [http://localhost:8000/api/v1](http://localhost:8000/api/v1)
- **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Real-Time RFID WebSockets**: `ws://localhost:8000/ws/rfid-events`

### 5.2 Containerized Deployment (Docker Compose)
```bash
# Windows:
run_docker.bat

# Linux / macOS:
./run_docker.sh
# or
docker compose up --build -d
```

### 5.3 Automated Pytest Suite (19 Passed)
```bash
# Run all tests directly from project root:
python -m pytest
```

---

## 6. Complete Documentation Suite (`docs/`)

| Document | Purpose |
|---|---|
| [**SRS.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/SRS.md) | Official Software Requirements Specification & baseline |
| [**ARCHITECTURE.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/ARCHITECTURE.md) | 12-stage event processing and reconciliation pipeline |
| [**DATABASE_SCHEMA.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/DATABASE_SCHEMA.md) | PostgreSQL 21-table schema, indexing & JSONB specifications |
| [**API_DOCUMENTATION.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/API_DOCUMENTATION.md) | Complete REST API (`/api/v1`) & WebSocket stream reference |
| [**RFID_INTEGRATION.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/RFID_INTEGRATION.md) | Fixed UHF hardware adapter, canonical event schema & physics engine |
| [**AI_MODEL_DOCUMENTATION.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/AI_MODEL_DOCUMENTATION.md) | P0/P1 model cards, validation metrics & baseline comparators |
| [**CALIBRATION_GUIDE.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/CALIBRATION_GUIDE.md) | Empirical RF zone profiling & cross-reading leakage characterization |
| [**INSTALLATION_GUIDE.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/INSTALLATION_GUIDE.md) | Comprehensive setup instructions for Python & Docker |
| [**USER_GUIDE.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/USER_GUIDE.md) | Warehouse operator workflow & physical verification lifecycle |
| [**TEST_PLAN.md**](file:///c:/Users/SESU/Downloads/D1%20-%20Intelligent%20Inventory%20Reconciliation%20and%20Misplacement%20Detection/docs/TEST_PLAN.md) | Quality assurance matrix & acceptance criteria |

---

## 7. Test Verification Matrix (19 Tests Passing)

| Test Suite | Test Function | Scenario Tested | Outcome |
| :--- | :--- | :--- | :--- |
| `test_api_endpoints.py` | `test_system_health` | System health check and DB connectivity | PASSED |
| `test_api_endpoints.py` | `test_system_events` | Background worker system events | PASSED |
| `test_api_endpoints.py` | `test_auth_me_and_refresh` | JWT profile & session token refresh | PASSED |
| `test_api_endpoints.py` | `test_dashboard_endpoints` | 5 dashboard telemetry & distribution endpoints | PASSED |
| `test_api_endpoints.py` | `test_products_and_tags_endpoints`| SKU catalog & serialized EPC registry | PASSED |
| `test_api_endpoints.py` | `test_locations_and_shelves` | Warehouse hierarchy, zones, shelves & bins | PASSED |
| `test_api_endpoints.py` | `test_readers_and_antennas` | Hardware registry, ping test & antenna status | PASSED |
| `test_api_endpoints.py` | `test_rfid_events` | Raw event query & real-time telemetry stats | PASSED |
| `test_api_endpoints.py` | `test_reconciliation` | End-to-end reconciliation run trigger | PASSED |
| `test_api_endpoints.py` | `test_ai_models_and_metrics` | Model registry, metrics, demand & cycle counting | PASSED |
| `test_api_endpoints.py` | `test_exceptions_lifecycle` | Exception assignment & acknowledgement | PASSED |
| `test_rfid_system.py` | `test_event_validator` | EPC syntax regex & RSSI boundaries | PASSED |
| `test_rfid_system.py` | `test_event_normalizer` | UTC timestamp normalization & event UUID | PASSED |
| `test_rfid_system.py` | `test_uhf_hardware_simulator` | Friis path-loss & RF shadowing attenuation | PASSED |
| `test_rfid_system.py` | `test_location_inference` | Multi-antenna softmax probabilities & ambiguity | PASSED |
| `test_rfid_system.py` | `test_read_reliability_prediction`| Absence vs RF shadowing vs reader outage | PASSED |
| `test_rfid_system.py` | `test_root_cause_explanation` | Multi-class cause reasoning & evidence clues | PASSED |
| `test_rfid_system.py` | `test_p1_models` | Multi-horizon demand regression & risk ranking | PASSED |
| `test_rfid_system.py` | `test_dashboard_summary` | KPI aggregation & status distribution donut | PASSED |


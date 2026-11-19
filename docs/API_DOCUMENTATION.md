# REST & WebSocket API Specification

## 1. Overview
- **Base URI**: `http://localhost:8000/api/v1`
- **Swagger / OpenAPI**: `http://localhost:8000/docs`
- **Format**: JSON (Request & Response)
- **Authentication**: Bearer JWT token in `Authorization: Bearer <token>` header

---

## 2. REST Endpoints Summary

### 2.1 Authentication (`/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticate using OAuth2 form data (email + password); returns JWT token |
| `POST` | `/auth/refresh` | Refresh access token for active session |
| `POST` | `/auth/logout` | Revoke session and log user logout |
| `GET` | `/auth/me` | Retrieve profile of authenticated user |

### 2.2 Dashboard (`/dashboard`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard/summary` | Comprehensive KPI cards, status donut, discrepancy trends, shelf breakdown |
| `GET` | `/dashboard/inventory-status` | Status distribution breakdown for donut visualization |
| `GET` | `/dashboard/rfid-activity` | Hourly / daily RFID tag read count histogram |
| `GET` | `/dashboard/shelf-summary` | Shelf-wise capacity utilization and discrepancy density |
| `GET` | `/dashboard/recent-exceptions` | Unresolved AI exceptions for immediate operator attention |

### 2.3 Products & Inventory (`/products`, `/rfid-tags`, `/inventory`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/products` | List all registered master catalog products |
| `POST` | `/products` | Create a new product SKU |
| `GET` | `/products/{id}` | Get product details by ID |
| `PATCH` | `/products/{id}` | Update product attributes |
| `POST` | `/products/import` | Bulk import product catalog with duplicate detection |
| `GET` | `/rfid-tags` | List all serialized RFID tags |
| `POST` | `/rfid-tags` | Register a new serialized EPC tag |
| `GET` | `/rfid-tags/{id}` | Get tag details by ID |
| `PATCH` | `/rfid-tags/{id}` | Update tag status or packaging class |
| `GET` | `/inventory` | List expected vs observed inventory state across warehouse |
| `GET` | `/inventory/{id}` | Get inventory record details |
| `POST` | `/inventory/assign-tag` | Assign tag to product, specify expected shelf, and register in RF engine |
| `GET` | `/inventory/movements` | List authorized and physical stock movement audit trail |
| `POST` | `/inventory/movements` | Record an authorized stock movement |

### 2.4 Warehouse & Spatial Locations (`/locations`, `/shelves`, `/zones`, `/bins`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/locations` / `/warehouses` | Full hierarchy of warehouses, zones, shelves, and antenna links |
| `GET` | `/shelves` / `/locations/shelves` | List all warehouse shelf bays |
| `POST` | `/shelves` / `/locations/shelves` | Provision a new warehouse shelf location |
| `GET` | `/zones` / `POST /zones` | List or create warehouse zones |
| `GET` | `/bins` / `POST /bins` | List or create sub-bay storage bins |

### 2.5 Hardware & Antennas (`/readers`, `/antennas`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/readers` | List multiport fixed UHF RFID readers |
| `POST` | `/readers` | Register a new reader |
| `GET` | `/readers/{id}` | Get reader details and connected antenna ports |
| `PATCH` | `/readers/{id}` | Update reader network or status attributes |
| `GET` | `/readers/{id}/health` | Hardware heartbeat, temperature, and RF interference metrics |
| `POST` | `/readers/{id}/test-connection` | Perform TCP/LLRP ping and connection validation |
| `GET` | `/antennas` | List all antenna ports across readers |
| `GET` | `/antennas/{id}` / `PATCH /antennas/{id}` | Retrieve or update antenna RF parameters |
| `POST` | `/antennas/assign` | Map antenna port to shelf, configure Tx power and gain |
| `GET` | `/antennas/{id}/calibrations` | Calibration runs for specific antenna |
| `POST` | `/calibration/runs` | Record empirical RF calibration profile |

### 2.6 RFID Observation Stream (`/rfid-events`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/rfid-events` | Query raw RFID events with optional `epc`, `antenna_id`, and `limit` |
| `GET` | `/rfid-events/{id}` | Get raw event detail and unedited payload |
| `POST` | `/rfid-events/ingest` | Internal raw event ingestion endpoint |
| `GET` | `/rfid-events/statistics` | Real-time read rate, total events, and antenna activity |

### 2.7 AI Intelligence Engine (`/ai`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/ai/models` | List all models, versions, and validation metrics |
| `GET` | `/ai/metrics` | Model accuracy, precision, recall, Brier score, and MAE/WAPE |
| `GET` | `/ai/predictions` | Historical AI discrepancy predictions and evidence logs |
| `POST` | `/ai/infer/read-reliability` | P0: Evaluates whether an unobserved EPC is unread vs absent |
| `POST` | `/ai/infer/root-cause` | P0: Ranks 5 candidate discrepancy causes with supporting evidence |
| `POST` | `/ai/infer/location` | P0: Infers shelf location across multi-antenna windows |
| `GET` | `/ai/demand-forecast` | P1: Multi-horizon (1d, 3d, 7d) demand and stockout risk |
| `GET` | `/ai/cycle-counting` | P1: Risk-ranked cycle counting priority list |
| `GET` | `/ai/destination/{epc}` | P1: Top-3 candidate shelves for misplaced EPC |
| `GET` | `/ai/scored-event/{epc}` | Unified scored event JSON contract |
| `GET` | `/ai/scored-events` | Unified scored event JSON for all registered items |
| `POST` | `/ai/demo/step/{step}` | Live demonstration runner step execution (Steps 1–6) |
| `GET` | `/ai/demo/status` | Current step and timeline status of live demonstration |
| `POST` | `/ai/demo/reset` | Reset live demonstration state |

### 2.8 Reconciliation & Exceptions (`/reconciliation`, `/exceptions`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/reconciliation/run` | Trigger full inventory reconciliation cycle |
| `GET` | `/reconciliation/status` | Last run timestamp, duration, items evaluated, open exceptions |
| `GET` | `/exceptions` | List exceptions with optional filters (`status`, `shelf`, `type`) |
| `GET` | `/exceptions/{id}` | Detailed exception card with evidence timeline |
| `POST` | `/exceptions/{id}/assign` | Assign exception to warehouse operator |
| `POST` | `/exceptions/{id}/acknowledge` | Acknowledge exception and set status to PENDING_VERIFICATION |
| `POST` | `/exceptions/{id}/verify` | Record physical verification result and ground truth |
| `POST` | `/exceptions/{id}/resolve` | Resolve exception with corrective action |
| `POST` | `/exceptions/{id}/reopen` | Reopen resolved exception for physical re-audit |

### 2.9 Reports & System (`/reports`, `/system`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reports/inventory` | Inventory reconciliation and stock health report |
| `GET` | `/reports/discrepancies` | Discrepancy analysis report |
| `GET` | `/reports/readers` | Hardware uptime and antenna read activity report |
| `GET` | `/reports/ai-performance` | Model validation, Brier score, and accuracy metrics |
| `GET` | `/reports/audit` | Operator verification and administrative action logs |
| `GET` | `/system/health` | Service health, database connectivity, and collector status |
| `GET` | `/system/events` | Background worker system events |

---

## 3. WebSocket Streams (`/ws/{channel}`)

Connect to `ws://localhost:8000/ws/{channel}`:
- **`rfid-events`**: Streams real-time normalized tag observation events.
- **`inventory-updates`**: Pushes reconciled inventory state changes.
- **`ai-alerts`**: Broadcasts new discrepancies and AI exception updates.
- **`system-status`**: Emits hardware connection and collector heartbeat telemetry.


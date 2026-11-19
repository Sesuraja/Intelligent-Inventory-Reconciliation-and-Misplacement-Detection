# Intelligent Inventory Reconciliation and Misplacement Detection

## Complete Software Requirements Specification (SRS) and Development Blueprint

**Document type:** Software Requirements Specification + Technical
Design\
**Project category:** AI + IoT + UHF RFID + Warehouse Inventory
Intelligence\
**Version:** 1.0\
**Status:** Development baseline\
**Primary implementation:** Python, FastAPI, React, TypeScript, HTML5,
CSS3, PostgreSQL

------------------------------------------------------------------------

# 1. Executive Summary

The Intelligent Inventory Reconciliation and Misplacement Detection
System is a web-based warehouse intelligence application that compares
expected inventory records with physical UHF RFID observations.

The system receives RFID observations from a fixed UHF reader,
associates each EPC with a registered product and expected warehouse
location, aggregates observations by time window, estimates the most
likely shelf location, and identifies potential inventory discrepancies.

The system must distinguish between:

-   Product observed in its expected location.
-   Product likely detected in a different location.
-   Product not observed but potentially missed by RFID.
-   Product likely absent after considering reader health, read
    reliability and historical evidence.
-   Product whose location is ambiguous because multiple antennas detect
    it.
-   Reader or antenna failures that make inventory conclusions
    unreliable.

The application provides an operator workflow to investigate and verify
exceptions. Official inventory records must not be silently changed
based only on a single RFID observation or an unverified AI prediction.

## 1.1 Primary objectives

1.  Provide visibility into expected and observed inventory.
2.  Collect and preserve raw UHF RFID observations.
3.  Map reader antennas to warehouse shelf zones.
4.  Detect potential misplaced and missing inventory.
5.  Distinguish likely missed reads from likely physical absence.
6.  Explain possible discrepancy causes using supporting evidence.
7.  Support human verification and controlled inventory corrections.
8.  Provide audit history, reports and measurable model performance.
9.  Allow future extension into demand forecasting and risk-based cycle
    counting.

## 1.2 Out of scope for the initial release

-   Automatic write-back to a live production WMS or ERP.
-   Guaranteed centimetre-level or exact-bin positioning from ordinary
    fixed UHF RFID antennas.
-   Guaranteed elimination of RFID cross-reads.
-   Guaranteed accuracy or latency claims before controlled testing.
-   BLE location tracking or BLE Angle-of-Arrival.
-   Demand forecasting and advanced optimization as mandatory MVP
    features.

------------------------------------------------------------------------

# 2. Project Scope and Demonstration Environment

The initial demonstration is a dedicated warehouse section.

  Item                           Demonstration scope
  ------------------------------ ------------------------------------------
  Warehouse area                 Approximately 4 m × 3 m
  Shelving                       2--3 steel shelving bays
  Tagged items                   30--100 bins/cartons
  UHF fixed reader               1 multiport reader, preferably 4-port
  UHF antennas                   2--4 compatible antennas
  Passive UHF tags               150 planned tags
  Handheld reader                Optional; not required for initial build
  Edge computer                  1
  WMS                            Isolated software sandbox
  Initial location granularity   Shelf / zone level

Hardware model, regional frequency, firmware, antenna connectors, reader
API/SDK, RSSI availability and other reader capabilities must be
verified against the actual hardware before integration.

## 2.1 Initial shelf and antenna plan

Initial logical mapping:

  -----------------------------------------------------------------------
  Reader port             Antenna                 Assigned zone
  ----------------------- ----------------------- -----------------------
  Port 1                  ANT-01                  Shelf A

  Port 2                  ANT-02                  Shelf B

  Port 3                  ANT-03                  Shelf C

  Port 4                  Unassigned initially    Spare / additional
                                                  coverage / verification
                                                  zone
  -----------------------------------------------------------------------

Start with three controlled shelf zones. Add the fourth antenna only
when coverage testing demonstrates a need.

An antenna assignment is a logical coverage association, not proof that
every tag detected by that antenna is physically on that shelf.

## 2.2 RF limitations and design principles

UHF RFID signals may reach beyond the intended shelf. A tag may be
detected by more than one antenna because of antenna radiation patterns,
reader power, tag orientation, reflections, metal, liquids and
environmental conditions.

The software must therefore:

-   Preserve observations from every antenna.
-   Compare observations within defined time windows.
-   Use read counts, RSSI statistics, antenna identity, historical
    coverage and reader health.
-   Calculate candidate shelf probabilities.
-   Allow an ambiguous result.
-   Avoid selecting a shelf from one strongest RSSI reading alone.
-   Support antenna calibration experiments.
-   Record actual physical ground truth during calibration.
-   Avoid declaring an item missing when the reader or relevant antenna
    is offline.

------------------------------------------------------------------------

# 3. Users, Roles and Permissions

## 3.1 User roles

  -----------------------------------------------------------------------
  Role                                Permissions
  ----------------------------------- -----------------------------------
  Administrator                       Full application, users,
                                      configuration and data access

  Warehouse Manager                   Inventory, exceptions, verification
                                      oversight and reports

  Warehouse Operator                  View inventory and verify assigned
                                      exceptions

  Technical Engineer                  Reader, antenna, calibration,
                                      integration and model configuration

  Read-only User                      View authorized dashboards and
                                      reports
  -----------------------------------------------------------------------

## 3.2 Authentication requirements

-   Secure login and logout.
-   Password hashing using Argon2 or bcrypt.
-   JWT access tokens and refresh-token strategy.
-   Role-based access control.
-   Password reset workflow if email infrastructure is configured.
-   Session expiry and token revocation policy.
-   Login audit history.
-   Rate limiting for authentication endpoints.

------------------------------------------------------------------------

# 4. Application Navigation and UX

Keep the primary navigation compact. Use five main navigation items.

1.  Dashboard
2.  Inventory
3.  Live Monitoring
4.  AI Exceptions
5.  Reports

Place Settings, user profile and administration controls in the
profile/settings area rather than adding many primary navigation items.

## 4.1 Visual design direction

Use the user-provided dashboard screenshot as the primary visual
reference.

Design characteristics:

-   Dark navy vertical sidebar.
-   Light blue-grey main background.
-   White cards with subtle borders and soft shadows.
-   Rounded corners.
-   Clear typography and restrained spacing.
-   Blue as the primary accent.
-   Green for normal/verified.
-   Orange for warning/ambiguous.
-   Red for critical/likely missing or device failure.
-   Responsive desktop, tablet and mobile layouts.
-   Consistent page header, cards, tables, filters and status badges.

Recommended frontend design system:

  Area             Recommendation
  ---------------- ---------------------------------------------
  Font             Inter
  Icons            Lucide React
  Components       shadcn/ui or equivalent reusable components
  Styling          Tailwind CSS or organized CSS modules
  Charts           Recharts
  Tables           TanStack Table
  Forms            React Hook Form + Zod
  API state        TanStack Query
  Local UI state   Zustand where needed

## 4.2 Dashboard layout

Top area: - Welcome message. - Current date/time. - Notification
indicator. - User profile.

KPI cards: - Total registered items. - In-place items. - Misplaced
candidates. - Missing / review required.

Main content: - Inventory status chart. - RFID read activity chart. -
Shelf-wise inventory summary. - Recent AI exceptions. - Reader and
antenna health.

All production dashboard figures must come from backend APIs. Sample
values may be used only in a clearly identified development/demo mode.

## 4.3 Required screens

  -----------------------------------------------------------------------
  Screen                              Main content
  ----------------------------------- -----------------------------------
  Dashboard                           KPIs, inventory charts, reader
                                      status and recent exceptions

  Inventory                           Products, EPC tags, expected
                                      locations and movement history

  Live Monitoring                     Reader health, antenna activity,
                                      live EPC observations and raw event
                                      view

  AI Exceptions                       Misplaced, likely missing, possible
                                      unread and ambiguous cases

  Exception Details                   Evidence, expected/observed
                                      location, model output, history and
                                      verification

  Reports                             Inventory, discrepancy, reader,
                                      model and audit reports

  Settings                            Users, roles, reader configuration,
                                      antenna mapping, calibration, model
                                      settings
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 5. Functional Requirements and Software Modules

## 5.1 Module A --- Dashboard and Warehouse Overview

### Features

-   Total registered products and EPCs.
-   In-place count.
-   Misplaced candidate count.
-   Likely missing count.
-   Possible unread count.
-   Ambiguous location count.
-   Pending verification count.
-   Reader online/offline state.
-   Antenna health and recent activity.
-   Recent RFID events.
-   Open exception list.
-   Inventory status distribution.
-   Daily RFID activity.
-   Shelf-wise inventory summary.
-   Discrepancy trend.
-   Last successful data collection timestamp.

### Requirements

-   KPI cards must be derived from database-backed API results.
-   Dashboard filters must support date range and warehouse/zone where
    applicable.
-   Clicking a KPI should navigate to the corresponding filtered list.
-   Dashboard must display stale-data and offline warnings.
-   Empty, loading and error states must be implemented.

## 5.2 Module B --- Product and Inventory Management

### Product management

-   Create, read, update and deactivate products.
-   Store SKU, product name, description, category, unit and optional
    value.
-   Search and filter products.
-   Import products using validated CSV/XLSX templates.
-   Detect duplicate SKU.
-   Maintain product creation and modification audit history.

### RFID tag management

-   Register EPC.
-   Assign EPC to a product or tracked carton/item.
-   Prevent duplicate active EPC assignment.
-   Activate/deactivate tags.
-   Reassign a tag through a controlled workflow.
-   Preserve tag assignment history.
-   Bulk import EPC mappings.
-   Validate EPC format according to configured tag policy.

### Inventory management

-   Maintain expected quantity and expected location.
-   Track item-level EPC records.
-   Record receipts, picks, transfers and dispatches.
-   Record authorized movement transactions.
-   Preserve inventory history.
-   Support cycle-count records.
-   Do not automatically change expected location from an unverified
    antenna observation.

## 5.3 Module C --- Warehouse and Location Management

### Location hierarchy

``` text
Warehouse
  └── Zone
       └── Shelf / Bay
            └── Bin (optional)
```

### Features

-   Create and edit warehouse.
-   Create zones.
-   Create shelves and bays.
-   Create optional bins.
-   Assign unique location codes.
-   Define location capacity if required.
-   Assign expected product locations.
-   Map antennas to shelf zones.
-   View shelf inventory.
-   Maintain location history.

Initial AI output should be shelf-level. Bin-level claims require a
separately tested antenna design and supporting evidence.

## 5.4 Module D --- RFID Device and Antenna Management

### Reader management

-   Register reader ID, manufacturer, model, serial number and firmware.
-   Configure network address and connection parameters securely.
-   Select supported communication adapter.
-   Monitor connection state.
-   Record last successful communication.
-   Record reader errors and reconnect attempts.
-   Support manual connection test.
-   Support controlled start/stop of collection.

### Antenna management

-   Register antenna ID and reader port.
-   Assign antenna to shelf/zone.
-   Store antenna model, gain, polarization, mounting position and
    orientation where known.
-   Store reader power configuration.
-   Record cable/connector information where useful.
-   Track antenna health where the reader exposes it.
-   Preserve configuration history.

### Calibration management

-   Create calibration run.
-   Record physical item and actual shelf.
-   Record antenna configuration and reader power.
-   Record all antenna observations.
-   Record tag orientation and packaging class where available.
-   Record environmental notes.
-   Label actual physical location.
-   Compare antenna coverage and cross-reading.
-   Export calibration dataset.

## 5.5 Module E --- RFID Collection and Event Processing

This module receives the raw data from the physical fixed reader.

### Reader integration

Use the exact interface supported by the selected reader: - Vendor
SDK/API, or - LLRP, if supported.

Do not assume every reader exposes identical fields or control
functions.

### Collector responsibilities

-   Connect to reader.
-   Subscribe to or poll for tag observations.
-   Preserve raw reader payload.
-   Normalize event fields.
-   Validate EPC and timestamps.
-   Preserve reader and antenna identifiers.
-   Record RSSI when exposed.
-   Record optional frequency, phase or Doppler only if supported.
-   Add received timestamp.
-   Handle reconnects.
-   Handle duplicate and out-of-order events.
-   Publish normalized events to processing pipeline.

### Canonical RFID event schema

``` json
{
  "event_id": "uuid",
  "source": "uhf_reader",
  "epc": "EPC001",
  "reader_id": "READER_01",
  "antenna_id": "ANT-01",
  "antenna_port": 1,
  "rssi_dbm": -42.0,
  "frequency_khz": null,
  "phase": null,
  "doppler": null,
  "observed_at": "2026-11-17T10:30:00Z",
  "received_at": "2026-11-17T10:30:00Z",
  "raw_payload": {},
  "validity_flags": []
}
```

Optional fields must be null/absent if the hardware does not expose
them. Never fabricate phase, Doppler or frequency values.

### Event processing

-   Validate event schema.
-   Normalize timestamps to UTC.
-   Track source clock offset where measurable.
-   Apply idempotency key.
-   Deduplicate for downstream processing without deleting raw
    observations.
-   Aggregate by EPC and time window.
-   Preserve raw event and transformed feature snapshot.
-   Record processing errors and retry safely.

### Initial observation window

Use a configurable 5--30 second window for the initial feature pipeline.
A 5--10 second starting configuration may be tested, but the correct
window must be determined experimentally.

## 5.6 Module F --- Shelf Location Inference

### Purpose

Estimate the most likely shelf for each EPC based on multiple antenna
observations.

### Inputs

-   EPC.
-   Expected location.
-   Reader ID.
-   Antenna ID.
-   Read count by antenna.
-   RSSI median and variance by antenna.
-   First-seen and last-seen timestamps.
-   Historical antenna coverage.
-   Reader and antenna health.
-   Recent authorized movement.
-   Tag orientation/packaging class where recorded.

### Processing

1.  Retrieve observations for the configured time window.
2.  Check reader and antenna health.
3.  Group observations by EPC and antenna.
4.  Calculate per-antenna features.
5.  Compare with calibrated shelf coverage.
6.  Calculate candidate shelf probabilities.
7.  Check model confidence and ambiguity.
8.  Return a location estimate or abstain.

### Output example

``` json
{
  "epc": "EPC001",
  "expected_location": "SHELF_A",
  "predicted_location": "SHELF_A",
  "candidate_locations": [
    {"location": "SHELF_A", "probability": 0.82},
    {"location": "SHELF_B", "probability": 0.15},
    {"location": "SHELF_C", "probability": 0.03}
  ],
  "status": "LOCATION_ESTIMATED",
  "verification_required": false,
  "model_version": "location-0.1.0"
}
```

Values above are illustrative only.

### Important rules

-   Strongest RSSI alone must not determine the shelf.
-   A single read must not establish a definitive location.
-   Similar candidate probabilities should produce AMBIGUOUS.
-   Missing antenna data must be represented explicitly.
-   Reader outage must lower confidence and suppress unsupported missing
    conclusions.
-   Location confidence must be calibrated and evaluated on held-out
    physical trials.

## 5.7 Module G --- Inventory Reconciliation Engine

### Purpose

Compare expected inventory with observed RFID evidence and authorized
WMS transactions.

### Inputs

-   Expected EPC and location.
-   Product/tag mapping.
-   Recent authorized movement.
-   Aggregated RFID observations.
-   Location inference.
-   Reader and antenna health.
-   Last successful inventory observation.

### Reconciliation states

  -----------------------------------------------------------------------
  State                               Meaning
  ----------------------------------- -----------------------------------
  IN_PLACE                            Evidence supports expected shelf

  MISPLACED_CANDIDATE                 Evidence supports a different shelf

  LIKELY_MISSING                      Sufficient evidence of absence
                                      after reliability checks

  POSSIBLE_UNREAD                     Item may be present but RFID
                                      observation is unreliable

  AMBIGUOUS                           Multiple candidate shelves remain
                                      plausible

  PENDING_VERIFICATION                Human check is required

  VERIFIED                            Physical state confirmed by an
                                      authorized user
  -----------------------------------------------------------------------

### Reconciliation rules

-   Do not label an EPC missing after one missed read.
-   Check reader and antenna health before absence inference.
-   Consider expected scan coverage and historical read reliability.
-   Consider recent authorized movements.
-   Use configurable observation and stale-data thresholds.
-   Generate an exception when evidence crosses configured thresholds.
-   Keep candidate predictions separate from verified inventory state.
-   Require authorized verification or transaction to change official
    expected location.

## 5.8 Module H --- AI Intelligence Engine

The AI engine must be an independent Python package/service. It must be
callable by FastAPI and independently testable.

### AI Model 1: RFID Read-Reliability Prediction --- P0

**Purpose:** Estimate whether a tag is likely present but unread, likely
absent, or uncertain.

Inputs: - EPC and expected location. - Per-antenna read counts. - RSSI
statistics. - Last-seen age. - First/last seen. - Historical read
reliability. - Reader/antenna health. - Recent movement records. - Tag
orientation and packaging class where available. - Coverage calibration
profile.

Outputs: - `LIKELY_PRESENT` - `LIKELY_UNREAD` - `LIKELY_ABSENT` -
`UNCERTAIN` - Calibrated probability/score. - Evidence and contributing
features. - Model version.

Recommended approach: - Deterministic rules baseline. - Gradient
Boosting Classifier. - Probability calibration. -
Abstention/verification state.

### AI Model 2: Root-Cause Explanation --- P0

**Purpose:** Rank likely causes for a discrepancy.

Candidate causes: 1. Physical relocation. 2. RF shadowing. 3. Incorrect
WMS transaction. 4. Duplicate EPC mapping. 5. Reader outage.

Inputs: - RFID event windows. - Antenna pattern. - Movement history. -
Reader health. - EPC registry. - Expected location. - Verification
labels.

Outputs: - Ranked cause hypotheses. - Confidence/score. - Supporting
evidence IDs. - Recommended verification action. - Model version.

Root-cause outputs are hypotheses, not confirmed facts. The UI must
clearly distinguish AI inference from operator-confirmed cause.

### AI Model 3: Demand Forecasting --- P1

Inputs: - Dated order/pick/dispatch history. - SKU. - Historical
demand. - Stock levels. - Reorder threshold. - Seasonality if sufficient
history exists.

Outputs: - 1-, 3- and 7-day demand forecasts. - Stockout risk. - Reorder
recommendation.

Baselines: - Moving average. - Seasonal-naive where appropriate.

Advanced model: - Gradient Boosting Regressor or an appropriate
time-series model after sufficient data is available.

Synthetic data must be labelled as synthetic.

### AI Model 4: Risk-Based Cycle Counting --- P1

Rank locations/SKUs for physical counting using: - Discrepancy
probability. - Item value. - Operational impact. - Time since last
audit. - Previous discrepancy frequency.

Output: - Ranked count list. - Risk score. - Explanation. - Suggested
verification priority.

### AI Model 5: Misplacement Destination Inference --- P1

Estimate top candidate shelves for a missing/misplaced EPC using: -
Relative antenna detections. - Previous location history. - Movement
records. - Nearby EPC co-occurrence. - Time-window observations.

Output: - Top candidate locations. - Calibrated scores. - Evidence. -
Abstain/verify state.

Do not claim exact shelf or bin location unless independent physical
testing supports it.

### AI engineering requirements

-   Dataset versioning.
-   Feature schema versioning.
-   Model versioning.
-   Training run records.
-   Reproducible train/validation/test splits.
-   Held-out sessions/items.
-   Probability calibration.
-   Model evaluation report.
-   Model card.
-   Deterministic fallback.
-   Model rollback.
-   Prediction logging.
-   Drift/quality monitoring.

## 5.9 Module I --- AI Exceptions and Investigation

### Exception types

-   Misplacement candidate.
-   Likely missing.
-   Possible unread.
-   Ambiguous location.
-   Duplicate EPC.
-   Reader outage.
-   Antenna fault.
-   Inventory transaction mismatch.

### Exception features

-   Exception list with filters.
-   Priority and severity.
-   EPC/product details.
-   Expected location.
-   Candidate/observed location.
-   AI confidence and model version.
-   Evidence timeline.
-   Reader/antenna observations.
-   Root-cause hypotheses.
-   Recommended next action.
-   Assignment to operator.
-   Acknowledge, verify, resolve and reopen.
-   Notes and attachments if required.
-   Full status history.

### Exception lifecycle

``` text
NEW
  -> AI_ANALYSIS
  -> PENDING_VERIFICATION
  -> ASSIGNED
  -> PHYSICAL_CHECK
  -> VERIFIED
  -> RESOLVED
```

A user may mark an exception as false positive or reopen it with a
reason. Original raw evidence and predictions must remain preserved.

## 5.10 Module J --- Verification and Ground Truth

### Features

-   Verify item present.
-   Verify item on expected shelf.
-   Verify item on another shelf.
-   Verify item missing.
-   Verify RFID unread/obstructed.
-   Record actual location.
-   Record verification user and timestamp.
-   Record notes.
-   Record correction/transaction reference.
-   Preserve before/after state.
-   Use verified labels in future training datasets.

Verification must not silently rewrite historical observations.

## 5.11 Module K --- Reports and Analytics

Required reports:

1.  Inventory reconciliation report.
2.  Misplaced item report.
3.  Likely missing item report.
4.  Possible unread report.
5.  Ambiguous location report.
6.  Shelf-wise inventory report.
7.  RFID read activity report.
8.  Reader and antenna health report.
9.  Cross-reading/calibration report.
10. Exception resolution report.
11. AI model evaluation report.
12. Operator verification/audit report.

Export: - CSV. - XLSX. - PDF.

Report filters: - Date range. - Warehouse. - Zone. - Shelf. -
Product/SKU. - EPC. - Exception type. - Status. - Reader/antenna.

## 5.12 Module L --- Administration and System Settings

-   User and role management.
-   Warehouse configuration.
-   Reader registration.
-   Antenna configuration.
-   Shelf mapping.
-   Calibration configuration.
-   Reader collection settings.
-   Observation-window configuration.
-   Reconciliation thresholds.
-   AI model registry.
-   Data retention settings.
-   Application health.
-   Database backup status.
-   Audit logs.

------------------------------------------------------------------------

# 6. Business Rules and Decision Logic

These rules must be centralized in backend services and covered by
tests.

  -----------------------------------------------------------------------
  Situation                           Expected system behaviour
  ----------------------------------- -----------------------------------
  EPC repeatedly read in expected     IN_PLACE candidate
  shelf                               

  EPC repeatedly read in another      MISPLACED_CANDIDATE
  shelf                               

  EPC read by multiple antennas       Calculate candidate probabilities

  Similar location evidence           AMBIGUOUS

  EPC not read once                   Do not declare missing

  EPC not read for configured period  Evaluate reliability, coverage and
                                      reader health

  Reader disconnected                 Suppress unsupported missing
                                      conclusions in affected zone

  Antenna disconnected                Mark affected coverage degraded

  Authorized movement exists          Reconcile against updated expected
                                      location

  Duplicate EPC mapping               Data-integrity exception

  Physical verification completed     Save ground truth and controlled
                                      correction

  AI model unavailable                Deterministic fallback and visible
                                      degraded state
  -----------------------------------------------------------------------

## 6.1 Confidence policy

Confidence thresholds must be configurable and selected through
calibration and validation. Do not hardcode arbitrary confidence
percentages as universal truth.

The system must support: - High-confidence candidate. -
Medium-confidence candidate. - Low-confidence/ambiguous. -
Abstain/verification required.

A high model score does not itself authorize an inventory correction.

------------------------------------------------------------------------

# 7. Database Design --- PostgreSQL

Use PostgreSQL with SQLAlchemy 2.x and Alembic.

## 7.1 Core tables

  -----------------------------------------------------------------------
  Table                   Key fields              Purpose
  ----------------------- ----------------------- -----------------------
  users                   id, name, email,        Users
                          password_hash, role_id, 
                          status                  

  roles                   id, role_name,          Roles
                          permissions             

  warehouses              id, code, name          Warehouse

  zones                   id, warehouse_id, code, Zones
                          name                    

  shelves                 id, zone_id, code,      Shelves
                          name, capacity          

  bins                    id, shelf_id, code,     Optional bins
                          capacity                

  products                id, sku, name,          Product master
                          category, unit, status  

  rfid_tags               id, epc, product_id,    EPC registry
                          status                  

  readers                 id, reader_code, model, Reader registry
                          serial, firmware,       
                          status                  

  antennas                id, reader_id, port,    Antenna mapping
                          shelf_id, status        

  antenna_calibrations    id, antenna_id, config, Calibration
                          run_date                

  inventory               id, epc,                Expected inventory
                          expected_location_id,   
                          status                  

  inventory_movements     id, epc, from_location, Movement history
                          to_location,            
                          movement_type,          
                          timestamp               

  rfid_events             id, event_id, epc,      Raw events
                          reader_id, antenna_id,  
                          rssi, observed_at,      
                          raw_payload             

  observation_windows     id, epc, window_start,  Aggregated features
                          window_end, features    

  location_predictions    id, epc,                Location predictions
                          predicted_location,     
                          candidates, score,      
                          model_version           

  discrepancies           id, epc, type, status,  Exceptions
                          priority, created_at    

  ai_predictions          id, discrepancy_id,     AI results
                          model_id, output,       
                          evidence                

  verification_logs       id, discrepancy_id,     Ground truth
                          actual_location,        
                          outcome, verified_by,   
                          verified_at             

  ai_models               id, name, version,      Model registry
                          status, metrics         

  model_training_runs     id, model_id,           Training history
                          dataset_version,        
                          metrics, artifact_path  

  audit_logs              id, user_id, action,    Audit trail
                          entity_type, entity_id, 
                          timestamp               

  system_events           id, source, event_type, System health/events
                          message, timestamp      
  -----------------------------------------------------------------------

## 7.2 Database requirements

-   Use UUID primary keys where appropriate.
-   Unique constraint on active EPC assignment.
-   Unique product SKU.
-   Foreign keys for all relationships.
-   Index EPC, observed timestamp, reader ID and antenna ID.
-   Store timestamps in UTC.
-   Use JSONB for raw payloads, flexible evidence and feature snapshots.
-   Use transactions for inventory changes.
-   Preserve historical movements and tag assignments.
-   Do not delete raw observations when an EPC is deactivated.
-   Use pagination for large tables.
-   Consider time-based partitioning for high-volume RFID events.
-   Define backup and restoration procedures.
-   Add migration tests.

## 7.3 Important data relationship

``` text
WAREHOUSE
  └── ZONES
       └── SHELVES
            └── BINS

PRODUCTS
  └── RFID_TAGS
       └── INVENTORY
            ├── INVENTORY_MOVEMENTS
            ├── RFID_EVENTS
            ├── OBSERVATION_WINDOWS
            ├── LOCATION_PREDICTIONS
            └── DISCREPANCIES
                 ├── AI_PREDICTIONS
                 └── VERIFICATION_LOGS

READERS
  └── ANTENNAS
       └── RFID_EVENTS

AI_MODELS
  └── MODEL_TRAINING_RUNS
```

------------------------------------------------------------------------

# 8. Backend Requirements --- FastAPI

## 8.1 Backend responsibilities

-   REST API.
-   Authentication and authorization.
-   Product and inventory operations.
-   Warehouse and location management.
-   Reader/antenna registry.
-   RFID event ingestion.
-   Event processing orchestration.
-   Reconciliation.
-   AI inference orchestration.
-   Exception management.
-   Verification.
-   Reporting.
-   WebSocket broadcasting.
-   Audit and health monitoring.

## 8.2 API version

Base path:

`/api/v1/`

## 8.3 REST endpoint specification

### Authentication

  Endpoint          Method   Purpose
  ----------------- -------- -----------------------
  `/auth/login`     POST     Login
  `/auth/refresh`   POST     Refresh access token
  `/auth/logout`    POST     Logout/revoke session
  `/auth/me`        GET      Current user

### Dashboard

  Endpoint                         Method   Purpose
  -------------------------------- -------- ---------------------
  `/dashboard/summary`             GET      KPI summary
  `/dashboard/inventory-status`    GET      Status distribution
  `/dashboard/rfid-activity`       GET      RFID activity chart
  `/dashboard/shelf-summary`       GET      Shelf inventory
  `/dashboard/recent-exceptions`   GET      Recent alerts

### Products and inventory

  Endpoint                 Method      Purpose
  ------------------------ ----------- -------------------------
  `/products`              GET/POST    List/create products
  `/products/{id}`         GET/PATCH   Product detail/update
  `/products/import`       POST        Bulk import
  `/rfid-tags`             GET/POST    List/register EPC
  `/rfid-tags/{id}`        GET/PATCH   Tag detail/update
  `/inventory`             GET         Inventory list
  `/inventory/{id}`        GET         Inventory detail
  `/inventory/movements`   GET/POST    Movement history/create

### Warehouse locations

  Endpoint        Method     Purpose
  --------------- ---------- -------------------------
  `/warehouses`   GET/POST   Warehouse management
  `/zones`        GET/POST   Zone management
  `/shelves`      GET/POST   Shelf management
  `/bins`         GET/POST   Optional bin management

### Readers and antennas

  Endpoint                          Method      Purpose
  --------------------------------- ----------- ------------------
  `/readers`                        GET/POST    Reader registry
  `/readers/{id}`                   GET/PATCH   Reader details
  `/readers/{id}/health`            GET         Reader health
  `/readers/{id}/test-connection`   POST        Test connection
  `/antennas`                       GET/POST    Antenna registry
  `/antennas/{id}`                  GET/PATCH   Antenna details
  `/antennas/{id}/calibrations`     GET/POST    Calibration runs

### RFID events

  Endpoint                    Method   Purpose
  --------------------------- -------- ---------------------------------------
  `/rfid-events`              GET      Search event history
  `/rfid-events/{id}`         GET      Event detail
  `/rfid-events/ingest`       POST     Internal ingestion endpoint if needed
  `/rfid-events/statistics`   GET      Read statistics

Protect ingestion endpoints so they cannot be used by unauthorized
external clients.

### AI and reconciliation

  Endpoint                       Method   Purpose
  ------------------------------ -------- ----------------------------
  `/reconciliation/run`          POST     Trigger reconciliation
  `/reconciliation/status`       GET      Reconciliation status
  `/ai/predictions`              GET      Prediction history
  `/ai/infer/read-reliability`   POST     Read-reliability inference
  `/ai/infer/root-cause`         POST     Root-cause inference
  `/ai/infer/location`           POST     Location inference
  `/ai/models`                   GET      Model registry
  `/ai/metrics`                  GET      Model metrics

### Exceptions and verification

  Endpoint                         Method   Purpose
  -------------------------------- -------- ------------------------------
  `/exceptions`                    GET      List exceptions
  `/exceptions/{id}`               GET      Exception detail
  `/exceptions/{id}/assign`        POST     Assign exception
  `/exceptions/{id}/acknowledge`   POST     Acknowledge
  `/exceptions/{id}/verify`        POST     Record physical verification
  `/exceptions/{id}/resolve`       POST     Resolve
  `/exceptions/{id}/reopen`        POST     Reopen

### Reports and administration

  Endpoint                    Method   Purpose
  --------------------------- -------- --------------------
  `/reports/inventory`        GET      Inventory report
  `/reports/discrepancies`    GET      Discrepancy report
  `/reports/readers`          GET      Reader report
  `/reports/ai-performance`   GET      AI report
  `/reports/audit`            GET      Audit report
  `/system/health`            GET      Health check
  `/system/events`            GET      System events

## 8.4 WebSocket endpoints

``` text
/ws/rfid-events
/ws/inventory-updates
/ws/ai-alerts
/ws/system-status
```

Requirements: - Authenticate WebSocket connections. - Broadcast only
authorized data. - Use event IDs and timestamps. - Handle
disconnect/reconnect. - Do not assume a WebSocket is a durable event
store. - Provide REST history endpoints for missed updates. - Avoid
broadcasting every raw read to every client if the event rate becomes
excessive; support aggregation and filtering.

------------------------------------------------------------------------

# 9. Python Data Contracts

Use Pydantic schemas for request and response validation.

## 9.1 RFID event schema example

``` python
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field

class RFIDEventCreate(BaseModel):
    event_id: str
    epc: str
    reader_id: str
    antenna_id: str
    rssi_dbm: float | None = None
    observed_at: datetime
    received_at: datetime
    raw_payload: dict[str, Any] = Field(default_factory=dict)
```

## 9.2 Location prediction schema

``` python
from pydantic import BaseModel

class CandidateLocation(BaseModel):
    location_id: str
    probability: float

class LocationPrediction(BaseModel):
    epc: str
    expected_location_id: str
    predicted_location_id: str | None
    candidates: list[CandidateLocation]
    status: str
    verification_required: bool
    model_version: str
```

## 9.3 Discrepancy schema

``` python
class DiscrepancyResponse(BaseModel):
    id: str
    epc: str
    discrepancy_type: str
    expected_location_id: str
    predicted_location_id: str | None
    confidence: float | None
    root_cause: str | None
    status: str
    verification_required: bool
```

Keep API schemas separate from ORM models. Validate all state
transitions in backend services.

------------------------------------------------------------------------

# 10. Frontend Requirements --- React + TypeScript

## 10.1 Frontend stack

  Purpose              Technology
  -------------------- --------------------------------
  Framework            React
  Language             TypeScript
  Markup               HTML5
  Styling              CSS3 / Tailwind CSS
  UI components        shadcn/ui
  Icons                Lucide React
  Charts               Recharts
  Tables               TanStack Table
  Routing              React Router
  Server state         TanStack Query
  Local state          Zustand, where required
  Forms                React Hook Form
  Validation           Zod
  Testing              Vitest + React Testing Library
  Browser automation   Playwright

## 10.2 Frontend pages

### Dashboard

-   Welcome header.
-   Four inventory KPI cards.
-   Inventory status chart.
-   RFID activity chart.
-   Shelf-wise performance.
-   Recent AI exceptions.
-   Reader/antenna status.

### Inventory

-   Searchable product table.
-   SKU and EPC filters.
-   Expected location.
-   Latest observed location.
-   Inventory status.
-   Product details drawer/page.
-   Product creation/editing.
-   EPC registration.
-   Bulk import.

### Live Monitoring

-   Reader connection status.
-   Antenna status.
-   Antenna-to-shelf mapping.
-   Live RFID event stream.
-   EPC, antenna, RSSI and timestamp.
-   Read count and first/last seen.
-   Raw event detail.
-   Connection/error history.
-   Calibration tools for authorized users.

### AI Exceptions

-   Exception filters.
-   Status and priority badges.
-   EPC/product information.
-   Expected versus candidate location.
-   Confidence and evidence.
-   Root-cause hypotheses.
-   Assignment and acknowledgement.

### Exception Details

-   Full event timeline.
-   Antenna observations.
-   AI prediction and model version.
-   Expected and candidate shelf.
-   Evidence explanation.
-   Verification form.
-   Resolution history.

### Reports

-   Date and location filters.
-   Inventory reconciliation.
-   Misplacement/missing/unread summaries.
-   Shelf-wise accuracy.
-   Reader activity.
-   AI evaluation.
-   CSV/XLSX/PDF export.

### Settings

-   User and role management.
-   Reader configuration.
-   Antenna mapping.
-   Shelf setup.
-   Calibration.
-   AI model versions.
-   Threshold configuration.
-   Data retention and system health.

## 10.3 Frontend component structure

``` text
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── dashboard/
│   │   ├── inventory/
│   │   ├── rfid/
│   │   ├── exceptions/
│   │   ├── reports/
│   │   └── common/
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Inventory.tsx
│   │   ├── LiveMonitoring.tsx
│   │   ├── AIExceptions.tsx
│   │   ├── ExceptionDetails.tsx
│   │   ├── Reports.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   ├── services/
│   │   ├── api.ts
│   │   ├── websocket.ts
│   │   ├── inventory.service.ts
│   │   ├── rfid.service.ts
│   │   ├── exception.service.ts
│   │   └── report.service.ts
│   ├── stores/
│   ├── types/
│   ├── utils/
│   └── styles/
├── package.json
└── README.md
```

## 10.4 Frontend quality requirements

-   Use reusable components.
-   Use typed API response interfaces.
-   Do not hardcode production data.
-   Include loading, empty, error and offline states.
-   Implement server-side pagination for large datasets.
-   Implement table sorting and filtering.
-   Use accessible labels and keyboard navigation.
-   Confirm destructive actions.
-   Show clear status explanations.
-   Do not rely on color alone to communicate status.
-   Maintain the same visual system on every page.
-   Support responsive layouts.
-   Handle WebSocket reconnect and stale data.

------------------------------------------------------------------------

# 11. Python Backend Project Structure

Recommended modular structure:

``` text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── database.py
│   │   ├── logging.py
│   │   └── exceptions.py
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── dashboard.py
│   │       ├── products.py
│   │       ├── inventory.py
│   │       ├── locations.py
│   │       ├── readers.py
│   │       ├── antennas.py
│   │       ├── events.py
│   │       ├── reconciliation.py
│   │       ├── ai.py
│   │       ├── exceptions.py
│   │       ├── verification.py
│   │       └── reports.py
│   ├── models/
│   ├── schemas/
│   ├── repositories/
│   ├── services/
│   │   ├── inventory_service.py
│   │   ├── reconciliation_service.py
│   │   ├── discrepancy_service.py
│   │   └── verification_service.py
│   ├── rfid/
│   │   ├── reader_manager.py
│   │   ├── reader_adapter.py
│   │   ├── reader_connection.py
│   │   ├── event_listener.py
│   │   ├── event_normalizer.py
│   │   ├── event_validator.py
│   │   ├── event_processor.py
│   │   ├── antenna_manager.py
│   │   └── calibration.py
│   ├── ai/
│   │   ├── feature_engineering.py
│   │   ├── read_reliability.py
│   │   ├── root_cause.py
│   │   ├── location_inference.py
│   │   ├── demand_forecasting.py
│   │   ├── cycle_counting.py
│   │   ├── model_registry.py
│   │   └── evaluation.py
│   ├── realtime/
│   │   ├── websocket_manager.py
│   │   └── event_broadcaster.py
│   └── utils/
├── ml/
│   ├── datasets/
│   ├── feature_specs/
│   ├── training/
│   ├── evaluation/
│   └── model_artifacts/
├── migrations/
├── tests/
├── requirements.txt
└── README.md
```

## 11.1 Architecture rule

Do not place all RFID collection, ML processing and database operations
inside FastAPI request handlers.

Run these as independently managed services/workers:

1.  RFID collector.
2.  Event processing worker.
3.  Reconciliation worker.
4.  AI inference service/module.
5.  FastAPI application.
6.  Scheduled reporting/maintenance worker if needed.

For a small first prototype, these can be separate processes on one
computer. A message broker is not mandatory on day one; introduce Redis
Streams, RabbitMQ or another durable queue only when measured throughput
and recovery requirements justify it.

------------------------------------------------------------------------

# 12. Event Processing and Reconciliation Workflow

``` text
UHF RFID Reader
      |
      v
Python Reader Adapter
      |
      v
Raw Event Capture
      |
      v
Event Validation and Normalization
      |
      v
Durable Event Storage
      |
      v
Time-window Feature Aggregation
      |
      v
Reader / Antenna Health Check
      |
      v
Shelf Location Inference
      |
      v
Read-Reliability Prediction
      |
      v
Root-Cause Hypothesis
      |
      v
Inventory Reconciliation
      |
      v
Exception Generation
      |
      v
FastAPI + WebSocket
      |
      v
React Dashboard
      |
      v
Human Physical Verification
      |
      v
Authorized Inventory Correction
      |
      v
Audit History and Verified Training Labels
```

## 12.1 Example scenario: Product moved to another shelf

Expected: - EPC001. - Product: Brake Pads. - Expected shelf: A.

Observed: - Repeated antenna observations support Shelf C. - No
authorized movement transaction exists.

Expected software result: - Generate MISPLACED_CANDIDATE. - Show
expected Shelf A. - Show candidate Shelf C. - Show evidence and
confidence. - Request physical verification. - Update expected location
only after authorized confirmation.

## 12.2 Example scenario: Tag missed read

Expected: - EPC002. - Expected shelf: B.

Observed: - No recent tag observations. - Other tags are being read
normally. - Reader and relevant antenna are online. - Previous reads for
this tag have been unstable.

Expected software result: - Consider POSSIBLE_UNREAD. - Do not
immediately classify as missing. - Show evidence and recommend
verification/rescan.

## 12.3 Example scenario: Reader outage

Expected: - Products on Shelf A.

Observed: - Antenna 1 stops communicating or reader connection is lost.

Expected software result: - Mark affected coverage as degraded. - Create
device-health alert. - Suppress missing-item conclusions based on the
unavailable coverage. - Resume normal reconciliation after health is
restored.

------------------------------------------------------------------------

# 13. AI Data Collection, Training and Evaluation

## 13.1 Dataset collection scenarios

Collect physical ground truth for:

1.  Normal inventory.
2.  Cross-antenna reads.
3.  Product moved to another shelf.
4.  Tag rotated.
5.  Tag obstructed.
6.  Reader disconnected.
7.  Antenna disconnected.
8.  Authorized movement.
9.  Unauthorized movement.
10. Duplicate EPC mapping.

## 13.2 Feature engineering

Initial feature set:

``` text
epc
expected_location
antenna_1_read_count
antenna_2_read_count
antenna_3_read_count
antenna_4_read_count
antenna_1_rssi_median
antenna_2_rssi_median
antenna_3_rssi_median
antenna_4_rssi_median
rssi_variance_by_antenna
first_seen_age
last_seen_age
movement_history
reader_health
antenna_health
coverage_profile_version
tag_orientation_if_recorded
packaging_class_if_recorded
```

Use null values and missingness indicators where a feature is not
available. Do not fabricate missing hardware measurements.

## 13.3 Training procedure

1.  Capture raw events.
2.  Capture physical ground truth.
3.  Validate event quality.
4.  Create versioned feature snapshots.
5.  Apply verified labels.
6.  Split data by complete sessions, dates or physical objects.
7.  Train deterministic baseline.
8.  Train candidate ML model.
9.  Calibrate probabilities.
10. Evaluate on held-out data.
11. Review failure cases.
12. Register approved model version.
13. Deploy with rollback capability.
14. Monitor real-world prediction quality.

## 13.4 Evaluation metrics

  -----------------------------------------------------------------------
  Model                               Required metrics
  ----------------------------------- -----------------------------------
  Read reliability                    Precision, recall, F1, calibration
                                      error

  Root cause                          Per-class precision, recall and F1

  Shelf inference                     Confusion matrix, per-shelf
                                      accuracy, top-k accuracy

  Demand forecast                     MAE, WAPE

  Cycle-count ranking                 Ranking quality, operator
                                      resolution time
  -----------------------------------------------------------------------

Report sample sizes and confidence intervals. Compare AI with a sensible
deterministic baseline.

Do not use the same scripted trials for both training and claimed final
evaluation.

------------------------------------------------------------------------

# 14. API, Security and Data Validation Standards

## 14.1 API standards

-   REST API versioning.
-   Consistent response schemas.
-   Standard error responses.
-   Pagination and filtering.
-   Input validation.
-   Request IDs and traceable logs.
-   OpenAPI documentation.
-   Idempotency for event ingestion.
-   Transactional inventory updates.

Example success response:

``` json
{
  "success": true,
  "data": {},
  "message": "Operation completed",
  "request_id": "uuid"
}
```

Example error response:

``` json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_EPC",
    "message": "This EPC is already assigned."
  },
  "request_id": "uuid"
}
```

## 14.2 Security requirements

-   JWT authentication.
-   Argon2/bcrypt password hashing.
-   RBAC.
-   HTTPS in production.
-   Strict CORS.
-   Rate limiting.
-   SQLAlchemy parameterized queries.
-   Pydantic input validation.
-   Secure secret storage.
-   Protected reader configuration.
-   Protected RFID ingestion.
-   Audit trail.
-   Backup and recovery.
-   Dependency vulnerability checks.

## 14.3 Data privacy and retention

-   Collect only required employee information.
-   Record operator actions for audit purposes.
-   Restrict access to user and audit records.
-   Define configurable RFID event retention.
-   Preserve evidence required for open or resolved exceptions.
-   Document backup retention and deletion policy.

------------------------------------------------------------------------

# 15. Non-Functional Requirements and Performance Targets

The following are initial engineering targets for the demo. They must be
measured and adjusted based on actual hardware and deployment
conditions.

  Category             Initial target
  -------------------- --------------------------------------------------
  Dashboard API        P95 under 500 ms under demo load
  Normal API           P95 under 300 ms under demo load
  Event-to-dashboard   Target under 2 seconds
  AI inference         Target under 500 ms per feature window
  Reader reconnect     Configurable, initial target under 10 seconds
  Data integrity       Raw event preserved before downstream processing
  Availability         Reader and service health visible
  Scalability          More readers, antennas and EPCs can be added
  Security             Authenticated APIs and role checks
  Recovery             Tested database backup and restore
  Maintainability      Modular services and versioned schemas

Measure P50, P95 and P99 latency. Separate reader capture, network,
feature processing, model inference, database and frontend delivery.

------------------------------------------------------------------------

# 16. Testing and Quality Assurance

## 16.1 Testing tools

  Purpose                Tool
  ---------------------- -----------------------------------
  Python unit tests      Pytest
  API testing            Postman / pytest
  Frontend unit tests    Vitest
  Component tests        React Testing Library
  Browser testing        Playwright
  Load testing           Locust
  Python linting         Ruff
  Frontend linting       ESLint
  Formatting             Prettier
  Security checks        Bandit and dependency auditing
  Database integration   Isolated PostgreSQL test database

## 16.2 Required test cases

  -----------------------------------------------------------------------
  Test                                Expected result
  ----------------------------------- -----------------------------------
  Normal EPC detection                Expected shelf candidate

  EPC detected in another shelf       Misplacement candidate

  EPC detected by multiple antennas   Candidate probabilities calculated

  Similar antenna evidence            Ambiguous

  Tag obstructed                      Possible unread / uncertain

  Reader disconnected                 Device-health alert; affected
                                      absence inference suppressed

  Antenna disconnected                Coverage degraded

  Duplicate EPC                       Data-integrity exception

  Authorized movement                 Expected location updated

  Unauthorized movement               Discrepancy generated

  Manual verification                 Verification/audit record saved

  AI service unavailable              Deterministic fallback and degraded
                                      state

  Database unavailable                Processing failure visible; events
                                      recoverable from durable
                                      capture/queue
  -----------------------------------------------------------------------

## 16.3 Acceptance evidence

For each test run, record: - Run ID. - Operator. - Date/time. -
Warehouse/shelf setup. - Reader serial number and firmware. - Antenna
configuration and power. - Tag model and orientation. - Ground truth. -
Raw event file/hash. - Feature snapshot. - Model version/hash. -
Results. - False positives and false negatives. - Latency percentiles. -
Failure notes. - Engineering/QA sign-off.

------------------------------------------------------------------------

# 17. Reports and Performance Measurement

## 17.1 Operational metrics

-   Total expected inventory.
-   Items observed in expected locations.
-   Misplacement candidates.
-   Likely missing items.
-   Possible unread items.
-   Ambiguous items.
-   Open exceptions.
-   Average exception resolution time.
-   Reader availability.
-   Antenna read activity.

## 17.2 AI metrics

-   Precision.
-   Recall.
-   F1.
-   Calibration error.
-   Per-shelf confusion matrix.
-   Root-cause classification performance.
-   Top-k candidate location performance.
-   False alerts per test run.
-   Model inference latency.
-   Performance by tag orientation and packaging scenario.

Do not present a single global accuracy score without scenario-level
breakdowns.

------------------------------------------------------------------------

# 18. Deployment and Infrastructure

## 18.1 Initial deployment

Use local deployment on the development/edge computer.

Services: - React production build. - FastAPI. - RFID collector. - Event
processing worker. - AI inference module/service. - PostgreSQL. -
Reverse proxy (Nginx). - Optional Redis/queue if needed.

## 18.2 Docker Compose services

Suggested service names:

``` text
frontend
backend
rfid-collector
event-worker
ai-worker
postgres
nginx
```

Redis is optional and should be introduced only if required for caching,
coordination or queueing. If used as a queue, configure persistence and
recovery according to the required durability.

## 18.3 Environment configuration

Example `.env.example`:

``` env
APP_ENV=development
APP_NAME=Inventory Intelligence

DATABASE_URL=postgresql+psycopg://app_user:change_me@postgres:5432/inventory_db

JWT_SECRET=replace_with_secure_secret
ACCESS_TOKEN_EXPIRE_MINUTES=30

API_PREFIX=/api/v1
FRONTEND_ORIGIN=http://localhost:5173

RFID_READER_HOST=192.168.1.100
RFID_READER_PORT=
RFID_READER_PROTOCOL=vendor_sdk
RFID_READER_ID=READER_01

RFID_OBSERVATION_WINDOW_SECONDS=10

AI_MODEL_DIRECTORY=./ml/model_artifacts
LOG_LEVEL=INFO
```

Do not commit actual passwords, tokens or private reader credentials.

## 18.4 Backup and recovery

-   Scheduled PostgreSQL backups.
-   Test restoration periodically.
-   Preserve raw event files.
-   Record model artifacts and dataset versions.
-   Maintain application logs.
-   Document recovery procedures.
-   Test reader reconnect and event replay.

------------------------------------------------------------------------

# 19. Development Roadmap and Priorities

## Phase 1 --- Foundation

Deliver: - Project setup. - React application. - FastAPI application. -
PostgreSQL. - Authentication. - Roles. - Product management. - EPC
registration. - Warehouse/shelf management. - Reader/antenna registry. -
Design system and dashboard layout.

Acceptance: - User can log in. - User can create products and tags. -
User can configure shelves and antenna assignments. - Dashboard displays
database-backed sample inventory.

## Phase 2 --- RFID Integration

Deliver: - Actual reader adapter. - Reader connection. - Live EPC
collector. - Raw event persistence. - Event validation. - Antenna
activity. - Reader health. - Live monitoring UI.

Acceptance: - Actual reader observations appear in the application. -
Raw payload and normalized fields are preserved. - Reader disconnection
is visible. - Reconnection is tested.

## Phase 3 --- Calibration and Reconciliation

Deliver: - Calibration runs. - Shelf ground-truth labels. - Antenna
feature aggregation. - Cross-reading analysis. - Deterministic
shelf-location baseline. - Expected-versus-observed reconciliation. -
Exception creation.

Acceptance: - Normal and injected misplacement scenarios are recorded. -
Multiple antenna detections are handled. - Ambiguous cases are not
forced into a shelf. - Missing status is not inferred from one missed
read.

## Phase 4 --- P0 AI

Deliver: - Read-reliability dataset. - Read-reliability classifier. -
Root-cause dataset. - Root-cause classifier. - Probability
calibration. - Model registry. - Model evaluation. - Deterministic
fallback.

Acceptance: - Both models have documented held-out evaluation. - Outputs
include evidence and model version. - Uncertain predictions request
verification. - Results are compared with the deterministic baseline.

## Phase 5 --- Complete Application

Deliver: - AI exception management. - Verification workflow. - Audit
history. - WebSocket updates. - Reports and exports. - User
permissions. - Security hardening. - Integration and acceptance tests.

Acceptance: - End-to-end demonstration works. - Physical verification is
recorded. - Official inventory updates are controlled and audited.

## Phase 6 --- P1 Advanced Features

Deliver: - Demand forecasting. - Risk-based cycle counting. -
Misplacement destination inference.

Acceptance: - Real or clearly labelled synthetic data. - Held-out
evaluation. - Comparison with simple baselines. - Documented
limitations.

------------------------------------------------------------------------

# 20. Required Repository Deliverables

Final repository should include:

``` text
inventory-intelligence/
├── frontend/
├── backend/
├── ml/
├── deployment/
│   ├── docker/
│   ├── nginx/
│   └── scripts/
├── docs/
│   ├── SRS.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_DOCUMENTATION.md
│   ├── RFID_INTEGRATION.md
│   ├── AI_MODEL_DOCUMENTATION.md
│   ├── CALIBRATION_GUIDE.md
│   ├── INSTALLATION_GUIDE.md
│   ├── USER_GUIDE.md
│   └── TEST_PLAN.md
├── tests/
├── .env.example
├── docker-compose.yml
├── README.md
└── LICENSE
```

Do not create empty documentation or placeholder modules and report them
as complete. Each deliverable should contain working implementation or
clearly marked planned scope.

------------------------------------------------------------------------

# 21. Final Technology Decisions

  Layer                  Selected technology
  ---------------------- ----------------------------
  Programming language   Python 3.12+
  Backend                FastAPI
  Frontend               React + TypeScript
  Markup                 HTML5
  Styling                CSS3 / Tailwind CSS
  Database               PostgreSQL
  ORM                    SQLAlchemy 2.x
  Migrations             Alembic
  AI/ML                  Scikit-learn
  Model serialization    Joblib or supported format
  Real-time              WebSocket
  Reader integration     Verified vendor SDK / LLRP
  Charts                 Recharts
  API documentation      OpenAPI
  Testing                Pytest, Vitest, Playwright
  Deployment             Docker Compose + Nginx

------------------------------------------------------------------------

# 22. Final Implementation Instructions

The software must be developed in the following order:

1.  Inspect and document the existing repository before changing files.
2.  Establish the visual design system using the provided dashboard
    reference image.
3.  Build the application shell and five primary navigation sections.
4.  Build database schema and migrations.
5.  Build product, EPC, warehouse, shelf and antenna management.
6.  Integrate the actual fixed UHF RFID reader using its documented
    interface.
7.  Implement raw event storage and live monitoring.
8.  Implement calibration and shelf-level location inference.
9.  Implement deterministic inventory reconciliation.
10. Collect labelled physical test data.
11. Develop and evaluate the two mandatory P0 AI models.
12. Build exception verification, audit and reports.
13. Add P1 features after the MVP is stable.
14. Run integration, hardware, security and acceptance tests.
15. Document actual measured results and known limitations.

## Non-negotiable engineering rules

-   Never fabricate RFID data or hardware capabilities.
-   Never assume an antenna detects only its assigned shelf.
-   Never use strongest RSSI alone as definitive shelf identification.
-   Never declare an item missing from a single missed read.
-   Never let an unverified AI prediction silently update official
    inventory.
-   Never claim model accuracy without held-out ground-truth evaluation.
-   Preserve raw RFID events.
-   Keep AI predictions explainable and versioned.
-   Keep reader collection independent of API request handling.
-   Maintain audit history for all inventory changes.
-   Use the provided dashboard screenshot as the consistent frontend
    design reference.
-   Keep navigation limited to Dashboard, Inventory, Live Monitoring, AI
    Exceptions and Reports.
-   Use realistic mock data only in development mode and clearly
    distinguish it from live hardware data.

------------------------------------------------------------------------

# 23. Definition of Done --- Initial MVP

The MVP is considered complete only when all of the following are
demonstrated:

-   [ ] Administrator can log in.
-   [ ] Products and EPCs can be registered.
-   [ ] Warehouse shelves can be configured.
-   [ ] Reader and antenna mappings can be configured.
-   [ ] Actual fixed reader data is collected.
-   [ ] Raw RFID events are stored.
-   [ ] Live RFID events appear in the frontend.
-   [ ] Multiple antenna observations are handled.
-   [ ] Shelf-level location inference is evaluated.
-   [ ] Expected and observed inventory are reconciled.
-   [ ] Misplacement candidates are detected.
-   [ ] Possible missed reads are distinguished from likely absence.
-   [ ] Reader/antenna outages are handled.
-   [ ] P0 read-reliability model is evaluated.
-   [ ] P0 root-cause model is evaluated.
-   [ ] AI evidence is visible to operators.
-   [ ] Physical verification can be recorded.
-   [ ] Official inventory changes are authorized and audited.
-   [ ] Reports can be generated.
-   [ ] Integration and failure-mode tests pass.
-   [ ] Installation and user documentation is available.

**Final product goal:** A reliable, explainable AI-powered warehouse
inventory intelligence application that uses real UHF RFID observations
to identify potential stock discrepancies, recommend where to
investigate, and help warehouse personnel verify and resolve inventory
problems.

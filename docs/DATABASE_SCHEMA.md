# PostgreSQL Database Schema & Data Dictionary

## 1. Overview
The database engine is PostgreSQL 16 (or SQLite for development fallback). The schema is managed using SQLAlchemy 2.x ORM models and Alembic migrations. All timestamps are strictly stored in UTC (`TIMESTAMP WITH TIME ZONE`).

---

## 2. Entity-Relationship Summary

```
WAREHOUSES (1) ──< ZONES (N) ──< SHELVES (N) ──< BINS (N)
                                      ^
                                      │ (mapped to)
READERS (1) ────< ANTENNAS (N) ───────┘
                     │
                     └──< ANTENNA_CALIBRATIONS (N)

PRODUCTS (1) ───< RFID_TAGS (N) ───< INVENTORY (1:1 per active tag)
                                          │
                                          ├──< INVENTORY_MOVEMENTS (N)
                                          ├──< RFID_EVENTS (N)
                                          ├──< OBSERVATION_WINDOWS (N)
                                          ├──< LOCATION_PREDICTIONS (N)
                                          └──< DISCREPANCIES (N)
                                                    │
                                                    ├──< AI_PREDICTIONS (N)
                                                    └──< VERIFICATION_LOGS (N)

USERS (1) ───< AUDIT_LOGS (N)
ROLES (1) ───< USERS (N)
AI_MODELS (1) ───< MODEL_TRAINING_RUNS (N)
```

---

## 3. Core Tables Specification

### 3.1 Authentication & System Security
1. **`roles`**: System role hierarchy (`Administrator`, `Warehouse Manager`, `Warehouse Operator`, `Technical Engineer`, `Read-only User`).
   - `id`: Integer / UUID Primary Key
   - `role_name`: String(50), Unique
   - `description`: Text
   - `permissions`: JSONB list of permission scopes
2. **`users`**: System user records.
   - `id`: Integer Primary Key
   - `name`: String(100)
   - `email`: String(150), Unique, Indexed
   - `password_hash`: String(255) (Argon2 / bcrypt)
   - `role_id`: FK -> `roles.id`
   - `is_active`: Boolean
   - `created_at`: Timestamptz
3. **`audit_logs`**: Immutable audit log of operator actions.
   - `id`: Integer Primary Key
   - `user_id`: FK -> `users.id`
   - `action`: String(100) (e.g., `TAG_ASSIGNED`, `DISCREPANCY_VERIFIED`, `SHELF_CREATED`)
   - `entity_type`: String(50)
   - `entity_id`: String(50)
   - `details`: JSONB snapshot of before/after state
   - `created_at`: Timestamptz, Indexed

### 3.2 Warehouse Spatial Hierarchy
4. **`warehouses`**: Top-level warehouse facility.
   - `id`: Integer Primary Key
   - `code`: String(30), Unique
   - `name`: String(100)
   - `description`: Text
5. **`zones`**: Logical warehouse zones (e.g. Zone A, Zone B).
   - `id`: Integer Primary Key
   - `warehouse_id`: FK -> `warehouses.id`
   - `code`: String(30), Unique
   - `name`: String(100)
6. **`shelves`**: Physical shelving bay.
   - `id`: Integer Primary Key
   - `zone_id`: FK -> `zones.id`
   - `shelf_code`: String(30), Unique, Indexed
   - `name`: String(100)
   - `capacity`: Integer
   - `category_restriction`: String(50)
   - `coord_x`: Float, `coord_y`: Float (2D map layout coordinates)
7. **`bins`**: Sub-bay storage compartments.
   - `id`: Integer Primary Key
   - `shelf_id`: FK -> `shelves.id`
   - `bin_code`: String(30)
   - `capacity`: Integer

### 3.3 Inventory & Products
8. **`products`**: Master product / SKU catalog.
   - `id`: Integer Primary Key
   - `sku`: String(50), Unique, Indexed
   - `name`: String(150)
   - `category`: String(50)
   - `unit`: String(20)
   - `unit_cost`: Float
   - `min_stock`: Integer (reorder threshold)
   - `description`: Text
   - `created_at`: Timestamptz
9. **`rfid_tags`**: Serialized passive UHF RFID tag registry.
   - `id`: Integer Primary Key
   - `epc`: String(64), Unique, Indexed
   - `product_id`: FK -> `products.id`
   - `status`: String(20) (`ACTIVE`, `INACTIVE`, `DECOMMISSIONED`)
   - `tag_type`: String(50) (e.g. `Monza R6-P`, `Impinj M730`)
   - `packaging_class`: String(30) (`CARDBOARD`, `PLASTIC`, `LIQUID_PROXIMITY`, `METAL_SHIELDED`)
   - `assigned_at`: Timestamptz
10. **`inventory`**: Expected vs physically reconciled stock state.
    - `id`: Integer Primary Key
    - `epc`: String(64), Unique, Indexed, FK -> `rfid_tags.epc`
    - `product_id`: FK -> `products.id`
    - `expected_location_id`: FK -> `shelves.id`
    - `observed_location_id`: FK -> `shelves.id` (nullable)
    - `status`: String(30) (`IN_PLACE`, `MISPLACED`, `LIKELY_MISSING`, `POSSIBLE_UNREAD`, `AMBIGUOUS`)
    - `confidence`: Float
    - `last_reconciled_at`: Timestamptz
    - `last_observed_at`: Timestamptz (nullable)
11. **`inventory_movements`**: History of authorized and physical stock transfers.
    - `id`: Integer Primary Key
    - `epc`: String(64), Indexed
    - `from_shelf_id`: FK -> `shelves.id` (nullable)
    - `to_shelf_id`: FK -> `shelves.id`
    - `movement_type`: String(30) (`RECEIPT`, `TRANSFER`, `PICK`, `DISPATCH`)
    - `authorized`: Integer (1 = Authorized, 0 = Unauthorized)
    - `authorized_by`: String(100)
    - `notes`: Text
    - `timestamp`: Timestamptz, Indexed

### 3.4 Hardware Telemetry & Event Storage
12. **`readers`**: Multiport fixed UHF RFID readers.
    - `id`: Integer Primary Key
    - `reader_code`: String(30), Unique
    - `name`: String(100)
    - `model`: String(50)
    - `ip_address`: String(45)
    - `port`: Integer
    - `protocol`: String(20) (`LLRP`, `VENDOR_SDK`)
    - `status`: String(20) (`ONLINE`, `OFFLINE`, `DEGRADED`)
    - `last_heartbeat`: Timestamptz
    - `location_desc`: String(150)
13. **`antennas`**: Antenna ports mapped to warehouse shelf zones.
    - `id`: Integer Primary Key
    - `reader_id`: FK -> `readers.id`
    - `port_number`: Integer
    - `antenna_code`: String(30), Unique
    - `shelf_id`: FK -> `shelves.id` (nullable)
    - `tx_power_dbm`: Float (e.g. 27.0 dBm)
    - `gain_dbi`: Float (e.g. 6.0 dBi)
    - `beam_angle_deg`: Float
    - `is_active`: Boolean
    - `purpose`: String(50) (`PRIMARY_SHELF`, `AISLE_PORTAL`, `VERIFICATION`)
14. **`antenna_calibrations`**: Empirical RF coverage profiles.
    - `id`: Integer Primary Key
    - `antenna_id`: FK -> `antennas.id`
    - `median_rssi_baseline`: Float
    - `noise_floor_dbm`: Float
    - `cross_read_leakage_dbm`: Float
    - `config`: JSONB (power settings, cable loss, polarization)
    - `calibration_date`: Timestamptz
15. **`rfid_events`**: High-volume raw RFID observation stream.
    - `id`: BigInteger Primary Key
    - `event_id`: String(64), Unique (UUID or reader hash)
    - `epc`: String(64), Indexed
    - `reader_id`: String(30), Indexed
    - `antenna_id`: Integer, Indexed
    - `rssi_dbm`: Float
    - `frequency`: Float (nullable)
    - `observed_at`: Timestamptz, Indexed
    - `received_at`: Timestamptz
    - `valid`: Boolean
    - `raw_payload`: JSONB (unaltered hardware response)
16. **`observation_windows`**: Feature snapshots aggregated per sliding window.
    - `id`: BigInteger Primary Key
    - `epc`: String(64), Indexed
    - `window_start`: Timestamptz
    - `window_end`: Timestamptz
    - `features`: JSONB (read counts, RSSI median/variance per antenna)

### 3.5 Discrepancies, AI Predictions & Ground Truth
17. **`location_predictions`**: Location inference output history.
    - `id`: Integer Primary Key
    - `epc`: String(64), Indexed
    - `expected_location_id`: FK -> `shelves.id`
    - `predicted_location_id`: FK -> `shelves.id` (nullable)
    - `confidence`: Float
    - `candidates`: JSONB (top-3 candidate probabilities)
    - `status`: String(30) (`LOCATION_ESTIMATED`, `AMBIGUOUS`, `UNOBSERVED`)
    - `created_at`: Timestamptz
18. **`discrepancies`**: Active exception workbench items.
    - `id`: Integer Primary Key
    - `epc`: String(64), Indexed
    - `discrepancy_type`: String(30) (`MISPLACED`, `LIKELY_MISSING`, `POSSIBLE_UNREAD`, `AMBIGUOUS`)
    - `expected_location_id`: FK -> `shelves.id`
    - `observed_location_id`: FK -> `shelves.id` (nullable)
    - `confidence`: Float
    - `root_cause`: String(50) (`PHYSICAL_RELOCATION`, `RF_SHADOWING`, `INCORRECT_WMS_TRANSACTION`, `DUPLICATE_EPC_MAPPING`, `READER_OUTAGE`)
    - `status`: String(30) (`NEW`, `AI_ANALYZED`, `PENDING_VERIFICATION`, `ASSIGNED`, `RESOLVED`)
    - `assigned_to`: String(100) (nullable)
    - `verification_required`: Boolean
    - `created_at`: Timestamptz, Indexed
    - `resolved_at`: Timestamptz (nullable)
19. **`ai_predictions`**: Explainability evidence attached to discrepancies.
    - `id`: Integer Primary Key
    - `discrepancy_id`: FK -> `discrepancies.id`
    - `model_id`: String(50)
    - `confidence`: Float
    - `features`: JSONB
    - `evidence`: JSONB (list of human-readable rationale strings)
    - `recommended_action`: String(100)
    - `created_at`: Timestamptz
20. **`verification_logs`**: Ground-truth records confirmed by warehouse operators.
    - `id`: Integer Primary Key
    - `discrepancy_id`: FK -> `discrepancies.id`
    - `epc`: String(64), Indexed
    - `actual_location_id`: FK -> `shelves.id`
    - `verification_result`: String(30) (`CONFIRMED_MISPLACED`, `CONFIRMED_MISSING`, `FALSE_POSITIVE`, `TAG_DAMAGED`)
    - `verified_by_name`: String(100)
    - `notes`: Text
    - `timestamp`: Timestamptz, Indexed
21. **`ai_models` & `model_training_runs`**: Model registry and training runs.
    - `id`: Integer Primary Key
    - `model_name`: String(100)
    - `version`: String(30)
    - `task_type`: String(50)
    - `status`: String(20) (`ACTIVE`, `EXPERIMENTAL`, `ARCHIVED`)
    - `metrics`: JSONB (accuracy, precision, recall, F1, Brier score)
    - `artifact_path`: String(255)


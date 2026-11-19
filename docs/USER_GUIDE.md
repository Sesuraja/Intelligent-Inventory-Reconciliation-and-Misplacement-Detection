# Warehouse Operator & Manager User Guide

## 1. System Navigation

The application uses an intuitive 5-pillar navigation structure in the dark navy sidebar:
1. **Dashboard**: High-level inventory health and system KPIs.
2. **Inventory**: Catalog products, serialized tags, shelf map layout, and manual assignments.
3. **Live Monitoring**: 4-port reader matrix, RF signal strength graphs, and live observation stream.
4. **AI Exceptions**: Exception workbench, root-cause evidence reasoning, and human verification actions.
5. **Reports**: Audit reports, discrepancy logs, and AI accuracy metrics.

---

## 2. Managing Products, Tags, Shelves & Antennas

### 2.1 Provisioning a New Warehouse Shelf
1. Navigate to **Inventory** and click **+ Add Warehouse Shelf** or **+ New Shelf**.
2. Enter:
   - **Shelf Code** (e.g. `SHELF_D`).
   - **Display Name** (e.g. `Shelf Bay D - High Value Electronics`).
   - **Zone** (e.g. `Zone A`).
   - **Max Unit Capacity** (e.g. `25`).
   - **Category Restriction** (e.g. `Electronics`).
3. Click **Create Shelf**. The location immediately appears on the warehouse map and is available for inventory allocation and antenna mapping.

### 2.2 Registering & Assigning an RFID Tag to a Product
1. In **Inventory**, click **+ Assign Tag to Product**.
2. Fill in:
   - **Tag EPC** (e.g. `EPC-AUTO-1016`).
   - **Select Catalog Product** (e.g. `Brake Rotor Kit`).
   - **Expected Warehouse Shelf** (e.g. `SHELF_A`).
   - **Packaging RF Profile** (`Cardboard / Dry Goods`, `Plastic Tote`, `Liquid Proximity`, `Metal Shielded`).
3. Click **Confirm & Assign Tag**. The serialized tag is bound to the SKU, expected location is established, and the physics simulator immediately begins tracking it.

### 2.3 Mapping Reader Antenna Ports to Shelves
1. Navigate to **Live Monitoring**.
2. Locate the **4-Port Antenna Matrix** and click **Configure / Assign** on an antenna card.
3. In the modal:
   - Select the **Target Warehouse Shelf**.
   - Adjust the **Transmit Power (Tx)** slider (e.g. $26.0$ dBm).
   - Set the **Antenna Gain** slider (e.g. $6.0$ dBi).
   - Specify antenna purpose (`Primary Shelf`, `Aisle Gateway`, `Verification Portal`).
4. Click **Apply RF Configuration**. The tracking engine updates its beam-pattern model instantly.

---

## 3. Investigating & Resolving AI Exceptions

### 3.1 The Verification Lifecycle
```
[NEW EXCEPTION] ──> [AI EVIDENCE ANALYSIS] ──> [ASSIGN OPERATOR] ──> [PHYSICAL CHECK] ──> [RESOLVED]
```

### 3.2 Operator Workflow
1. Navigate to **AI Exceptions**.
2. Filter by status (`PENDING_VERIFICATION`, `ASSIGNED`) or shelf.
3. Click an exception card to open the **Evidence & Hypothesis Inspector**.
4. Review the AI reasoning:
   - **Discrepancy Confidence**: Posterior probability (e.g. $92\%$).
   - **Ranked Candidate Causes**: `PHYSICAL_RELOCATION`, `RF_SHADOWING`, `INCORRECT_WMS_TRANSACTION`.
   - **Evidence Strings**: Per-antenna read counts, RSSI gradients, and elapsed timestamps.
   - **Recommended Verification Action**: e.g., *"Perform handheld barcode/RFID audit of Shelf C, Bay 2"*.
5. Conduct the physical audit at the shelf.
6. Click **Record Physical Verification**:
   - Select Outcome: `CONFIRMED_MISPLACED`, `CONFIRMED_MISSING`, `FALSE_POSITIVE`, or `TAG_DAMAGED`.
   - Specify Actual Shelf observed.
   - Enter operator notes.
7. Click **Confirm Verification**. The official inventory record updates, an immutable audit log is saved, and the discrepancy is marked as `RESOLVED`.


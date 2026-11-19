# Quality Assurance & Test Plan

## 1. Scope & Objective
This test plan validates the end-to-end functionality, RF signal handling, AI intelligence models, database integrity, and UI/UX responsiveness against Section 16 of the Software Requirements Specification (SRS).

---

## 2. Test Matrix & Acceptance Criteria

| Test ID | Test Scenario | Inputs / Action | Expected Result | Automated Test Case |
|---|---|---|---|---|
| **TC-01** | **Normal EPC Detection** | EPC-AUTO-1001 placed on expected Shelf A. | Antenna 1 records $> 90\%$ reads. State = `IN_PLACE`. Confidence $\ge 0.85$. | `test_location_inference` in `test_rfid_system.py` |
| **TC-02** | **Physical Misplacement** | EPC-AUTO-1002 physically relocated to Shelf C without WMS transfer. | Antenna 3 reads dominate. AI raises `MISPLACED` exception. Root cause = `PHYSICAL_RELOCATION`. | `test_live_misplacement_scenario` in `test_rfid_system.py` |
| **TC-03** | **Multi-Antenna Cross-Reading** | EPC detected by both Port 1 (-42 dBm, 28 reads) and Port 2 (-68 dBm, 3 reads). | Disambiguation engine identifies primary location as Shelf A. Candidate probability $\ge 0.80$. | `test_location_inference` in `test_rfid_system.py` |
| **TC-04** | **Ambiguous Border Location** | EPC placed equidistant between Shelf A and Shelf B (-56 dBm on both ports). | Probability difference $< 0.15$. System outputs `AMBIGUOUS`. Verification requested. | `test_location_inference` in `test_rfid_system.py` |
| **TC-05** | **RF Shadowing (Unread Tag)** | Tag obstructed behind dense liquid or metal shield; 0 reads in window; reader online. | Model predicts `POSSIBLE_UNREAD` / `UNCERTAIN` instead of missing. Root cause = `RF_SHADOWING`. | `test_read_reliability_prediction` in `test_rfid_system.py` |
| **TC-06** | **Reader / Port Outage** | Reader set to `OFFLINE` or antenna cable detached. | Zone marked as degraded. Missing-item conclusions are strictly suppressed. | `test_read_reliability_prediction` in `test_rfid_system.py` |
| **TC-07** | **Authorized Stock Movement** | WMS movement record posted from Shelf A to Shelf B. | Expected location updates to Shelf B. Tag on Shelf B is marked `IN_PLACE`. | `test_exceptions_lifecycle` in `test_api_endpoints.py` |
| **TC-08** | **Manual Operator Verification** | Operator conducts handheld scan and submits verification form. | Ground truth logged in `verification_logs`. Official stock updated. Discrepancy marked `RESOLVED`. | `test_exceptions_lifecycle` in `test_api_endpoints.py` |
| **TC-09** | **Event Schema Validation** | Malformed event (RSSI out of range: -110 dBm, empty EPC). | Ingestion rejects event with HTTP 400. Raw error captured in log. | `test_event_validator` in `test_rfid_system.py` |
| **TC-10** | **Demand & Cycle Count Ranking** | Request stockout forecast and shelf audit list. | Shelves ranked by discrepancy probability $\times$ value. Avoided search time projected. | `test_demand_forecasting_and_cycle_counting` in `test_rfid_system.py` |

---

## 3. Execution Instructions

### 3.1 Backend Pytest Suite
Run the full 19-test automated suite:
```bash
python -m pytest backend/tests/ -v
```

### 3.2 Frontend TypeScript Build Verification
Verify type safety and clean bundling:
```bash
cd frontend
npm run build
```
*(Passing criteria: 0 TypeScript errors, clean `dist/` asset output).*


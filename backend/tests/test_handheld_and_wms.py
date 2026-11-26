import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_handheld_readers_and_registration():
    # 1. List readers
    res = client.get("/api/v1/handheld/readers")
    assert res.status_code == 200
    readers = res.json()
    assert len(readers) >= 2
    assert any(r["device_code"] == "HH-01" for r in readers)

    # 2. Register new handheld reader
    res_reg = client.post("/api/v1/handheld/readers/register", json={
        "device_code": "HH-TEST-09",
        "model": "Honeywell EDA51 UHF",
        "assigned_operator": "Test Operator",
        "battery_level": 92
    })
    assert res_reg.status_code == 200
    data = res_reg.json()
    assert data["device_code"] == "HH-TEST-09"
    assert data["battery_level"] == 92


def test_handheld_session_lifecycle_and_verification():
    # 1. Create a handheld scan session
    res_sess = client.post("/api/v1/handheld/sessions", json={
        "operator_name": "Marcus Kane",
        "device_code": "HH-01",
        "shelf_code": "SHELF_C",
        "scan_mode": "DISCREPANCY_VERIFICATION",
        "notes": "Testing shelf C verification"
    })
    assert res_sess.status_code == 200
    sess = res_sess.json()
    sess_id = sess["id"]
    assert sess["status"] == "ACTIVE"
    assert sess["target_shelf_code"] == "SHELF_C"

    # 2. Submit scanned events
    res_evts = client.post(f"/api/v1/handheld/sessions/{sess_id}/events", json={
        "shelf_code": "SHELF_C",
        "events": [
            {"epc": "EPC-9002", "rssi_dbm": -48.5, "read_count": 3, "scanned_barcode_or_qr": "QR-SHELF-C"},
            {"epc": "EPC-9004", "rssi_dbm": -51.0, "read_count": 2, "scanned_barcode_or_qr": "QR-SHELF-C"}
        ]
    })
    assert res_evts.status_code == 200
    assert res_evts.json()["events_received"] == 2
    assert res_evts.json()["unique_epcs"] >= 2

    # 3. Complete scan session
    res_comp = client.post(f"/api/v1/handheld/sessions/{sess_id}/complete")
    assert res_comp.status_code == 200
    comp_data = res_comp.json()
    assert comp_data["status"] == "COMPLETED"
    assert comp_data["verifications_generated"] >= 1

    # 4. Query scans
    res_scans = client.get(f"/api/v1/handheld/scans?session_id={sess_id}")
    assert res_scans.status_code == 200
    assert len(res_scans.json()) >= 2


def test_direct_ground_truth_verification_override():
    # Direct ground-truth verification submission (Rule 6)
    res_ver = client.post("/api/v1/handheld/verification", json={
        "epc": "EPC-9003",
        "actual_shelf_code": "SHELF_B",
        "verification_status": "CONFIRMED_MISPLACED",
        "verified_by": "Senior Quality Inspector",
        "device_code": "HH-01",
        "barcode_scanned": "BC-SHELF-B",
        "notes": "Manually verified physical tag presence on Shelf B",
        "auto_reconcile": True
    })
    assert res_ver.status_code == 200
    data = res_ver.json()
    assert data["epc"] == "EPC-9003"
    assert data["verified_shelf_code"] == "SHELF_B"
    assert data["verification_status"] == "CONFIRMED_MISPLACED"
    assert data["barcode_matched"] is True


def test_handheld_batch_sync():
    csv_payload = "epc,shelf_code,rssi_dbm,barcode\nEPC-9001,SHELF_A,-45.0,BC-A1\nEPC-9006,SHELF_A,-47.5,BC-A2\n"
    res_sync = client.post(
        "/api/v1/handheld/sync",
        files={"file": ("scans.csv", csv_payload.encode("utf-8"), "text/csv")}
    )
    assert res_sync.status_code == 200
    sync_data = res_sync.json()
    assert sync_data["total_scans_imported"] == 2
    assert sync_data["unique_epcs"] == 2


def test_wms_sandbox_full_lifecycle():
    # 1. List WMS Inventory
    res_inv = client.get("/api/v1/wms/inventory")
    assert res_inv.status_code == 200
    items = res_inv.json()
    assert len(items) > 0

    # 2. Inbound Receiving
    res_rcv = client.post("/api/v1/wms/receive", json={
        "sku": "SKU-TEST-WMS",
        "quantity": 2,
        "target_shelf_code": "SHELF_A",
        "lot_number": "LOT-RCV-001",
        "epc_prefix": "EPC-TEST-RCV"
    })
    assert res_rcv.status_code == 200
    rcv_data = res_rcv.json()
    assert rcv_data["quantity_received"] == 2
    assert len(rcv_data["epcs"]) == 2
    epc_new = rcv_data["epcs"][0]

    # 3. Putaway to storage
    res_put = client.post("/api/v1/wms/putaway", json={
        "epc": epc_new,
        "to_shelf_code": "SHELF_B",
        "user_name": "Forklift-02"
    })
    assert res_put.status_code == 200
    assert res_put.json()["new_location"] == "SHELF_B"

    # 4. Authorized Move
    res_mov = client.post("/api/v1/wms/move", json={
        "epc": epc_new,
        "to_shelf_code": "SHELF_C",
        "reason": "Stock consolidation"
    })
    assert res_mov.status_code == 200
    assert res_mov.json()["new_location"] == "SHELF_C"

    # 5. Outbound Pick
    res_pick = client.post("/api/v1/wms/pick", json={
        "epc": epc_new,
        "order_number": "ORD-OUT-201"
    })
    assert res_pick.status_code == 200
    assert res_pick.json()["status"] == "ALLOCATED"

    # 6. Outbound Ship
    res_ship = client.post("/api/v1/wms/ship", json={
        "epc": epc_new,
        "order_number": "ORD-OUT-201"
    })
    assert res_ship.status_code == 200
    assert res_ship.json()["status"] == "SHIPPED"

    # 7. Cycle count adjustment
    target_adj_epc = items[0]["epc"]
    res_adj = client.post("/api/v1/wms/adjust", json={
        "epc": target_adj_epc,
        "new_shelf_code": "SHELF_A",
        "quantity": 1,
        "reason": "Routine cycle count audit"
    })
    assert res_adj.status_code == 200
    assert res_adj.json()["success"] is True

    # 8. Re-sync WMS expected state
    res_sync = client.post("/api/v1/wms/sync")
    assert res_sync.status_code == 200
    assert res_sync.json()["success"] is True

    # 9. Inject intentional discrepancy error
    res_err = client.post("/api/v1/wms/inject-error", json={
        "error_type": "MISPLACE",
        "epc": "EPC-9001",
        "target_shelf_code": "SHELF_D"
    })
    assert res_err.status_code == 200
    assert res_err.json()["injection_report"]["error_type"] == "MISPLACE"

    # 10. Check transaction history
    res_tx = client.get("/api/v1/wms/transactions?limit=10")
    assert res_tx.status_code == 200
    txs = res_tx.json()
    assert len(txs) >= 4
    types = [t["transaction_type"] for t in txs]
    assert "RECEIPT" in types
    assert "PUTAWAY" in types


def test_qr_shelf_decode_and_verification_history():
    # 1. Test valid shelf QR decode
    res_qr = client.post("/api/v1/handheld/shelf-qr/decode", json={
        "qr_raw_payload": "SHELF-QR:SHELF_B:ZONE_A:AISLE_02"
    })
    assert res_qr.status_code == 200
    qr_data = res_qr.json()
    assert qr_data["valid"] is True
    assert qr_data["shelf_code"] == "SHELF_B"

    # 2. Test invalid shelf QR decode
    res_bad = client.post("/api/v1/handheld/shelf-qr/decode", json={
        "qr_raw_payload": "INVALID_RANDOM_CODE"
    })
    assert res_bad.status_code == 200
    assert res_bad.json()["valid"] is False

    # 3. Test verification history endpoint
    res_hist = client.get("/api/v1/handheld/verification/history?limit=10")
    assert res_hist.status_code == 200
    assert isinstance(res_hist.json(), list)


def test_wms_transaction_reversal_and_approval():
    # 1. Fetch transactions to find one to reverse
    res_tx = client.get("/api/v1/wms/transactions?limit=1")
    assert res_tx.status_code == 200
    txs = res_tx.json()
    if txs:
        target_tx_id = txs[0]["id"]
        # Reverse transaction
        res_rev = client.post(f"/api/v1/wms/transactions/{target_tx_id}/reverse", json={
            "reversed_by": "Test Supervisor",
            "reason": "Test reversal audit"
        })
        assert res_rev.status_code in [200, 400]
        if res_rev.status_code == 200:
            assert res_rev.json()["success"] is True

    # 2. Reconcile approve
    res_inv = client.get("/api/v1/wms/inventory")
    target_rec_epc = res_inv.json()[0]["epc"] if res_inv.status_code == 200 and res_inv.json() else "30341ADB10521280257A10A9"
    res_app = client.post("/api/v1/wms/reconcile/approve", json={
        "epc": target_rec_epc,
        "action": "ACCEPT_LOCATION",
        "approved_shelf_code": "SHELF_A",
        "supervisor_name": "Senior Supervisor",
        "notes": "Approved test reconciliation"
    })
    assert res_app.status_code == 200
    assert res_app.json()["approved"] is True


def test_rfid_tag_retirement_hierarchy_and_history():
    # 1. Assign tag with pallet and carton hierarchy
    prods_resp = client.get("/api/v1/products")
    prods = prods_resp.json() if prods_resp.status_code == 200 else []
    target_pid = prods[0]["id"] if prods else 1

    shelves_resp = client.get("/api/v1/shelves")
    shelves = shelves_resp.json() if shelves_resp.status_code == 200 else []
    target_sid = shelves[0]["id"] if shelves else 1

    res_assign = client.post("/api/v1/inventory/assign-tag", json={
        "epc": "EPC-HIERARCHY-01",
        "product_id": target_pid,
        "expected_shelf_id": target_sid,
        "packaging_class": "CARDBOARD",
        "pallet_id": "PALLET-X100",
        "carton_id": "CARTON-C500",
        "assigned_by": "Warehouse Supervisor",
        "reason": "Initial pallet breakdown"
    })
    assert res_assign.status_code == 200
    assert res_assign.json()["success"] is True

    # 2. Check tag history
    res_hist = client.get("/api/v1/rfid-tags/EPC-HIERARCHY-01/history")
    assert res_hist.status_code == 200
    hist = res_hist.json()
    assert len(hist) >= 1
    assert hist[0]["pallet_id"] == "PALLET-X100"
    assert hist[0]["carton_id"] == "CARTON-C500"

    # 3. Check duplicate EPC endpoint
    res_dups = client.get("/api/v1/rfid-tags/duplicates")
    assert res_dups.status_code == 200
    assert isinstance(res_dups.json(), list)

    # 4. Retire tag
    res_ret = client.post("/api/v1/rfid-tags/EPC-HIERARCHY-01/retire", json={
        "reason": "Damaged RFID inlay during handling",
        "retired_by": "Senior QA"
    })
    assert res_ret.status_code == 200
    assert res_ret.json()["status"] == "RETIRED"


def test_comprehensive_system_health():
    res = client.get("/api/v1/system/health/comprehensive")
    assert res.status_code == 200
    data = res.json()
    assert "overall_status" in data
    assert "reader" in data
    assert "antennas" in data
    assert len(data["antennas"]) >= 1
    assert "edge_collector" in data
    assert "data_quality_index" in data
    assert data["data_quality_index"]["overall_score"] > 0.8


def test_model_rollback_and_evaluation_metrics():
    # 1. Rollback model
    res_rb = client.post("/api/v1/ai/models/1/rollback")
    assert res_rb.status_code == 200
    assert res_rb.json()["success"] is True

    # 2. Get evaluation report with advanced metrics
    res_eval = client.get("/api/v1/ai/evaluation")
    assert res_eval.status_code == 200
    eval_data = res_eval.json()
    assert "false_absence_rate" in eval_data
    assert "per_shelf_performance" in eval_data
    assert "confusion_matrix" in eval_data
    assert "calibration_reliability_curve" in eval_data


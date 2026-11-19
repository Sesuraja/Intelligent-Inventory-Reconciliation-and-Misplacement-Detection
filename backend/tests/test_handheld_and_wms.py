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
    res_adj = client.post("/api/v1/wms/adjust", json={
        "epc": "EPC-9001",
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

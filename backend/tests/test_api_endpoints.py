import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.seed_data import seed_database

@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    seed_database()

client = TestClient(app)

def test_system_health():
    res = client.get("/api/v1/system/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["database"] == "CONNECTED"

def test_system_events():
    res = client.get("/api/v1/system/events")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_auth_me_and_refresh():
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 200
    user = res.json()
    assert "email" in user
    assert "role" in user

    res_ref = client.post("/api/v1/auth/refresh")
    assert res_ref.status_code == 200
    assert "access_token" in res_ref.json()

def test_dashboard_endpoints():
    res1 = client.get("/api/v1/dashboard/summary")
    assert res1.status_code == 200
    assert "kpis" in res1.json()

    res2 = client.get("/api/v1/dashboard/inventory-status")
    assert res2.status_code == 200
    assert "status_distribution" in res2.json()

    res3 = client.get("/api/v1/dashboard/rfid-activity")
    assert res3.status_code == 200
    assert "rfid_activity" in res3.json()

    res4 = client.get("/api/v1/dashboard/shelf-summary")
    assert res4.status_code == 200
    assert "shelf_distribution" in res4.json()

    res5 = client.get("/api/v1/dashboard/recent-exceptions")
    assert res5.status_code == 200
    assert "recent_discrepancies" in res5.json()

def test_products_and_tags_endpoints():
    res = client.get("/api/v1/products")
    assert res.status_code == 200
    prods = res.json()
    assert len(prods) > 0
    p_id = prods[0]["id"]

    res_single = client.get(f"/api/v1/products/{p_id}")
    assert res_single.status_code == 200
    assert res_single.json()["sku"] == prods[0]["sku"]

    res_tags = client.get("/api/v1/rfid-tags")
    assert res_tags.status_code == 200
    tags = res_tags.json()
    assert len(tags) > 0

def test_locations_and_shelves():
    res_loc = client.get("/api/v1/locations")
    assert res_loc.status_code == 200
    
    res_shelves = client.get("/api/v1/shelves")
    assert res_shelves.status_code == 200
    assert len(res_shelves.json()) >= 3

    res_zones = client.get("/api/v1/zones")
    assert res_zones.status_code == 200

    res_bins = client.get("/api/v1/bins")
    assert res_bins.status_code == 200

def test_readers_and_antennas():
    res_r = client.get("/api/v1/readers")
    assert res_r.status_code == 200
    readers = res_r.json()
    assert len(readers) > 0
    r_id = readers[0]["id"]

    res_health = client.get(f"/api/v1/readers/{r_id}/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ONLINE"

    res_test = client.post(f"/api/v1/readers/{r_id}/test-connection")
    assert res_test.status_code == 200
    assert res_test.json()["success"] is True

    res_ant = client.get("/api/v1/antennas")
    assert res_ant.status_code == 200
    assert len(res_ant.json()) >= 3

def test_rfid_events():
    res = client.get("/api/v1/rfid-events?limit=10")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    res_stats = client.get("/api/v1/rfid-events/statistics")
    assert res_stats.status_code == 200
    assert res_stats.json()["read_rate_per_sec"] > 0

def test_reconciliation():
    res_status = client.get("/api/v1/reconciliation/status")
    assert res_status.status_code == 200
    assert "status" in res_status.json()

    res_run = client.post("/api/v1/reconciliation/run")
    assert res_run.status_code == 200
    assert res_run.json()["success"] is True

def test_ai_models_and_metrics():
    res_m = client.get("/api/v1/ai/models")
    assert res_m.status_code == 200
    assert len(res_m.json()) >= 2

    res_met = client.get("/api/v1/ai/metrics")
    assert res_met.status_code == 200
    assert "read_reliability_classifier" in res_met.json()
    assert "root_cause_explainer" in res_met.json()

    res_fc = client.get("/api/v1/ai/demand-forecast")
    assert res_fc.status_code == 200
    assert len(res_fc.json()) > 0

    res_cc = client.get("/api/v1/ai/cycle-counting")
    assert res_cc.status_code == 200
    assert len(res_cc.json()) > 0

def test_exceptions_lifecycle():
    res = client.get("/api/v1/exceptions")
    assert res.status_code == 200
    exceptions = res.json()
    assert len(exceptions) > 0
    exc_id = exceptions[0]["id"]

    res_assign = client.post(f"/api/v1/exceptions/{exc_id}/assign?operator_name=Alex%20Rivera")
    assert res_assign.status_code == 200
    assert res_assign.json()["assigned_to"] == "Alex Rivera"

    res_ack = client.post(f"/api/v1/exceptions/{exc_id}/acknowledge")
    assert res_ack.status_code == 200
    assert res_ack.json()["status"] == "PENDING_VERIFICATION"

def test_dynamic_product_shelf_tag_antenna_lifecycle():
    import uuid
    uid = uuid.uuid4().hex[:6].upper()
    test_sku = f"SKU-DYN-{uid}"
    test_shelf = f"SHF_{uid}"
    test_epc = f"EPC-DYN-{uid}"

    # 1. Dynamically create a master product SKU
    p_data = {
        "sku": test_sku,
        "name": f"Heavy Duty Industrial Alternator {uid}",
        "category": "Automotive",
        "unit": "units",
        "unit_cost": 280.0,
        "min_stock": 4,
        "description": "Dynamic testing SKU"
    }
    res_p = client.post("/api/v1/products", json=p_data)
    assert res_p.status_code == 200
    prod = res_p.json()
    prod_id = prod["id"]
    assert prod["sku"] == test_sku

    # 2. Dynamically create a new warehouse shelf
    s_data = {
        "shelf_code": test_shelf,
        "name": f"Shelf Bay {test_shelf} - Heavy Components",
        "capacity": 35,
        "category_restriction": "Automotive",
        "zone_id": 1
    }
    res_s = client.post("/api/v1/shelves", json=s_data)
    assert res_s.status_code == 200
    shelf = res_s.json()
    shelf_id = shelf["id"]
    assert shelf["shelf_code"] == test_shelf

    # 3. Dynamically assign a serialized tag to the product and map to the new shelf
    assign_data = {
        "epc": test_epc,
        "product_id": prod_id,
        "expected_shelf_id": shelf_id,
        "packaging_class": "CARDBOARD",
        "tag_type": "EPC_GEN2_UHF"
    }
    res_assign = client.post("/api/v1/inventory/assign-tag", json=assign_data)
    assert res_assign.status_code == 200
    assigned = res_assign.json()
    assert assigned["success"] is True
    assert assigned["epc"] == test_epc

    # Verify inventory record reflects the dynamic assignment
    res_inv = client.get(f"/api/v1/inventory?search={test_epc}")
    assert res_inv.status_code == 200
    inv_items = res_inv.json()
    assert len(inv_items) == 1
    assert inv_items[0]["expected_shelf_code"] == test_shelf

    # 4. Dynamically assign antenna port 4 to the new shelf on the reader
    ant_assign_data = {
        "reader_id": 1,
        "port_number": 4,
        "shelf_id": shelf_id,
        "antenna_code": "ANT-04",
        "tx_power_dbm": 28.5,
        "gain_dbi": 6.0,
        "purpose": "PRIMARY_DETECTION"
    }
    res_ant = client.post("/api/v1/readers/antennas/assign", json=ant_assign_data)
    assert res_ant.status_code == 200
    ant_res = res_ant.json()
    assert ant_res["shelf_code"] == test_shelf
    assert ant_res["port_number"] == 4

def test_dynamic_reports():
    res_inv = client.get("/api/v1/reports/inventory")
    assert res_inv.status_code == 200
    data_inv = res_inv.json()
    assert "total_epcs_tracked" in data_inv
    assert "total_inventory_valuation" in data_inv
    # Shelves should dynamically appear in the report
    shelves_in_report = [s["shelf_code"] for s in data_inv["shelf_breakdown"]]
    assert len(shelves_in_report) >= 3
    assert any("SHELF" in s for s in shelves_in_report)

    res_disc = client.get("/api/v1/reports/discrepancies")
    assert res_disc.status_code == 200
    assert "total_discrepancies" in res_disc.json()

    res_rd = client.get("/api/v1/reports/readers")
    assert res_rd.status_code == 200
    assert res_rd.json()["readers_count"] > 0

    res_ai = client.get("/api/v1/reports/ai-performance")
    assert res_ai.status_code == 200
    assert "active_models" in res_ai.json()

    res_aud = client.get("/api/v1/reports/audit")
    assert res_aud.status_code == 200
    assert "records" in res_aud.json()

def test_spa_client_routes():
    # Deep links to SPA pages should return 200 with HTML content
    for page in ["/", "/dashboard", "/inventory", "/monitoring", "/exceptions", "/reports"]:
        res = client.get(page)
        assert res.status_code == 200
        assert "text/html" in res.headers.get("content-type", "")
        assert "Intelligent Inventory Reconciliation" in res.text

def test_dynamic_system_settings_and_users():
    # Test registered users endpoint
    res_users = client.get("/api/v1/auth/users")
    assert res_users.status_code == 200
    users = res_users.json()
    assert isinstance(users, list)
    assert len(users) >= 2
    assert any(u["name"] == "Sarah Jenkins" for u in users)

    # Test dynamic system settings get & update
    res_get = client.get("/api/v1/system/settings")
    assert res_get.status_code == 200
    settings_data = res_get.json()
    assert "brand_name" in settings_data

    # Update settings dynamically
    res_post = client.post("/api/v1/system/settings", json={
        "brand_name": "Dynamic RFID AIoT",
        "company_name": "Enterprise Logistics Hub #9"
    })
    assert res_post.status_code == 200
    assert res_post.json()["settings"]["brand_name"] == "Dynamic RFID AIoT"
    assert res_post.json()["settings"]["company_name"] == "Enterprise Logistics Hub #9"


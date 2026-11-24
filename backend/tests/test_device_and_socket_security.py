import pytest
import hmac
import hashlib
import time
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.security import create_access_token
from app.services.audit_service import audit_service
from app.core.database import SessionLocal
from app.models.security import DeviceApiKey

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_device_auth():
    db = SessionLocal()
    test_key = "test-rfid-secret-key-12345"
    key_hash = hashlib.sha256(test_key.encode("utf-8")).hexdigest()
    
    device_key = db.query(DeviceApiKey).filter(DeviceApiKey.device_id == "READER_01").first()
    if not device_key:
        device_key = DeviceApiKey(
            device_id="READER_01",
            name="Test Fixed Reader 01",
            key_hash=key_hash,
            is_active=True,
            scope="ingest"
        )
        db.add(device_key)
    else:
        device_key.key_hash = key_hash
        device_key.is_active = True
    db.commit()
    db.close()
    return {"device_id": "READER_01", "api_key": test_key}

def test_device_auth_missing_credentials():
    """Verify that ingest rejects requests missing device authentication headers."""
    resp = client.post("/api/v1/rfid-events/ingest", json={"epc": "111122223333444455556666"})
    assert resp.status_code == 401
    assert "Missing 'X-Device-API-Key' header" in resp.json()["detail"]

def test_device_auth_invalid_key(setup_device_auth):
    """Verify that ingest rejects invalid device API keys."""
    resp = client.post(
        "/api/v1/rfid-events/ingest",
        json={"epc": "111122223333444455556666"},
        headers={
            "X-Device-ID": setup_device_auth["device_id"],
            "X-Device-API-Key": "wrong-secret-key"
        }
    )
    assert resp.status_code == 403
    assert "Invalid, expired, or revoked" in resp.json()["detail"]

def test_device_auth_unregistered_device(setup_device_auth):
    """Verify that ingest rejects unregistered devices."""
    resp = client.post(
        "/api/v1/rfid-events/ingest",
        json={"epc": "111122223333444455556666"},
        headers={
            "X-Device-ID": "UNKNOWN_ROGUE_READER",
            "X-Device-API-Key": setup_device_auth["api_key"]
        }
    )
    assert resp.status_code == 403
    assert "not in the authorized device allow-list" in resp.json()["detail"]

def test_device_auth_valid_key(setup_device_auth):
    """Verify that ingest accepts valid device API keys and valid RFID event payload."""
    event_payload = {
        "epc": "111122223333444455556666",
        "reader_id": setup_device_auth["device_id"],
        "antenna_id": 1,
        "rssi_dbm": -62.0,
        "frequency": 915.0,
        "observed_at": datetime.now(timezone.utc).isoformat()
    }
    resp = client.post(
        "/api/v1/rfid-events/ingest",
        json=event_payload,
        headers={
            "X-Device-ID": setup_device_auth["device_id"],
            "X-Device-API-Key": setup_device_auth["api_key"]
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "INGESTED"
    assert "event_id" in data

def test_device_auth_hmac_replay_protection(setup_device_auth):
    """Verify HMAC signature validation and timestamp replay rejection."""
    event_payload = {
        "epc": "111122223333444455557777",
        "reader_id": setup_device_auth["device_id"],
        "antenna_id": 1,
        "rssi_dbm": -55.0,
        "frequency": 915.0,
        "observed_at": datetime.now(timezone.utc).isoformat()
    }
    body_bytes = json.dumps(event_payload).encode("utf-8")

    # 1. Expired timestamp (> 300s skew)
    old_ts = str(time.time() - 400.0)
    sig_old = hmac.new(
        setup_device_auth["api_key"].encode("utf-8"),
        f"{old_ts}:".encode("utf-8") + body_bytes,
        hashlib.sha256
    ).hexdigest()

    resp_expired = client.post(
        "/api/v1/rfid-events/ingest",
        content=body_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Device-ID": setup_device_auth["device_id"],
            "X-Device-API-Key": setup_device_auth["api_key"],
            "X-Device-Timestamp": old_ts,
            "X-Device-Signature": sig_old
        }
    )
    assert resp_expired.status_code == 401
    assert "replay window exceeded" in resp_expired.json()["detail"]

    # 2. Valid current timestamp + correct HMAC
    valid_ts = str(time.time())
    valid_sig = hmac.new(
        setup_device_auth["api_key"].encode("utf-8"),
        f"{valid_ts}:".encode("utf-8") + body_bytes,
        hashlib.sha256
    ).hexdigest()

    resp_valid = client.post(
        "/api/v1/rfid-events/ingest",
        content=body_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Device-ID": setup_device_auth["device_id"],
            "X-Device-API-Key": setup_device_auth["api_key"],
            "X-Device-Timestamp": valid_ts,
            "X-Device-Signature": valid_sig
        }
    )
    assert resp_valid.status_code == 200
    assert resp_valid.json()["status"] == "INGESTED"

def test_hash_chained_audit_log_and_verification():
    """Verify that audit logs form a tamper-evident SHA-256 hash chain."""
    db = SessionLocal()
    try:
        # Create 3 audit records
        e1 = audit_service.log(db, "TEST_ACTION_1", "ITEM", "EPC001", actor="test_user", details={"step": 1})
        e2 = audit_service.log(db, "TEST_ACTION_2", "ITEM", "EPC002", actor="test_user", details={"step": 2})
        e3 = audit_service.log(db, "TEST_ACTION_3", "ITEM", "EPC003", actor="test_user", details={"step": 3})

        assert e2.prev_hash == e1.entry_hash
        assert e3.prev_hash == e2.entry_hash

        # Verify chain integrity
        verif = audit_service.verify_chain(db)
        assert verif["valid"] is True
        assert verif["total_records"] >= 3

        # API endpoint check
        resp = client.get("/api/v1/audit/verify-chain")
        assert resp.status_code == 200
        assert resp.json()["valid"] is True

        resp_logs = client.get("/api/v1/audit/logs?limit=5")
        assert resp_logs.status_code == 200
        assert len(resp_logs.json()["records"]) > 0
    finally:
        db.close()

def test_w9_simulator_flag_and_audit():
    """Verify that dummy simulator is disabled in production and removed from active endpoints."""
    assert settings.ENABLE_SIMULATOR is False
    resp = client.post(
        "/api/v1/simulator/action",
        json={"action": "TOGGLE_SHADOWING", "epc": "TEST_EPC", "enabled": True}
    )
    # Simulator router is removed; returns 404 or 405
    assert resp.status_code in [404, 405]

def test_websocket_channel_and_role_permissions():
    """Verify WebSocket authentication and per-topic permissions."""
    # 1. Invalid topic
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/invalid-unknown-channel") as ws:
            pass

    # 2. Token with Viewer role attempting to connect to ai-alerts (unauthorized topic)
    viewer_token = create_access_token({"sub": "viewer@test.com", "role": "Viewer", "uid": 99})
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/ai-alerts?token={viewer_token}") as ws:
            pass

    # 3. Viewer role connecting to system-status (authorized topic)
    with client.websocket_connect(f"/ws/system-status?token={viewer_token}") as ws:
        # Connected successfully
        pass

    # 4. Operator role connecting to ai-alerts (authorized topic)
    operator_token = create_access_token({"sub": "op@test.com", "role": "Warehouse Operator", "uid": 100})
    with client.websocket_connect(f"/ws/ai-alerts?token={operator_token}") as ws:
        pass

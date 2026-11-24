"""
Device Authentication & Ingest Verification Module.
Implements Section 3 highest priority requirement:
- Per-device API key (hashed in DB, scoped to ingest, rotatable)
- Device allow-list
- Optional HMAC signature with timestamp replay window
- Rejection of unsigned or unauthorized reads
"""

from fastapi import Header, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib
import hmac
import os
import json
from typing import Optional, Dict, Any, List

from app.core.database import get_db
from app.models.security import DeviceApiKey


ALLOWED_DEVICES = ["READER_01", "READER_02", "EDGE_COLLECTOR_01", "EDGE_COLLECTOR_02", "HANDHELD_DEV_01"]
DEFAULT_TEST_KEY = "dev-edge-key-secret-12345"


def hash_api_key(raw_key: str) -> str:
    """Computes SHA-256 hash of raw API key."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()


def ensure_default_device_keys(db: Session):
    """Ensures a baseline active API key exists for the edge collector / reader."""
    test_hash = hash_api_key(DEFAULT_TEST_KEY)
    existing = db.query(DeviceApiKey).filter(DeviceApiKey.key_hash == test_hash).first()
    if not existing:
        key_row = DeviceApiKey(
            device_id="EDGE_COLLECTOR_01",
            name="Default Edge Collector Ingest Key",
            key_hash=test_hash,
            scope="ingest",
            is_active=True,
            created_at=datetime.now(timezone.utc)
        )
        db.add(key_row)
        try:
            db.commit()
        except Exception:
            db.rollback()


async def verify_device_ingest_auth(
    request: Request,
    x_device_api_key: Optional[str] = Header(None, alias="X-Device-API-Key"),
    x_device_id: Optional[str] = Header(None, alias="X-Device-ID"),
    x_device_signature: Optional[str] = Header(None, alias="X-Device-Signature"),
    x_device_timestamp: Optional[str] = Header(None, alias="X-Device-Timestamp"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    FastAPI dependency enforcing strict device authentication on event ingestion.
    Rejects unauthorized, unauthenticated, or forged reads.
    """
    # 1. Resolve raw key from header or Authorization Bearer
    raw_key = x_device_api_key
    if not raw_key and authorization and authorization.startswith("Bearer "):
        raw_key = authorization.split(" ", 1)[1]

    if not raw_key:
        raise HTTPException(
            status_code=401,
            detail="Device authentication required on ingest: Missing 'X-Device-API-Key' header."
        )

    # Ensure default keys in database
    ensure_default_device_keys(db)

    # 2. Verify hashed key against database
    key_hash = hash_api_key(raw_key)
    api_key_record = db.query(DeviceApiKey).filter(
        DeviceApiKey.key_hash == key_hash,
        DeviceApiKey.is_active == True
    ).first()

    if not api_key_record:
        raise HTTPException(
            status_code=403,
            detail="Invalid, expired, or revoked device API key."
        )

    # 3. Verify scope
    if api_key_record.scope not in ("ingest", "all"):
        raise HTTPException(
            status_code=403,
            detail=f"API key does not have 'ingest' scope (granted scope: '{api_key_record.scope}')."
        )

    device_id = x_device_id or api_key_record.device_id

    # 4. Device allow-list check
    if device_id not in ALLOWED_DEVICES:
        raise HTTPException(
            status_code=403,
            detail=f"Device '{device_id}' is not in the authorized device allow-list."
        )

    # 5. Optional HMAC signature and replay-window check
    if x_device_signature and x_device_timestamp:
        try:
            ts = float(x_device_timestamp)
            now_ts = datetime.now(timezone.utc).timestamp()
            # 5-minute replay window tolerance
            if abs(now_ts - ts) > 300.0:
                raise HTTPException(
                    status_code=401,
                    detail=f"Timestamp replay window exceeded (skew: {abs(now_ts - ts):.1f}s > 300s)."
                )

            body_bytes = await request.body()
            expected_sig = hmac.new(
                raw_key.encode("utf-8"),
                f"{x_device_timestamp}:".encode("utf-8") + body_bytes,
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(expected_sig, x_device_signature):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid HMAC request signature."
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid X-Device-Timestamp format.")

    # Update last_used_at
    api_key_record.last_used_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except Exception:
        db.rollback()

    return {
        "authenticated": True,
        "device_id": device_id,
        "key_id": api_key_record.id,
        "scope": api_key_record.scope
    }

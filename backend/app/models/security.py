"""
Device API Key & Security Models.
Implements device authentication on ingest and API key scoping.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from datetime import datetime, timezone
import uuid

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class DeviceApiKey(Base):
    """
    Cryptographically hashed API key for physical RFID readers and edge collectors.
    Scoped specifically for event ingestion.
    Supports key rotation and revocation.
    """
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(50), nullable=False, index=True)
    name = Column(String(100), default="Edge Collector Ingest Key", nullable=False)
    key_hash = Column(String(64), nullable=False, index=True)  # SHA-256 hash of raw API key
    scope = Column(String(50), default="ingest", nullable=False)  # Scoped to 'ingest'
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)

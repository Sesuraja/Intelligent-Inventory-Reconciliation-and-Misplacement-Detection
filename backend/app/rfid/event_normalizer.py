import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.rfid.event_validator import EventValidator

class EventNormalizer:
    """
    Normalizes raw vendor or LLRP payloads into standard schema:
    {
      "event_id": "EVT-000001",
      "epc": "EPC001",
      "reader_id": "READER_01",
      "antenna_id": 1,
      "rssi_dbm": -42.0,
      "frequency": 866.3,
      "observed_at": "2026-11-17T10:30:00Z",
      "received_at": "2026-11-17T10:30:00Z",
      "source": "SIMULATION" | "PHYSICAL",
      "valid": true,
      "raw_payload": {...}
    }
    """

    @classmethod
    def normalize(
        cls,
        raw_event: Dict[str, Any],
        reader_code: str,
        antenna_id: int,
        clock_offset_ms: float = 0.0,
        source: str = "SIMULATION"
    ) -> Dict[str, Any]:
        event_id = raw_event.get("event_id") or f"EVT-{uuid.uuid4().hex[:8].upper()}"
        epc = str(raw_event.get("epc", "")).strip().upper()
        
        rssi = float(raw_event.get("rssi_dbm", raw_event.get("rssi", -60.0)))
        frequency = raw_event.get("frequency")
        if frequency is not None:
            frequency = float(frequency)

        # Observed timestamp handling
        raw_observed = raw_event.get("observed_at")
        if isinstance(raw_observed, str):
            try:
                observed_at = datetime.fromisoformat(raw_observed.replace("Z", "+00:00"))
            except Exception:
                observed_at = datetime.now(timezone.utc)
        elif isinstance(raw_observed, datetime):
            observed_at = raw_observed
        else:
            observed_at = datetime.now(timezone.utc)

        received_at = datetime.now(timezone.utc)
        evt_source = raw_event.get("source") or source
        is_sim = raw_event.get("is_simulated") if "is_simulated" in raw_event else (evt_source.upper() == "SIMULATION")

        # Check clock-drift and stale events (watermark)
        drift_seconds = abs((received_at - observed_at).total_seconds())
        clock_drift_exceeded = drift_seconds > 5.0
        is_stale = (received_at - observed_at).total_seconds() > 60.0

        # Deterministic idempotency key: hash of reader + antenna + epc + timestamp
        import hashlib
        idempotency_raw = f"{reader_code}:{antenna_id}:{epc}:{observed_at.isoformat()}"
        idempotency_key = hashlib.sha256(idempotency_raw.encode("utf-8")).hexdigest()

        normalized = {
            "event_id": event_id,
            "idempotency_key": idempotency_key,
            "epc": epc,
            "reader_id": reader_code,
            "antenna_id": antenna_id,
            "rssi_dbm": rssi,
            "frequency": frequency,
            "observed_at": observed_at,
            "received_at": received_at,
            "source": evt_source,
            "is_simulated": is_sim,
            "data_source": evt_source.lower(),
            "clock_drift_seconds": round(drift_seconds, 3),
            "clock_drift_exceeded": clock_drift_exceeded,
            "is_stale": is_stale,
            "raw_payload": raw_event
        }

        is_valid, validation_msg = EventValidator.validate_event(normalized)
        normalized["valid"] = is_valid
        normalized["validation_message"] = validation_msg

        return normalized

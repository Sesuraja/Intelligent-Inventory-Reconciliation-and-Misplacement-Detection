"""
Cryptographic Hash-Chained Audit Service.
Every entry links to the previous entry's hash (SHA-256 chain),
preventing tampering with logs (logins, config changes, labels, model promotions, simulator use).
"""

from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import hashlib
import json

from app.models.audit import AuditLog


class AuditService:
    GENESIS_HASH = "0" * 64

    @classmethod
    def compute_hash(
        cls,
        prev_hash: str,
        timestamp: Optional[datetime],
        action: str,
        entity: str,
        entity_id: Optional[str],
        actor: str,
        details: Optional[Dict[str, Any]]
    ) -> str:
        """Computes deterministic SHA-256 hash for an audit log entry."""
        if timestamp is None:
            dt_str = ""
        elif isinstance(timestamp, datetime):
            if hasattr(timestamp, "tzinfo") and timestamp.tzinfo is not None:
                dt = timestamp.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                dt = timestamp
            dt_str = dt.strftime("%Y-%m-%dT%H:%M:%S.%f")
        else:
            dt_str = str(timestamp)

        details_str = json.dumps(details or {}, sort_keys=True, default=str)
        payload = f"{prev_hash}:{dt_str}:{action}:{entity}:{entity_id or ''}:{actor}:{details_str}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def log(
        cls,
        db: Session,
        action: str,
        entity: str,
        entity_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        actor: str = "system",
        user_id: Optional[int] = None
    ) -> AuditLog:
        """
        Creates a new hash-chained audit log record.
        Links to previous record's hash to ensure tamper evidence.
        """
        now = datetime.now(timezone.utc)
        last_entry = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        prev_hash = last_entry.entry_hash if (last_entry and last_entry.entry_hash) else cls.GENESIS_HASH

        entry_hash = cls.compute_hash(
            prev_hash=prev_hash,
            timestamp=now,
            action=action,
            entity=entity,
            entity_id=entity_id,
            actor=actor,
            details=details
        )

        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            details=details,
            actor=actor,
            prev_hash=prev_hash,
            entry_hash=entry_hash,
            timestamp=now
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry

    @classmethod
    def verify_chain_integrity(cls, db: Session) -> Dict[str, Any]:
        return cls.verify_chain(db)

    @classmethod
    def verify_chain(cls, db: Session) -> Dict[str, Any]:
        """
        Verifies the cryptographic integrity of the entire audit log hash chain.
        Returns whether the chain is intact and reports any tampered entry IDs.
        """
        entries: List[AuditLog] = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
        if not entries:
            return {
                "valid": True,
                "is_valid": True,
                "total_records": 0,
                "total_entries": 0,
                "tampered_entries": [],
                "message": "Audit log is empty; chain is valid."
            }

        tampered = []
        expected_prev = cls.GENESIS_HASH

        for entry in entries:
            if entry.prev_hash != expected_prev:
                tampered.append({
                    "id": entry.id,
                    "action": entry.action,
                    "error": "PREV_HASH_MISMATCH",
                    "expected_prev": expected_prev,
                    "actual_prev": entry.prev_hash
                })

            recomputed = cls.compute_hash(
                prev_hash=entry.prev_hash or cls.GENESIS_HASH,
                timestamp=entry.timestamp,
                action=entry.action,
                entity=entry.entity,
                entity_id=entry.entity_id,
                actor=entry.actor,
                details=entry.details
            )

            if entry.entry_hash != recomputed:
                tampered.append({
                    "id": entry.id,
                    "action": entry.action,
                    "error": "HASH_CORRUPTED",
                    "expected_hash": recomputed,
                    "actual_hash": entry.entry_hash
                })

            expected_prev = entry.entry_hash or cls.GENESIS_HASH

        return {
            "valid": len(tampered) == 0,
            "is_valid": len(tampered) == 0,
            "total_records": len(entries),
            "total_entries": len(entries),
            "tampered_entries": tampered,
            "message": "Hash chain verified successfully; no tampering detected." if len(tampered) == 0 else f"Detected {len(tampered)} tampered entries!"
        }


audit_service = AuditService()

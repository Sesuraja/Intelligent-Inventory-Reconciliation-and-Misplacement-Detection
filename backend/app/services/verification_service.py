from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.models.discrepancy import Discrepancy, VerificationLog
from app.models.inventory import Inventory, InventoryMovement
from app.models.location import Shelf
from app.models.audit import AuditLog
from app.realtime.websocket_manager import ws_manager

class VerificationService:
    """
    Manages human verification workflow and captures physical ground truth.
    Converts operator actions into labeled training samples and maintains audit trails.
    """

    @classmethod
    async def record_verification(
        cls,
        db: Session,
        discrepancy_id: int,
        verification_result: str,
        actual_shelf_id: Optional[int],
        verified_by_name: str = "Warehouse Operator",
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        
        discrepancy = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
        if not discrepancy:
            raise ValueError(f"Discrepancy ID {discrepancy_id} not found")

        item = db.query(Inventory).filter(Inventory.epc == discrepancy.epc).first()
        before_shelf_id = item.expected_location_id if item else None

        # Create verification log
        log = VerificationLog(
            discrepancy_id=discrepancy.id,
            epc=discrepancy.epc,
            actual_location_id=actual_shelf_id or discrepancy.observed_location_id or before_shelf_id,
            verified_by_name=verified_by_name,
            verification_result=verification_result,
            before_location_id=before_shelf_id,
            after_location_id=actual_shelf_id or before_shelf_id,
            notes=notes,
            timestamp=now
        )
        db.add(log)

        # Update discrepancy status
        discrepancy.status = "VERIFIED"

        # Apply appropriate inventory adjustment based on physical confirmation
        if item:
            if verification_result == "CONFIRMED_MISPLACED" and actual_shelf_id:
                # Operator confirms item is at new shelf; record authorized movement and update location
                movement = InventoryMovement(
                    epc=item.epc,
                    from_shelf_id=item.expected_location_id,
                    to_shelf_id=actual_shelf_id,
                    movement_type="RECONCILED",
                    authorized=1,
                    authorized_by=verified_by_name,
                    notes=f"Physical verification confirmed misplacement. Relocated per audit {discrepancy.id}. Notes: {notes}",
                    timestamp=now
                )
                db.add(movement)
                item.expected_location_id = actual_shelf_id
                item.observed_location_id = actual_shelf_id
                item.status = "VERIFIED"
                discrepancy.status = "RESOLVED"
                discrepancy.resolved_at = now

            elif verification_result == "CONFIRMED_PRESENT":
                # False alarm confirmed; item is in expected location
                item.status = "VERIFIED"
                item.observed_location_id = item.expected_location_id
                discrepancy.status = "RESOLVED"
                discrepancy.resolved_at = now

            elif verification_result == "CONFIRMED_MISSED_READ":
                # Item present but RF missed read (shadowing/orientation)
                item.status = "VERIFIED"
                item.observed_location_id = item.expected_location_id
                discrepancy.status = "RESOLVED"
                discrepancy.resolved_at = now

            elif verification_result == "CONFIRMED_MISSING":
                # Confirmed physical loss / shrinkage
                item.status = "LIKELY_MISSING"
                discrepancy.status = "RESOLVED"
                discrepancy.resolved_at = now

        # Audit log
        audit = AuditLog(
            action="VERIFY_DISCREPANCY",
            entity="DISCREPANCY",
            entity_id=str(discrepancy.id),
            details={
                "epc": discrepancy.epc,
                "result": verification_result,
                "verified_by": verified_by_name,
                "notes": notes
            },
            timestamp=now
        )
        db.add(audit)
        db.commit()

        await ws_manager.broadcast("ai-alerts", {
            "type": "EXCEPTION_VERIFIED",
            "discrepancy_id": discrepancy.id,
            "epc": discrepancy.epc,
            "status": discrepancy.status,
            "result": verification_result
        })

        return {
            "success": True,
            "discrepancy_id": discrepancy.id,
            "status": discrepancy.status,
            "result": verification_result,
            "timestamp": now.isoformat()
        }

    @classmethod
    async def resolve_exception(
        cls,
        db: Session,
        discrepancy_id: int,
        resolution_action: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        discrepancy = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
        if not discrepancy:
            raise ValueError(f"Discrepancy ID {discrepancy_id} not found")

        discrepancy.status = "RESOLVED"
        discrepancy.resolved_at = now

        item = db.query(Inventory).filter(Inventory.epc == discrepancy.epc).first()
        if item and resolution_action == "UPDATE_WMS_LOCATION" and discrepancy.observed_location_id:
            item.expected_location_id = discrepancy.observed_location_id
            item.status = "IN_PLACE"

        db.commit()

        await ws_manager.broadcast("ai-alerts", {
            "type": "EXCEPTION_RESOLVED",
            "discrepancy_id": discrepancy.id,
            "epc": discrepancy.epc,
            "action": resolution_action
        })

        return {"success": True, "discrepancy_id": discrepancy.id, "status": "RESOLVED"}


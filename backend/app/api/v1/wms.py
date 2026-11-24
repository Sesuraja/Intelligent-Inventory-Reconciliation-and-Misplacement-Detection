import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.wms import WMSInventory, WMSOrder, WMSOrderLine, WMSTransaction
from app.models.inventory import Inventory, InventoryMovement
from app.models.product import Product
from app.models.rfid_tag import RFIDTag
from app.models.location import Shelf
from app.models.discrepancy import Discrepancy
from app.models.audit import AuditLog
from app.rfid.reader_manager import reader_manager
from app.schemas.wms import (
    WMSInventoryResponse,
    WMSReceiveRequest,
    WMSPutawayRequest,
    WMSMoveRequest,
    WMSPickRequest,
    WMSShipRequest,
    WMSAdjustRequest,
    WMSInjectErrorRequest,
    WMSTransactionResponse,
)
from app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="/wms", tags=["WMS Sandbox"])


@router.get("/inventory", response_model=List[WMSInventoryResponse])
def get_wms_inventory(
    status: Optional[str] = Query(None),
    shelf: Optional[str] = Query(None),
    sku: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve all expected warehouse inventory items managed by the WMS sandbox."""
    query = db.query(WMSInventory)
    if status and status != "ALL":
        query = query.filter(WMSInventory.status == status)
    if sku:
        query = query.filter(WMSInventory.sku == sku)

    items = query.order_by(WMSInventory.id.asc()).all()
    results = []
    for it in items:
        sh_code = it.expected_shelf.shelf_code if it.expected_shelf else "UNKNOWN"
        if shelf and shelf != "ALL" and sh_code != shelf:
            continue
        p = it.product
        results.append(WMSInventoryResponse(
            id=it.id,
            epc=it.epc,
            sku=it.sku,
            product_name=p.name if p else "Unknown Product",
            category=p.category if p else "General",
            expected_shelf_code=sh_code,
            quantity=it.quantity,
            lot_number=it.lot_number,
            status=it.status,
            updated_at=it.updated_at or datetime.now(timezone.utc)
        ))
    return results


@router.post("/receive")
async def receive_inbound_goods(payload: WMSReceiveRequest, db: Session = Depends(get_db)):
    """Inbound receipt of new products into WMS receiving dock/staging shelf."""
    now = datetime.now(timezone.utc)
    shelf = db.query(Shelf).filter(Shelf.shelf_code == payload.target_shelf_code).first()
    if not shelf:
        raise HTTPException(status_code=400, detail=f"Shelf '{payload.target_shelf_code}' not found")

    prod = db.query(Product).filter(Product.sku == payload.sku).first()
    if not prod:
        prod = Product(
            sku=payload.sku,
            name=f"Inbound Goods {payload.sku}",
            category="Inbound",
            unit="piece",
            min_stock=5
        )
        db.add(prod)
        db.flush()

    received_items = []
    for i in range(payload.quantity):
        epc = f"{payload.epc_prefix}-{uuid.uuid4().hex[:6].upper()}"
        
        # Create tag if needed
        tag = db.query(RFIDTag).filter(RFIDTag.epc == epc).first()
        if not tag:
            tag = RFIDTag(epc=epc, product_id=prod.id, packaging_class="CARDBOARD", status="ACTIVE")
            db.add(tag)
            db.flush()

        # Add to WMS Inventory
        wms_item = WMSInventory(
            epc=epc,
            sku=payload.sku,
            product_id=prod.id,
            expected_shelf_id=shelf.id,
            quantity=1,
            lot_number=payload.lot_number or "LOT-2026-INBOUND",
            status="AVAILABLE",
            updated_at=now
        )
        db.add(wms_item)

        # Mirror in physical inventory table
        inv = Inventory(
            epc=epc,
            product_id=prod.id,
            expected_location_id=shelf.id,
            observed_location_id=shelf.id,
            status="IN_PLACE",
            confidence=1.0,
            last_reconciled_at=now,
            last_observed_at=now
        )
        db.add(inv)

        # Record movement
        db.add(InventoryMovement(
            epc=epc,
            from_shelf_id=None,
            to_shelf_id=shelf.id,
            movement_type="RECEIPT",
            authorized=1,
            authorized_by=payload.user_name or "WMS_OPERATOR",
            notes=f"Inbound receipt of {payload.sku}",
            timestamp=now
        ))

        # Record WMS transaction
        db.add(WMSTransaction(
            transaction_type="RECEIPT",
            epc=epc,
            sku=payload.sku,
            to_shelf_id=shelf.id,
            quantity=1,
            user_name=payload.user_name or "WMS_OPERATOR",
            reference_code=payload.lot_number,
            notes=f"Inbound receiving at {payload.target_shelf_code}",
            timestamp=now
        ))

        received_items.append(epc)

    db.commit()

    return {
        "success": True,
        "sku": payload.sku,
        "quantity_received": payload.quantity,
        "target_shelf": payload.target_shelf_code,
        "epcs": received_items
    }


@router.post("/putaway")
async def putaway_goods(payload: WMSPutawayRequest, db: Session = Depends(get_db)):
    """Move received items from staging dock to assigned storage location."""
    now = datetime.now(timezone.utc)
    target_shelf = db.query(Shelf).filter(Shelf.shelf_code == payload.to_shelf_code).first()
    if not target_shelf:
        raise HTTPException(status_code=400, detail=f"Target shelf '{payload.to_shelf_code}' not found")

    wms_item = db.query(WMSInventory).filter(WMSInventory.epc == payload.epc).first()
    if not wms_item:
        raise HTTPException(status_code=404, detail=f"WMS inventory record for EPC '{payload.epc}' not found")

    from_shelf_id = wms_item.expected_shelf_id
    wms_item.expected_shelf_id = target_shelf.id
    wms_item.updated_at = now

    # Also update physical system's expected location
    inv = db.query(Inventory).filter(Inventory.epc == payload.epc).first()
    if inv:
        inv.expected_location_id = target_shelf.id
        inv.observed_location_id = target_shelf.id
        inv.status = "IN_PLACE"

    # Log WMS transaction
    db.add(WMSTransaction(
        transaction_type="PUTAWAY",
        epc=payload.epc,
        sku=wms_item.sku,
        from_shelf_id=from_shelf_id,
        to_shelf_id=target_shelf.id,
        quantity=wms_item.quantity,
        user_name=payload.user_name or "WMS_OPERATOR",
        notes=payload.notes or "Putaway completed",
        timestamp=now
    ))

    # Log InventoryMovement
    db.add(InventoryMovement(
        epc=payload.epc,
        from_shelf_id=from_shelf_id,
        to_shelf_id=target_shelf.id,
        movement_type="AUTHORIZED_MOVE",
        authorized=1,
        authorized_by=payload.user_name or "WMS_OPERATOR",
        notes=payload.notes or "Putaway completed",
        timestamp=now
    ))

    db.commit()

    return {
        "success": True,
        "epc": payload.epc,
        "new_location": payload.to_shelf_code,
        "transaction": "PUTAWAY"
    }


@router.post("/move")
async def authorized_internal_transfer(payload: WMSMoveRequest, db: Session = Depends(get_db)):
    """Authorized internal warehouse move between shelves with full WMS transaction log."""
    now = datetime.now(timezone.utc)
    target_shelf = db.query(Shelf).filter(Shelf.shelf_code == payload.to_shelf_code).first()
    if not target_shelf:
        raise HTTPException(status_code=400, detail=f"Target shelf '{payload.to_shelf_code}' not found")

    wms_item = db.query(WMSInventory).filter(WMSInventory.epc == payload.epc).first()
    if not wms_item:
        raise HTTPException(status_code=404, detail=f"WMS inventory record for EPC '{payload.epc}' not found")

    from_shelf_id = wms_item.expected_shelf_id
    wms_item.expected_shelf_id = target_shelf.id
    wms_item.updated_at = now

    inv = db.query(Inventory).filter(Inventory.epc == payload.epc).first()
    if inv:
        inv.expected_location_id = target_shelf.id
        inv.observed_location_id = target_shelf.id
        inv.status = "IN_PLACE"

    db.add(WMSTransaction(
        transaction_type="MOVE",
        epc=payload.epc,
        sku=wms_item.sku,
        from_shelf_id=from_shelf_id,
        to_shelf_id=target_shelf.id,
        quantity=wms_item.quantity,
        user_name=payload.user_name or "WMS_OPERATOR",
        notes=payload.reason or "Authorized internal transfer",
        timestamp=now
    ))

    db.add(InventoryMovement(
        epc=payload.epc,
        from_shelf_id=from_shelf_id,
        to_shelf_id=target_shelf.id,
        movement_type="AUTHORIZED_MOVE",
        authorized=1,
        authorized_by=payload.user_name or "WMS_OPERATOR",
        notes=payload.reason or "Authorized internal transfer",
        timestamp=now
    ))

    db.commit()

    return {
        "success": True,
        "epc": payload.epc,
        "new_location": payload.to_shelf_code,
        "transaction": "MOVE"
    }


@router.post("/pick")
async def pick_goods(payload: WMSPickRequest, db: Session = Depends(get_db)):
    """Pick item from shelf for outbound fulfillment order."""
    now = datetime.now(timezone.utc)
    query = db.query(WMSInventory)
    if payload.epc:
        query = query.filter(WMSInventory.epc == payload.epc)
    elif payload.sku:
        query = query.filter(WMSInventory.sku == payload.sku, WMSInventory.status == "AVAILABLE")
    
    item = query.first()
    if not item:
        raise HTTPException(status_code=404, detail="Available item for picking not found")

    item.status = "ALLOCATED"
    item.updated_at = now

    db.add(WMSTransaction(
        transaction_type="PICK",
        epc=item.epc,
        sku=item.sku,
        from_shelf_id=item.expected_shelf_id,
        quantity=1,
        user_name=payload.user_name or "WMS_PICKER",
        reference_code=payload.order_number,
        notes=f"Picked for order {payload.order_number or 'DIRECT'}",
        timestamp=now
    ))

    db.commit()

    return {
        "success": True,
        "epc": item.epc,
        "sku": item.sku,
        "status": item.status,
        "order": payload.order_number
    }


@router.post("/ship")
async def ship_goods(payload: WMSShipRequest, db: Session = Depends(get_db)):
    """Ship picked item out of the facility, marking it dispatched."""
    now = datetime.now(timezone.utc)
    if not payload.epc:
        raise HTTPException(status_code=400, detail="EPC must be provided for shipment")

    item = db.query(WMSInventory).filter(WMSInventory.epc == payload.epc).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"WMS inventory for '{payload.epc}' not found")

    item.status = "SHIPPED"
    item.updated_at = now

    inv = db.query(Inventory).filter(Inventory.epc == payload.epc).first()
    if inv:
        inv.status = "SHIPPED"

    db.add(WMSTransaction(
        transaction_type="SHIP",
        epc=item.epc,
        sku=item.sku,
        from_shelf_id=item.expected_shelf_id,
        quantity=1,
        user_name=payload.user_name or "WMS_SHIPPER",
        reference_code=payload.order_number,
        notes="Dispatched on outbound carrier",
        timestamp=now
    ))

    db.commit()

    return {
        "success": True,
        "epc": item.epc,
        "status": "SHIPPED"
    }


@router.post("/adjust")
async def cycle_count_adjustment(payload: WMSAdjustRequest, db: Session = Depends(get_db)):
    """Manual cycle-count or administrative inventory adjustment in WMS."""
    now = datetime.now(timezone.utc)
    item = db.query(WMSInventory).filter(WMSInventory.epc == payload.epc).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"WMS item '{payload.epc}' not found")

    target_shelf = None
    if payload.new_shelf_code:
        target_shelf = db.query(Shelf).filter(Shelf.shelf_code == payload.new_shelf_code).first()
        if not target_shelf:
            raise HTTPException(status_code=400, detail=f"Shelf '{payload.new_shelf_code}' not found")

    from_id = item.expected_shelf_id
    if target_shelf:
        item.expected_shelf_id = target_shelf.id
    if payload.quantity is not None:
        item.quantity = payload.quantity
    item.updated_at = now

    db.add(WMSTransaction(
        transaction_type="ADJUST",
        epc=item.epc,
        sku=item.sku,
        from_shelf_id=from_id,
        to_shelf_id=target_shelf.id if target_shelf else from_id,
        quantity=payload.quantity or item.quantity,
        user_name=payload.user_name or "CYCLE_COUNTER",
        notes=payload.reason,
        timestamp=now
    ))

    db.commit()

    return {
        "success": True,
        "epc": item.epc,
        "new_location": payload.new_shelf_code,
        "quantity": item.quantity,
        "reason": payload.reason
    }


@router.post("/sync")
async def sync_wms_to_reconciliation(db: Session = Depends(get_db)):
    """
    Re-sync expected state: aligns physical inventory 'expected_location_id'
    with authoritative WMS sandbox 'wms_inventory.expected_shelf_id'.
    """
    now = datetime.now(timezone.utc)
    wms_items = db.query(WMSInventory).all()
    synced_count = 0

    for wms in wms_items:
        inv = db.query(Inventory).filter(Inventory.epc == wms.epc).first()
        if inv and inv.expected_location_id != wms.expected_shelf_id:
            inv.expected_location_id = wms.expected_shelf_id
            synced_count += 1

    db.add(AuditLog(
        action="WMS_SYNC",
        entity="WMS_INVENTORY",
        details={"synced_records": synced_count},
        timestamp=now
    ))
    db.commit()

    return {
        "success": True,
        "records_synchronized": synced_count,
        "total_wms_items": len(wms_items)
    }


@router.post("/inject-error")
async def inject_test_discrepancy(payload: WMSInjectErrorRequest, db: Session = Depends(get_db)):
    """
    Inject intentional inventory anomaly/discrepancy to test autonomous reconciliation & AI diagnostics.
    Supported types:
    - MISPLACE: Physically moves tag to a different shelf without WMS knowing
    - WMS_DESYNC: Updates WMS expected location without physically moving the item
    - SHRINKAGE: Removes tag from physical RF field without WMS knowledge (causes LIKELY_MISSING)
    - SHADOW: Marks tag as RF-shielded/shadowed (tests read-reliability model)
    """
    now = datetime.now(timezone.utc)
    epc = payload.epc
    if not epc:
        # Default to an active item
        item = db.query(Inventory).filter(Inventory.status == "IN_PLACE").first()
        if not item:
            item = db.query(Inventory).first()
        epc = item.epc if item else "30341ADB10521280257A10A9"

    inv_item = db.query(Inventory).filter(Inventory.epc == epc).first()
    wms_item = db.query(WMSInventory).filter(WMSInventory.epc == epc).first()

    target_shelf = payload.target_shelf_code or "SHELF_C"
    target_obj = db.query(Shelf).filter(Shelf.shelf_code == target_shelf).first()

    report = {"error_type": payload.error_type, "epc": epc}

    if payload.error_type == "MISPLACE":
        # Record an unauthorized movement log to feed root-cause model
        db.add(InventoryMovement(
            epc=epc,
            from_shelf_id=inv_item.expected_location_id if inv_item else None,
            to_shelf_id=target_obj.id if target_obj else None,
            movement_type="TRANSFER",
            authorized=0,
            authorized_by="Unknown Forklift Operator",
            notes="Injected error: Unauthorized physical transfer without scanning barcode",
            timestamp=now
        ))
        db.commit()
        report["message"] = f"Tag {epc} movement logged to {target_shelf}. WMS still expects it at {inv_item.expected_shelf.shelf_code if inv_item and inv_item.expected_shelf else 'original shelf'}."

    elif payload.error_type == "WMS_DESYNC":
        # Change WMS expected shelf without physically moving item
        if wms_item and target_obj:
            wms_item.expected_shelf_id = target_obj.id
            db.commit()
        report["message"] = f"WMS expected shelf updated to {target_shelf}, but physical tag {epc} was NOT moved."

    elif payload.error_type == "SHRINKAGE":
        report["message"] = f"Tag {epc} marked for shrinkage audit."

    elif payload.error_type == "SHADOW":
        report["message"] = f"Tag {epc} flagged as potentially RF-shadowed."

    db.add(AuditLog(
        action="INJECT_TEST_ERROR",
        entity="WMS_SANDBOX",
        entity_id=epc,
        details=report,
        timestamp=now
    ))
    db.commit()

    return {
        "success": True,
        "injection_report": report,
        "recommended_next_step": "Trigger automated reconciliation cycle via POST /api/v1/reconciliation/run to observe AI detecting the anomaly."
    }


@router.get("/transactions", response_model=List[WMSTransactionResponse])
def get_wms_transactions(
    limit: int = Query(50, le=200),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve historical WMS transactions (Receipts, Putaways, Moves, Picks, Ships, Adjustments)."""
    query = db.query(WMSTransaction)
    if type and type != "ALL":
        query = query.filter(WMSTransaction.transaction_type == type)

    records = query.order_by(WMSTransaction.id.desc()).limit(limit).all()
    results = []
    shelves_by_id = {s.id: s.shelf_code for s in db.query(Shelf).all()}

    for r in records:
        results.append(WMSTransactionResponse(
            id=r.id,
            transaction_type=r.transaction_type,
            epc=r.epc,
            sku=r.sku,
            from_shelf_code=shelves_by_id.get(r.from_shelf_id),
            to_shelf_code=shelves_by_id.get(r.to_shelf_id),
            quantity=r.quantity,
            user_name=r.user_name,
            reference_code=r.reference_code,
            notes=r.notes,
            is_reversed=r.is_reversed or False,
            reversal_of_transaction_id=r.reversal_of_transaction_id,
            approval_status=r.approval_status or "AUTO_APPROVED",
            approved_by=r.approved_by,
            approved_at=r.approved_at,
            timestamp=r.timestamp or datetime.now(timezone.utc)
        ))
    return results


@router.post("/transactions/{id}/reverse")
async def reverse_wms_transaction(
    id: int,
    user_name: Optional[str] = Query("Supervisor"),
    reason: Optional[str] = Query("Manual rollback of incorrect transaction"),
    db: Session = Depends(get_db)
):
    """
    Rolls back an inventory movement or adjustment transaction, creating an immutable
    audit trail compensation record and restoring previous expected shelf locations.
    """
    now = datetime.now(timezone.utc)
    tx = db.query(WMSTransaction).filter(WMSTransaction.id == id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.is_reversed:
        raise HTTPException(status_code=400, detail="Transaction has already been reversed")

    # Mark original transaction as reversed
    tx.is_reversed = True

    # Reverse physical and WMS expected shelves if an EPC is associated
    if tx.epc and tx.from_shelf_id:
        wms_item = db.query(WMSInventory).filter(WMSInventory.epc == tx.epc).first()
        if wms_item:
            wms_item.expected_shelf_id = tx.from_shelf_id
            wms_item.updated_at = now

        inv_item = db.query(Inventory).filter(Inventory.epc == tx.epc).first()
        if inv_item:
            inv_item.expected_location_id = tx.from_shelf_id
            inv_item.last_reconciled_at = now

    # Create compensating reversal transaction record
    reversal_tx = WMSTransaction(
        transaction_type=f"REVERSAL_{tx.transaction_type}",
        epc=tx.epc,
        sku=tx.sku,
        from_shelf_id=tx.to_shelf_id,
        to_shelf_id=tx.from_shelf_id,
        quantity=tx.quantity,
        user_name=user_name,
        reference_code=f"REV-TX-{tx.id}",
        notes=f"Reversal of TX #{tx.id}: {reason}",
        is_reversed=False,
        reversal_of_transaction_id=tx.id,
        approval_status="APPROVED",
        approved_by=user_name,
        approved_at=now,
        timestamp=now
    )
    db.add(reversal_tx)

    # Add audit log
    db.add(AuditLog(
        action="TRANSACTION_REVERSED",
        entity="WMS_TRANSACTION",
        entity_id=str(tx.id),
        details={
            "reversed_transaction_id": tx.id,
            "reversal_tx_type": reversal_tx.transaction_type,
            "epc": tx.epc,
            "restored_shelf_id": tx.from_shelf_id,
            "operator": user_name,
            "reason": reason
        },
        timestamp=now
    ))
    db.commit()

    return {
        "success": True,
        "message": f"Transaction #{id} ({tx.transaction_type}) successfully rolled back.",
        "reversal_transaction_id": reversal_tx.id,
        "restored_shelf_id": tx.from_shelf_id
    }


@router.post("/reconcile/approve")
async def approve_wms_reconciliation(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Supervisor approval workflow for high-value or uncertain inventory reconciliations.
    Updates official WMS records only when authorized by warehouse policy.
    """
    now = datetime.now(timezone.utc)
    epc = payload.get("epc")
    new_shelf_code = payload.get("new_shelf_code") or payload.get("approved_shelf_code")
    approver = payload.get("approver") or payload.get("supervisor_name") or "Warehouse Supervisor"
    notes = payload.get("notes", "Approved inventory re-alignment")

    if not epc or not new_shelf_code:
        raise HTTPException(status_code=400, detail="EPC and new_shelf_code are required")

    shelf = db.query(Shelf).filter(Shelf.shelf_code == new_shelf_code).first()
    if not shelf:
        raise HTTPException(status_code=404, detail=f"Shelf '{new_shelf_code}' not found")

    wms_item = db.query(WMSInventory).filter(WMSInventory.epc == epc).first()
    if not wms_item:
        raise HTTPException(status_code=404, detail=f"EPC '{epc}' not found in WMS catalog")

    old_shelf_id = wms_item.expected_shelf_id
    wms_item.expected_shelf_id = shelf.id
    wms_item.updated_at = now

    inv_item = db.query(Inventory).filter(Inventory.epc == epc).first()
    if inv_item:
        inv_item.expected_location_id = shelf.id
        inv_item.status = "IN_PLACE"
        inv_item.last_reconciled_at = now

    # Record approved WMS transaction
    tx = WMSTransaction(
        transaction_type="RECONCILED_APPROVED",
        epc=epc,
        sku=wms_item.sku,
        from_shelf_id=old_shelf_id,
        to_shelf_id=shelf.id,
        quantity=wms_item.quantity,
        user_name=approver,
        reference_code=f"REC-APP-{epc}",
        notes=notes,
        is_reversed=False,
        approval_status="APPROVED",
        approved_by=approver,
        approved_at=now,
        timestamp=now
    )
    db.add(tx)

    # Resolve any pending discrepancy
    discs = db.query(Discrepancy).filter(
        Discrepancy.epc == epc,
        Discrepancy.status.in_(["NEW", "AI_ANALYZED", "PENDING_VERIFICATION"])
    ).all()
    for d in discs:
        d.status = "RESOLVED"
        d.resolved_at = now

    db.commit()

    return {
        "success": True,
        "approved": True,
        "message": f"Reconciliation for tag {epc} approved and officially synchronized.",
        "transaction_id": tx.id,
        "approved_by": approver,
        "new_shelf_code": new_shelf_code
    }

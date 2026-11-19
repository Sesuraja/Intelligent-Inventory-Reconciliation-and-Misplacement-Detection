import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.wms import WMSInventory, WMSOrder, WMSOrderLine, WMSTransaction
from app.models.inventory import Inventory, InventoryMovement
from app.models.product import Product
from app.models.rfid_tag import RFIDTag
from app.models.location import Shelf
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
            unit_cost=100.0,
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

    # Sync into simulator
    sim = reader_manager.get_simulator()
    for epc in received_items:
        sim.register_simulated_tag(
            epc=epc,
            physical_shelf=payload.target_shelf_code,
            is_present=True,
            is_shadowed=False,
            packaging="CARDBOARD"
        )

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

    # Update simulator position
    sim = reader_manager.get_simulator()
    if payload.epc in sim.tags:
        sim.tags[payload.epc]["physical_shelf"] = payload.to_shelf_code

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

    # Update simulator physical location as well
    sim = reader_manager.get_simulator()
    if payload.epc in sim.tags:
        sim.tags[payload.epc]["physical_shelf"] = payload.to_shelf_code

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

    # Remove from simulator active RF field
    sim = reader_manager.get_simulator()
    if payload.epc in sim.tags:
        sim.tags[payload.epc]["is_present"] = False

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
        epc = item.epc if item else "EPC-9001"

    inv_item = db.query(Inventory).filter(Inventory.epc == epc).first()
    wms_item = db.query(WMSInventory).filter(WMSInventory.epc == epc).first()
    sim = reader_manager.get_simulator()

    target_shelf = payload.target_shelf_code or "SHELF_C"
    target_obj = db.query(Shelf).filter(Shelf.shelf_code == target_shelf).first()

    report = {"error_type": payload.error_type, "epc": epc}

    if payload.error_type == "MISPLACE":
        # Physically move tag to target shelf in simulator without updating WMS
        sim.move_tag(epc, target_shelf)
        # Also record an unauthorized movement log to feed root-cause model
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
        report["message"] = f"Tag {epc} physically moved to {target_shelf}. WMS still expects it at {inv_item.expected_shelf.shelf_code if inv_item and inv_item.expected_shelf else 'original shelf'}."

    elif payload.error_type == "WMS_DESYNC":
        # Change WMS expected shelf without physically moving item
        if wms_item and target_obj:
            wms_item.expected_shelf_id = target_obj.id
            db.commit()
        report["message"] = f"WMS expected shelf updated to {target_shelf}, but physical tag {epc} was NOT moved."

    elif payload.error_type == "SHRINKAGE":
        # Physical shrinkage / theft: tag stops appearing in RF field
        sim.set_tag_presence(epc, False)
        report["message"] = f"Tag {epc} removed from RF field. Physical reader will observe 0 reads."

    elif payload.error_type == "SHADOW":
        # Shadowing: tag present but obscured by metal/liquid
        sim.set_tag_shadowed(epc, True)
        report["message"] = f"Tag {epc} marked as RF-shadowed. Antenna signals will attenuate significantly."

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
            timestamp=r.timestamp or datetime.now(timezone.utc)
        ))
    return results

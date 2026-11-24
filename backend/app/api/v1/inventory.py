from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.inventory import Inventory, InventoryMovement
from app.models.product import Product
from app.models.rfid_tag import RFIDTag, TagAssignmentHistory
from app.models.location import Shelf
from app.models.discrepancy import Discrepancy
from app.schemas.inventory import (
    InventoryResponse, InventoryCreate,
    ProductResponse, ProductCreate,
    RFIDTagResponse, RFIDTagCreate,
    InventoryMovementResponse, InventoryMovementCreate,
    AssignTagRequest, TagRetireRequest, TagHistoryResponse
)
from app.rfid.reader_manager import reader_manager

router = APIRouter(tags=["Inventory"])

@router.get("/inventory", response_model=List[InventoryResponse])
def get_inventory(
    status: Optional[str] = Query(None),
    shelf: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Inventory).options(
        joinedload(Inventory.product),
        joinedload(Inventory.expected_shelf),
        joinedload(Inventory.observed_shelf)
    )
    if status:
        query = query.filter(Inventory.status == status)
    if shelf:
        query = query.join(Shelf, Inventory.expected_location_id == Shelf.id).filter(Shelf.shelf_code == shelf)
    
    items = query.all()

    # Pre-fetch active discrepancies in 1 query to avoid N+1 queries
    active_discs = db.query(Discrepancy).filter(
        Discrepancy.status.in_(["NEW", "AI_ANALYZED", "PENDING_VERIFICATION", "ASSIGNED"])
    ).all()
    disc_map = {d.epc: d.id for d in active_discs}

    results = []
    for item in items:
        prod = item.product
        if not prod:
            continue
        if search:
            s_lower = search.lower()
            if (s_lower not in item.epc.lower()) and (s_lower not in prod.name.lower()) and (s_lower not in prod.sku.lower()):
                continue

        results.append(InventoryResponse(
            id=item.id,
            epc=item.epc,
            product_id=prod.id,
            product_name=prod.name,
            product_sku=prod.sku,
            category=prod.category,
            expected_location_id=item.expected_location_id,
            expected_shelf_code=item.expected_shelf.shelf_code if item.expected_shelf else "UNKNOWN",
            observed_location_id=item.observed_location_id,
            observed_shelf_code=item.observed_shelf.shelf_code if item.observed_shelf else None,
            status=item.status,
            confidence=item.confidence,
            last_reconciled_at=item.last_reconciled_at,
            last_observed_at=item.last_observed_at,
            discrepancy_id=disc_map.get(item.epc)
        ))
    return results

@router.get("/inventory/{id}", response_model=InventoryResponse)
def get_inventory_item(id: int, db: Session = Depends(get_db)):
    item = db.query(Inventory).filter(Inventory.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    prod = item.product
    disc = db.query(Discrepancy).filter(
        Discrepancy.epc == item.epc,
        Discrepancy.status.in_(["NEW", "AI_ANALYZED", "PENDING_VERIFICATION", "ASSIGNED"])
    ).first()

    return InventoryResponse(
        id=item.id,
        epc=item.epc,
        product_id=prod.id,
        product_name=prod.name,
        product_sku=prod.sku,
        category=prod.category,
        expected_location_id=item.expected_location_id,
        expected_shelf_code=item.expected_shelf.shelf_code if item.expected_shelf else "UNKNOWN",
        observed_location_id=item.observed_location_id,
        observed_shelf_code=item.observed_shelf.shelf_code if item.observed_shelf else None,
        status=item.status,
        confidence=item.confidence,
        last_reconciled_at=item.last_reconciled_at,
        last_observed_at=item.last_observed_at,
        discrepancy_id=disc.id if disc else None
    )

@router.get("/products", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@router.post("/products", response_model=ProductResponse)
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(Product).filter(Product.sku == product_in.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product with this SKU already exists")
    prod = Product(**product_in.dict())
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod

@router.get("/products/{id}", response_model=ProductResponse)
def get_product(id: int, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod

@router.patch("/products/{id}", response_model=ProductResponse)
def update_product(id: int, updates: Dict[str, Any], db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, val in updates.items():
        if hasattr(prod, key) and key != "id":
            setattr(prod, key, val)
    db.commit()
    db.refresh(prod)
    return prod

@router.delete("/products/{id}")
def delete_product(id: int, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(prod)
    db.commit()
    return {"success": True, "message": f"Product {id} deleted successfully"}

@router.post("/products/import")
def bulk_import_products(items: List[ProductCreate], db: Session = Depends(get_db)):
    """Bulk import products with SKU de-duplication."""
    imported = []
    skipped = []
    for item in items:
        if db.query(Product).filter(Product.sku == item.sku).first():
            skipped.append(item.sku)
            continue
        p = Product(**item.dict())
        db.add(p)
        imported.append(item.sku)
    db.commit()
    return {"success": True, "imported_count": len(imported), "skipped_duplicates": skipped}

@router.get("/rfid-tags", response_model=List[RFIDTagResponse])
def get_rfid_tags(db: Session = Depends(get_db)):
    tags = db.query(RFIDTag).all()
    results = []
    for t in tags:
        results.append(RFIDTagResponse(
            id=t.id,
            epc=t.epc,
            product_id=t.product_id,
            product_name=t.product.name if t.product else None,
            product_sku=t.product.sku if t.product else None,
            status=t.status,
            tag_type=t.tag_type,
            packaging_class=t.packaging_class,
            pallet_id=t.pallet_id,
            carton_id=t.carton_id,
            assigned_at=t.assigned_at,
            retired_at=t.retired_at,
            retirement_reason=t.retirement_reason
        ))
    return results

@router.get("/rfid-tags/duplicates")
def get_duplicate_tags(db: Session = Depends(get_db)):
    """
    Detects potential duplicate EPC mappings or cloned tags
    reported across disparate antennas or recorded multiple times.
    """
    dup_discrepancies = db.query(Discrepancy).filter(
        Discrepancy.discrepancy_type == "DUPLICATE_EPC",
        Discrepancy.status.in_(["NEW", "AI_ANALYZED", "PENDING_VERIFICATION"])
    ).all()
    
    tags = db.query(RFIDTag).filter(RFIDTag.status == "ACTIVE").all()
    epc_counts: Dict[str, int] = {}
    for t in tags:
        epc_counts[t.epc] = epc_counts.get(t.epc, 0) + 1
    
    multi_epcs = [epc for epc, count in epc_counts.items() if count > 1]
    
    duplicates = []
    for d in dup_discrepancies:
        duplicates.append({
            "epc": d.epc,
            "type": "CROSS_ANTENNA_DUPLICATE",
            "discrepancy_id": d.id,
            "expected_shelf": d.expected_shelf.shelf_code if d.expected_shelf else "UNKNOWN",
            "observed_shelf": d.observed_shelf.shelf_code if d.observed_shelf else "UNKNOWN",
            "detected_at": d.detected_at,
            "severity": d.severity
        })
    for epc in multi_epcs:
        duplicates.append({
            "epc": epc,
            "type": "MULTI_REGISTERED_EPC",
            "discrepancy_id": None,
            "expected_shelf": "MULTI",
            "observed_shelf": "MULTI",
            "detected_at": datetime.now(timezone.utc),
            "severity": "CRITICAL"
        })
    return duplicates

@router.post("/rfid-tags", response_model=RFIDTagResponse)
def register_rfid_tag(tag_in: RFIDTagCreate, db: Session = Depends(get_db)):
    existing = db.query(RFIDTag).filter(RFIDTag.epc == tag_in.epc).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag EPC already registered")
    tag = RFIDTag(**tag_in.dict())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return RFIDTagResponse(
        id=tag.id,
        epc=tag.epc,
        product_id=tag.product_id,
        product_name=tag.product.name if tag.product else None,
        product_sku=tag.product.sku if tag.product else None,
        status=tag.status,
        tag_type=tag.tag_type,
        packaging_class=tag.packaging_class,
        pallet_id=tag.pallet_id,
        carton_id=tag.carton_id,
        assigned_at=tag.assigned_at,
        retired_at=tag.retired_at,
        retirement_reason=tag.retirement_reason
    )

@router.get("/rfid-tags/{id}", response_model=RFIDTagResponse)
def get_rfid_tag_by_id(id: int, db: Session = Depends(get_db)):
    tag = db.query(RFIDTag).filter(RFIDTag.id == id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return RFIDTagResponse(
        id=tag.id,
        epc=tag.epc,
        product_id=tag.product_id,
        product_name=tag.product.name if tag.product else None,
        product_sku=tag.product.sku if tag.product else None,
        status=tag.status,
        tag_type=tag.tag_type,
        packaging_class=tag.packaging_class,
        pallet_id=tag.pallet_id,
        carton_id=tag.carton_id,
        assigned_at=tag.assigned_at,
        retired_at=tag.retired_at,
        retirement_reason=tag.retirement_reason
    )

@router.patch("/rfid-tags/{id}", response_model=RFIDTagResponse)
def update_rfid_tag(id: int, updates: Dict[str, Any], db: Session = Depends(get_db)):
    tag = db.query(RFIDTag).filter(RFIDTag.id == id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    for key, val in updates.items():
        if hasattr(tag, key) and key != "id":
            setattr(tag, key, val)
    db.commit()
    db.refresh(tag)
    return RFIDTagResponse(
        id=tag.id,
        epc=tag.epc,
        product_id=tag.product_id,
        product_name=tag.product.name if tag.product else None,
        product_sku=tag.product.sku if tag.product else None,
        status=tag.status,
        tag_type=tag.tag_type,
        packaging_class=tag.packaging_class,
        pallet_id=tag.pallet_id,
        carton_id=tag.carton_id,
        assigned_at=tag.assigned_at,
        retired_at=tag.retired_at,
        retirement_reason=tag.retirement_reason
    )

@router.post("/rfid-tags/{epc}/retire")
def retire_rfid_tag(epc: str, req: TagRetireRequest, db: Session = Depends(get_db)):
    """
    Retires an EPC tag due to damage, wear, or packaging decommissioning.
    Marks tag as RETIRED, records audit history, and unlinks from active inventory.
    """
    clean_epc = epc.strip().upper()
    tag = db.query(RFIDTag).filter(RFIDTag.epc == clean_epc).first()
    if not tag:
        raise HTTPException(status_code=404, detail=f"RFID Tag with EPC {epc} not found")
    
    tag.status = "RETIRED"
    tag.retired_at = datetime.now(timezone.utc)
    tag.retirement_reason = req.reason

    # Record history
    history = TagAssignmentHistory(
        epc=tag.epc,
        previous_product_id=tag.product_id,
        new_product_id=tag.product_id,
        pallet_id=tag.pallet_id,
        carton_id=tag.carton_id,
        assigned_by=req.retired_by,
        reason=f"RETIREMENT: {req.reason}",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(history)

    # Update associated inventory record if active
    inv = db.query(Inventory).filter(Inventory.epc == tag.epc).first()
    if inv:
        inv.status = "RETIRED"
        inv.confidence = 0.0

    db.commit()
    return {
        "success": True,
        "epc": tag.epc,
        "status": tag.status,
        "retired_at": tag.retired_at,
        "retirement_reason": tag.retirement_reason,
        "message": f"Tag {tag.epc} has been safely retired."
    }

@router.get("/rfid-tags/{epc}/history", response_model=List[TagHistoryResponse])
def get_tag_history(epc: str, db: Session = Depends(get_db)):
    """Returns lifecycle assignment, pallet/carton associations, and transfer history for an EPC."""
    clean_epc = epc.strip().upper()
    histories = db.query(TagAssignmentHistory).filter(TagAssignmentHistory.epc == clean_epc).order_by(TagAssignmentHistory.timestamp.desc()).all()
    
    results = []
    for h in histories:
        results.append(TagHistoryResponse(
            id=h.id,
            epc=h.epc,
            previous_product_name=h.previous_product.name if h.previous_product else None,
            new_product_name=h.new_product.name if h.new_product else "UNKNOWN",
            pallet_id=h.pallet_id,
            carton_id=h.carton_id,
            assigned_by=h.assigned_by,
            reason=h.reason,
            timestamp=h.timestamp
        ))
    return results

@router.get("/inventory/movements", response_model=List[InventoryMovementResponse])
def get_inventory_movements_alias(limit: int = 50, db: Session = Depends(get_db)):
    """SRS-compliant alias for /inventory/movements."""
    return get_movements(limit=limit, db=db)

@router.get("/movements", response_model=List[InventoryMovementResponse])
def get_movements(limit: int = 50, db: Session = Depends(get_db)):
    movs = db.query(InventoryMovement).order_by(InventoryMovement.timestamp.desc()).limit(limit).all()
    results = []
    for m in movs:
        results.append(InventoryMovementResponse(
            id=m.id,
            epc=m.epc,
            from_shelf_code=m.from_shelf.shelf_code if m.from_shelf else None,
            to_shelf_code=m.to_shelf.shelf_code if m.to_shelf else "UNKNOWN",
            movement_type=m.movement_type,
            authorized=m.authorized,
            authorized_by=m.authorized_by,
            notes=m.notes,
            timestamp=m.timestamp
        ))
    return results

@router.post("/movements", response_model=InventoryMovementResponse)
def record_movement(movement_in: InventoryMovementCreate, db: Session = Depends(get_db)):
    item = db.query(Inventory).filter(Inventory.epc == movement_in.epc).first()
    from_shelf_id = item.expected_location_id if item else None

    mov = InventoryMovement(
        epc=movement_in.epc,
        from_shelf_id=from_shelf_id,
        to_shelf_id=movement_in.to_shelf_id,
        movement_type=movement_in.movement_type,
        authorized=1,
        authorized_by=movement_in.authorized_by,
        notes=movement_in.notes,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(mov)
    if item:
        # Authorized movement updates expected location!
        item.expected_location_id = movement_in.to_shelf_id
        item.status = "IN_PLACE"
    db.commit()
    db.refresh(mov)

    return InventoryMovementResponse(
        id=mov.id,
        epc=mov.epc,
        from_shelf_code=mov.from_shelf.shelf_code if mov.from_shelf else None,
        to_shelf_code=mov.to_shelf.shelf_code if mov.to_shelf else "UNKNOWN",
        movement_type=mov.movement_type,
        authorized=mov.authorized,
        authorized_by=mov.authorized_by,
        notes=mov.notes,
        timestamp=mov.timestamp
    )

@router.post("/inventory/assign-tag")
def assign_tag_to_product(req: AssignTagRequest, db: Session = Depends(get_db)):
    """
    Assigns an EPC tag to a product, sets packaging RF profile,
    and establishes the expected shelf in WMS master records.
    """
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product ID {req.product_id} not found")

    shelf = db.query(Shelf).filter(Shelf.id == req.expected_shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail=f"Shelf ID {req.expected_shelf_id} not found")

    # Clean EPC
    epc = req.epc.strip().upper()

    # Create or update RFIDTag record
    tag = db.query(RFIDTag).filter(RFIDTag.epc == epc).first()
    prev_prod_id = tag.product_id if tag else None
    if not tag:
        tag = RFIDTag(
            epc=epc,
            product_id=product.id,
            status=req.status,
            tag_type=req.tag_type,
            packaging_class=req.packaging_class,
            pallet_id=req.pallet_id,
            carton_id=req.carton_id
        )
        db.add(tag)
    else:
        tag.product_id = product.id
        tag.status = req.status
        tag.tag_type = req.tag_type
        tag.packaging_class = req.packaging_class
        if req.pallet_id:
            tag.pallet_id = req.pallet_id
        if req.carton_id:
            tag.carton_id = req.carton_id

    # Record assignment history audit trail
    history = TagAssignmentHistory(
        epc=epc,
        previous_product_id=prev_prod_id,
        new_product_id=product.id,
        pallet_id=req.pallet_id or (tag.pallet_id if tag else None),
        carton_id=req.carton_id or (tag.carton_id if tag else None),
        assigned_by=req.assigned_by,
        reason=req.reason,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(history)

    # Create or update Inventory stock record
    inv = db.query(Inventory).filter(Inventory.epc == epc).first()
    if not inv:
        inv = Inventory(
            epc=epc,
            product_id=product.id,
            expected_location_id=shelf.id,
            observed_location_id=shelf.id,
            status="IN_PLACE",
            confidence=0.98,
            last_reconciled_at=datetime.now(timezone.utc),
            last_observed_at=datetime.now(timezone.utc)
        )
        db.add(inv)
    else:
        inv.product_id = product.id
        inv.expected_location_id = shelf.id
        inv.status = "IN_PLACE"
        inv.confidence = 0.98

    db.commit()
    db.refresh(inv)

    return {
        "success": True,
        "message": f"Successfully mapped EPC '{epc}' to {product.name} on {shelf.shelf_code}",
        "inventory_id": inv.id,
        "epc": epc,
        "product_name": product.name,
        "product_sku": product.sku,
        "expected_shelf": shelf.shelf_code,
        "packaging_class": req.packaging_class
    }


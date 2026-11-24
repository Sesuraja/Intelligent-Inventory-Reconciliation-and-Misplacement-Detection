from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.location import Warehouse, Zone, Shelf, Bin
from app.models.inventory import Inventory
from app.models.reader import Antenna
from app.schemas.location import WarehouseResponse, ShelfResponse, ZoneResponse, ShelfCreate
from app.rfid.reader_manager import reader_manager

router = APIRouter(tags=["Locations"])

@router.get("/locations", response_model=List[WarehouseResponse])
@router.get("/warehouses", response_model=List[WarehouseResponse])
def get_locations(db: Session = Depends(get_db)):
    warehouses = db.query(Warehouse).all()
    results = []
    for wh in warehouses:
        zones_res = []
        for z in wh.zones:
            shelves_res = []
            for s in z.shelves:
                curr_count = db.query(Inventory).filter(Inventory.expected_location_id == s.id).count()
                ant = db.query(Antenna).filter(Antenna.shelf_id == s.id).first()
                shelves_res.append(ShelfResponse(
                    id=s.id,
                    zone_id=s.zone_id,
                    shelf_code=s.shelf_code,
                    name=s.name,
                    capacity=s.capacity,
                    category_restriction=s.category_restriction,
                    coord_x=s.coord_x,
                    coord_y=s.coord_y,
                    current_items_count=curr_count,
                    assigned_antenna_code=ant.antenna_code if ant else None
                ))
            zones_res.append(ZoneResponse(
                id=z.id,
                warehouse_id=z.warehouse_id,
                name=z.name,
                code=z.code,
                shelves=shelves_res
            ))
        results.append(WarehouseResponse(
            id=wh.id,
            name=wh.name,
            code=wh.code,
            description=wh.description,
            zones=zones_res
        ))
    return results

@router.patch("/warehouses/{id}")
def update_warehouse(id: int, updates: dict, db: Session = Depends(get_db)):
    """Updates warehouse facility details (name, code, description)."""
    wh = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    for key, val in updates.items():
        if hasattr(wh, key) and key != "id":
            setattr(wh, key, val)
    db.commit()
    db.refresh(wh)
    return {"id": wh.id, "name": wh.name, "code": wh.code, "description": wh.description}

@router.get("/shelves", response_model=List[ShelfResponse])
@router.get("/locations/shelves", response_model=List[ShelfResponse])
def get_shelves(db: Session = Depends(get_db)):
    shelves = db.query(Shelf).all()
    res = []
    for s in shelves:
        curr_count = db.query(Inventory).filter(Inventory.expected_location_id == s.id).count()
        ant = db.query(Antenna).filter(Antenna.shelf_id == s.id).first()
        res.append(ShelfResponse(
            id=s.id,
            zone_id=s.zone_id,
            shelf_code=s.shelf_code,
            name=s.name,
            capacity=s.capacity,
            category_restriction=s.category_restriction,
            coord_x=s.coord_x,
            coord_y=s.coord_y,
            current_items_count=curr_count,
            assigned_antenna_code=ant.antenna_code if ant else None
        ))
    return res

@router.post("/shelves", response_model=ShelfResponse)
@router.post("/locations/shelves", response_model=ShelfResponse)
def create_shelf(shelf_in: ShelfCreate, db: Session = Depends(get_db)):
    """Creates a new warehouse shelf location and registers it for antenna mapping."""
    existing = db.query(Shelf).filter(Shelf.shelf_code == shelf_in.shelf_code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Shelf code already exists in warehouse")
    
    # Check zone exists
    zone = db.query(Zone).filter(Zone.id == shelf_in.zone_id).first()
    if not zone:
        # Default to first zone
        zone = db.query(Zone).first()
        zone_id = zone.id if zone else 1
    else:
        zone_id = zone.id

    new_shelf = Shelf(
        shelf_code=shelf_in.shelf_code.upper(),
        name=shelf_in.name or f"Shelf {shelf_in.shelf_code.upper()}",
        zone_id=zone_id,
        capacity=shelf_in.capacity,
        category_restriction=shelf_in.category_restriction,
        coord_x=shelf_in.coord_x,
        coord_y=shelf_in.coord_y
    )
    db.add(new_shelf)
    db.commit()
    db.refresh(new_shelf)

    return ShelfResponse(
        id=new_shelf.id,
        zone_id=new_shelf.zone_id,
        shelf_code=new_shelf.shelf_code,
        name=new_shelf.name,
        capacity=new_shelf.capacity,
        category_restriction=new_shelf.category_restriction,
        coord_x=new_shelf.coord_x,
        coord_y=new_shelf.coord_y,
        current_items_count=0,
        assigned_antenna_code=None
    )

@router.patch("/shelves/{id}", response_model=ShelfResponse)
@router.patch("/locations/shelves/{id}", response_model=ShelfResponse)
def update_shelf(id: int, updates: dict, db: Session = Depends(get_db)):
    """Updates shelf configuration and capacity dynamically."""
    shelf = db.query(Shelf).filter(Shelf.id == id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    for key, val in updates.items():
        if hasattr(shelf, key) and key != "id":
            if key == "shelf_code" and isinstance(val, str):
                val = val.upper()
            setattr(shelf, key, val)
    db.commit()
    db.refresh(shelf)
    curr_count = db.query(Inventory).filter(Inventory.expected_location_id == shelf.id).count()
    ant = db.query(Antenna).filter(Antenna.shelf_id == shelf.id).first()
    return ShelfResponse(
        id=shelf.id,
        zone_id=shelf.zone_id,
        shelf_code=shelf.shelf_code,
        name=shelf.name,
        capacity=shelf.capacity,
        category_restriction=shelf.category_restriction,
        coord_x=shelf.coord_x,
        coord_y=shelf.coord_y,
        current_items_count=curr_count,
        assigned_antenna_code=ant.antenna_code if ant else None
    )

@router.delete("/shelves/{id}")
@router.delete("/locations/shelves/{id}")
def delete_shelf(id: int, db: Session = Depends(get_db)):
    """Deletes a warehouse shelf."""
    shelf = db.query(Shelf).filter(Shelf.id == id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    db.delete(shelf)
    db.commit()
    return {"success": True, "message": f"Shelf {id} deleted successfully"}

@router.get("/zones")
def get_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    return [{"id": z.id, "warehouse_id": z.warehouse_id, "code": z.code, "name": z.name} for z in zones]

@router.post("/zones")
def create_zone(name: str, code: str, warehouse_id: int = 1, db: Session = Depends(get_db)):
    z = Zone(name=name, code=code.upper(), warehouse_id=warehouse_id)
    db.add(z)
    db.commit()
    db.refresh(z)
    return {"id": z.id, "warehouse_id": z.warehouse_id, "code": z.code, "name": z.name}

@router.patch("/zones/{id}")
def update_zone(id: int, updates: dict, db: Session = Depends(get_db)):
    """Updates warehouse zone parameters."""
    z = db.query(Zone).filter(Zone.id == id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    for key, val in updates.items():
        if hasattr(z, key) and key != "id":
            if key == "code" and isinstance(val, str):
                val = val.upper()
            setattr(z, key, val)
    db.commit()
    db.refresh(z)
    return {"id": z.id, "warehouse_id": z.warehouse_id, "code": z.code, "name": z.name}

@router.delete("/zones/{id}")
def delete_zone(id: int, db: Session = Depends(get_db)):
    """Deletes a warehouse zone."""
    z = db.query(Zone).filter(Zone.id == id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    db.delete(z)
    db.commit()
    return {"success": True, "message": f"Zone {id} deleted successfully"}

@router.get("/bins")
def get_bins(db: Session = Depends(get_db)):
    bins = db.query(Bin).all()
    return [{"id": b.id, "shelf_id": b.shelf_id, "bin_code": b.bin_code, "capacity": b.capacity} for b in bins]

@router.post("/bins")
def create_bin(bin_code: str, shelf_id: int, capacity: int = 10, db: Session = Depends(get_db)):
    b = Bin(bin_code=bin_code.upper(), shelf_id=shelf_id, capacity=capacity)
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id, "shelf_id": b.shelf_id, "bin_code": b.bin_code, "capacity": b.capacity}


from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class BinResponse(BaseModel):
    id: int
    bin_code: str
    capacity: int

    class Config:
        from_attributes = True

class ShelfCreate(BaseModel):
    shelf_code: str
    name: Optional[str] = None
    zone_id: int = 1
    capacity: int = 30
    category_restriction: Optional[str] = None
    coord_x: float = 0.0
    coord_y: float = 0.0

class ShelfResponse(BaseModel):
    id: int
    zone_id: int
    shelf_code: str
    name: Optional[str] = None
    capacity: int
    category_restriction: Optional[str] = None
    coord_x: float
    coord_y: float
    current_items_count: int = 0
    assigned_antenna_code: Optional[str] = None

    class Config:
        from_attributes = True

class ZoneResponse(BaseModel):
    id: int
    warehouse_id: int
    name: str
    code: str
    shelves: List[ShelfResponse] = []

    class Config:
        from_attributes = True

class WarehouseResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    zones: List[ZoneResponse] = []

    class Config:
        from_attributes = True


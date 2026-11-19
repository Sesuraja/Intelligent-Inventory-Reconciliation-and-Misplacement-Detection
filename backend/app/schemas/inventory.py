from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    unit: str = "piece"
    unit_cost: float = 0.0
    min_stock: int = 5
    description: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class RFIDTagBase(BaseModel):
    epc: str
    product_id: int
    status: str = "ACTIVE"
    tag_type: str = "EPC_GEN2_UHF"
    packaging_class: str = "CARDBOARD"

class RFIDTagCreate(RFIDTagBase):
    pass

class AssignTagRequest(BaseModel):
    epc: str
    product_id: int
    expected_shelf_id: int
    packaging_class: str = "CARDBOARD"
    tag_type: str = "EPC_GEN2_UHF"
    status: str = "ACTIVE"

class RFIDTagResponse(RFIDTagBase):
    id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    assigned_at: datetime

    class Config:
        from_attributes = True

class InventoryBase(BaseModel):
    epc: str
    product_id: int
    expected_location_id: int

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(BaseModel):
    id: int
    epc: str
    product_id: int
    product_name: str
    product_sku: str
    category: str
    unit_cost: float
    expected_location_id: int
    expected_shelf_code: str
    observed_location_id: Optional[int] = None
    observed_shelf_code: Optional[str] = None
    status: str
    confidence: float
    last_reconciled_at: Optional[datetime] = None
    last_observed_at: Optional[datetime] = None
    discrepancy_id: Optional[int] = None

    class Config:
        from_attributes = True

class InventoryMovementCreate(BaseModel):
    epc: str
    to_shelf_id: int
    movement_type: str = "TRANSFER"
    notes: Optional[str] = None
    authorized_by: str = "Operator"

class InventoryMovementResponse(BaseModel):
    id: int
    epc: str
    from_shelf_code: Optional[str] = None
    to_shelf_code: str
    movement_type: str
    authorized: int
    authorized_by: str
    notes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


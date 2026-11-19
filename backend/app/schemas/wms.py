from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class WMSInventoryResponse(BaseModel):
    id: int
    epc: str
    sku: str
    product_name: Optional[str]
    category: Optional[str]
    expected_shelf_code: str
    quantity: int
    lot_number: str
    status: str
    updated_at: datetime

    class Config:
        from_attributes = True

class WMSReceiveRequest(BaseModel):
    sku: str
    quantity: int = 1
    target_shelf_code: str = "SHELF_A"
    lot_number: Optional[str] = "LOT-2026-INBOUND"
    epc_prefix: Optional[str] = "EPC-RCV"
    user_name: Optional[str] = "WMS_OPERATOR"

class WMSPutawayRequest(BaseModel):
    epc: str
    to_shelf_code: str
    user_name: Optional[str] = "WMS_OPERATOR"
    notes: Optional[str] = None

class WMSMoveRequest(BaseModel):
    epc: str
    to_shelf_code: str
    user_name: Optional[str] = "WMS_OPERATOR"
    reason: Optional[str] = "Standard stock replenishment"

class WMSPickRequest(BaseModel):
    epc: Optional[str] = None
    sku: Optional[str] = None
    order_number: Optional[str] = None
    user_name: Optional[str] = "WMS_PICKER"

class WMSShipRequest(BaseModel):
    epc: Optional[str] = None
    order_number: Optional[str] = None
    user_name: Optional[str] = "WMS_SHIPPER"

class WMSAdjustRequest(BaseModel):
    epc: str
    new_shelf_code: Optional[str] = None
    quantity: Optional[int] = 1
    reason: str
    user_name: Optional[str] = "CYCLE_COUNTER"

class WMSInjectErrorRequest(BaseModel):
    error_type: str = "MISPLACE"  # MISPLACE, WMS_DESYNC, SHRINKAGE, SHADOW
    epc: Optional[str] = None
    target_shelf_code: Optional[str] = None
    notes: Optional[str] = None

class WMSTransactionResponse(BaseModel):
    id: int
    transaction_type: str
    epc: Optional[str]
    sku: str
    from_shelf_code: Optional[str]
    to_shelf_code: Optional[str]
    quantity: int
    user_name: str
    reference_code: Optional[str]
    notes: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

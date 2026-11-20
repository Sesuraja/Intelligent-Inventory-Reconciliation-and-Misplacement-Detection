from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class WMSInventory(Base):
    __tablename__ = "wms_inventory"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), unique=True, index=True, nullable=False)
    sku = Column(String(50), index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    expected_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    quantity = Column(Integer, default=1)
    lot_number = Column(String(50), default="LOT-2026-A")
    status = Column(String(50), default="AVAILABLE")  # AVAILABLE, ALLOCATED, IN_TRANSIT, SHIPPED, QUARANTINED
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    product = relationship("Product")
    expected_shelf = relationship("Shelf")


class WMSOrder(Base):
    __tablename__ = "wms_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    order_type = Column(String(50), default="OUTBOUND")  # INBOUND, OUTBOUND
    status = Column(String(50), default="PENDING")  # PENDING, PROCESSING, COMPLETED, CANCELLED
    customer_or_vendor = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    lines = relationship("WMSOrderLine", back_populates="order", cascade="all, delete-orphan")
    transactions = relationship("WMSTransaction", back_populates="order")


class WMSOrderLine(Base):
    __tablename__ = "wms_order_lines"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("wms_orders.id"), nullable=False)
    sku = Column(String(50), nullable=False)
    requested_quantity = Column(Integer, default=1)
    fulfilled_quantity = Column(Integer, default=0)
    target_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)

    order = relationship("WMSOrder", back_populates="lines")
    target_shelf = relationship("Shelf")


class WMSTransaction(Base):
    __tablename__ = "wms_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(String(50), nullable=False)  # RECEIPT, PUTAWAY, MOVE, PICK, SHIP, ADJUST
    epc = Column(String(64), index=True, nullable=True)
    sku = Column(String(50), index=True, nullable=False)
    from_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    to_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    quantity = Column(Integer, default=1)
    order_id = Column(Integer, ForeignKey("wms_orders.id"), nullable=True)
    user_name = Column(String(100), default="WMS_OPERATOR")
    reference_code = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_reversed = Column(Boolean, default=False)
    reversal_of_transaction_id = Column(Integer, ForeignKey("wms_transactions.id"), nullable=True)
    approval_status = Column(String(50), default="AUTO_APPROVED")  # PENDING_APPROVAL, APPROVED, REJECTED, AUTO_APPROVED
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    from_shelf = relationship("Shelf", foreign_keys=[from_shelf_id])
    to_shelf = relationship("Shelf", foreign_keys=[to_shelf_id])
    order = relationship("WMSOrder", back_populates="transactions")
    reversal_of = relationship("WMSTransaction", remote_side=[id], foreign_keys=[reversal_of_transaction_id])

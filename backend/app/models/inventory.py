from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), ForeignKey("rfid_tags.epc"), unique=True, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    expected_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    observed_location_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    status = Column(String(50), default="IN_PLACE")
    confidence = Column(Float, default=1.0)
    last_reconciled_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_observed_at = Column(DateTime, nullable=True)

    tag = relationship("RFIDTag", back_populates="inventory")
    product = relationship("Product", back_populates="inventory_items")
    expected_shelf = relationship("Shelf", foreign_keys=[expected_location_id], back_populates="inventory_items")
    observed_shelf = relationship("Shelf", foreign_keys=[observed_location_id])
    discrepancies = relationship("Discrepancy", back_populates="inventory_item")

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), index=True, nullable=False)
    from_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    to_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    movement_type = Column(String(50), default="TRANSFER")  # RECEIPT, DISPATCH, TRANSFER, AUTHORIZED_MOVE, RECONCILED
    authorized = Column(Integer, default=1)  # 1 = Authorized, 0 = Unauthorized
    authorized_by = Column(String(100), default="SYSTEM")
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    from_shelf = relationship("Shelf", foreign_keys=[from_shelf_id])
    to_shelf = relationship("Shelf", foreign_keys=[to_shelf_id])


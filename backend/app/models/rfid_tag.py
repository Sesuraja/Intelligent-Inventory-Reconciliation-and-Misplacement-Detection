from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class RFIDTag(Base):
    __tablename__ = "rfid_tags"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), unique=True, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    status = Column(String(30), default="ACTIVE")  # ACTIVE, INACTIVE, DAMAGED, RETIRED, DECOMMISSIONED
    tag_type = Column(String(50), default="EPC_GEN2_UHF")
    packaging_class = Column(String(50), default="CARDBOARD")  # CARDBOARD, PLASTIC, METAL_SHIELDED, LIQUID_PROXIMITY
    
    # Hierarchy: Pallet -> Carton -> Product Item
    pallet_id = Column(String(50), nullable=True, index=True)
    carton_id = Column(String(50), nullable=True, index=True)

    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    retired_at = Column(DateTime, nullable=True)
    retirement_reason = Column(String(255), nullable=True)

    product = relationship("Product", back_populates="tags")
    inventory = relationship("Inventory", back_populates="tag", uselist=False)
    assignment_history = relationship("TagAssignmentHistory", back_populates="tag", cascade="all, delete-orphan")


class TagAssignmentHistory(Base):
    __tablename__ = "tag_assignment_history"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), ForeignKey("rfid_tags.epc"), index=True, nullable=False)
    previous_product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    new_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    pallet_id = Column(String(50), nullable=True)
    carton_id = Column(String(50), nullable=True)
    assigned_by = Column(String(100), default="SYSTEM")
    reason = Column(String(255), default="INITIAL_PROVISIONING")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    tag = relationship("RFIDTag", back_populates="assignment_history")
    previous_product = relationship("Product", foreign_keys=[previous_product_id])
    new_product = relationship("Product", foreign_keys=[new_product_id])

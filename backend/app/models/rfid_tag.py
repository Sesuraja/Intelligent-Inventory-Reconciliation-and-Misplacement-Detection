from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class RFIDTag(Base):
    __tablename__ = "rfid_tags"

    id = Column(Integer, primary_key=True, index=True)
    epc = Column(String(64), unique=True, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    status = Column(String(30), default="ACTIVE")  # ACTIVE, INACTIVE, DAMAGED, DECOMMISSIONED
    tag_type = Column(String(50), default="EPC_GEN2_UHF")
    packaging_class = Column(String(50), default="CARDBOARD")  # CARDBOARD, PLASTIC, METAL_SHIELDED, LIQUID_PROXIMITY
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="tags")
    inventory = relationship("Inventory", back_populates="tag", uselist=False)


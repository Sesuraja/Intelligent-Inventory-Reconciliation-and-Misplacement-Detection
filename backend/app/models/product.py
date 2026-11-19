from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)
    unit = Column(String(30), default="piece")
    unit_cost = Column(Float, default=0.0)
    min_stock = Column(Integer, default=5)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    tags = relationship("RFIDTag", back_populates="product", cascade="all, delete-orphan")
    inventory_items = relationship("Inventory", back_populates="product")


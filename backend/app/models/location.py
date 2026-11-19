from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    zones = relationship("Zone", back_populates="warehouse", cascade="all, delete-orphan")

class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)

    warehouse = relationship("Warehouse", back_populates="zones")
    shelves = relationship("Shelf", back_populates="zone", cascade="all, delete-orphan")

class Shelf(Base):
    __tablename__ = "shelves"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    shelf_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=True)
    capacity = Column(Integer, default=50)
    category_restriction = Column(String(100), nullable=True)
    coord_x = Column(Float, default=0.0)
    coord_y = Column(Float, default=0.0)

    zone = relationship("Zone", back_populates="shelves")
    bins = relationship("Bin", back_populates="shelf", cascade="all, delete-orphan")
    antennas = relationship("Antenna", back_populates="shelf")
    inventory_items = relationship("Inventory", back_populates="expected_shelf", foreign_keys="[Inventory.expected_location_id]")

class Bin(Base):
    __tablename__ = "bins"

    id = Column(Integer, primary_key=True, index=True)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    bin_code = Column(String(50), nullable=False)
    capacity = Column(Integer, default=10)

    shelf = relationship("Shelf", back_populates="bins")


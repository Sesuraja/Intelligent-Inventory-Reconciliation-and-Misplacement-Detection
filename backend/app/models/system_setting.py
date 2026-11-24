from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON, Text
from app.core.database import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True)  # e.g. "thresholds.abstain_band", "windows.aggregation", etc.
    category = Column(String, nullable=False, index=True)  # thresholds, abstain_bands, windows, retention, feature_flags
    value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    last_modified_by = Column(String, default="admin")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

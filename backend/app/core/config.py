from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List, Optional
import os

class Settings(BaseSettings):
    model_config = ConfigDict(case_sensitive=True)

    PROJECT_NAME: str = "Intelligent Inventory Reconciliation & Misplacement Detection"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./inventory_rfid.db")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "rfid-ai-secret-key-super-secure-jwt-warehouse-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # RFID & Collector Defaults
    COLLECTOR_WINDOW_SECONDS: int = 10
    RSSI_MIN_THRESHOLD_DBM: float = -85.0
    CROSS_READ_RSSI_DIFF_THRESHOLD: float = 6.0
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]

settings = Settings()

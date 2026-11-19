from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List, Optional
import os

class Settings(BaseSettings):
    model_config = ConfigDict(case_sensitive=True, extra="ignore")

    PROJECT_NAME: str = "Intelligent Inventory Reconciliation & Misplacement Detection"
    VERSION: str = "1.2.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./inventory_rfid.db")
    
    # Security: Standardized JWT_SECRET with fallback to SECRET_KEY
    JWT_SECRET: str = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "rfid-ai-secret-key-super-secure-jwt-warehouse-2026"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", os.getenv("JWT_SECRET", "rfid-ai-secret-key-super-secure-jwt-warehouse-2026"))
    ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))  # 24 hours
    REQUIRE_AUTH: bool = os.getenv("REQUIRE_AUTH", "false").lower() in ("true", "1", "yes")

    # System Operating Mode: SIMULATION, PHYSICAL, OFFLINE
    DEFAULT_OPERATING_MODE: str = os.getenv("OPERATING_MODE", "SIMULATION")
    
    # Fixed UHF RFID Reader Defaults
    RFID_READER_HOST: str = os.getenv("RFID_READER_HOST", "192.168.1.100")
    RFID_READER_PORT: int = int(os.getenv("RFID_READER_PORT", "5084"))
    RFID_READER_PROTOCOL: str = os.getenv("RFID_READER_PROTOCOL", "LLRP")
    RFID_READER_ID: str = os.getenv("RFID_READER_ID", "READER_01")
    RFID_CONNECT_TIMEOUT_SEC: float = float(os.getenv("RFID_CONNECT_TIMEOUT_SEC", "3.0"))
    RFID_RECONNECT_INTERVAL_SEC: float = float(os.getenv("RFID_RECONNECT_INTERVAL_SEC", "5.0"))

    # RFID Collector Defaults
    COLLECTOR_POLL_INTERVAL_SEC: float = float(os.getenv("COLLECTOR_POLL_INTERVAL_SEC", "2.0"))
    COLLECTOR_WINDOW_SECONDS: int = int(os.getenv("RFID_OBSERVATION_WINDOW_SECONDS", "10"))
    RSSI_MIN_THRESHOLD_DBM: float = float(os.getenv("RSSI_MIN_THRESHOLD_DBM", "-85.0"))
    CROSS_READ_RSSI_DIFF_THRESHOLD: float = float(os.getenv("CROSS_READ_RSSI_DIFF_THRESHOLD", "6.0"))
    
    # CORS
    CORS_ORIGINS: List[str] = [
        origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()
    ]

settings = Settings()

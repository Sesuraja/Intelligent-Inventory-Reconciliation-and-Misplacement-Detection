from enum import Enum
from typing import Dict, Any
import logging

logger = logging.getLogger("rfid_warehouse")

class OperatingMode(str, Enum):
    PHYSICAL = "PHYSICAL"
    OFFLINE = "OFFLINE"
    SIMULATION = "SIMULATION"

class OperatingModeManager:
    """
    Manages the global warehouse telemetry operating mode:
    - PHYSICAL: Real-time observations from live Aperture Venture Studio UHF RFID Gateway.
    - OFFLINE: Standby mode with no active observation collection.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OperatingModeManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        from app.core.config import settings
        raw_mode = settings.DEFAULT_OPERATING_MODE.upper()
        if raw_mode in (OperatingMode.PHYSICAL.value, OperatingMode.OFFLINE.value, OperatingMode.SIMULATION.value):
            self._mode = OperatingMode(raw_mode)
        else:
            self._mode = OperatingMode.PHYSICAL
        self._initialized = True
        logger.info(f"OperatingModeManager initialized in mode: {self._mode.value}")

    @property
    def current_mode(self) -> OperatingMode:
        return self._mode

    def set_mode(self, mode: OperatingMode | str) -> OperatingMode:
        if isinstance(mode, str):
            mode = OperatingMode(mode.upper())
        prev_mode = self._mode
        self._mode = mode
        logger.info(f"System operating mode changed: {prev_mode.value} -> {self._mode.value}")
        return self._mode

    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": self._mode.value,
            "is_simulation": False,
            "is_physical": self._mode == OperatingMode.PHYSICAL,
            "is_offline": self._mode == OperatingMode.OFFLINE,
            "description": (
                "Connected to live Aperture Venture Studio UHF RFID Gateway (https://gateway.apertureventurestudio.com)"
                if self._mode == OperatingMode.PHYSICAL
                else "Offline standby (data collection paused)"
            )
        }

mode_manager = OperatingModeManager()

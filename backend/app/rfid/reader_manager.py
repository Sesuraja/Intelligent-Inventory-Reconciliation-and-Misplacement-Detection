import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.rfid.simulator import UHFHardwareSimulator
from app.rfid.reader_adapter import AbstractReaderAdapter
from app.rfid.llrp_adapter import LLRPReaderAdapter
from app.rfid.operating_mode import mode_manager, OperatingMode
from app.core.config import settings

logger = logging.getLogger("rfid_warehouse")

class ReaderManager:
    """
    Manages physical UHF RFID reader adapters and RF physics simulators.
    Enforces strict isolation between operating modes:
    - SIMULATION: routes to UHFHardwareSimulator
    - PHYSICAL: routes to LLRPReaderAdapter (direct socket to reader)
    - OFFLINE: suspends active collection
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ReaderManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self.default_simulator = UHFHardwareSimulator(
            reader_code=settings.RFID_READER_ID,
            ip_address=settings.RFID_READER_HOST,
            port=settings.RFID_READER_PORT
        )

        self.physical_adapter = LLRPReaderAdapter(
            reader_code=settings.RFID_READER_ID,
            ip_address=settings.RFID_READER_HOST,
            port=settings.RFID_READER_PORT,
            reconnect_interval_sec=settings.RFID_RECONNECT_INTERVAL_SEC,
            connect_timeout_sec=settings.RFID_CONNECT_TIMEOUT_SEC
        )

        self._initialized = True
        logger.info(
            f"ReaderManager initialized with Physical Adapter ({settings.RFID_READER_HOST}:{settings.RFID_READER_PORT}) "
            f"and Physics Simulator. Default mode: {mode_manager.current_mode.value}"
        )

    def get_simulator(self) -> UHFHardwareSimulator:
        return self.default_simulator

    def get_physical_adapter(self) -> LLRPReaderAdapter:
        return self.physical_adapter

    def get_active_adapter(self) -> Optional[AbstractReaderAdapter]:
        """Returns the appropriate adapter based on current operating mode."""
        mode = mode_manager.current_mode
        if mode == OperatingMode.SIMULATION:
            return self.default_simulator
        elif mode == OperatingMode.PHYSICAL:
            return self.physical_adapter
        elif mode == OperatingMode.OFFLINE:
            return None
        return self.default_simulator

    def get_reader(self, reader_code: str = "READER_01") -> Optional[AbstractReaderAdapter]:
        return self.get_active_adapter()

    async def get_all_health(self) -> List[Dict[str, Any]]:
        mode = mode_manager.current_mode
        sim_health = await self.default_simulator.get_health_status()
        sim_health["operating_mode"] = "SIMULATION"
        sim_health["active_mode"] = (mode == OperatingMode.SIMULATION)

        phys_health = await self.physical_adapter.get_health_status()
        phys_health["operating_mode"] = "PHYSICAL"
        phys_health["active_mode"] = (mode == OperatingMode.PHYSICAL)

        return [sim_health, phys_health]

    async def test_physical_connection(self) -> Dict[str, Any]:
        """Directly probes the physical hardware reader socket without mock claims."""
        return await self.physical_adapter.test_physical_connection()

reader_manager = ReaderManager()

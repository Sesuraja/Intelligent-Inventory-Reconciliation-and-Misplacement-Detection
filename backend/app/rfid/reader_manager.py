import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.rfid.reader_adapter import AbstractReaderAdapter
from app.rfid.gateway_adapter import GatewayReaderAdapter
from app.rfid.operating_mode import mode_manager, OperatingMode
from app.core.config import settings

logger = logging.getLogger("rfid_warehouse")

class ReaderManager:
    """
    Manages physical UHF RFID reader telemetry via the Aperture Venture Studio Gateway.
    Directly interfaces with reader 100EHH5323020053 across Antenna Ports 1 & 2.
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

        self.gateway_adapter = GatewayReaderAdapter(
            reader_code=settings.RFID_READER_ID,
            gateway_url=settings.RFID_GATEWAY_URL
        )
        self.physical_adapter = self.gateway_adapter

        self._initialized = True
        logger.info(
            f"ReaderManager initialized with Aperture Gateway Adapter ({settings.RFID_GATEWAY_URL}) "
            f"for Reader {settings.RFID_READER_ID}. Active mode: {mode_manager.current_mode.value}"
        )

    def get_physical_adapter(self) -> GatewayReaderAdapter:
        return self.gateway_adapter

    def get_active_adapter(self) -> Optional[AbstractReaderAdapter]:
        """Returns the active gateway adapter based on current operating mode."""
        mode = mode_manager.current_mode
        if mode == OperatingMode.OFFLINE:
            return None
        return self.gateway_adapter

    def get_reader(self, reader_code: str = "100EHH5323020053") -> Optional[AbstractReaderAdapter]:
        return self.get_active_adapter()

    async def get_all_health(self) -> List[Dict[str, Any]]:
        mode = mode_manager.current_mode
        phys_health = await self.gateway_adapter.get_health_status()
        phys_health["operating_mode"] = mode.value
        phys_health["active_mode"] = (mode == OperatingMode.PHYSICAL)
        return [phys_health]

    async def test_physical_connection(self) -> Dict[str, Any]:
        """Probes the live Aperture Gateway API endpoint."""
        is_ok = await self.gateway_adapter.connect()
        return {
            "success": is_ok,
            "status": "CONNECTED" if is_ok else "DISCONNECTED",
            "reader_code": self.gateway_adapter.reader_code,
            "endpoint": self.gateway_adapter.latest_url
        }

reader_manager = ReaderManager()

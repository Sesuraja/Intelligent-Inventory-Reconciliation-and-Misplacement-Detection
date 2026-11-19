from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, AsyncGenerator
from datetime import datetime, timezone
import uuid

class AbstractReaderAdapter(ABC):
    """
    Abstract interface for fixed UHF RFID readers.
    Supports LLRP, Vendor SDKs, and Hardware Simulators.
    """
    def __init__(self, reader_code: str, ip_address: str, port: int = 5084):
        self.reader_code = reader_code
        self.ip_address = ip_address
        self.port = port
        self.is_connected = False
        self.clock_offset_ms = 0.0

    @abstractmethod
    async def connect(self) -> bool:
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        pass

    @abstractmethod
    async def get_health_status(self) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def configure_antennas(self, configs: List[Dict[str, Any]]) -> bool:
        pass

    @abstractmethod
    async def poll_observations(self) -> List[Dict[str, Any]]:
        pass


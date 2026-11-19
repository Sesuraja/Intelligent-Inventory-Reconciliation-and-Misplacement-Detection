import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.rfid.simulator import UHFHardwareSimulator
from app.rfid.reader_adapter import AbstractReaderAdapter

class ReaderManager:
    """Manages physical reader adapters and simulators."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ReaderManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self.readers: Dict[str, AbstractReaderAdapter] = {}
        # Default 4-port reader simulator
        self.default_simulator = UHFHardwareSimulator(reader_code="READER_01")
        self.readers["READER_01"] = self.default_simulator
        self._initialized = True

    def get_reader(self, reader_code: str = "READER_01") -> Optional[AbstractReaderAdapter]:
        return self.readers.get(reader_code)

    def get_simulator(self) -> UHFHardwareSimulator:
        return self.default_simulator

    async def get_all_health(self) -> List[Dict[str, Any]]:
        health_reports = []
        for code, adapter in self.readers.items():
            report = await adapter.get_health_status()
            health_reports.append(report)
        return health_reports

reader_manager = ReaderManager()


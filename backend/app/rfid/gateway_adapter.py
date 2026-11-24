"""
Aperture Venture Studio UHF RFID Gateway Reader Adapter.
Directly interfaces with physical UHF RFID reader telemetry API:
- https://gateway.apertureventurestudio.com/api/v1/gateway/uhfrfid/telemetry/latest
- https://gateway.apertureventurestudio.com/api/v1/gateway/uhfrfid/telemetry/history
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Set
import urllib.request
import json

from app.rfid.reader_adapter import AbstractReaderAdapter
from app.core.config import settings

logger = logging.getLogger("rfid_warehouse")

class GatewayReaderAdapter(AbstractReaderAdapter):
    """
    Reader adapter connecting to the live Aperture Venture Studio UHF RFID Gateway.
    Polls real physical RFID events from Reader 100EHH5323020053 across Antenna Ports 1 & 2.
    """

    def __init__(
        self,
        reader_code: str = "100EHH5323020053",
        gateway_url: str = "https://gateway.apertureventurestudio.com"
    ):
        super().__init__(reader_code=reader_code, ip_address="gateway.apertureventurestudio.com", port=443)
        self.gateway_url = gateway_url.rstrip("/")
        self.latest_url = f"{self.gateway_url}/api/v1/gateway/uhfrfid/telemetry/latest"
        self.history_url = f"{self.gateway_url}/api/v1/gateway/uhfrfid/telemetry/history"
        
        self.is_connected = False
        self.total_reads_received = 0
        self.last_poll_time: Optional[datetime] = None
        self.last_error: Optional[str] = None
        self._seen_signatures: Set[str] = set()
        self._max_signatures = 2000

    async def connect(self) -> bool:
        """Probes the live gateway API to verify connectivity."""
        loop = asyncio.get_event_loop()
        try:
            success = await loop.run_in_executor(None, self._check_connection_sync)
            self.is_connected = success
            if success:
                logger.info(f"Connected to Aperture UHF RFID Gateway: {self.latest_url}")
            return success
        except Exception as e:
            self.last_error = str(e)
            self.is_connected = False
            logger.error(f"Failed to connect to Aperture Gateway: {e}")
            return False

    def _check_connection_sync(self) -> bool:
        req = urllib.request.Request(self.latest_url, headers={"User-Agent": "RFIDWarehouseGateway/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status == 200

    async def disconnect(self) -> None:
        self.is_connected = False
        logger.info("Disconnected from Aperture UHF RFID Gateway.")

    async def get_health_status(self) -> Dict[str, Any]:
        return {
            "reader_code": self.reader_code,
            "adapter_type": "APERTURE_HTTP_GATEWAY",
            "gateway_url": self.gateway_url,
            "latest_endpoint": self.latest_url,
            "history_endpoint": self.history_url,
            "is_connected": self.is_connected,
            "status": "CONNECTED" if self.is_connected else "DISCONNECTED",
            "total_reads_received": self.total_reads_received,
            "last_poll_time": self.last_poll_time.isoformat() if self.last_poll_time else None,
            "last_error": self.last_error,
            "antennas": [
                {"port": 1, "is_active": True, "shelf": "Shelf A (Bay A)"},
                {"port": 2, "is_active": True, "shelf": "Shelf B (Bay B)"}
            ]
        }

    async def configure_antennas(self, configs: List[Dict[str, Any]]) -> bool:
        return True

    async def poll_observations(self) -> List[Dict[str, Any]]:
        """Polls the latest real-time observations from the gateway."""
        loop = asyncio.get_event_loop()
        try:
            raw_payload = await loop.run_in_executor(None, self._fetch_latest_sync)
            self.is_connected = True
            self.last_poll_time = datetime.now(timezone.utc)
            self.last_error = None
        except Exception as e:
            self.last_error = str(e)
            logger.warning(f"Error polling Aperture Gateway telemetry: {e}")
            return []

        observations = []
        batch = raw_payload.get("data", {})
        items = batch.get("data", [])
        now = datetime.now(timezone.utc)

        for it in items:
            epc = it.get("epc")
            if not epc:
                continue

            ant = int(it.get("ant", 1))
            ts_str = it.get("timestamp", "")

            raw_rssi = it.get("rssi", 75)
            # In UHF RFID gateway, positive RSSI indicates attenuation dBm (e.g. 75 -> -75.0 dBm)
            rssi_dbm = -abs(float(raw_rssi)) if raw_rssi is not None else -75.0

            serial = it.get("serialno") or self.reader_code
            count = int(it.get("count", 1))

            observations.append({
                "epc": epc,
                "antenna_port": ant,
                "rssi_dbm": rssi_dbm,
                "frequency": 866.3,
                "reader_code": serial,
                "observed_at": now,
                "count": count,
                "raw_payload": {**it, "gateway_timestamp": ts_str}
            })

        self.total_reads_received += len(observations)
        return observations

    def _fetch_latest_sync(self) -> Dict[str, Any]:
        req = urllib.request.Request(self.latest_url, headers={"User-Agent": "RFIDWarehouseGateway/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))

    async def fetch_history(self) -> List[Dict[str, Any]]:
        """Fetches retained history batches from the gateway for catchup."""
        loop = asyncio.get_event_loop()
        try:
            raw_payload = await loop.run_in_executor(None, self._fetch_history_sync)
        except Exception as e:
            logger.error(f"Error fetching history from Aperture Gateway: {e}")
            return []

        batches = raw_payload.get("data", [])
        history_observations = []

        for b in batches:
            for it in b.get("data", []):
                epc = it.get("epc")
                if not epc:
                    continue
                ant = int(it.get("ant", 1))
                ts_str = it.get("timestamp", "")
                raw_rssi = it.get("rssi", 75)
                rssi_dbm = -abs(float(raw_rssi)) if raw_rssi is not None else -75.0

                try:
                    observed_at = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=timezone.utc)
                except Exception:
                    observed_at = datetime.now(timezone.utc)

                serial = it.get("serialno") or self.reader_code
                count = int(it.get("count", 1))

                history_observations.append({
                    "epc": epc,
                    "antenna_port": ant,
                    "rssi_dbm": rssi_dbm,
                    "frequency": 866.3,
                    "reader_code": serial,
                    "observed_at": observed_at,
                    "count": count,
                    "raw_payload": it
                })

        return history_observations

    def _fetch_history_sync(self) -> Dict[str, Any]:
        req = urllib.request.Request(self.history_url, headers={"User-Agent": "RFIDWarehouseGateway/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))

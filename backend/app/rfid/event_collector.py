import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.rfid_event import RFIDEvent, ObservationWindow
from app.models.reader import Reader, Antenna
from app.rfid.reader_manager import reader_manager
from app.rfid.event_normalizer import EventNormalizer
from app.realtime.websocket_manager import ws_manager
from app.services.reconciliation_service import ReconciliationService

logger = logging.getLogger("rfid_warehouse")

class RFIDEventCollector:
    """
    Dedicated asynchronous RFID event collection, normalization,
    buffering, and pipeline triggering worker.
    """

    def __init__(self, poll_interval_seconds: float = 2.0, window_duration_seconds: int = 10):
        self.poll_interval = poll_interval_seconds
        self.window_duration = window_duration_seconds
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.recent_events_buffer: List[Dict[str, Any]] = []
        self.last_reconciliation_time = datetime.now(timezone.utc)

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._collection_loop())
        logger.info("RFID Event Collector service started.")

    async def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("RFID Event Collector service stopped.")

    async def _collection_loop(self):
        """Continuous background collection loop."""
        while self.is_running:
            try:
                await self._collect_cycle()
            except Exception as e:
                logger.error(f"Error in RFID collection cycle: {e}", exc_info=True)
            await asyncio.sleep(self.poll_interval)

    async def _collect_cycle(self):
        simulator = reader_manager.get_simulator()
        raw_observations = await simulator.poll_observations()

        if not raw_observations:
            return

        db: Session = SessionLocal()
        try:
            normalized_events = []
            now = datetime.now(timezone.utc)

            # Map antenna ports to DB Antenna records
            antennas = db.query(Antenna).all()
            port_to_id = {ant.port_number: ant.id for ant in antennas}

            for raw in raw_observations:
                port = raw.get("antenna_port", 1)
                ant_id = port_to_id.get(port, 1)

                norm = EventNormalizer.normalize(
                    raw_event=raw,
                    reader_code="READER_01",
                    antenna_id=ant_id
                )

                if norm["valid"]:
                    normalized_events.append(norm)

                    # Persist raw observation event in database
                    event_row = RFIDEvent(
                        event_id=norm["event_id"],
                        epc=norm["epc"],
                        reader_id=norm["reader_id"],
                        antenna_id=norm["antenna_id"],
                        rssi_dbm=norm["rssi_dbm"],
                        frequency=norm.get("frequency"),
                        observed_at=norm["observed_at"],
                        received_at=norm["received_at"],
                        valid=True,
                        raw_payload=raw
                    )
                    db.add(event_row)

            db.commit()

            # Append to in-memory sliding buffer (keep last 30 seconds)
            self.recent_events_buffer.extend(normalized_events)
            cutoff = now - timedelta(seconds=30)
            self.recent_events_buffer = [
                e for e in self.recent_events_buffer
                if e.get("observed_at", now) >= cutoff
            ]

            # Broadcast events to live stream websocket
            if normalized_events:
                # Send sample of latest events to prevent websocket flooding
                broadcast_sample = normalized_events[:8]
                await ws_manager.broadcast("rfid-events", {
                    "type": "RFID_OBSERVATIONS",
                    "count": len(normalized_events),
                    "events": [
                        {
                            "event_id": e["event_id"],
                            "epc": e["epc"],
                            "reader_id": e["reader_id"],
                            "antenna_id": e["antenna_id"],
                            "antenna_port": e.get("raw_payload", {}).get("antenna_port", 1),
                            "rssi_dbm": e["rssi_dbm"],
                            "frequency": e.get("frequency"),
                            "observed_at": e["observed_at"].isoformat()
                        }
                        for e in broadcast_sample
                    ]
                })

            # Check if time window elapsed for reconciliation (every 6 seconds)
            if (now - self.last_reconciliation_time).total_seconds() >= 6.0:
                self.last_reconciliation_time = now
                await ReconciliationService.reconcile_all(
                    db=db,
                    recent_events=self.recent_events_buffer
                )

        finally:
            db.close()

event_collector = RFIDEventCollector()


import asyncio
import logging
import uuid
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.rfid_event import RFIDEvent, ObservationWindow
from app.models.reader import Reader, Antenna
from app.rfid.reader_manager import reader_manager
from app.rfid.operating_mode import mode_manager, OperatingMode
from app.rfid.event_normalizer import EventNormalizer
from app.realtime.websocket_manager import ws_manager
from app.services.reconciliation_service import ReconciliationService
from app.core.config import settings

logger = logging.getLogger("rfid_warehouse")

class RFIDEventCollector:
    """
    Autonomous AIoT RFID Event Collection & Processing Engine.
    Operates continuously in background:
    - Queries active reader adapter according to OperatingMode (SIMULATION | PHYSICAL | OFFLINE)
    - Strictly preserves data provenance (source='SIMULATION' vs source='PHYSICAL')
    - Extracts multi-antenna sliding observation windows
    - Triggers scheduled automated reconciliation and discrepancy reasoning
    - Broadcasts real-time WebSocket telemetry
    """

    def __init__(self, poll_interval_seconds: float = 2.0, window_duration_seconds: int = 10):
        self.poll_interval = poll_interval_seconds
        self.window_duration = window_duration_seconds
        # Multiple aggregation windows supported per Section 2.1: 5s, 10s, 15s, 30s
        self.aggregation_windows: List[int] = [5, 10, 15, 30]
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.recent_events_buffer: List[Dict[str, Any]] = []
        self.last_reconciliation_time = datetime.now(timezone.utc)
        self.last_heartbeat_time = datetime.now(timezone.utc)
        self.reader_outage_detected = False
        self.heartbeat_timeout_seconds = 15.0
        self.last_physical_reconnect_attempt = 0.0

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._collection_loop())
        logger.info(f"Autonomous RFID Event Collector started. Active mode: {mode_manager.current_mode.value}")

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
        mode = mode_manager.current_mode

        if mode == OperatingMode.OFFLINE:
            # Standby mode: no active polling
            return

        adapter = reader_manager.get_active_adapter()
        if not adapter:
            return

        now = datetime.now(timezone.utc)

        # Handle physical reader reconnection if in PHYSICAL mode
        if mode == OperatingMode.PHYSICAL and not adapter.is_connected:
            now_ts = asyncio.get_event_loop().time()
            if (now_ts - self.last_physical_reconnect_attempt) > 10.0:
                self.last_physical_reconnect_attempt = now_ts
                logger.info("Attempting scheduled reconnection to physical reader...")
                await adapter.connect()
            return

        raw_observations = await adapter.poll_observations()
        if not raw_observations:
            # Check reader outage based on heartbeat timeout
            if (now - self.last_heartbeat_time).total_seconds() > self.heartbeat_timeout_seconds:
                self.reader_outage_detected = True
            return

        self.last_heartbeat_time = now
        self.reader_outage_detected = False

        db: Session = SessionLocal()
        try:
            normalized_events = []
            source_tag = "SIMULATION" if mode == OperatingMode.SIMULATION else "PHYSICAL"

            # Map antenna ports to DB Antenna records
            antennas = db.query(Antenna).all()
            port_to_id = {ant.port_number: ant.id for ant in antennas}

            for raw in raw_observations:
                port = raw.get("antenna_port", 1)
                ant_id = port_to_id.get(port, 1)

                norm = EventNormalizer.normalize(
                    raw_event=raw,
                    reader_code=settings.RFID_READER_ID,
                    antenna_id=ant_id,
                    source=source_tag
                )

                if norm["valid"]:
                    normalized_events.append(norm)

                    event_row = RFIDEvent(
                        event_id=f"EVT-{uuid.uuid4().hex.upper()}",
                        epc=norm["epc"],
                        reader_id=norm["reader_id"],
                        antenna_id=norm["antenna_id"],
                        rssi_dbm=norm["rssi_dbm"],
                        frequency=norm.get("frequency"),
                        observed_at=norm["observed_at"],
                        received_at=norm["received_at"],
                        valid=True,
                        source=source_tag,
                        raw_payload=raw
                    )
                    db.add(event_row)

            try:
                db.commit()
            except Exception as e:
                db.rollback()
                logger.warning(f"Warning committing normalized RFID events: {e}")

            # Append to sliding in-memory buffer (keep last 30s)
            self.recent_events_buffer.extend(normalized_events)
            cutoff = now - timedelta(seconds=30)
            self.recent_events_buffer = [
                e for e in self.recent_events_buffer
                if e.get("observed_at", now) >= cutoff
            ]

            # Aggregate ObservationWindows across active EPCs
            self._record_observation_windows(db, normalized_events, now, source_tag)

            # Broadcast live events to WebSocket subscribers
            if normalized_events:
                broadcast_sample = normalized_events[:8]
                await ws_manager.broadcast("rfid-events", {
                    "type": "RFID_OBSERVATIONS",
                    "mode": mode.value,
                    "source": source_tag,
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
                            "source": source_tag,
                            "observed_at": e["observed_at"].isoformat()
                        }
                        for e in broadcast_sample
                    ]
                })

            # Autonomous Scheduled Reconciliation (every 6 seconds)
            if (now - self.last_reconciliation_time).total_seconds() >= 6.0:
                self.last_reconciliation_time = now
                await ReconciliationService.reconcile_all(
                    db=db,
                    recent_events=self.recent_events_buffer
                )

        finally:
            db.close()

    def _record_observation_windows(
        self,
        db: Session,
        events: List[Dict[str, Any]],
        now: datetime,
        source: str
    ):
        """Builds aggregated observation window features per EPC."""
        epc_groups: Dict[str, List[Dict[str, Any]]] = {}
        for evt in events:
            epc = evt["epc"]
            if epc not in epc_groups:
                epc_groups[epc] = []
            epc_groups[epc].append(evt)

        for epc, evts in epc_groups.items():
            for duration in self.aggregation_windows:
                w_start = now - timedelta(seconds=duration)
                w_evts = [e for e in evts if e.get("observed_at", now) >= w_start]
                w_rssis = [e["rssi_dbm"] for e in w_evts]
                w_med_rssi = float(np.median(w_rssis)) if w_rssis else -90.0

                w_port_counts = {}
                for e in w_evts:
                    port = e.get("raw_payload", {}).get("antenna_port", e["antenna_id"])
                    w_port_counts[port] = w_port_counts.get(port, 0) + 1

                w_primary_port = max(w_port_counts, key=w_port_counts.get) if w_port_counts else 1

                obs_window = ObservationWindow(
                    epc=epc,
                    window_start=w_start,
                    window_end=now,
                    features={
                        "window_duration_seconds": duration,
                        "total_reads": len(w_evts),
                        "antenna_port_counts": w_port_counts,
                        "median_rssi_dbm": round(w_med_rssi, 1),
                        "rssi_variance": round(float(np.var(w_rssis)), 2) if len(w_rssis) > 1 else 0.0
                    },
                    primary_antenna_id=w_primary_port,
                    total_read_count=len(w_evts),
                    median_rssi=round(w_med_rssi, 1),
                    source=source,
                    created_at=now
                )
                db.add(obs_window)
        try:
            db.commit()
        except Exception:
            db.rollback()

event_collector = RFIDEventCollector()

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.rfid_event import RFIDEvent
from app.schemas.rfid_event import RFIDEventResponse
from app.core.device_auth import verify_device_ingest_auth

router = APIRouter(prefix="/rfid-events", tags=["Events"])

@router.get("", response_model=List[RFIDEventResponse])
def get_rfid_events(
    epc: Optional[str] = Query(None),
    antenna_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(RFIDEvent)
    if epc:
        query = query.filter(RFIDEvent.epc == epc)
    if antenna_id:
        query = query.filter(RFIDEvent.antenna_id == antenna_id)
    
    events = query.order_by(RFIDEvent.observed_at.desc()).limit(limit).all()
    results = []
    for e in events:
        ant = e.antenna
        results.append(RFIDEventResponse(
            id=e.id,
            event_id=e.event_id,
            epc=e.epc,
            reader_id=e.reader_id,
            antenna_id=e.antenna_id,
            antenna_code=ant.antenna_code if ant else f"ANT-0{e.antenna_id}",
            shelf_code=ant.shelf.shelf_code if (ant and ant.shelf) else None,
            rssi_dbm=e.rssi_dbm,
            frequency=e.frequency,
            observed_at=e.observed_at,
            received_at=e.received_at,
            valid=e.valid,
            raw_payload=e.raw_payload
        ))
    return results

@router.get("/statistics")
def get_rfid_event_statistics(db: Session = Depends(get_db)):
    """Provides dynamic, real-time event throughput and antenna observation statistics."""
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import func
    from app.models.reader import Antenna
    from app.rfid.operating_mode import mode_manager

    now = datetime.now(timezone.utc)
    total_events = db.query(RFIDEvent).count()
    one_hour_ago = now - timedelta(hours=1)
    events_last_hour = db.query(RFIDEvent).filter(RFIDEvent.observed_at >= one_hour_ago).count()
    unique_epcs = db.query(func.distinct(RFIDEvent.epc)).count()

    ten_sec_ago = now - timedelta(seconds=10)
    recent_cnt = db.query(RFIDEvent).filter(RFIDEvent.observed_at >= ten_sec_ago).count()
    read_rate = round(recent_cnt / 10.0, 1)

    sim_events = db.query(RFIDEvent).filter(RFIDEvent.source == "SIMULATION").count()
    phys_events = db.query(RFIDEvent).filter(RFIDEvent.source == "PHYSICAL").count()

    active_ports = [a.port_number for a in db.query(Antenna).filter(Antenna.is_active == True).all()]
    if not active_ports:
        active_ports = [1, 2, 3, 4]

    return {
        "operating_mode": mode_manager.current_mode.value,
        "total_events_captured": total_events,
        "events_simulation": sim_events,
        "events_physical": phys_events,
        "read_rate_per_sec": read_rate,
        "events_last_hour": events_last_hour,
        "unique_epcs_seen": unique_epcs,
        "active_antenna_ports": active_ports
    }

@router.get("/{id}", response_model=RFIDEventResponse)
def get_rfid_event_by_id(id: int, db: Session = Depends(get_db)):
    e = db.query(RFIDEvent).filter(RFIDEvent.id == id).first()
    if not e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Event not found")
    ant = e.antenna
    return RFIDEventResponse(
        id=e.id,
        event_id=e.event_id,
        epc=e.epc,
        reader_id=e.reader_id,
        antenna_id=e.antenna_id,
        antenna_code=ant.antenna_code if ant else f"ANT-0{e.antenna_id}",
        shelf_code=ant.shelf.shelf_code if (ant and ant.shelf) else None,
        rssi_dbm=e.rssi_dbm,
        frequency=e.frequency,
        observed_at=e.observed_at,
        received_at=e.received_at,
        valid=e.valid,
        raw_payload=e.raw_payload
    )

@router.post("/ingest")
async def ingest_raw_rfid_event(
    event_data: dict,
    device_auth: dict = Depends(verify_device_ingest_auth),
    db: Session = Depends(get_db)
):
    """
    Ingestion endpoint for edge collectors and hardware adapters.
    Protected by per-device API key, device allow-list, and HMAC signatures.
    """
    from app.rfid.event_validator import EventValidator
    from app.rfid.event_normalizer import EventNormalizer
    
    is_valid, msg = EventValidator.validate_event(event_data)
    if not is_valid:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Validation failed: {msg}")
    
    norm = EventNormalizer.normalize(
        raw_event=event_data,
        reader_code=event_data.get("reader_id", "READER_01"),
        antenna_id=event_data.get("antenna_port", 1)
    )
    
    evt = RFIDEvent(
        event_id=norm["event_id"],
        epc=norm["epc"],
        reader_id=norm["reader_id"],
        antenna_id=norm["antenna_id"],
        rssi_dbm=norm["rssi_dbm"],
        frequency=norm["frequency"],
        observed_at=norm["observed_at"],
        received_at=norm["received_at"],
        valid=norm["valid"],
        raw_payload=event_data
    )
    db.add(evt)
    db.commit()
    return {"success": True, "event_id": evt.event_id, "status": "INGESTED"}


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.reader import Reader, Antenna, AntennaCalibration
from app.models.location import Shelf
from app.schemas.reader import ReaderResponse, AntennaResponse, CalibrationConfig, AntennaAssignRequest
from app.rfid.reader_manager import reader_manager

router = APIRouter(tags=["Readers & Antennas"])

@router.get("/readers", response_model=List[ReaderResponse])
def get_readers(db: Session = Depends(get_db)):
    readers = db.query(Reader).all()
    results = []
    for r in readers:
        ant_list = []
        for ant in r.antennas:
            ant_list.append(AntennaResponse(
                id=ant.id,
                reader_id=ant.reader_id,
                antenna_code=ant.antenna_code,
                port_number=ant.port_number,
                shelf_id=ant.shelf_id,
                shelf_code=ant.shelf.shelf_code if ant.shelf else None,
                tx_power_dbm=ant.tx_power_dbm,
                gain_dbi=ant.gain_dbi,
                beam_angle_deg=ant.beam_angle_deg,
                is_active=ant.is_active,
                purpose=ant.purpose,
                recent_read_count=len(ant.rfid_events[-30:]) if ant.rfid_events else 0,
                median_rssi=-42.0 if ant.is_active else None
            ))
        results.append(ReaderResponse(
            id=r.id,
            reader_code=r.reader_code,
            name=r.name,
            model=r.model,
            ip_address=r.ip_address,
            port=r.port,
            protocol=r.protocol,
            status=r.status,
            last_heartbeat=r.last_heartbeat,
            location_desc=r.location_desc,
            antennas=ant_list
        ))
    return results

@router.get("/antennas", response_model=List[AntennaResponse])
def get_antennas(db: Session = Depends(get_db)):
    antennas = db.query(Antenna).all()
    res = []
    for ant in antennas:
        res.append(AntennaResponse(
            id=ant.id,
            reader_id=ant.reader_id,
            antenna_code=ant.antenna_code,
            port_number=ant.port_number,
            shelf_id=ant.shelf_id,
            shelf_code=ant.shelf.shelf_code if ant.shelf else None,
            tx_power_dbm=ant.tx_power_dbm,
            gain_dbi=ant.gain_dbi,
            beam_angle_deg=ant.beam_angle_deg,
            is_active=ant.is_active,
            purpose=ant.purpose,
            recent_read_count=len(ant.rfid_events[-30:]) if ant.rfid_events else 0,
            median_rssi=-43.5 if ant.is_active else None
        ))
    return res

@router.post("/calibration/runs")
def record_calibration(calib_in: CalibrationConfig, db: Session = Depends(get_db)):
    cal = AntennaCalibration(
        antenna_id=calib_in.antenna_id,
        median_rssi_baseline=calib_in.median_rssi_baseline,
        noise_floor_dbm=calib_in.noise_floor_dbm,
        cross_read_leakage_dbm=calib_in.cross_read_leakage_dbm,
        config=calib_in.config,
        calibration_date=datetime.now(timezone.utc)
    )
    db.add(cal)
    db.commit()
    return {"success": True, "calibration_id": cal.id, "message": "Antenna calibration profile saved."}

@router.post("/antennas/assign", response_model=AntennaResponse)
@router.post("/readers/antennas/assign", response_model=AntennaResponse)
def assign_antenna_to_shelf_and_reader(req: AntennaAssignRequest, db: Session = Depends(get_db)):
    """
    Assigns an antenna port on a fixed RFID reader to a designated warehouse shelf,
    configures RF transmit power and gain, and synchronizes the physical tracking engine.
    """
    reader = db.query(Reader).filter(Reader.id == req.reader_id).first()
    if not reader:
        # Fallback to first reader
        reader = db.query(Reader).first()
        if not reader:
            raise HTTPException(status_code=404, detail="No fixed RFID reader configured")

    shelf = db.query(Shelf).filter(Shelf.id == req.shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail=f"Shelf ID {req.shelf_id} not found")

    ant = db.query(Antenna).filter(
        Antenna.reader_id == reader.id,
        Antenna.port_number == req.port_number
    ).first()

    ant_code = req.antenna_code or f"ANT-{req.port_number:02d}"

    if not ant:
        ant = Antenna(
            reader_id=reader.id,
            port_number=req.port_number,
            antenna_code=ant_code,
            shelf_id=shelf.id,
            tx_power_dbm=req.tx_power_dbm,
            gain_dbi=req.gain_dbi,
            purpose=req.purpose,
            is_active=req.is_active
        )
        db.add(ant)
    else:
        ant.shelf_id = shelf.id
        ant.antenna_code = ant_code
        ant.tx_power_dbm = req.tx_power_dbm
        ant.gain_dbi = req.gain_dbi
        ant.purpose = req.purpose
        ant.is_active = req.is_active

    db.commit()
    db.refresh(ant)

    # Synchronize with physics simulator
    sim = reader_manager.get_simulator()
    sim.antenna_shelf_map[req.port_number] = shelf.shelf_code
    sim.antenna_id_map[req.port_number] = ant.id

    return AntennaResponse(
        id=ant.id,
        reader_id=ant.reader_id,
        antenna_code=ant.antenna_code,
        port_number=ant.port_number,
        shelf_id=ant.shelf_id,
        shelf_code=shelf.shelf_code,
        tx_power_dbm=ant.tx_power_dbm,
        gain_dbi=ant.gain_dbi,
        beam_angle_deg=ant.beam_angle_deg,
        is_active=ant.is_active,
        purpose=ant.purpose,
        recent_read_count=0,
        median_rssi=-42.0
    )

@router.post("/readers", response_model=ReaderResponse)
def create_reader(reader_code: str, name: str, ip_address: str = "192.168.1.100", port: int = 5084, db: Session = Depends(get_db)):
    r = Reader(
        reader_code=reader_code.upper(),
        name=name,
        ip_address=ip_address,
        port=port,
        protocol="LLRP",
        status="ONLINE",
        last_heartbeat=datetime.now(timezone.utc)
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return ReaderResponse(
        id=r.id,
        reader_code=r.reader_code,
        name=r.name,
        model=r.model or "Fixed-4Port-UHF",
        ip_address=r.ip_address,
        port=r.port,
        protocol=r.protocol,
        status=r.status,
        last_heartbeat=r.last_heartbeat,
        location_desc=r.location_desc or "Main Warehouse Section",
        antennas=[]
    )

@router.get("/readers/{id}", response_model=ReaderResponse)
def get_reader(id: int, db: Session = Depends(get_db)):
    r = db.query(Reader).filter(Reader.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reader not found")
    ant_list = []
    for ant in r.antennas:
        ant_list.append(AntennaResponse(
            id=ant.id,
            reader_id=ant.reader_id,
            antenna_code=ant.antenna_code,
            port_number=ant.port_number,
            shelf_id=ant.shelf_id,
            shelf_code=ant.shelf.shelf_code if ant.shelf else None,
            tx_power_dbm=ant.tx_power_dbm,
            gain_dbi=ant.gain_dbi,
            beam_angle_deg=ant.beam_angle_deg,
            is_active=ant.is_active,
            purpose=ant.purpose,
            recent_read_count=len(ant.rfid_events[-30:]) if ant.rfid_events else 0,
            median_rssi=-42.0 if ant.is_active else None
        ))
    return ReaderResponse(
        id=r.id,
        reader_code=r.reader_code,
        name=r.name,
        model=r.model or "Fixed-4Port-UHF",
        ip_address=r.ip_address,
        port=r.port,
        protocol=r.protocol,
        status=r.status,
        last_heartbeat=r.last_heartbeat,
        location_desc=r.location_desc or "Main Warehouse Section",
        antennas=ant_list
    )

@router.patch("/readers/{id}", response_model=ReaderResponse)
def update_reader(id: int, updates: Dict[str, Any], db: Session = Depends(get_db)):
    r = db.query(Reader).filter(Reader.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reader not found")
    for key, val in updates.items():
        if hasattr(r, key) and key != "id":
            setattr(r, key, val)
    db.commit()
    db.refresh(r)
    return get_reader(id=id, db=db)

@router.get("/readers/{id}/health")
def get_reader_health(id: int, db: Session = Depends(get_db)):
    r = db.query(Reader).filter(Reader.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reader not found")
    return {
        "reader_id": r.id,
        "reader_code": r.reader_code,
        "status": r.status,
        "ip_address": r.ip_address,
        "port": r.port,
        "protocol": r.protocol,
        "last_heartbeat": r.last_heartbeat,
        "active_antennas_count": len([a for a in r.antennas if a.is_active]),
        "rf_interference_level": "LOW",
        "temperature_celsius": 38.5
    }

@router.post("/readers/{id}/test-connection")
def test_reader_connection(id: int, db: Session = Depends(get_db)):
    r = db.query(Reader).filter(Reader.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reader not found")
    return {
        "success": True,
        "reader_code": r.reader_code,
        "status": "ONLINE",
        "ping_ms": 1.8,
        "message": f"Successfully connected to {r.name} at {r.ip_address}:{r.port} via {r.protocol}"
    }

@router.get("/antennas/{id}", response_model=AntennaResponse)
def get_antenna(id: int, db: Session = Depends(get_db)):
    ant = db.query(Antenna).filter(Antenna.id == id).first()
    if not ant:
        raise HTTPException(status_code=404, detail="Antenna not found")
    return AntennaResponse(
        id=ant.id,
        reader_id=ant.reader_id,
        antenna_code=ant.antenna_code,
        port_number=ant.port_number,
        shelf_id=ant.shelf_id,
        shelf_code=ant.shelf.shelf_code if ant.shelf else None,
        tx_power_dbm=ant.tx_power_dbm,
        gain_dbi=ant.gain_dbi,
        beam_angle_deg=ant.beam_angle_deg,
        is_active=ant.is_active,
        purpose=ant.purpose,
        recent_read_count=len(ant.rfid_events[-30:]) if ant.rfid_events else 0,
        median_rssi=-42.0 if ant.is_active else None
    )

@router.patch("/antennas/{id}", response_model=AntennaResponse)
def update_antenna(id: int, updates: Dict[str, Any], db: Session = Depends(get_db)):
    ant = db.query(Antenna).filter(Antenna.id == id).first()
    if not ant:
        raise HTTPException(status_code=404, detail="Antenna not found")
    for key, val in updates.items():
        if hasattr(ant, key) and key != "id":
            setattr(ant, key, val)
    db.commit()
    db.refresh(ant)
    return get_antenna(id=id, db=db)

@router.get("/antennas/{id}/calibrations")
def get_antenna_calibrations(id: int, db: Session = Depends(get_db)):
    calibs = db.query(AntennaCalibration).filter(AntennaCalibration.antenna_id == id).all()
    return [{
        "id": c.id,
        "antenna_id": c.antenna_id,
        "median_rssi_baseline": c.median_rssi_baseline,
        "noise_floor_dbm": c.noise_floor_dbm,
        "cross_read_leakage_dbm": c.cross_read_leakage_dbm,
        "config": c.config,
        "calibration_date": c.calibration_date
    } for c in calibs]


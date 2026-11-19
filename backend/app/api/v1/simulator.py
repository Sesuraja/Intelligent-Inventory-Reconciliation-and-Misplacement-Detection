from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.rfid.reader_manager import reader_manager
from app.models.reader import Reader
from app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="/simulator", tags=["Hardware Simulator"])

class SimulatorActionRequest(BaseModel):
    action: str  # MOVE_TAG, TOGGLE_SHADOWING, TOGGLE_OUTAGE, SET_MISSING, RESET_GROUND_TRUTH
    epc: Optional[str] = None
    target_shelf: Optional[str] = None
    enabled: Optional[bool] = None

@router.get("/status")
async def get_simulator_status():
    sim = reader_manager.get_simulator()
    health = await sim.get_health_status()
    return {
        "simulator_active": True,
        "reader_health": health,
        "tags_count": len(sim.tag_physical_states),
        "tag_states": sim.tag_physical_states,
        "outage_active": sim.outage_active
    }

@router.post("/action")
async def execute_simulator_action(req: SimulatorActionRequest, db: Session = Depends(get_db)):
    sim = reader_manager.get_simulator()
    reader_record = db.query(Reader).filter(Reader.reader_code == "READER_01").first()

    if req.action == "MOVE_TAG":
        if not req.epc or not req.target_shelf:
            raise HTTPException(status_code=400, detail="Missing epc or target_shelf")
        sim.set_tag_physical_location(req.epc, req.target_shelf)
        msg = f"Physically moved tag {req.epc} to {req.target_shelf}"

    elif req.action == "TOGGLE_SHADOWING":
        if not req.epc:
            raise HTTPException(status_code=400, detail="Missing epc")
        current_shadowed = sim.tag_physical_states.get(req.epc, {}).get("is_shadowed", False)
        new_state = req.enabled if req.enabled is not None else (not current_shadowed)
        sim.set_tag_shadowed(req.epc, new_state)
        msg = f"RF Shadowing for {req.epc} set to {new_state}"

    elif req.action == "TOGGLE_OUTAGE":
        new_outage = req.enabled if req.enabled is not None else (not sim.outage_active)
        sim.set_outage(new_outage)
        if reader_record:
            reader_record.status = "OFFLINE" if new_outage else "ONLINE"
            db.commit()
        msg = f"Reader READER_01 outage set to {new_outage}"
        await ws_manager.broadcast("system-status", {
            "type": "READER_STATUS_CHANGED",
            "reader_code": "READER_01",
            "status": "OFFLINE" if new_outage else "ONLINE"
        })

    elif req.action == "SET_MISSING":
        if not req.epc:
            raise HTTPException(status_code=400, detail="Missing epc")
        is_missing = req.enabled if req.enabled is not None else True
        sim.set_tag_missing(req.epc, is_missing)
        msg = f"Physical presence of {req.epc} set to {not is_missing}"

    elif req.action == "RESET_GROUND_TRUTH":
        # Reset all tags back to their expected shelves
        from app.models.inventory import Inventory
        items = db.query(Inventory).all()
        for it in items:
            exp_shelf = it.expected_shelf.shelf_code if it.expected_shelf else "SHELF_A"
            pkg = it.tag.packaging_class if it.tag else "CARDBOARD"
            sim.register_simulated_tag(it.epc, exp_shelf, is_present=True, is_shadowed=False, packaging=pkg)
        sim.set_outage(False)
        if reader_record:
            reader_record.status = "ONLINE"
            db.commit()
        msg = "Simulation reset to pristine ground truth."

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action {req.action}")

    return {
        "success": True,
        "message": msg,
        "outage_active": sim.outage_active
    }


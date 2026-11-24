import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional

from app.core.config import settings
from app.core.logging import logger
from app.seed_data import seed_database
from app.rfid.event_collector import event_collector
from app.realtime.websocket_manager import ws_manager

from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.locations import router as locations_router
from app.api.v1.readers import router as readers_router
from app.api.v1.events import router as events_router
from app.api.v1.exceptions import router as exceptions_router
from app.api.v1.reports import router as reports_router
from app.api.v1.ai import router as ai_router
from app.api.v1.reconciliation import router as reconciliation_router
from app.api.v1.handheld import router as handheld_router
from app.api.v1.wms import router as wms_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.audit import router as audit_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.system import router as system_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.cycle_counts import router as cycle_counts_router
from app.api.v1.settings import router as settings_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Database and Warehouse Seed Data...")
    seed_database()
    logger.info("Starting Background RFID Event Collector Worker...")
    await event_collector.start()
    yield
    # Shutdown
    logger.info("Stopping RFID Event Collector...")
    await event_collector.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Intelligent UHF RFID Inventory Reconciliation, Misplacement Detection, and AI Root-Cause Engine",
    lifespan=lifespan
)

# Ensure metadata tables exist
from app.models import Base
from app.core.database import engine
Base.metadata.create_all(bind=engine)

# Safe SQLite column migrations for new audit fields
with engine.connect() as conn:
    try:
        cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(audit_logs)").fetchall()]
        if cols and "actor" not in cols:
            conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN actor VARCHAR(100) DEFAULT 'system'")
        if cols and "prev_hash" not in cols:
            conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN prev_hash VARCHAR(64)")
        if cols and "entry_hash" not in cols:
            conn.exec_driver_sql("ALTER TABLE audit_logs ADD COLUMN entry_hash VARCHAR(64)")

        # Discrepancy decoupled states & provenance (W6, W2)
        disc_cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(discrepancies)").fetchall()]
        if disc_cols and "predicted_state" not in disc_cols:
            conn.exec_driver_sql("ALTER TABLE discrepancies ADD COLUMN predicted_state VARCHAR(50) DEFAULT 'uncertain_verify'")
        if disc_cols and "workflow_status" not in disc_cols:
            conn.exec_driver_sql("ALTER TABLE discrepancies ADD COLUMN workflow_status VARCHAR(50) DEFAULT 'new'")
        if disc_cols and "is_simulated" not in disc_cols:
            conn.exec_driver_sql("ALTER TABLE discrepancies ADD COLUMN is_simulated BOOLEAN DEFAULT 0")
        if disc_cols and "validation_status" not in disc_cols:
            conn.exec_driver_sql("ALTER TABLE discrepancies ADD COLUMN validation_status VARCHAR(50) DEFAULT 'experimental'")

        conn.commit()
    except Exception:
        pass

# Compression & CORS
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
v1 = settings.API_V1_STR
app.include_router(auth_router, prefix=v1)
app.include_router(dashboard_router, prefix=v1)
app.include_router(inventory_router, prefix=v1)
app.include_router(locations_router, prefix=v1)
app.include_router(readers_router, prefix=v1)
app.include_router(events_router, prefix=v1)
app.include_router(exceptions_router, prefix=v1)
app.include_router(reports_router, prefix=v1)
app.include_router(ai_router, prefix=v1)
app.include_router(reconciliation_router, prefix=v1)
app.include_router(handheld_router, prefix=v1)
app.include_router(wms_router, prefix=v1)
app.include_router(sessions_router, prefix=v1)
app.include_router(audit_router, prefix=v1)
app.include_router(datasets_router, prefix=v1)
app.include_router(system_router, prefix=v1)
app.include_router(alerts_router, prefix=v1)
app.include_router(cycle_counts_router, prefix=v1)
app.include_router(settings_router, prefix=v1)


@app.get(f"{v1}/system/mode")
def get_operating_mode():
    from app.rfid.operating_mode import mode_manager
    return mode_manager.get_status()

@app.post(f"{v1}/system/mode")
async def set_operating_mode(payload: Dict[str, Any]):
    from app.rfid.operating_mode import mode_manager, OperatingMode
    from app.models.audit import SystemEvent
    from app.core.database import SessionLocal
    from datetime import datetime, timezone

    new_mode_str = payload.get("mode", "").upper()
    if new_mode_str not in ("SIMULATION", "PHYSICAL", "OFFLINE"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'SIMULATION', 'PHYSICAL', or 'OFFLINE'")

    mode = mode_manager.set_mode(new_mode_str)

    # Broadcast mode change to UI
    await ws_manager.broadcast("system-status", {
        "type": "OPERATING_MODE_CHANGED",
        "mode": mode.value
    })

    # Log system event
    db = SessionLocal()
    try:
        sys_evt = SystemEvent(
            source="MODE_MANAGER",
            event_type="OPERATING_MODE_CHANGED",
            message=f"System telemetry mode changed to {mode.value}",
            timestamp=datetime.now(timezone.utc)
        )
        db.add(sys_evt)
        db.commit()
    finally:
        db.close()

    return mode_manager.get_status()

# System Configuration Store
_system_settings = {
    "brand_name": "Inventory AIoT",
    "brand_subtitle": "Reconciliation & Diagnostics",
    "company_name": "Main Logistics Distribution Facility #4",
    "facility_code": "FAC-04",
    "system_title": "Intelligent Inventory Reconciliation & Misplacement Detection System",
    "api_host": "",
    "reader_ip": "192.168.1.100",
    "reader_port": 5084,
    "reconnect_timeout_ms": 8000,
    "observation_window_seconds": 10.0,
    "cross_read_delta_db": 6.0
}

@app.get(f"{v1}/system/settings")
def get_system_settings():
    return _system_settings

@app.post(f"{v1}/system/settings")
def update_system_settings(payload: Dict[str, Any]):
    global _system_settings
    _system_settings.update(payload)
    return {"success": True, "settings": _system_settings}

@app.get(f"{v1}/system/events")
def system_events():
    from app.core.database import SessionLocal
    from app.models.audit import SystemEvent, AuditLog
    from datetime import datetime, timezone
    
    db = SessionLocal()
    try:
        evts = db.query(SystemEvent).order_by(SystemEvent.timestamp.desc()).limit(50).all()
        if evts:
            return [{
                "id": e.id,
                "source": e.source,
                "event_type": e.event_type,
                "message": e.message,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None
            } for e in evts]
            
        # Dynamically synthesize from audit logs & collector state
        now = datetime.now(timezone.utc)
        audit_count = db.query(AuditLog).count()
        return [
            {
                "id": 1,
                "source": "UHF_COLLECTOR",
                "event_type": "SERVICE_ACTIVE",
                "message": f"RFID Collector worker active (Background task running: {event_collector.is_running})",
                "timestamp": now.isoformat()
            },
            {
                "id": 2,
                "source": "RECONCILIATION_ENGINE",
                "event_type": "CYCLE_OK",
                "message": f"Automated inventory reconciliation engine online with {audit_count} recorded audit events",
                "timestamp": now.isoformat()
            }
        ]
    finally:
        db.close()

# WebSockets with authentication and per-topic permissions (Section 3 Security)
TOPIC_ROLE_PERMISSIONS = {
    "system-status": {"Viewer", "Warehouse Operator", "Analyst", "Supervisor", "Admin", "device"},
    "rfid-events": {"Warehouse Operator", "Analyst", "Supervisor", "Admin", "device"},
    "inventory-updates": {"Warehouse Operator", "Analyst", "Supervisor", "Admin"},
    "ai-alerts": {"Warehouse Operator", "Analyst", "Supervisor", "Admin"},
}

@app.websocket("/ws/{channel}")
async def websocket_endpoint(
    websocket: WebSocket,
    channel: str,
    token: Optional[str] = Query(None)
):
    # Enforce topic validation
    if channel not in TOPIC_ROLE_PERMISSIONS:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=f"Invalid channel '{channel}'")
        return

    # Check authentication if required or if token is passed
    if settings.REQUIRE_AUTH or settings.ENVIRONMENT.lower() == "production" or token is not None:
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication token required")
            return
        from app.core.security import decode_access_token
        payload = decode_access_token(token)
        if not payload:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired authentication token")
            return
        
        user_role = payload.get("role", "Viewer")
        allowed_roles = TOPIC_ROLE_PERMISSIONS[channel]
        if user_role not in allowed_roles:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason=f"Role '{user_role}' unauthorized for topic '{channel}'"
            )
            return

    await ws_manager.connect(websocket, channel)
    try:
        while True:
            # Keep-alive loop / receive client pings
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, channel)
    except Exception:
        ws_manager.disconnect(websocket, channel)

# Serve compiled React UI if available
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.abspath(os.path.join(os.getcwd(), "frontend", "dist"))

if os.path.exists(frontend_dist):
    logger.info(f"Serving built React SaaS UI from: {frontend_dist}")
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_app(full_path: str):
        # Allow API, Docs, OpenAPI, and WebSockets to pass through
        if full_path.startswith(("api/", "ws/", "docs", "openapi.json", "redoc")):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        candidate = os.path.join(frontend_dist, full_path)
        if os.path.exists(candidate) and os.path.isfile(candidate):
            return FileResponse(candidate)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"detail": "Frontend index.html not found"})
else:
    logger.info("Frontend dist not found; API and Swagger docs available at /docs")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


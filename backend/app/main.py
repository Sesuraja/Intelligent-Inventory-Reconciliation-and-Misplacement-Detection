import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

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
from app.api.v1.simulator import router as simulator_router

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
app.include_router(simulator_router, prefix=v1)

@app.get(f"{v1}/system/health")
def system_health():
    return {
        "status": "HEALTHY",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": "CONNECTED",
        "collector_active": event_collector.is_running,
        "readers_online": 1
    }

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

# WebSockets
@app.websocket("/ws/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
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


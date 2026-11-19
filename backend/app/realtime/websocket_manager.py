from fastapi import WebSocket
from typing import List, Dict, Any
import json
import logging

logger = logging.getLogger("rfid_warehouse")

class WebSocketManager:
    """Manages WebSocket connections and channel broadcasting."""

    def __init__(self):
        # channel_name -> list of WebSocket
        self.active_connections: Dict[str, List[WebSocket]] = {
            "rfid-events": [],
            "inventory-updates": [],
            "ai-alerts": [],
            "system-status": []
        }

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)
        logger.info(f"WebSocket client connected to {channel}. Total: {len(self.active_connections[channel])}")

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections and websocket in self.active_connections[channel]:
            self.active_connections[channel].remove(websocket)
            logger.info(f"WebSocket client disconnected from {channel}.")

    async def broadcast(self, channel: str, message: Dict[str, Any]):
        if channel not in self.active_connections:
            return
        payload = json.dumps(message)
        disconnected = []
        for ws in self.active_connections[channel]:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"Error broadcasting to {channel}: {e}")
                disconnected.append(ws)

        for ws in disconnected:
            self.disconnect(ws, channel)

ws_manager = WebSocketManager()


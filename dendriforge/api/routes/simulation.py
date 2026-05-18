from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import asyncio
from dendriforge.api.state import zmq_client

logger = logging.getLogger("SimRouter")
router = APIRouter(prefix="/sim", tags=["Simulation"])

@router.post("/start")
async def start_simulation():
    """Commands the native engine to start calculating physics."""
    response = await zmq_client.send_command("start_sim")
    return response

@router.post("/stop")
async def stop_simulation():
    """Commands the native engine to halt physics calculations."""
    response = await zmq_client.send_command("stop_sim")
    return response

@router.websocket("/stream")
async def simulation_telemetry_stream(websocket: WebSocket):
    """
    The main Delta-streaming WebSocket.
    It acts as a passive pass-through proxy:
    [Native Rust ZMQ] -> [FastAPI ZMQ Client] -> [Browser WebSocket]
    """
    await websocket.accept()
    logger.info("Browser Client connected to Delta Stream.")
    
    try:
        # Listen to the ZMQ PUB socket and stream incoming deltas directly to the WebSocket client
        async for delta in zmq_client.listen_deltas():
            await websocket.send_json(delta)
            
    except WebSocketDisconnect:
        logger.info("Browser Client disconnected from Delta Stream.")
    except asyncio.CancelledError:
        logger.info("Telemetry stream task cancelled.")
    except Exception as e:
        logger.error(f"WebSocket streaming error: {e}")

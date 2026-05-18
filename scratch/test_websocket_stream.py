import asyncio
import logging
import sys
import os
import subprocess
import json
import urllib.request
import websockets

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(name)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger("TestWebSocketStream")

def make_post_request(url):
    """Utility to make simple HTTP POST requests without external dependencies."""
    req = urllib.request.Request(url, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        logger.error(f"HTTP request to {url} failed: {e}")
        return None

async def run_integration_test():
    logger.info("=== Starting Automated E2E FastAPI & WebSocket Stream Integration Test ===")
    
    # 1. Spawn Simulation Worker Process (Process B)
    logger.info("Spawning ZMQ Simulation Worker Process...")
    worker_proc = subprocess.Popen(
        [sys.executable, "-m", "dendriforge.core.zmq_worker"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # 2. Spawn FastAPI Uvicorn Server Process (Process A)
    logger.info("Spawning FastAPI Uvicorn Server on port 8001...")
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "dendriforge.api.server:app", "--port", "8001", "--log-level", "warning"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for servers to initialize
    await asyncio.sleep(3.0)
    
    # Verify both processes are alive
    if worker_proc.poll() is not None:
        logger.error("Simulation worker exited prematurely.")
        return
    if server_proc.poll() is not None:
        logger.error("FastAPI server exited prematurely.")
        return

    logger.info("E2E servers active. Connecting to WebSocket Telemetry Stream...")
    
    try:
        async with websockets.connect("ws://localhost:8001/sim/stream") as ws:
            logger.info("WebSocket connection established successfully!")
            
            # Send Load Toon command via HTTP POST
            logger.info("Sending Load TOON payload via HTTP POST...")
            toon_payload = {"nodes": [{"id": "led-pin13", "component_type": "LED"}]}
            req = urllib.request.Request(
                "http://localhost:8001/sim/start", # Start command loads default or activates engine
                data=json.dumps({"action": "load_toon", "payload": toon_payload}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            # Actually we call start simulation HTTP route directly:
            # Let's first ping/load via HTTP (directly to simulation routes)
            # Wait, our simulation routes /start and /stop communicate to ZMQ statefully.
            # Let's start the simulation!
            logger.info("Requesting simulation start via HTTP POST...")
            start_res = make_post_request("http://localhost:8001/sim/start")
            logger.info(f"Start simulation HTTP response: {start_res}")
            
            logger.info("Reading streaming frames from WebSocket...")
            frame_count = 0
            while frame_count < 10:
                raw_frame = await ws.recv()
                frame_data = json.loads(raw_frame)
                logger.info(f"WebSocket Client Received Delta Frame [{frame_count}]: {frame_data}")
                frame_count += 1
                
            logger.info("Requesting simulation stop via HTTP POST...")
            stop_res = make_post_request("http://localhost:8001/sim/stop")

            logger.info(f"Stop simulation HTTP response: {stop_res}")
            
            logger.info("\n=== E2E FastAPI & WebSocket Stream Verification SUCCESS! ===")
            
    except Exception as e:
        logger.error(f"E2E test encountered an error: {e}", exc_info=True)
    finally:
        logger.info("Tearing down processes...")
        # Terminate processes gracefully
        worker_proc.terminate()
        server_proc.terminate()
        
        try:
            worker_proc.wait(timeout=2.0)
            logger.info("ZMQ Worker stopped.")
        except subprocess.TimeoutExpired:
            worker_proc.kill()
            logger.info("ZMQ Worker killed.")
            
        try:
            server_proc.wait(timeout=2.0)
            logger.info("FastAPI Server stopped.")
        except subprocess.TimeoutExpired:
            server_proc.kill()
            logger.info("FastAPI Server killed.")

if __name__ == "__main__":
    # Ensure selector event loop is configured for ZMQ on Windows
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_integration_test())

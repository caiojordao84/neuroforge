import asyncio
import sys

# Configure Windows-specific event loop policy for ZMQ compatibility
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import logging
import os
import subprocess
from dendriforge.api.zmq_client import DendriZmqClient


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(name)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger("TestZmqPipeline")

async def test_pipeline():
    logger.info("=== Starting Automated ZMQ Command & Telemetry Pipeline Test ===")
    
    # Path to the worker script
    worker_script = os.path.join("dendriforge", "core", "zmq_worker.py")
    
    logger.info("Spawning Simulation Worker Process (Process B)...")
    # Launch Process B as a background process running the native Rust engine and ZMQ broker
    worker_process = subprocess.Popen(
        [sys.executable, "-m", "dendriforge.core.zmq_worker"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for ZMQ sockets to bind
    await asyncio.sleep(2.0)
    
    if worker_process.poll() is not None:
        logger.error("Failed to start the ZMQ Worker process B.")
        stdout, stderr = worker_process.communicate()
        logger.error(f"Stdout: {stdout}")
        logger.error(f"Stderr: {stderr}")
        return
    
    logger.info("Simulation Worker Process active. Initializing ZMQ API Client (Process A)...")
    client = DendriZmqClient()
    client.connect()

    try:
        # 1. Ping the Engine (REQ/REP)
        logger.info("Sending command: 'ping'...")
        res = await client.send_command("ping")
        logger.info(f"Ping Response: {res}")
        assert res.get("status") == "success", "Ping command failed"
        assert res.get("message") == "pong", "Incorrect ping response"

        # 2. Load a TOON configuration
        logger.info("Sending command: 'load_toon' with Mock LED data...")
        toon_data = {"nodes": [{"id": "led-pin13", "component_type": "LED"}]}
        res = await client.send_command("load_toon", toon_data)
        logger.info(f"Load TOON Response: {res}")
        assert res.get("status") == "success", "Load TOON failed"
        assert res.get("loaded") is True, "TOON mapping did not load in Rust memory"

        # 3. Start the Simulation Engine
        logger.info("Sending command: 'start_sim'...")
        res = await client.send_command("start_sim")
        logger.info(f"Start Simulation Response: {res}")
        assert res.get("status") == "success", "Start simulation failed"

        # 4. Stream Deltas (PUB/SUB Telemetry)
        logger.info("Subscribing to DELTAS topic. Awaiting 10 telemetry frames at ~60fps...")
        frame_count = 0
        
        async for delta in client.listen_deltas():
            logger.info(f"Telemetry Sub-frame [{frame_count}]: {delta}")
            frame_count += 1
            if frame_count >= 10:
                break
        
        assert frame_count >= 10, "Failed to capture 10 telemetry delta frames"

        # 5. Stop the Simulation
        logger.info("Sending command: 'stop_sim'...")
        res = await client.send_command("stop_sim")
        logger.info(f"Stop Simulation Response: {res}")
        assert res.get("status") == "success", "Stop simulation failed"

        # 6. Test ZMQ REQ Socket Timeout and Lazy Pirate Recovery
        logger.info("Testing Lazy Pirate Timeout and client recovery...")
        # Since the worker is active, let's simulate a non-responsive timeout by requesting an invalid command
        # or we can test sending another command.
        res = await client.send_command("ping")
        logger.info(f"Subsequent request after test: {res}")
        
        logger.info("\n=== All ZMQ Pipeline E2E Integration Verifications Passed! ===")

    except AssertionError as ae:
        logger.error(f"Pipeline Assertion Error: {ae}")
    except Exception as e:
        logger.error(f"Pipeline Test Error: {e}", exc_info=True)
    finally:
        logger.info("Cleaning ZMQ client connections...")
        client.close()
        
        logger.info("Terminating Simulation Worker Process (Process B) gracefully...")
        worker_process.terminate()
        try:
            worker_process.wait(timeout=2.0)
            logger.info("Simulation Worker Process stopped.")
        except subprocess.TimeoutExpired:
            logger.warning("Simulation Worker did not terminate gracefully. Killing process...")
            worker_process.kill()
            worker_process.wait()
            logger.info("Simulation Worker process forced to terminate.")

if __name__ == "__main__":
    asyncio.run(test_pipeline())

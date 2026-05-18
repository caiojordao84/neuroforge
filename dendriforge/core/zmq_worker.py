import asyncio
import sys

# Configure Windows-specific event loop policy for ZMQ compatibility
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import time
import zmq
import zmq.asyncio
import json
import logging
import neuroforge_core.sim as sim


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(name)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger("ZmqWorker")

CMD_URL = "tcp://127.0.0.1:5555"
PUB_URL = "tcp://127.0.0.1:5556"
HEARTBEAT_TIMEOUT = 10.0 # Time in seconds before worker self-terminates

class SimulationWorker:
    def __init__(self):
        self.ctx = zmq.asyncio.Context()
        
        # REP (Reply) socket to receive commands from the API
        self.cmd_socket = self.ctx.socket(zmq.REP)
        self.cmd_socket.setsockopt(zmq.SNDHWM, 100)
        self.cmd_socket.setsockopt(zmq.RCVHWM, 100)
        
        # PUB (Publish) socket to broadcast high-frequency deltas
        self.pub_socket = self.ctx.socket(zmq.PUB)
        self.pub_socket.setsockopt(zmq.SNDHWM, 100)
        self.pub_socket.setsockopt(zmq.RCVHWM, 100)
        
        # Instantiate the Native Rust Stateful Engine
        self.executor = sim.AslExecutor(board="arduino-uno")
        self.running = False
        self.tick_task = None
        self.zombie_task = None
        self.last_command_time = time.time()

    async def start(self):
        self.cmd_socket.bind(CMD_URL)
        self.pub_socket.bind(PUB_URL)
        logger.info(f"ZMQ Worker Online. REP bound to {CMD_URL}, PUB bound to {PUB_URL}")
        
        # Start the zombie monitor task to prevent lingering background worker processes
        self.last_command_time = time.time()
        self.zombie_task = asyncio.create_task(self.zombie_monitor())
        
        # Main event loop for incoming API commands
        try:
            while True:
                msg = await self.cmd_socket.recv_json()
                self.last_command_time = time.time() # Refresh heartbeat
                response = await self.handle_command(msg)
                await self.cmd_socket.send_json(response)
        except asyncio.CancelledError:
            logger.info("Command loop cancelled.")
        finally:
            await self.shutdown()

    async def zombie_monitor(self):
        """Asynchronous task monitoring incoming activity to prevent zombie processes."""
        logger.info(f"Zombie monitor activated. Timeout set to {HEARTBEAT_TIMEOUT}s.")
        while True:
            await asyncio.sleep(1.0)
            elapsed = time.time() - self.last_command_time
            if elapsed > HEARTBEAT_TIMEOUT:
                logger.warning(f"No command received for {elapsed:.1f}s. Orphaned worker detected. Terminating...")
                asyncio.get_running_loop().stop()
                break

    async def handle_command(self, msg: dict) -> dict:
        action = msg.get("action")
        payload = msg.get("payload", {})
        
        logger.info(f"Command Received: {action}")
        
        if action == "ping":
            return {"status": "success", "message": "pong"}
            
        elif action == "load_toon":
            # Pass the TOON data directly to the Rust engine
            success = self.executor.load_toon(json.dumps(payload))
            return {"status": "success" if success else "error", "loaded": success}
            
        elif action == "start_sim":
            if not self.running:
                self.running = True
                self.tick_task = asyncio.create_task(self.sim_loop())
            return {"status": "success", "message": "Simulation sequence initiated"}
            
        elif action == "stop_sim":
            self.running = False
            if self.tick_task:
                await self.tick_task
                self.tick_task = None
            return {"status": "success", "message": "Simulation halted"}
            
        return {"status": "error", "message": f"Unknown action: {action}"}

    async def sim_loop(self):
        logger.info("Simulation loop activated. Yielding GIL to Rust...")
        tick_count = 0
        try:
            while self.running:
                # 1. Offload tick to native Rust layer, RELEASING the Python GIL
                deltas_json = await asyncio.to_thread(self.executor.step, '{"inputs": []}')
                
                # 2. Publish deltas downstream to the API layer via ZMQ PUB
                # We prefix the message with a topic "DELTAS" for the SUB filter
                await self.pub_socket.send_string(f"DELTAS {deltas_json}")
                
                # Simulated timing alignment (60 FPS constraint)
                await asyncio.sleep(0.016)
                tick_count += 1
                if tick_count % 60 == 0:
                    logger.info(f"Pushed 60 frames. Current tick: {tick_count}")
        except asyncio.CancelledError:
            logger.info("Simulation tick loop cancelled.")
        finally:
            self.running = False

    async def shutdown(self):
        logger.info("Shutting down ZMQ worker resources...")
        self.running = False
        if self.tick_task:
            self.tick_task.cancel()
            try:
                await self.tick_task
            except asyncio.CancelledError:
                pass
        if self.zombie_task:
            self.zombie_task.cancel()
        
        self.cmd_socket.close(linger=0)
        self.pub_socket.close(linger=0)
        self.ctx.term()
        logger.info("ZMQ worker resources cleaned successfully.")

if __name__ == "__main__":
    worker = SimulationWorker()
    try:
        asyncio.run(worker.start())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutdown signal received gracefully.")
    except Exception as e:
        logger.critical(f"Unhandled worker error: {e}", exc_info=True)

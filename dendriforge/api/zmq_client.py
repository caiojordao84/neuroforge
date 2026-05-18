import zmq
import zmq.asyncio
import json
import logging
import asyncio

logger = logging.getLogger("ZmqApiClient")

class DendriZmqClient:
    def __init__(self, cmd_url="tcp://127.0.0.1:5555", sub_url="tcp://127.0.0.1:5556"):
        self.ctx = zmq.asyncio.Context()
        self.cmd_socket = None
        
        # SUB (Subscribe) socket to listen to the Delta stream
        self.sub_socket = self.ctx.socket(zmq.SUB)
        self.sub_socket.setsockopt(zmq.SNDHWM, 100)
        self.sub_socket.setsockopt(zmq.RCVHWM, 100)
        
        self.cmd_url = cmd_url
        self.sub_url = sub_url

    def connect(self):
        # Initialize and connect the command socket (Lazy Pirate approach)
        self._init_cmd_socket()
        
        # Connect and subscribe the subscriber socket
        self.sub_socket.connect(self.sub_url)
        self.sub_socket.setsockopt_string(zmq.SUBSCRIBE, "DELTAS")
        logger.info(f"API Client connected to Broker: {self.cmd_url} / {self.sub_url}")

    def _init_cmd_socket(self):
        """Initializes or recreates a clean REQ socket to avoid EFSM state lockups."""
        if self.cmd_socket:
            logger.info("Closing compromised REQ socket...")
            self.cmd_socket.close(linger=0)
            
        self.cmd_socket = self.ctx.socket(zmq.REQ)
        self.cmd_socket.setsockopt(zmq.SNDHWM, 100)
        self.cmd_socket.setsockopt(zmq.RCVHWM, 100)
        self.cmd_socket.connect(self.cmd_url)
        logger.info("REQ socket successfully connected.")

    async def send_command(self, action: str, payload: dict = None) -> dict:
        """Sends a robust command to the Native Engine and awaits a response.
        
        Implements the Lazy Pirate pattern to recreate the REQ socket on timeout,
        preventing permanent lockups.
        """
        msg = {"action": action, "payload": payload or {}}
        
        try:
            await self.cmd_socket.send_json(msg)
            # 2000ms timeout for engine responses to prevent deadlocks
            response = await asyncio.wait_for(self.cmd_socket.recv_json(), timeout=2.0)
            return response
        except asyncio.TimeoutError:
            logger.error(f"ZMQ Command Timeout for action: {action}. Re-initializing command socket...")
            self._init_cmd_socket()
            return {"status": "error", "message": "ZMQ Worker timeout"}
        except Exception as e:
            logger.error(f"ZMQ Command Error: {e}. Re-initializing command socket...")
            self._init_cmd_socket()
            return {"status": "error", "message": f"ZMQ Communication failure: {e}"}

    async def listen_deltas(self):
        """
        Async generator that yields simulation deltas.
        Can be wired directly into FastAPI's WebSocket endpoint.
        """
        try:
            while True:
                # Non-blocking await for the next frame from Rust
                raw_msg = await self.sub_socket.recv_string()
                
                # Strip the "DELTAS " topic prefix
                if " " in raw_msg:
                    _, json_payload = raw_msg.split(" ", 1)
                    yield json.loads(json_payload)
        except asyncio.CancelledError:
            logger.info("Delta listener cancelled.")
        except Exception as e:
            logger.error(f"Delta stream reading error: {e}")

    def close(self):
        if self.cmd_socket:
            self.cmd_socket.close(linger=0)
        self.sub_socket.close(linger=0)
        self.ctx.term()
        logger.info("ZMQ Client disconnected and context terminated.")

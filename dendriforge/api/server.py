import asyncio
import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dendriforge.api.state import zmq_client
from dendriforge.api.routes.simulation import router as sim_router

# Configure Windows-specific event loop policy for ZMQ compatibility
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(name)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger("DendriAPI")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the FastAPI server."""
    logger.info("Initializing ZMQ Broker Connection...")
    zmq_client.connect()
    yield
    logger.info("Shutting down ZMQ Broker Connection...")
    zmq_client.close()

app = FastAPI(
    title="DendriForge Sovereign API",
    description="High-performance simulation command and telemetry broker API",
    lifespan=lifespan
)

# Enable CORS to allow the Dumb Client HTML to connect from local origins (file:// or different ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(sim_router)

@app.get("/")
def read_root():
    return {"status": "success", "message": "DendriForge API Online"}

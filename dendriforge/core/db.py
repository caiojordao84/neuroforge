import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlmodel import SQLModel

# We import the models here so SQLModel registers them before creating tables
import dendriforge.core.models  # noqa: F401

logger = logging.getLogger("DendriDB")

# Read from Environment. Default to a local SQLite file for Desktop/Local Dev
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///dendriforge.db")

# Create the Async Engine
engine = create_async_engine(
    DATABASE_URL, 
    echo=False, 
    future=True,
    # SQLite specific connection args to prevent thread locking issues
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Async session factory
async_session_maker = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def init_db():
    """
    Initializes the database, generating tables if they do not exist.
    In a full production environment, this is replaced by Alembic migrations.
    """
    logger.info(f"Initializing database schema at {DATABASE_URL}")
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

async def get_session():
    """
    FastAPI Dependency to yield a database session per HTTP request.
    """
    async with async_session_maker() as session:
        yield session

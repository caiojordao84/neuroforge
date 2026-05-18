import asyncio
import logging
from sqlmodel import select
from dendriforge.core.db import init_db, async_session_maker
from dendriforge.core.models import User, Project

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestDB")

async def test_database_flow():
    # 1. Initialize DB and build tables
    await init_db()
    
    logger.info("Opening async session...")
    async with async_session_maker() as session:
        # 2. Check if a test user already exists
        result = await session.execute(select(User).where(User.username == "Maker42"))
        user = result.scalars().first()
        
        if not user:
            logger.info("Creating a new test user...")
            user = User(username="Maker42", email="maker@dendriforge.local")
            session.add(user)
            await session.commit()
            await session.refresh(user)
            
        # 3. Create a test Project with some mock TOON data
        logger.info(f"Creating a new project for User ID: {user.id}")
        new_project = Project(
            name="Automated Tank Controller",
            user_id=user.id,
            toon_data='{"board": "arduino-uno", "components": []}',
            asl_code="PROGRAM TankControl\nEND_PROGRAM"
        )
        session.add(new_project)
        await session.commit()
        await session.refresh(new_project)
        
        # 4. Query it back to verify
        logger.info("Querying projects from database...")
        proj_query = await session.execute(select(Project).where(Project.user_id == user.id))
        projects = proj_query.scalars().all()
        
        for p in projects:
            logger.info(f"Found Project [{p.id}]: '{p.name}' created at {p.created_at}")
            logger.info(f"  -> TOON Payload: {p.toon_data}")

    logger.info("=== Database verification completed successfully! ===")

if __name__ == "__main__":
    asyncio.run(test_database_flow())

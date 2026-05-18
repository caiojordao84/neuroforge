from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime, timezone

class User(SQLModel, table=True):
    """
    Represents a DendriForge User (Maker, Student, or Professional).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True)
    email: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Project(SQLModel, table=True):
    """
    Represents a hardware/software project workspace.
    Holds the TOON metadata and the ASL/Structured Text code.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: int = Field(foreign_key="user.id")
    
    # JSON string containing the components and wiring (The Schema)
    toon_data: str = Field(default="{}") 
    
    # The actual transpiled ASL IR or user source code
    asl_code: str = Field(default="")
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

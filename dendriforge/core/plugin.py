from typing import Protocol, Any, Dict
from enum import Enum

class TargetProcess(Enum):
    """
    Defines the isolated ZMQ process where the plugin is allowed to execute.
    This prevents UI/API logic from blocking the real-time simulation engine.
    """
    API_LAYER = "api_layer"
    SIM_LAYER = "sim_layer"
    ANALOG_LAYER = "analog_layer"
    TRANSPORT_LAYER = "transport_layer"

class DendriPlugin(Protocol):
    """
    Core interface for all DendriForge Plugins.
    """
    name: str
    version: str
    target_process: TargetProcess

    def register(self) -> None:
        """Called when the plugin is initially discovered by the registry."""
        ...

    def activate(self, context: Dict[str, Any]) -> None:
        """Called when the target process initializes and injects the context."""
        ...

    def deactivate(self) -> None:
        """Called during graceful shutdown of the process."""
        ...

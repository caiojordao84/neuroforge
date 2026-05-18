import logging
from dendriforge.core.plugin import TargetProcess
from dendriforge.core.plugin_registry import PluginRegistry

# Set log level to DEBUG so skipped plugins are displayed in the test
logging.basicConfig(level=logging.DEBUG, format='%(name)s | %(message)s')
logger = logging.getLogger("TestPlugins")

# --- Mock Plugin 1: API Route extension ---
class CustomRestRoutePlugin:
    name = "CustomRestRoutes"
    version = "1.0.0"
    target_process = TargetProcess.API_LAYER

    def register(self): pass
    def activate(self, context):
        logger.info(f"[{self.name}] Activated! Injecting custom FastAPI routes into: {context.get('app')}")
    def deactivate(self): pass

# --- Mock Plugin 2: Physics modifier ---
class CustomFrictionPhysicsPlugin:
    name = "CustomFrictionPhysics"
    version = "0.9.1"
    target_process = TargetProcess.SIM_LAYER

    def register(self): pass
    def activate(self, context):
        logger.info(f"[{self.name}] Activated! Modifying ASL physics in engine: {context.get('engine')}")
    def deactivate(self): pass


def test_plugin_isolation():
    logger.info("=== Booting API Layer (Process A) ===")
    api_registry = PluginRegistry(current_process=TargetProcess.API_LAYER)
    
    # Attempt to load ALL plugins into the API layer
    api_registry.register_plugin(CustomRestRoutePlugin)
    api_registry.register_plugin(CustomFrictionPhysicsPlugin)
    
    api_registry.activate_all(context={"app": "<FastAPI_Instance>"})
    
    logger.info("\n=== Booting Sim Layer (Process B) ===")
    sim_registry = PluginRegistry(current_process=TargetProcess.SIM_LAYER)
    
    # Attempt to load ALL plugins into the Sim layer
    sim_registry.register_plugin(CustomRestRoutePlugin)
    sim_registry.register_plugin(CustomFrictionPhysicsPlugin)
    
    sim_registry.activate_all(context={"engine": "<Rust_ASL_Core>"})
    
    logger.info("\n=== Plugin verification completed successfully! ===")

if __name__ == "__main__":
    test_plugin_isolation()

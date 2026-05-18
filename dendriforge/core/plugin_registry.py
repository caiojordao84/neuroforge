import logging
from typing import Dict, Type
from dendriforge.core.plugin import DendriPlugin, TargetProcess

logger = logging.getLogger("PluginRegistry")

class PluginRegistry:
    def __init__(self, current_process: TargetProcess):
        self.current_process = current_process
        self._plugins: Dict[str, DendriPlugin] = {}

    def register_plugin(self, plugin_class: Type[DendriPlugin]) -> bool:
        """
        Attempts to register a plugin. Aborts safely if the plugin targets
        a different OS process layer.
        """
        try:
            plugin_instance = plugin_class()
            
            # Strict Process Targeting Validation
            if plugin_instance.target_process != self.current_process:
                logger.debug(
                    f"Skipping plugin '{plugin_instance.name}' "
                    f"(Target: {plugin_instance.target_process.value}, "
                    f"Current: {self.current_process.value})"
                )
                return False
                
            plugin_instance.register()
            self._plugins[plugin_instance.name] = plugin_instance
            logger.info(f"Registered compatible plugin: '{plugin_instance.name}' v{plugin_instance.version}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register plugin {plugin_class}: {e}")
            return False

    def activate_all(self, context: dict):
        """Activates all registered plugins within this specific process."""
        for name, plugin in self._plugins.items():
            logger.info(f"Activating plugin: {name}")
            plugin.activate(context)
            
    def deactivate_all(self):
        """Safely tears down plugins."""
        for name, plugin in self._plugins.items():
            logger.info(f"Deactivating plugin: {name}")
            plugin.deactivate()

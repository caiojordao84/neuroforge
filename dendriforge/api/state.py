from dendriforge.api.zmq_client import DendriZmqClient

# Global ZMQ Client Instance shared across route handlers and server lifecycle
zmq_client = DendriZmqClient()

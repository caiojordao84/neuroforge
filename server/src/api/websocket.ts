import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { engine } from './routes';

/**
 * Setup WebSocket server for real-time communication
 */
export function setupWebSocket(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Forward serial output to client
    const serialHandler = (line: string) => {
      socket.emit('serial', line);
    };

    // Forward pin changes to client
    const pinChangeHandler = (pin: number, state: any) => {
      socket.emit('pinChange', { pin, ...state });
    };

    // Forward simulation events
    const startedHandler = () => {
      socket.emit('simulationStarted');
    };

    const stoppedHandler = () => {
      socket.emit('simulationStopped');
    };

    const pausedHandler = () => {
      socket.emit('simulationPaused');
    };

    const resumedHandler = () => {
      socket.emit('simulationResumed');
    };

    // Subscribe to engine events
    engine.on('serial', serialHandler);
    engine.on('pin-change', pinChangeHandler);
    engine.on('started', startedHandler);
    engine.on('stopped', stoppedHandler);
    engine.on('paused', pausedHandler);
    engine.on('resumed', resumedHandler);

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // Unsubscribe from engine events
      engine.off('serial', serialHandler);
      engine.off('pin-change', pinChangeHandler);
      engine.off('started', startedHandler);
      engine.off('stopped', stoppedHandler);
      engine.off('paused', pausedHandler);
      engine.off('resumed', resumedHandler);
    });

    // Send initial status
    socket.emit('status', {
      running: engine.isRunning(),
      paused: engine.isPaused()
    });
  });

  console.log('WebSocket server initialized');
  return io;
}

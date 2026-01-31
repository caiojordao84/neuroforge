import { io, Socket } from 'socket.io-client';

export interface PinChangeEvent {
  pin: number;
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'UNKNOWN';
  value: number;
}

export interface SimulationStatusEvent {
  running: boolean;
  paused: boolean;
}

/**
 * WebSocket client for real-time QEMU events
 */
export class QEMUWebSocket {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(private url: string = 'http://localhost:3001') {}

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('Already connected to WebSocket');
      return;
    }

    this.socket = io(this.url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to QEMU WebSocket');
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from QEMU WebSocket');
      this.emit('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.emit('error', 'Failed to connect to backend');
      }
    });

    // Simulation events from server
    this.socket.on('serial', (line: string) => {
      this.emit('serial', line);
    });

    this.socket.on('pinChange', (data: PinChangeEvent) => {
      this.emit('pinChange', data);
    });

    this.socket.on('simulationStarted', () => {
      this.emit('simulationStarted');
    });

    this.socket.on('simulationStopped', () => {
      this.emit('simulationStopped');
    });

    this.socket.on('simulationPaused', () => {
      this.emit('simulationPaused');
    });

    this.socket.on('simulationResumed', () => {
      this.emit('simulationResumed');
    });

    this.socket.on('status', (data: SimulationStatusEvent) => {
      this.emit('status', data);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Subscribe to event
   */
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit event to local listeners
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const qemuWebSocket = new QEMUWebSocket();

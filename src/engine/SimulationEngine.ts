// Stub temporario compativel com UI

interface PinChangeEvent {
  pin: number;
  state: boolean;
}

class SimulationEngine {
  isRunning = false;
  speed = 1;
  private listeners: Map<string, Function[]> = new Map();

  start(_setup?: any, _loop?: any, _speed?: number) {
    this.isRunning = true;
    this.emit('start');
  }

  stop() {
    this.isRunning = false;
    this.emit('stop');
    this.emit('simulationStopped');
  }

  reset() {
    this.emit('reset');
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  setPinState(pin: number, state: boolean) {
    this.emit('pinChange', { pin, state });
  }

  preprocess(code: string, _language: string): string {
    return code;
  }

  // EventEmitter-like API
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
}

export const simulationEngine = new SimulationEngine();

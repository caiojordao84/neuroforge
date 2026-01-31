// Stub temporario - sera substituido pelo QEMUSimulationEngine
import { EventEmitter } from 'events';

class SimulationEngine extends EventEmitter {
  isRunning = false;
  speed = 1;

  start() {
    this.isRunning = true;
    this.emit('start');
  }

  stop() {
    this.isRunning = false;
    this.emit('stop');
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
}

export const simulationEngine = new SimulationEngine();

import type { BoardType } from '@/types';

export type SimulationMode = 'interpreter' | 'qemu';

export interface CompileResponse {
  success: boolean;
  firmwarePath?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface SimulationStatus {
  success: boolean;
  running: boolean;
  paused: boolean;
}

export interface PinState {
  success: boolean;
  pin: number;
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'UNKNOWN';
  value: number;
}

/**
 * Client for NeuroForge Backend REST API
 */
export class QEMUApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Compile Arduino code to firmware
   * @param code - Arduino sketch code
   * @param board - Target board type
   * @param mode - Simulation mode (qemu uses NeuroForge Time board)
   */
  async compile(
    code: string,
    board: BoardType = 'arduino-uno',
    mode: SimulationMode = 'qemu'
  ): Promise<CompileResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, board, mode })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Start QEMU simulation
   */
  async startSimulation(firmwarePath: string, board: BoardType = 'arduino-uno'): Promise<CompileResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/simulate/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ firmwarePath, board })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Stop QEMU simulation
   */
  async stopSimulation(): Promise<CompileResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/simulate/stop`, {
        method: 'POST'
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Get simulation status
   */
  async getStatus(): Promise<SimulationStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/simulate/status`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        running: false,
        paused: false
      };
    }
  }

  /**
   * Read pin state from QEMU
   */
  async readPin(pin: number): Promise<PinState> {
    try {
      const response = await fetch(`${this.baseUrl}/api/simulate/pins/${pin}`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        pin,
        mode: 'UNKNOWN',
        value: 0
      };
    }
  }

  /**
   * Write pin state to QEMU (simulate button press, etc)
   */
  async writePin(pin: number, value: number): Promise<CompileResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/simulate/pins/${pin}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Get serial buffer
   */
  async getSerial(): Promise<{ success: boolean; lines: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/simulate/serial`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        lines: []
      };
    }
  }

  /**
   * Clear serial buffer
   */
  async clearSerial(): Promise<CompileResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/simulate/serial`, {
        method: 'DELETE'
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const qemuApi = new QEMUApiClient();

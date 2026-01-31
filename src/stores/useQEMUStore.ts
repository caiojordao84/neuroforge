import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SimulationMode = 'fake' | 'qemu';

interface QEMUState {
  // Simulation mode
  mode: SimulationMode;
  setMode: (mode: SimulationMode) => void;

  // Backend connection
  isBackendConnected: boolean;
  setBackendConnected: (connected: boolean) => void;

  // WebSocket connection
  isWebSocketConnected: boolean;
  setWebSocketConnected: (connected: boolean) => void;

  // Simulation state
  isSimulationRunning: boolean;
  setSimulationRunning: (running: boolean) => void;

  // Firmware
  firmwarePath: string | null;
  setFirmwarePath: (path: string | null) => void;

  // Compilation
  isCompiling: boolean;
  setCompiling: (compiling: boolean) => void;
  compilationError: string | null;
  setCompilationError: (error: string | null) => void;

  // Backend URL
  backendUrl: string;
  setBackendUrl: (url: string) => void;
}

export const useQEMUStore = create<QEMUState>()(
  persist(
    (set) => ({
      // Default values
      mode: 'fake',
      setMode: (mode) => set({ mode }),

      isBackendConnected: false,
      setBackendConnected: (connected) => set({ isBackendConnected: connected }),

      isWebSocketConnected: false,
      setWebSocketConnected: (connected) => set({ isWebSocketConnected: connected }),

      isSimulationRunning: false,
      setSimulationRunning: (running) => set({ isSimulationRunning: running }),

      firmwarePath: null,
      setFirmwarePath: (path) => set({ firmwarePath: path }),

      isCompiling: false,
      setCompiling: (compiling) => set({ isCompiling: compiling }),

      compilationError: null,
      setCompilationError: (error) => set({ compilationError: error }),

      backendUrl: 'http://localhost:3001',
      setBackendUrl: (url) => set({ backendUrl: url })
    }),
    {
      name: 'qemu-storage',
      partialize: (state) => ({
        mode: state.mode,
        backendUrl: state.backendUrl
      })
    }
  )
);

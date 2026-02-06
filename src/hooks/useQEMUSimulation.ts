import { useEffect, useCallback } from 'react';
import { useQEMUStore } from '@/stores/useQEMUStore';
import { qemuApi } from '@/services/QEMUApiClient';
import { qemuWebSocket } from '@/services/QEMUWebSocket';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { useSerialStore } from '@/stores/useSerialStore';
import { simulationEngine } from '@/engine/SimulationEngine';

/**
 * Hook for managing QEMU simulation lifecycle
 */
export function useQEMUSimulation() {
  const {
    mode,
    isBackendConnected,
    setBackendConnected,
    isWebSocketConnected,
    setWebSocketConnected,
    setSimulationRunning,
    setFirmwarePath,
    setCompiling,
    setCompilationError
  } = useQEMUStore();

  const { status } = useSimulationStore();
  const { addSerialLine } = useSerialStore();

  /**
   * Check backend health on mount
   */
  useEffect(() => {
    if (mode !== 'qemu') return;

    const checkHealth = async () => {
      const healthy = await qemuApi.healthCheck();
      setBackendConnected(healthy);

      if (!healthy) {
        console.warn('⚠️ QEMU Backend is not available');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, [mode, setBackendConnected]);

  /**
   * Connect WebSocket when in QEMU mode
   */
  useEffect(() => {
    if (mode !== 'qemu' || !isBackendConnected) return;

    qemuWebSocket.connect();

    // Subscribe to events
    const unsubscribers = [
      qemuWebSocket.on('connected', () => {
        setWebSocketConnected(true);
      }),

      qemuWebSocket.on('disconnected', () => {
        setWebSocketConnected(false);
      }),

      qemuWebSocket.on('serial', (line: string) => {
        addSerialLine(line, 'output');
      }),

      qemuWebSocket.on('pinChange', ({ pin, value, mode }) => {
        const pinNum = Number(pin);

        // 1. Update Mode if provided
        if (mode) {
          useSimulationStore.getState().setPinMode(pinNum, mode as any);
        }

        // 2. Update Value ONLY if provided (not during pure mode changes)
        if (value !== undefined) {
          const pinValue = (value === 1 || value === 'HIGH') ? 'HIGH' : 'LOW';
          console.log(`📡 [QEMU-WS] Pin ${pinNum} -> ${pinValue} (Mode: ${mode || 'OUTPUT'})`);

          useSimulationStore.getState().digitalWrite(pinNum, pinValue);
          simulationEngine.emit('pinChange', { pin: pinNum, value: pinValue });
        }
      }),

      qemuWebSocket.on('simulationStarted', () => {
        setSimulationRunning(true);
      }),

      qemuWebSocket.on('simulationStopped', () => {
        setSimulationRunning(false);
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
      qemuWebSocket.disconnect();
    };
  }, [mode, isBackendConnected, setWebSocketConnected, setSimulationRunning, addSerialLine]);

  /**
   * Compile and start QEMU simulation
   */
  const compileAndStart = useCallback(async (code: string, board: string) => {
    if (mode !== 'qemu') return;

    setCompiling(true);
    setCompilationError(null);

    try {
      // Step 1: Compile
      const compileResult = await qemuApi.compile(code, board as any);

      if (!compileResult.success) {
        setCompilationError(compileResult.error || 'Compilation failed');
        return;
      }

      setFirmwarePath(compileResult.firmwarePath!);

      // Step 2: Start simulation
      const startResult = await qemuApi.startSimulation(compileResult.firmwarePath!, board as any);

      if (!startResult.success) {
        setCompilationError(startResult.error || 'Failed to start simulation');
        return;
      }

      setSimulationRunning(true);
    } catch (error) {
      setCompilationError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setCompiling(false);
    }
  }, [mode, setCompiling, setCompilationError, setFirmwarePath, setSimulationRunning]);

  /**
   * Stop QEMU simulation
   */
  const stopQEMU = useCallback(async () => {
    if (mode !== 'qemu') return;

    const result = await qemuApi.stopSimulation();
    if (result.success) {
      setSimulationRunning(false);
    }
  }, [mode, setSimulationRunning]);

  return {
    mode,
    isBackendConnected,
    isWebSocketConnected,
    compileAndStart,
    stopQEMU
  };
}

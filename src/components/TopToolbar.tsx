import React, { useCallback, useEffect } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { useSerialStore } from '@/stores/useSerialStore';
import { useQEMUStore } from '@/stores/useQEMUStore';
import { useQEMUSimulation } from '@/hooks/useQEMUSimulation';
import { simulationEngine } from '@/engine/SimulationEngine';
import { codeParser } from '@/engine/CodeParser';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SimulationModeToggle } from '@/components/SimulationModeToggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Square,
  RotateCcw,
  FastForward,
  Cpu,
  Zap,
  Loader2
} from 'lucide-react';

export const TopToolbar: React.FC = () => {
  const {
    status,
    speed,
    setSpeed,
    language,
    getAllMCUs,
    activeMCUId,
    startSimulation,
    stopSimulation,
    resetSimulation,
  } = useSimulationStore();

  const { addTerminalLine, clearSerial, clearTerminal } = useSerialStore();
  const {
    mode,
    isCompiling,
    isSimulationRunning,
    compilationError,
    setCompilationError
  } = useQEMUStore();
  const { compileAndStart, stopQEMU, isBackendConnected } = useQEMUSimulation();

  // Determine if simulation is running (handles both modes)
  const isRunning = mode === 'qemu' ? isSimulationRunning : status === 'running';

  // Show compilation errors
  useEffect(() => {
    if (compilationError) {
      addTerminalLine(`❌ Compilation Error: ${compilationError}`, 'error');
    }
  }, [compilationError, addTerminalLine]);

  // Clear compilation error when MCUs change
  useEffect(() => {
    setCompilationError(null);
  }, [setCompilationError]);

  /**
   * Get active MCU from canvas
   */
  const getActiveMCU = useCallback(() => {
    const allMCUs = getAllMCUs();

    if (allMCUs.length === 0) {
      return null;
    }

    // If there's an active MCU selected, use it
    if (activeMCUId) {
      const activeMCU = allMCUs.find(m => m.id === activeMCUId);
      if (activeMCU) return activeMCU;
    }

    // Otherwise, use the first MCU
    return allMCUs[0];
  }, [getAllMCUs, activeMCUId]);

  /**
   * Handle START simulation
   */
  const handleStart = useCallback(async () => {
    if (mode === 'qemu') {
      // QEMU Mode with auto-detection
      if (!isBackendConnected) {
        addTerminalLine('❌ QEMU Backend is not connected. Start server: cd server && npm run dev', 'error');
        return;
      }

      const activeMCU = getActiveMCU();

      if (!activeMCU) {
        addTerminalLine('❌ No MCU found on canvas. Drag an MCU from Components Library.', 'error');
        return;
      }

      // Proactive Sync: Try to get latest code from FileStore
      // This is a safety measure in case the background sync in CodeEditorWithTabs missed an update
      const { files, activeFileId } = (await import('@/stores/useFileStore')).useFileStore.getState();
      const activeFile = files.find(f => f.id === activeFileId);

      let codeToCompile = activeMCU.code;
      let source = 'SimulationStore (MCU)';

      if (activeFile) {
        // Use active file if it's explicitly assigned to this MCU 
        // OR if there's only one MCU and the file isn't assigned elsewhere
        const isAssignedToThis = activeFile.mcuId === activeMCU.id;
        const isAutoEligible = !activeFile.mcuId && getAllMCUs().length === 1;

        if (isAssignedToThis || isAutoEligible) {
          codeToCompile = activeFile.code;
          source = `FileStore (Active Tab: ${activeFile.name})`;
        }
      }

      addTerminalLine(`🔨 Compiling ${activeMCU.label} (${activeMCU.type})...`, 'info');
      addTerminalLine(`📄 Source: ${source}`, 'info');

      // FIX: Update simulation status to 'running' so MCUNode can detect it
      startSimulation();

      await compileAndStart(codeToCompile, activeMCU.type);

    } else {
      // Fake Mode with MCU detection
      const activeMCU = getActiveMCU();

      if (!activeMCU) {
        addTerminalLine('❌ No MCU found on canvas. Drag an MCU from Components Library.', 'error');
        return;
      }

      codeParser.setLanguage(activeMCU.language);

      // Preprocess code to inject libraries
      const processedCode = simulationEngine.preprocess(activeMCU.code, activeMCU.language);
      const parsed = codeParser.parse(processedCode);

      if (parsed) {
        startSimulation();
        simulationEngine.start(parsed.setup, parsed.loop, speed);
        addTerminalLine(`▶️ Simulation started on ${activeMCU.label}`, 'info');
      } else {
        addTerminalLine('❌ Failed to parse code', 'error');
      }
    }
  }, [mode, speed, isBackendConnected, getActiveMCU, startSimulation, compileAndStart, addTerminalLine]);

  /**
   * Handle STOP simulation
   */
  const handleStop = useCallback(async () => {
    if (mode === 'qemu') {
      await stopQEMU();
      addTerminalLine('⏹️ QEMU simulation stopped', 'info');
    } else {
      simulationEngine.stop();
      addTerminalLine('⏹️ Simulation stopped', 'info');
    }

    stopSimulation();
  }, [mode, stopQEMU, stopSimulation, addTerminalLine]);

  /**
   * Handle Run/Stop toggle
   */
  const handleRunStop = useCallback(async () => {
    if (isRunning) {
      await handleStop();
    } else {
      await handleStart();
    }
  }, [isRunning, handleStart, handleStop]);

  /**
   * Handle reset
   */
  const handleReset = useCallback(() => {
    if (mode === 'qemu') {
      stopQEMU();
    }
    resetSimulation();
    simulationEngine.reset();
    clearSerial();
    clearTerminal();
    addTerminalLine('🔄 Simulation reset', 'info');
  }, [mode, resetSimulation, stopQEMU, clearSerial, clearTerminal, addTerminalLine]);

  /**
   * Handle speed change
   */
  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    if (mode === 'fake') {
      simulationEngine.setSpeed(newSpeed);
    }
  }, [mode, setSpeed]);

  // Get active MCU info for display
  const activeMCU = getActiveMCU();
  const mcuCount = getAllMCUs().length;

  return (
    <div
      className={cn(
        'fixed top-0 left-[60px] right-0 h-14',
        'bg-[#0a0e14] border-b border-[rgba(0,217,255,0.2)]',
        'flex items-center justify-between px-4 z-40',
        'shadow-lg shadow-black/20'
      )}
    >
      {/* Left section - Logo & MCU Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-lg',
              'bg-gradient-to-br from-[#00d9ff] to-[#0088cc]',
              'flex items-center justify-center'
            )}
          >
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-[#e6e6e6] font-bold text-lg">NeuroForge</span>
        </div>

        <div className="w-px h-6 bg-[rgba(0,217,255,0.2)]" />

        {/* MCU Info Display */}
        <div className="flex items-center gap-2">
          <Cpu className={cn(
            'w-4 h-4',
            activeMCU ? 'text-[#00d9ff]' : 'text-[#9ca3af]'
          )} />
          <div className="flex flex-col">
            <span className="text-[#e6e6e6] text-sm font-medium">
              {activeMCU ? activeMCU.label : 'No MCU'}
            </span>
            {mcuCount > 0 && (
              <span className="text-[#9ca3af] text-xs">
                {mcuCount} MCU{mcuCount > 1 ? 's' : ''} on canvas
              </span>
            )}
          </div>
        </div>

        <div className="w-px h-6 bg-[rgba(0,217,255,0.2)]" />

        {/* Simulation Mode Toggle */}
        <SimulationModeToggle />
      </div>

      {/* Center section - Speed (only for fake mode) */}
      {mode === 'fake' && (
        <div className="flex items-center gap-2">
          <span className="text-[#9ca3af] text-sm">Speed:</span>
          <Select value={speed.toString()} onValueChange={(v) => handleSpeedChange(parseInt(v, 10))}>
            <SelectTrigger className="w-[80px] h-9 bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm">
              <FastForward className="w-4 h-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
              {[1, 2, 5, 10].map((s) => (
                <SelectItem
                  key={s}
                  value={s.toString()}
                  className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
                >
                  {s}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Right section - Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={status === 'idle' && !isSimulationRunning || isCompiling}
          className="h-9 px-3 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Reset
        </Button>

        {/* Main Run/Stop Button */}
        <Button
          size="sm"
          onClick={handleRunStop}
          disabled={
            isCompiling ||
            !activeMCU ||
            (mode === 'qemu' && !isBackendConnected && !isRunning)
          }
          className={cn(
            'h-9 px-5',
            isRunning
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-[#00d9ff] hover:bg-[#00a8cc] text-[#0a0e14]'
          )}
        >
          {isCompiling ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Compiling...
            </>
          ) : isRunning ? (
            <>
              <Square className="w-4 h-4 mr-1" fill="currentColor" />
              STOP
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" fill="currentColor" />
              {mode === 'qemu' ? 'Compile & Run' : 'Run'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default TopToolbar;

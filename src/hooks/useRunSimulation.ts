import { useCallback, useRef } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { useSerialStore } from '@/stores/useSerialStore';
import { useQEMUStore } from '@/stores/useQEMUStore';
import { useQEMUSimulation } from '@/hooks/useQEMUSimulation';
import { simulationEngine } from '@/engine/SimulationEngine';
import { codeParser } from '@/engine/CodeParser';
import { createASLRuntime } from '@/engine/asl/ASLExecutor';
import { codeToASL } from '@/engine/asl/codeToASL';
import { getASLSupportedLanguages, getLanguageInfo } from '@/engine/asl/LanguageRegistry';

export function useRunSimulation() {
    const abortControllerRef = useRef<AbortController | null>(null);

    const {
        status,
        speed,
        getAllMCUs,
        activeMCUId,
        startSimulation,
        stopSimulation,
    } = useSimulationStore();

    const { addTerminalLine } = useSerialStore();
    const { mode, isBackendConnected } = useQEMUStore();
    const { compileAndStart, stopQEMU } = useQEMUSimulation();

    // Determine if simulation is running (handles both modes)
    const isSimulationRunning = mode === 'qemu' ? useQEMUStore.getState().isSimulationRunning : status === 'running';

    const getActiveMCU = useCallback(() => {
        const allMCUs = getAllMCUs();
        if (allMCUs.length === 0) return null;
        if (activeMCUId) {
            const activeMCU = allMCUs.find(m => m.id === activeMCUId);
            if (activeMCU) return activeMCU;
        }
        return allMCUs[0];
    }, [getAllMCUs, activeMCUId]);

    const handleStart = useCallback(async () => {
        const activeMCU = getActiveMCU();
        if (!activeMCU) {
            addTerminalLine('❌ No MCU found on canvas. Drag an MCU from Components Library.', 'error');
            return;
        }

        const isPython = getLanguageInfo(activeMCU.language)?.monacoLanguage === 'python';

        if (mode === 'qemu' && !isPython) {
            // --- QEMU Mode (C++ backend) ---
            if (!isBackendConnected) {
                addTerminalLine('❌ QEMU Backend is not connected. Start server: cd server && npm run dev', 'error');
                return;
            }

            // Sync latest code
            const { files, activeFileId } = (await import('@/stores/useFileStore')).useFileStore.getState();
            const activeFile = files.find(f => f.id === activeFileId);

            let codeToCompile = activeMCU.code;
            let source = 'SimulationStore (MCU)';

            if (activeFile) {
                const isAssignedToThis = activeFile.mcuId === activeMCU.id;
                const isAutoEligible = !activeFile.mcuId && getAllMCUs().length === 1;

                if (isAssignedToThis || isAutoEligible) {
                    codeToCompile = activeFile.code;
                    source = `FileStore (Active Tab: ${activeFile.name})`;
                }
            }

            addTerminalLine(`🔨 Compiling ${activeMCU.label} (${activeMCU.type})...`, 'info');
            addTerminalLine(`📄 Source: ${source}`, 'info');

            startSimulation();
            await compileAndStart(codeToCompile, activeMCU.type);
        } else {
            // --- Local ASL Engine Mode ---
            if (mode === 'qemu' && isPython) {
                addTerminalLine(`ℹ️ Python is simulated locally (ASL Engine) instead of QEMU.`, 'info');
            }

            const processedCode = simulationEngine.preprocess(activeMCU.code, activeMCU.language);
            let startedWithASL = false;

            addTerminalLine(`🚀 Starting simulation (Language: ${activeMCU.language}, Mode: ${isPython ? 'local' : mode})`, 'info');

            const isASLSupported = getASLSupportedLanguages().includes(activeMCU.language);

            if (isASLSupported) {
                try {
                    // Pull libraries from store to support #include in C++
                    const { libraries } = (await import('@/stores/useLibraryStore')).useLibraryStore.getState();
                    
                    // Compile code to standard ASL AST
                    const aslProgram = await codeToASL(processedCode, activeMCU.language, libraries);
                    addTerminalLine(`✅ ASL Program generated (${aslProgram.globals.length} globals, ${aslProgram.tasks.length} tasks)`, 'success');

                    abortControllerRef.current = new AbortController();
                    const abortSignal = abortControllerRef.current.signal;

                    // Initialize the real runtime sandbox
                    const runtime = createASLRuntime(aslProgram, { abortSignal });

                    startSimulation();
                    // The ASLExecutor replaces the legacy regex parsing logic
                    simulationEngine.start(runtime.setup, runtime.loop, speed);
                    addTerminalLine(`▶️ Simulation (ASL) started on ${activeMCU.label}`, 'info');
                    startedWithASL = true;
                } catch (err) {
                    console.error('[ASL] Failed to run via ASL', err);
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    addTerminalLine(`❌ ASL Error: ${errorMsg}`, 'error');
                    addTerminalLine('⚠️ Falling back to legacy parser...', 'warning');
                }
            }

            // Legacy Regex fallback (CodeParser)
            if (!startedWithASL) {
                codeParser.setLanguage(activeMCU.language);
                const parsed = codeParser.parse(processedCode);

                if (parsed) {
                    startSimulation();
                    simulationEngine.start(parsed.setup, parsed.loop, speed);
                    addTerminalLine(`▶️ Simulation started on ${activeMCU.label} (Legacy Parser)`, 'info');
                } else {
                    addTerminalLine('❌ Failed to parse code', 'error');
                }
            }
        }
    }, [mode, speed, isBackendConnected, getActiveMCU, startSimulation, compileAndStart, addTerminalLine, getAllMCUs]);

    const handleStop = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        if (mode === 'qemu') {
            await stopQEMU();
            addTerminalLine('⏹️ QEMU simulation stopped', 'info');
        } else {
            simulationEngine.stop();
            addTerminalLine('⏹️ Simulation stopped', 'info');
        }
        stopSimulation();
    }, [mode, stopQEMU, stopSimulation, addTerminalLine]);

    const handleRunStop = useCallback(async () => {
        if (isSimulationRunning) {
            await handleStop();
        } else {
            await handleStart();
        }
    }, [isSimulationRunning, handleStart, handleStop]);

    const handleReset = useCallback(() => {
        if (mode === 'qemu') {
            stopQEMU();
        }
        const { resetSimulation } = useSimulationStore.getState();
        const { clearSerial, clearTerminal } = useSerialStore.getState();

        resetSimulation();
        simulationEngine.reset();
        clearSerial();
        clearTerminal();
        addTerminalLine('🔄 Simulation reset', 'info');
    }, [mode, stopQEMU, addTerminalLine]);

    return {
        isSimulationRunning,
        handleStart,
        handleStop,
        handleRunStop,
        handleReset,
        getActiveMCU,
    };
}

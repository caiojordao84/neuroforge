import React, { useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { useSerialStore } from '@/stores/useSerialStore';
import { transpiler } from '@/engine/Transpiler';
import type { Language } from '@/types';
import { cn } from '@/lib/utils';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Languages } from 'lucide-react';

export const CodeEditor: React.FC = () => {
  const { 
    getAllMCUs,
    activeMCUId,
    updateMCUCode,
    updateMCULanguage,
    language,
    status,
    startSimulation,
    stopSimulation,
    resetSimulation,
  } = useSimulationStore();

  const { addTerminalLine } = useSerialStore();
  const [showTranspileConfirm, setShowTranspileConfirm] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);

  // Get active MCU
  const getActiveMCU = useCallback(() => {
    const allMCUs = getAllMCUs();
    if (allMCUs.length === 0) return null;
    
    if (activeMCUId) {
      const mcu = allMCUs.find(m => m.id === activeMCUId);
      if (mcu) return mcu;
    }
    
    return allMCUs[0];
  }, [getAllMCUs, activeMCUId]);

  const activeMCU = getActiveMCU();
  const code = activeMCU?.code || '';
  const activeLanguage = activeMCU?.language || language;

  // Handle code change
  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && activeMCU) {
        updateMCUCode(activeMCU.id, value);
      }
    },
    [activeMCU, updateMCUCode]
  );

  // Handle language change
  const handleLanguageChange = useCallback(
    (newLanguage: Language) => {
      if (newLanguage === activeLanguage) return;

      setPendingLanguage(newLanguage);
      setShowTranspileConfirm(true);
    },
    [activeLanguage]
  );

  // Confirm transpilation
  const confirmTranspile = useCallback(() => {
    if (!pendingLanguage || !activeMCU) return;

    const newCode = transpiler.transpile(code, activeLanguage, pendingLanguage);
    updateMCUCode(activeMCU.id, newCode);
    updateMCULanguage(activeMCU.id, pendingLanguage);
    
    addTerminalLine(
      `🔄 Code transpiled from ${activeLanguage.toUpperCase()} to ${pendingLanguage.toUpperCase()}`,
      'info'
    );

    setShowTranspileConfirm(false);
    setPendingLanguage(null);
  }, [code, activeLanguage, pendingLanguage, activeMCU, updateMCUCode, updateMCULanguage, addTerminalLine]);

  // Cancel transpilation
  const cancelTranspile = useCallback(() => {
    setShowTranspileConfirm(false);
    setPendingLanguage(null);
  }, []);

  // Handle run button
  const handleRun = useCallback(() => {
    if (status === 'running') {
      stopSimulation();
    } else {
      startSimulation();
      addTerminalLine('▶️ Starting simulation...', 'success');
    }
  }, [status, startSimulation, stopSimulation, addTerminalLine]);

  // Handle reset button
  const handleReset = useCallback(() => {
    resetSimulation();
    addTerminalLine('🔄 Simulation reset', 'info');
  }, [resetSimulation, addTerminalLine]);

  // Get editor language for Monaco
  const getEditorLanguage = (lang: Language): string => {
    switch (lang) {
      case 'cpp':
        return 'cpp';
      case 'micropython':
      case 'circuitpython':
        return 'python';
      case 'assembly':
        return 'asm';
      default:
        return 'cpp';
    }
  };

  const editorLanguage = getEditorLanguage(activeLanguage);

  // Editor theme options
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: 'JetBrains Mono, monospace',
    lineNumbers: 'on' as const,
    roundedSelection: false,
    scrollBeyondLastLine: false,
    readOnly: status === 'running' || !activeMCU,
    automaticLayout: true,
    padding: { top: 16 },
    folding: true,
    renderLineHighlight: 'all' as const,
    matchBrackets: 'always' as const,
    autoIndent: 'full' as const,
    formatOnPaste: true,
    formatOnType: true,
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2',
          'bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]'
        )}
      >
        {/* Language selector */}
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-[#9ca3af]" />
          <Select value={activeLanguage} onValueChange={handleLanguageChange} disabled={!activeMCU}>
            <SelectTrigger className="w-[160px] h-8 bg-[#0a0e14] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
              <SelectItem 
                value="cpp" 
                className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
              >
                C++ (Arduino)
              </SelectItem>
              <SelectItem 
                value="micropython"
                className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
              >
                MicroPython
              </SelectItem>
              <SelectItem 
                value="circuitpython"
                className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
              >
                CircuitPython
              </SelectItem>
              <SelectItem 
                value="assembly"
                className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
              >
                Assembly (AVR)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={status === 'idle'}
            className="h-8 px-3 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={!activeMCU}
            className={cn(
              'h-8 px-4',
              status === 'running'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[#00d9ff] hover:bg-[#00a8cc] text-[#0a0e14]'
            )}
          >
            <Play className="w-4 h-4 mr-1" />
            {status === 'running' ? 'Stop' : 'Run'}
          </Button>
        </div>
      </div>

      {/* Transpile confirmation dialog */}
      {showTranspileConfirm && (
        <div
          className={cn(
            'absolute top-12 left-1/2 -translate-x-1/2 z-50',
            'bg-[#151b24] border border-[rgba(0,217,255,0.3)] rounded-lg',
            'p-4 shadow-xl'
          )}
        >
          <p className="text-[#e6e6e6] text-sm mb-3">
            Transpile code from {activeLanguage.toUpperCase()} to {pendingLanguage?.toUpperCase()}?
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelTranspile}
              className="bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmTranspile}
              className="bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00a8cc]"
            >
              Transpile
            </Button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeMCU ? (
          <Editor
            height="100%"
            language={editorLanguage}
            value={code}
            onChange={handleCodeChange}
            options={editorOptions}
            theme="vs-dark"
            loading={
              <div className="flex items-center justify-center h-full text-[#9ca3af]">
                Loading editor...
              </div>
            }
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[#9ca3af]">
            No MCU on canvas. Drag an MCU from Components Library.
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1',
          'bg-[#151b24] border-t border-[rgba(0,217,255,0.2)]',
          'text-xs text-[#9ca3af]'
        )}
      >
        <div className="flex items-center gap-4">
          <span>
            {activeLanguage === 'cpp' && 'C++ (Arduino)'}
            {activeLanguage === 'micropython' && 'MicroPython'}
            {activeLanguage === 'circuitpython' && 'CircuitPython'}
            {activeLanguage === 'assembly' && 'Assembly (AVR)'}
          </span>
          <span>UTF-8</span>
          {activeMCU && (
            <span className="text-[#00d9ff]">{activeMCU.label}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'flex items-center gap-1',
              status === 'running' && 'text-green-400',
              status === 'error' && 'text-red-400'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                status === 'idle' && 'bg-[#9ca3af]',
                status === 'running' && 'bg-green-400 animate-pulse',
                status === 'paused' && 'bg-yellow-400',
                status === 'error' && 'bg-red-400'
              )}
            />
            {status === 'idle' && 'Ready'}
            {status === 'running' && 'Running'}
            {status === 'paused' && 'Paused'}
            {status === 'error' && 'Error'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;

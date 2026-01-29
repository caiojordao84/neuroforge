import React, { useCallback, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useFileStore } from '@/stores/useFileStore';
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
import { 
  Play, 
  RotateCcw, 
  Languages, 
  Plus, 
  FileCode,
  Microchip,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export const CodeEditorWithTabs: React.FC = () => {
  const { 
    files, 
    activeFileId, 
    createFile, 
    deleteFile, 
    renameFile,
    setActiveFile, 
    updateFileCode,
    updateFileLanguage,
    // assignMCU - will be used for MCU assignment feature
  } = useFileStore();

  const { 
    status,
    startSimulation,
    stopSimulation,
    resetSimulation,
  } = useSimulationStore();

  const { addTerminalLine } = useSerialStore();

  const [showTranspileConfirm, setShowTranspileConfirm] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLanguage, setNewFileLanguage] = useState<Language>('cpp');
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const activeFile = files.find((f) => f.id === activeFileId);

  // Sync with simulation store when active file changes
  useEffect(() => {
    if (activeFile) {
      // Update simulation store with active file's code and language
      useSimulationStore.setState({ 
        code: activeFile.code,
        language: activeFile.language,
      });
    }
  }, [activeFile?.id]);

  // Handle code change
  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && activeFileId) {
        updateFileCode(activeFileId, value);
      }
    },
    [activeFileId, updateFileCode]
  );

  // Handle language change
  const handleLanguageChange = useCallback(
    (newLanguage: Language) => {
      if (!activeFile || newLanguage === activeFile.language) return;

      setPendingLanguage(newLanguage);
      setShowTranspileConfirm(true);
    },
    [activeFile]
  );

  // Confirm transpilation
  const confirmTranspile = useCallback(() => {
    if (!activeFile || !pendingLanguage || !activeFileId) return;

    const newCode = transpiler.transpile(activeFile.code, activeFile.language, pendingLanguage);
    updateFileCode(activeFileId, newCode);
    updateFileLanguage(activeFileId, pendingLanguage);
    
    addTerminalLine(
      `🔄 Code transpiled from ${activeFile.language.toUpperCase()} to ${pendingLanguage.toUpperCase()}`,
      'info'
    );

    setShowTranspileConfirm(false);
    setPendingLanguage(null);
  }, [activeFile, activeFileId, pendingLanguage, updateFileCode, updateFileLanguage, addTerminalLine]);

  // Cancel transpilation
  const cancelTranspile = useCallback(() => {
    setShowTranspileConfirm(false);
    setPendingLanguage(null);
  }, []);

  // Handle create new file
  const handleCreateFile = useCallback(() => {
    if (newFileName.trim()) {
      createFile(newFileName.trim(), newFileLanguage);
      setNewFileName('');
      setShowNewFileDialog(false);
      addTerminalLine(`📄 Created new file: ${newFileName}`, 'info');
    }
  }, [newFileName, newFileLanguage, createFile, addTerminalLine]);

  // Handle delete file
  const handleDeleteFile = useCallback((fileId: string, fileName: string) => {
    deleteFile(fileId);
    addTerminalLine(`🗑️ Deleted file: ${fileName}`, 'info');
  }, [deleteFile, addTerminalLine]);

  // Handle rename file
  const handleStartRename = useCallback((fileId: string, currentName: string) => {
    setRenamingFile(fileId);
    setRenameValue(currentName);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (renamingFile && renameValue.trim()) {
      renameFile(renamingFile, renameValue.trim());
      setRenamingFile(null);
      setRenameValue('');
    }
  }, [renamingFile, renameValue, renameFile]);

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

  const editorLanguage = activeFile ? getEditorLanguage(activeFile.language) : 'cpp';

  // Editor theme options
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: 'JetBrains Mono, monospace',
    lineNumbers: 'on' as const,
    roundedSelection: false,
    scrollBeyondLastLine: false,
    readOnly: status === 'running',
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
          <Select 
            value={activeFile?.language || 'cpp'} 
            onValueChange={(v) => handleLanguageChange(v as Language)}
            disabled={!activeFile}
          >
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

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#0a0e14] border-b border-[rgba(0,217,255,0.2)] overflow-x-auto">
        {files.map((file) => (
          <div
            key={file.id}
            onClick={() => setActiveFile(file.id)}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer',
              'text-sm transition-all duration-150 min-w-[100px] max-w-[200px]',
              activeFileId === file.id
                ? 'bg-[#151b24] text-[#e6e6e6] border-t border-l border-r border-[rgba(0,217,255,0.3)]'
                : 'bg-[#0d1117] text-[#9ca3af] hover:bg-[#151b24] hover:text-[#e6e6e6]'
            )}
          >
            <FileCode className="w-3.5 h-3.5 shrink-0" />
            
            {renamingFile === file.id ? (
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleConfirmRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename();
                  if (e.key === 'Escape') {
                    setRenamingFile(null);
                    setRenameValue('');
                  }
                }}
                className="h-5 px-1 py-0 text-xs bg-[#0a0e14] border-[rgba(0,217,255,0.3)]"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1">{file.name}</span>
            )}
            
            {file.mcuId && (
              <span title="Assigned to MCU">
                <Microchip className="w-3 h-3 text-[#00d9ff] shrink-0" />
              </span>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[rgba(0,217,255,0.2)] rounded transition-opacity"
                >
                  <MoreVertical className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <DropdownMenuItem
                  onClick={() => handleStartRename(file.id, file.name)}
                  className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)] text-xs"
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {/* TODO: Implement assign MCU */}}
                  className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)] text-xs"
                >
                  Assign to MCU
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[rgba(0,217,255,0.2)]" />
                <DropdownMenuItem
                  onClick={() => handleDeleteFile(file.id, file.name)}
                  disabled={file.isMain || files.length <= 1}
                  className="text-red-400 hover:bg-[rgba(255,0,0,0.1)] focus:bg-[rgba(255,0,0,0.1)] text-xs"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        
        {/* Add new file button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNewFileDialog(true)}
          className="h-7 px-2 text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Transpile confirmation dialog */}
      {showTranspileConfirm && (
        <div
          className={cn(
            'absolute top-24 left-1/2 -translate-x-1/2 z-50',
            'bg-[#151b24] border border-[rgba(0,217,255,0.3)] rounded-lg',
            'p-4 shadow-xl'
          )}
        >
          <p className="text-[#e6e6e6] text-sm mb-3">
            Transpile code from {activeFile?.language.toUpperCase()} to {pendingLanguage?.toUpperCase()}?
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

      {/* New file dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
          <DialogHeader>
            <DialogTitle className="text-[#e6e6e6]">Create New File</DialogTitle>
            <DialogDescription className="text-[#9ca3af]">
              Enter a name for your new sketch file.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-[#9ca3af] text-sm mb-2 block">File Name</label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="sketch.ino"
                className="bg-[#0a0e14] border-[rgba(0,217,255,0.3)] text-[#e6e6e6]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFile();
                }}
                autoFocus
              />
            </div>
            
            <div>
              <label className="text-[#9ca3af] text-sm mb-2 block">Language</label>
              <Select value={newFileLanguage} onValueChange={(v) => setNewFileLanguage(v as Language)}>
                <SelectTrigger className="bg-[#0a0e14] border-[rgba(0,217,255,0.3)] text-[#e6e6e6]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                  <SelectItem value="cpp" className="text-[#e6e6e6]">C++ (Arduino)</SelectItem>
                  <SelectItem value="micropython" className="text-[#e6e6e6]">MicroPython</SelectItem>
                  <SelectItem value="circuitpython" className="text-[#e6e6e6]">CircuitPython</SelectItem>
                  <SelectItem value="assembly" className="text-[#e6e6e6]">Assembly (AVR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewFileDialog(false)}
              className="bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFile}
              disabled={!newFileName.trim()}
              className="bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00a8cc]"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeFile ? (
          <Editor
            key={activeFile.id} // Force re-mount when file changes
            height="100%"
            language={editorLanguage}
            value={activeFile.code}
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
            No file selected
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
            {activeFile?.language === 'cpp' && 'C++ (Arduino)'}
            {activeFile?.language === 'micropython' && 'MicroPython'}
            {activeFile?.language === 'circuitpython' && 'CircuitPython'}
            {activeFile?.language === 'assembly' && 'Assembly (AVR)'}
          </span>
          <span>UTF-8</span>
          {activeFile?.mcuId && (
            <span className="text-[#00d9ff]">Assigned to MCU</span>
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

export default CodeEditorWithTabs;

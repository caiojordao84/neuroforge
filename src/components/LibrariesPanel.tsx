import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Trash2,
    Upload,
    FileCode,
    MoreVertical,
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Language } from '@/types';

export const LibrariesPanel: React.FC = () => {
    const {
        libraries,
        activeLibraryId,
        addLibrary,
        updateLibrary,
        deleteLibrary,
        setActiveLibrary,
        importLibraryFromUrl
    } = useLibraryStore();

    const [showNewLibDialog, setShowNewLibDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [newLibName, setNewLibName] = useState('');
    const [newLibLanguage, setNewLibLanguage] = useState<Language>('cpp');
    const [importUrl, setImportUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);

    const handleCreateLibrary = () => {
        if (newLibName.trim()) {
            addLibrary(newLibName.trim(), newLibLanguage);
            setNewLibName('');
            setShowNewLibDialog(false);
        }
    };

    const handleImportLibrary = async () => {
        if (importUrl.trim()) {
            setIsImporting(true);
            try {
                await importLibraryFromUrl(importUrl.trim());
                setImportUrl('');
                setShowImportDialog(false);
            } catch (error) {
                alert('Failed to import library. Please check the URL.');
            } finally {
                setIsImporting(false);
            }
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            // Guess language from extension
            let language: Language = 'cpp';
            if (file.name.endsWith('.py')) language = 'micropython';

            addLibrary(file.name, language, content);
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };

    const handleCodeChange = (value: string | undefined) => {
        if (activeLibraryId && value !== undefined) {
            updateLibrary(activeLibraryId, { content: value });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0e14] text-[#e6e6e6]">
            {/* Header / Tabs */}
            <div className="flex items-center gap-1 px-2 py-1 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)] overflow-x-auto">
                {libraries.map((lib) => (
                    <div
                        key={lib.id}
                        onClick={() => setActiveLibrary(lib.id)}
                        className={cn(
                            'group flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer',
                            'text-sm transition-all duration-150 min-w-[100px] max-w-[150px]',
                            activeLibraryId === lib.id
                                ? 'bg-[#0a0e14] text-[#00d9ff] border-t border-l border-r border-[rgba(0,217,255,0.3)]'
                                : 'bg-[#0d1117] text-[#9ca3af] hover:bg-[#1f2937]'
                        )}
                    >
                        <FileCode className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate flex-1">{lib.name}</span>
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
                                    onClick={() => deleteLibrary(lib.id)}
                                    className="text-red-400 hover:bg-[rgba(255,0,0,0.1)] focus:bg-[rgba(255,0,0,0.1)] text-xs"
                                >
                                    <Trash2 className="w-3 h-3 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}

                <div className="flex items-center gap-1 ml-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNewLibDialog(true)}
                        title="New Library"
                        className="h-7 w-7 p-0 text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowImportDialog(true)}
                        title="Import from URL"
                        className="h-7 w-7 p-0 text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]"
                    >
                        <Globe className="w-4 h-4" />
                    </Button>
                    <label className="cursor-pointer">
                        <div className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-[rgba(0,217,255,0.1)] text-[#9ca3af] hover:text-[#00d9ff]">
                            <Upload className="w-4 h-4" />
                        </div>
                        <input
                            type="file"
                            className="hidden"
                            accept=".h,.hpp,.c,.cpp,.py"
                            onChange={handleFileUpload}
                        />
                    </label>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeLibrary ? (
                    <Editor
                        key={activeLibrary.id}
                        height="100%"
                        language={activeLibrary.language === 'cpp' ? 'cpp' : 'python'}
                        value={activeLibrary.content}
                        onChange={handleCodeChange}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            fontFamily: 'JetBrains Mono, monospace',
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-[#9ca3af] p-6 text-center">
                        <FileCode className="w-12 h-12 mb-4 opacity-50" />
                        <p className="mb-2">No library selected</p>
                        <p className="text-xs max-w-xs">
                            Create a new library, import from URL, or upload a file to get started.
                        </p>
                    </div>
                )}
            </div>

            {/* New Library Dialog */}
            <Dialog open={showNewLibDialog} onOpenChange={setShowNewLibDialog}>
                <DialogContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)] z-[9999]">
                    <DialogHeader>
                        <DialogTitle className="text-[#e6e6e6]">Create New Library</DialogTitle>
                        <DialogDescription className="text-[#9ca3af]">
                            Enter a name for your library file (e.g., MyLib.h).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-[#9ca3af] text-sm mb-2 block">Library Name</label>
                            <Input
                                value={newLibName}
                                onChange={(e) => setNewLibName(e.target.value)}
                                placeholder="MyLibrary.h"
                                className="bg-[#0a0e14] border-[rgba(0,217,255,0.3)] text-[#e6e6e6]"
                            />
                        </div>
                        <div>
                            <label className="text-[#9ca3af] text-sm mb-2 block">Language</label>
                            <Select value={newLibLanguage} onValueChange={(v) => setNewLibLanguage(v as Language)}>
                                <SelectTrigger className="bg-[#0a0e14] border-[rgba(0,217,255,0.3)] text-[#e6e6e6]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                    <SelectItem value="cpp" className="text-[#e6e6e6]">C++ (Arduino)</SelectItem>
                                    <SelectItem value="micropython" className="text-[#e6e6e6]">MicroPython</SelectItem>
                                    <SelectItem value="circuitpython" className="text-[#e6e6e6]">CircuitPython</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowNewLibDialog(false)}
                            className="bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateLibrary}
                            disabled={!newLibName.trim()}
                            className="bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00a8cc]"
                        >
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import URL Dialog */}
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)] z-[9999]">
                    <DialogHeader>
                        <DialogTitle className="text-[#e6e6e6]">Import Library</DialogTitle>
                        <DialogDescription className="text-[#9ca3af]">
                            Enter the URL of the raw file to import (e.g., GitHub Raw URL).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            placeholder="https://raw.githubusercontent.com/..."
                            className="bg-[#0a0e14] border-[rgba(0,217,255,0.3)] text-[#e6e6e6]"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowImportDialog(false)}
                            className="bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleImportLibrary}
                            disabled={!importUrl.trim() || isImporting}
                            className="bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00a8cc]"
                        >
                            {isImporting ? 'Importing...' : 'Import'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

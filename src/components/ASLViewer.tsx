import React, { useEffect, useState, useCallback } from 'react';
import { useFileStore } from '@/stores/useFileStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { codeToASL } from '@/engine/asl/codeToASL';
import type { ASLProgram } from '@/engine/asl/ASLTypes';
import { cn } from '@/lib/utils';
import { RefreshCw, AlertCircle } from 'lucide-react';

export const ASLViewer: React.FC = () => {
    const { files, activeFileId } = useFileStore();
    const activeFile = files.find((f) => f.id === activeFileId);

    const [aslJson, setAslJson] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { libraries } = useLibraryStore();
    const regenerate = useCallback(async () => {
        if (!activeFile) {
            setAslJson('// No file active');
            setError(null);
            return;
        }

        if (activeFile.language !== 'cpp' &&
            activeFile.language !== 'micropython' &&
            activeFile.language !== 'circuitpython' &&
            activeFile.language !== 'python' &&
            activeFile.language !== 'rust') {
            setAslJson(`// ASL generation not supported for language: ${activeFile.language}`);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const asl: ASLProgram = await codeToASL(activeFile.code, activeFile.language, libraries);
            setAslJson(JSON.stringify(asl, null, 2));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
            setAslJson('');
        } finally {
            setIsLoading(false);
        }
    }, [activeFile, libraries]);

    // Debounced auto-regeneration on code/file change
    useEffect(() => {
        const timer = setTimeout(() => {
            regenerate();
        }, 600);
        return () => clearTimeout(timer);
    }, [regenerate]);

    return (
        <div className="flex flex-col h-full bg-[#0a0e14]">
            {/* Header */}
            <div
                className={cn(
                    'flex items-center justify-between px-3 py-2',
                    'bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]'
                )}
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9ca3af] font-semibold uppercase tracking-widest">ASL Output</span>
                    {activeFile && (
                        <span className="text-xs text-[#00d9ff] bg-[rgba(0,217,255,0.1)] px-2 py-0.5 rounded">
                            {activeFile.name}
                        </span>
                    )}
                </div>
                <button
                    onClick={regenerate}
                    disabled={isLoading}
                    title="Regenerate ASL"
                    className={cn(
                        'p-1 rounded text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)] transition-colors',
                        isLoading && 'animate-spin text-[#00d9ff]'
                    )}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto relative">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,14,20,0.6)] z-10">
                        <span className="text-[#00d9ff] text-sm animate-pulse">Generating ASL…</span>
                    </div>
                )}

                {error ? (
                    <div className="flex items-start gap-2 m-4 p-3 rounded-lg bg-[rgba(255,50,50,0.1)] border border-red-500/30">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <pre className="text-red-400 text-xs whitespace-pre-wrap break-words font-mono">{error}</pre>
                    </div>
                ) : (
                    <pre
                        className={cn(
                            'p-4 text-xs font-mono text-[#a8d8a8] leading-relaxed',
                            'whitespace-pre overflow-auto h-full',
                            'selection:bg-[rgba(0,217,255,0.2)]'
                        )}
                    >
                        {aslJson || '// Waiting for code…'}
                    </pre>
                )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1 bg-[#151b24] border-t border-[rgba(0,217,255,0.2)] text-xs text-[#5a6472] flex items-center justify-between">
                <span>Abstract Simulation Language — read-only</span>
                {!error && aslJson && (
                    <span className="text-[#9ca3af]">{aslJson.split('\n').length} lines</span>
                )}
            </div>
        </div>
    );
};

export default ASLViewer;

import React, { useRef, useEffect } from 'react';
import { useSerialStore } from '@/stores/useSerialStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Trash2, Terminal as TerminalIcon } from 'lucide-react';

export const Terminal: React.FC = () => {
  const { terminalLines, clearTerminal } = useSerialStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Get level color
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      case 'info':
      default:
        return 'text-[#9ca3af]';
    }
  };

  // Get level icon
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
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
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] text-sm font-medium">System Terminal</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={clearTerminal}
          className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-red-400 hover:bg-red-500/10"
          title="Clear terminal"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 overflow-auto p-3',
          'bg-[#0a0e14] font-mono text-sm',
          'scrollbar-thin scrollbar-thumb-[rgba(0,217,255,0.3)] scrollbar-track-transparent'
        )}
      >
        {terminalLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#666] text-sm gap-2">
            <TerminalIcon className="w-8 h-8 opacity-50" />
            <span>System messages will appear here...</span>
          </div>
        ) : (
          <div className="space-y-1">
            {terminalLines.map((line) => (
              <div key={line.id} className="flex gap-2 items-start">
                <span className="text-[#444] text-xs shrink-0 mt-0.5">
                  [{line.timestamp}]
                </span>
                <span className="shrink-0">{getLevelIcon(line.level)}</span>
                <span className={cn('break-all', getLevelColor(line.level))}>
                  {line.message}
                </span>
              </div>
            ))}
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
          <span>NeuroForge v1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{terminalLines.length} messages</span>
        </div>
      </div>
    </div>
  );
};

export default Terminal;

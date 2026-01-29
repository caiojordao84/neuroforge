import React, { useRef, useEffect, useState } from 'react';
import { useSerialStore } from '@/stores/useSerialStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Trash2, 
  Download, 
  ScrollText,
  Send
} from 'lucide-react';

const baudRates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

export const SerialMonitor: React.FC = () => {
  const { 
    serialLines, 
    baudRate, 
    autoScroll, 
    setBaudRate, 
    setAutoScroll, 
    clearSerial,
    exportSerial 
  } = useSerialStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [serialLines, autoScroll]);

  // Handle export
  const handleExport = () => {
    const content = exportSerial();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial-output-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle send (simulated)
  const handleSend = () => {
    if (inputText.trim()) {
      // In a real implementation, this would send data to the simulation
      setInputText('');
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
        {/* Baud rate selector */}
        <div className="flex items-center gap-2">
          <span className="text-[#9ca3af] text-xs">Baud:</span>
          <Select value={baudRate.toString()} onValueChange={(v) => setBaudRate(parseInt(v, 10))}>
            <SelectTrigger className="w-[90px] h-7 bg-[#0a0e14] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
              {baudRates.map((rate) => (
                <SelectItem 
                  key={rate} 
                  value={rate.toString()}
                  className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)] text-xs"
                >
                  {rate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Auto scroll toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)]',
              autoScroll ? 'text-[#00d9ff]' : 'text-[#9ca3af]',
              'hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]'
            )}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            <ScrollText className="w-4 h-4" />
          </Button>

          {/* Clear button */}
          <Button
            variant="outline"
            size="sm"
            onClick={clearSerial}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-red-400 hover:bg-red-500/10"
            title="Clear output"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]"
            title="Export to file"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Serial output */}
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 overflow-auto p-3',
          'bg-[#0a0e14] font-mono text-sm',
          'scrollbar-thin scrollbar-thumb-[rgba(0,217,255,0.3)] scrollbar-track-transparent'
        )}
      >
        {serialLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#666] text-sm">
            No serial output yet...
          </div>
        ) : (
          <div className="space-y-1">
            {serialLines.map((line) => (
              <div key={line.id} className="flex gap-2">
                <span className="text-[#666] text-xs shrink-0">[{line.timestamp}]</span>
                <span 
                  className={cn(
                    'break-all',
                    line.type === 'output' && 'text-[#e6e6e6]',
                    line.type === 'input' && 'text-[#00d9ff]',
                    line.type === 'error' && 'text-red-400'
                  )}
                >
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2',
          'bg-[#151b24] border-t border-[rgba(0,217,255,0.2)]'
        )}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type to send..."
          className={cn(
            'flex-1 px-3 py-1.5 rounded',
            'bg-[#0a0e14] border border-[rgba(0,217,255,0.3)]',
            'text-[#e6e6e6] text-sm placeholder:text-[#666]',
            'focus:outline-none focus:border-[#00d9ff]'
          )}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="h-8 px-3 bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00a8cc] disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default SerialMonitor;

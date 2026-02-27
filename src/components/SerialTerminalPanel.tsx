import React, { useRef, useEffect, useState } from 'react';
import { useSerialStore } from '@/stores/useSerialStore';
import { cn } from '@/lib/utils';
import { Trash2, Download, ScrollText, Send, Terminal as TerminalIcon } from 'lucide-react';

const baudRates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

type TabType = 'serial' | 'terminal';

export const SerialTerminalPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('serial');
  const {
    serialLines,
    terminalLines,
    baudRate,
    autoScroll,
    setBaudRate,
    setAutoScroll,
    clearSerial,
    exportSerial,
    clearTerminal,
  } = useSerialStore();

  const serialScrollRef = useRef<HTMLDivElement>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (autoScroll && serialScrollRef.current && activeTab === 'serial') {
      serialScrollRef.current.scrollTop = serialScrollRef.current.scrollHeight;
    }
  }, [serialLines, autoScroll, activeTab]);

  useEffect(() => {
    if (autoScroll && terminalScrollRef.current && activeTab === 'terminal') {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLines, autoScroll, activeTab]);

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

  const handleSend = () => {
    if (inputText.trim()) {
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-[rgba(0,217,255,0.2)]">
        <button
          onClick={() => setActiveTab('serial')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            'border-b-2 -mb-px',
            activeTab === 'serial'
              ? 'text-[#00d9ff] border-[#00d9ff]'
              : 'text-[#9ca3af] border-transparent hover:text-[#e6e6e6]'
          )}
        >
          Serial Monitor
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            'border-b-2 -mb-px',
            activeTab === 'terminal'
              ? 'text-[#00d9ff] border-[#00d9ff]'
              : 'text-[#9ca3af] border-transparent hover:text-[#e6e6e6]'
          )}
        >
          Terminal
        </button>
      </div>

      {/* Serial Monitor Tab */}
      {activeTab === 'serial' && (
        <div className="flex flex-col h-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(0,217,255,0.2)]">
            <div className="flex items-center gap-2">
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className={cn(
                  'bg-[#0a0e14] text-[#e6e6e6] text-xs px-2 py-1 rounded',
                  'border border-[rgba(0,217,255,0.3)]',
                  'focus:outline-none focus:border-[#00d9ff]'
                )}
              >
                {baudRates.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} baud
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-[#9ca3af]">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded"
                />
                Auto-scroll
              </label>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearSerial}
                className="p-1.5 rounded hover:bg-[rgba(0,217,255,0.1)]"
                title="Clear"
              >
                <Trash2 className="w-4 h-4 text-[#9ca3af] hover:text-[#00d9ff]" />
              </button>
              <button
                onClick={handleExport}
                className="p-1.5 rounded hover:bg-[rgba(0,217,255,0.1)]"
                title="Export"
              >
                <Download className="w-4 h-4 text-[#9ca3af] hover:text-[#00d9ff]" />
              </button>
            </div>
          </div>

          {/* Output */}
          <div
            ref={serialScrollRef}
            className="flex-1 overflow-auto p-3 font-mono text-xs"
          >
            {serialLines.length === 0 ? (
              <div className="text-[#5a6472] italic">No serial output yet...</div>
            ) : (
              serialLines.map((line) => (
                <div key={line.id} className="text-[#a8d8a8] whitespace-pre-wrap">
                  <span className="text-[#5a6472] mr-2">[{line.timestamp}]</span>
                  {line.text}
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-[rgba(0,217,255,0.2)]">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send to serial..."
              className={cn(
                'flex-1 bg-[#0a0e14] text-[#e6e6e6] text-xs px-3 py-2 rounded',
                'border border-[rgba(0,217,255,0.3)]',
                'focus:outline-none focus:border-[#00d9ff]',
                'placeholder:text-[#5a6472]'
              )}
            />
            <button
              onClick={handleSend}
              className={cn(
                'p-2 rounded bg-[rgba(0,217,255,0.2)]',
                'hover:bg-[rgba(0,217,255,0.3)] transition-colors'
              )}
            >
              <Send className="w-4 h-4 text-[#00d9ff]" />
            </button>
          </div>
        </div>
      )}

      {/* Terminal Tab */}
      {activeTab === 'terminal' && (
        <div className="flex flex-col h-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(0,217,255,0.2)]">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-[#00d9ff]" />
              <span className="text-[#e6e6e6] text-sm font-medium">System Terminal</span>
            </div>
            <button
              onClick={clearTerminal}
              className="p-1.5 rounded hover:bg-[rgba(0,217,255,0.1)]"
              title="Clear"
            >
              <Trash2 className="w-4 h-4 text-[#9ca3af] hover:text-[#00d9ff]" />
            </button>
          </div>

          {/* Terminal output */}
          <div
            ref={terminalScrollRef}
            className="flex-1 overflow-auto p-3 font-mono text-xs"
          >
            {terminalLines.length === 0 ? (
              <div className="text-[#5a6472] italic">Terminal output will appear here...</div>
            ) : (
              terminalLines.map((line) => (
                <div
                  key={line.id}
                  className={cn(
                    'whitespace-pre-wrap',
                    line.level === 'error' && 'text-red-400',
                    line.level === 'success' && 'text-green-400',
                    line.level === 'warning' && 'text-yellow-400',
                    line.level === 'info' && 'text-[#00d9ff]'
                  )}
                >
                  <span className="text-[#5a6472] mr-2">[{line.timestamp}]</span>
                  {line.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SerialTerminalPanel;

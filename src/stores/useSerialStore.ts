import { create } from 'zustand';
import type { SerialLine, TerminalLine, LogLevel } from '@/types';

interface SerialStore {
  // Serial Monitor
  serialLines: SerialLine[];
  baudRate: number;
  autoScroll: boolean;
  
  // Terminal
  terminalLines: TerminalLine[];
  
  // Actions
  addSerialLine: (text: string, type?: SerialLine['type']) => void;
  clearSerial: () => void;
  setBaudRate: (rate: number) => void;
  setAutoScroll: (autoScroll: boolean) => void;
  exportSerial: () => string;
  
  addTerminalLine: (message: string, level?: LogLevel) => void;
  clearTerminal: () => void;
  
  // Serial print helpers (for simulation engine)
  serialPrint: (text: string) => void;
  serialPrintln: (text: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const getTimestamp = () => new Date().toLocaleTimeString();

export const useSerialStore = create<SerialStore>()((set, get) => ({
  // Serial Monitor
  serialLines: [],
  baudRate: 9600,
  autoScroll: true,
  
  // Terminal
  terminalLines: [],

  addSerialLine: (text, type = 'output') => {
    const line: SerialLine = {
      id: generateId(),
      timestamp: getTimestamp(),
      text,
      type,
    };
    set((state) => ({
      serialLines: [...state.serialLines.slice(-499), line], // Keep last 500 lines
    }));
  },

  clearSerial: () => set({ serialLines: [] }),

  setBaudRate: (baudRate) => set({ baudRate }),

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  exportSerial: () => {
    const lines = get().serialLines;
    return lines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
  },

  addTerminalLine: (message, level = 'info') => {
    const line: TerminalLine = {
      id: generateId(),
      timestamp: getTimestamp(),
      message,
      level,
    };
    set((state) => ({
      terminalLines: [...state.terminalLines.slice(-199), line], // Keep last 200 lines
    }));
  },

  clearTerminal: () => set({ terminalLines: [] }),

  serialPrint: (text) => {
    // Append to last line if it exists and is output type
    set((state) => {
      const lastLine = state.serialLines[state.serialLines.length - 1];
      if (lastLine && lastLine.type === 'output' && !lastLine.text.endsWith('\n')) {
        const updatedLines = [...state.serialLines];
        updatedLines[updatedLines.length - 1] = {
          ...lastLine,
          text: lastLine.text + text,
        };
        return { serialLines: updatedLines };
      }
      // Create new line
      const line: SerialLine = {
        id: generateId(),
        timestamp: getTimestamp(),
        text,
        type: 'output',
      };
      return { serialLines: [...state.serialLines, line] };
    });
  },

  serialPrintln: (text) => {
    get().addSerialLine(text, 'output');
  },
}));

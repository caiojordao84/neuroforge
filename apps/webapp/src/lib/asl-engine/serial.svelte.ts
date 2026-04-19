export type SerialLineType = 'output' | 'input' | 'error' | 'system';

export interface SerialLine {
  id: string;
  timestamp: string;
  text: string;
  type: SerialLineType;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface TerminalLine {
  id: string;
  timestamp: string;
  message: string;
  level: LogLevel;
}

const genId = () => Math.random().toString(36).substring(2, 9);
const ts    = () => new Date().toLocaleTimeString();

class SerialState {
  serialLines  = $state<SerialLine[]>([]);
  terminalLines = $state<TerminalLine[]>([]);
  baudRate     = $state(9600);
  autoScroll   = $state(true);

  addSerialLine(text: string, type: SerialLineType = 'output') {
    const line: SerialLine = { id: genId(), timestamp: ts(), text, type };
    this.serialLines = [...this.serialLines.slice(-499), line];
  }

  clearSerial()              { this.serialLines = []; }
  setBaudRate(r: number)     { this.baudRate = r; }
  setAutoScroll(v: boolean)  { this.autoScroll = v; }

  exportSerial(): string {
    return this.serialLines.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
  }

  serialPrint(text: string) {
    const last = this.serialLines.at(-1);
    if (last && last.type === 'output' && !last.text.endsWith('\n')) {
      const updated = [...this.serialLines];
      updated[updated.length - 1] = { ...last, text: last.text + text };
      this.serialLines = updated;
    } else {
      this.addSerialLine(text, 'output');
    }
  }

  serialPrintln(text: string) { this.addSerialLine(text, 'output'); }

  addTerminalLine(message: string, level: LogLevel = 'info') {
    const line: TerminalLine = { id: genId(), timestamp: ts(), message, level };
    this.terminalLines = [...this.terminalLines.slice(-199), line];
  }

  clearTerminal() { this.terminalLines = []; }
}

export const serial = new SerialState();

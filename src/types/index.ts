// NeuroForge - TypeScript Type Definitions

// ============================================
// Window Management Types
// ============================================

export interface WindowState {
  id: string;
  isOpen: boolean;
  isMinimized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  title: string;
}

export type WindowId = 'codeEditor' | 'componentsLibrary' | 'serialMonitor' | 'terminal' | 'properties';

// ============================================
// Pin State Machine Types
// ============================================

export type PinMode = 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';

export type PinValue = 'HIGH' | 'LOW' | number; // number = PWM 0-255

export interface PinState {
  pin: number;
  mode: PinMode;
  value: PinValue;
  isAnalog?: boolean;
}

// ============================================
// Board Types
// ============================================

export type BoardType = 'arduino-uno' | 'esp32-devkit' | 'raspberry-pi-pico';

export interface BoardConfig {
  id: BoardType;
  name: string;
  digitalPins: number[];
  analogPins: number[];
  pwmPins: number[];
  hasWiFi: boolean;
  hasBluetooth: boolean;
  description: string;
}

// ============================================
// MCU Configuration (NEW - Multi-MCU Support)
// ============================================

export interface MCUConfig {
  id: string;                    // Node ID único (igual ao canvas node)
  type: BoardType;               // Tipo da placa
  code: string;                  // Código específico desta MCU
  language: Language;            // Linguagem de programação
  firmwarePath?: string;         // Path do firmware compilado (QEMU)
  isRunning: boolean;            // Status de execução
  label: string;                 // Nome customizado (e.g., "Main Controller")
}

// ============================================
// Component Node Types
// ============================================

export type ComponentType = 'led' | 'rgbLed' | 'button' | 'servo' | 'potentiometer' | 'mcu';

// Node data for React Flow - must extend Record<string, unknown>
export interface ComponentNodeData extends Record<string, unknown> {
  id: string;
  type: ComponentType;
  label: string;
  // LED specific
  color?: string;
  isOn?: boolean;
  brightness?: number;
  // RGB LED specific
  rgbColor?: { r: number; g: number; b: number };
  isCommonAnode?: boolean;
  // Servo specific
  angle?: number;
  minAngle?: number;
  maxAngle?: number;
  // Potentiometer specific
  value?: number;
  percentage?: number;
  // Button specific
  isPressed?: boolean;
  isPullUp?: boolean;
  // MCU specific
  mcuType?: BoardType;
  pinStates?: Record<number, PinState>;
  isRunning?: boolean;
  // Connection info
  connectedPins?: Record<string, number | undefined>;
  connectedPin?: number;
}

// ============================================
// Connection/Wiring Types
// ============================================

export interface WireConnection {
  id: string;
  source: string; // nodeId:handleId (e.g., "LED_1:anode")
  target: string; // nodeId:handleId (e.g., "board:D13")
}

// ============================================
// Simulation Types
// ============================================

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'error';

export type Language = 'cpp' | 'micropython' | 'circuitpython' | 'assembly';

export interface SimulationState {
  status: SimulationStatus;
  language: Language;
  speed: number; // 1x, 2x, 5x, 10x
  code: string;
  isLoopRunning: boolean;
}

// ============================================
// Serial Monitor Types
// ============================================

export interface SerialLine {
  id: string;
  timestamp: string;
  text: string;
  type: 'output' | 'input' | 'error';
}

export interface SerialMonitorState {
  lines: SerialLine[];
  baudRate: number;
  autoScroll: boolean;
}

// ============================================
// Terminal Types
// ============================================

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface TerminalLine {
  id: string;
  timestamp: string;
  message: string;
  level: LogLevel;
}

// ============================================
// Event Types
// ============================================

export interface PinChangeEvent {
  pin: number;
  value: PinValue;
  mode?: PinMode;
}

export interface ComponentEvent {
  componentId: string;
  eventType: string;
  data: unknown;
}

// ============================================
// Component Library Item
// ============================================

export interface ComponentLibraryItem {
  type: ComponentType;
  name: string;
  description: string;
  icon: string;
  defaultData: Record<string, unknown>;
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SimulationStatus,
  Language,
  BoardType,
  BoardConfig,
  PinState,
  MCUConfig
} from '@/types';

interface SimulationStore {
  // Simulation state
  status: SimulationStatus;
  language: Language;
  speed: number;
  isLoopRunning: boolean;

  // Multi-MCU Support (NEW)
  mcus: Map<string, MCUConfig>;
  activeMCUId: string | null;

  // Pin states
  pins: Map<number, PinState>;

  // Actions
  setStatus: (status: SimulationStatus) => void;
  setLanguage: (language: Language) => void;
  setSpeed: (speed: number) => void;
  setIsLoopRunning: (isRunning: boolean) => void;

  // MCU Management (NEW)
  addMCU: (id: string, config: Omit<MCUConfig, 'id'>) => void;
  removeMCU: (id: string) => void;
  updateMCUCode: (id: string, code: string) => void;
  updateMCULanguage: (id: string, language: Language) => void;
  setMCUFirmware: (id: string, firmwarePath: string) => void;
  setMCURunning: (id: string, isRunning: boolean) => void;
  getMCU: (id: string) => MCUConfig | undefined;
  getAllMCUs: () => MCUConfig[];
  setActiveMCU: (id: string | null) => void;
  syncMCUsWithCanvas: (canvasNodeIds: string[]) => void;
  clearAllMCUs: () => void;

  // Pin operations
  setPinMode: (pin: number, mode: PinState['mode']) => void;
  digitalWrite: (pin: number, value: 'HIGH' | 'LOW') => void;
  analogWrite: (pin: number, value: number) => void;
  digitalRead: (pin: number) => 'HIGH' | 'LOW';
  analogRead: (pin: number) => number;
  getPinState: (pin: number) => PinState | undefined;
  resetPins: () => void;

  // Start/Stop/Reset
  startSimulation: () => void;
  stopSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
}

const defaultCppCode = `// Arduino LED Blink Example
// LED connected to pin 13

void setup() {
  // Initialize digital pin 13 as an output
  pinMode(13, OUTPUT);
  
  // Initialize Serial communication
  Serial.begin(9600);
  Serial.println("Arduino started!");
}

void loop() {
  // Turn the LED on
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(1000);
  
  // Turn the LED off
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(1000);
}`;

const defaultMicroPythonCode = `# MicroPython LED Blink Example
from machine import Pin
import time

# Initialize LED on pin 13
led = Pin(13, Pin.OUT)

print("MicroPython started!")

while True:
    # Turn LED on
    led.value(1)
    print("LED ON")
    time.sleep(1)
    
    # Turn LED off
    led.value(0)
    print("LED OFF")
    time.sleep(1)`;

const defaultCircuitPythonCode = `# CircuitPython LED Blink Example
import board
import digitalio
import time

# Initialize LED on pin 13
led = digitalio.DigitalInOut(board.D13)
led.direction = digitalio.Direction.OUTPUT

print("CircuitPython started!")

while True:
    # Turn LED on
    led.value = True
    print("LED ON")
    time.sleep(1)
    
    # Turn LED off
    led.value = False
    print("LED OFF")
    time.sleep(1)`;

const defaultAssemblyCode = `; AVR Assembly LED Blink Example
; LED connected to pin 13 (PB5)

.include "m328pdef.inc"

; Initialize stack pointer
ldi r16, LOW(RAMEND)
out SPL, r16
ldi r16, HIGH(RAMEND)
out SPH, r16

; Set PB5 as output
sbi DDRB, 5

main_loop:
    ; Turn LED on (set PB5 high)
    sbi PORTB, 5
    
    ; Delay ~1 second
    ldi r24, 0xFF
    ldi r25, 0xFF
    ldi r26, 0x0A
delay_on:
    dec r24
    brne delay_on
    dec r25
    brne delay_on
    dec r26
    brne delay_on
    
    ; Turn LED off (clear PB5)
    cbi PORTB, 5
    
    ; Delay ~1 second
    ldi r24, 0xFF
    ldi r25, 0xFF
    ldi r26, 0x0A
delay_off:
    dec r24
    brne delay_off
    dec r25
    brne delay_off
    dec r26
    brne delay_off
    
    rjmp main_loop`;

export const defaultCodeMap: Record<Language, string> = {
  'cpp': defaultCppCode,
  'micropython': defaultMicroPythonCode,
  'circuitpython': defaultCircuitPythonCode,
  'assembly': defaultAssemblyCode,
};

export const boardConfigs: Record<BoardType, BoardConfig> = {
  'arduino-uno': {
    id: 'arduino-uno',
    name: 'Arduino Uno R3',
    digitalPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    analogPins: [14, 15, 16, 17, 18, 19], // A0-A5
    pwmPins: [3, 5, 6, 9, 10, 11],
    hasWiFi: false,
    hasBluetooth: false,
    description: 'ATmega328P - 14 digital, 6 analog pins',
  },
  'esp32-devkit': {
    id: 'esp32-devkit',
    name: 'ESP32 DevKit V1',
    digitalPins: Array.from({ length: 40 }, (_, i) => i),
    analogPins: [32, 33, 34, 35, 36, 39],
    pwmPins: Array.from({ length: 40 }, (_, i) => i),
    hasWiFi: true,
    hasBluetooth: true,
    description: '38 GPIO, WiFi/Bluetooth enabled',
  },
  'raspberry-pi-pico': {
    id: 'raspberry-pi-pico',
    name: 'Raspberry Pi Pico',
    digitalPins: Array.from({ length: 30 }, (_, i) => i),
    analogPins: [26, 27, 28],
    pwmPins: Array.from({ length: 30 }, (_, i) => i),
    hasWiFi: false,
    hasBluetooth: false,
    description: 'RP2040 - 26 GPIO, 3 analog pins',
  },
};

export const useSimulationStore = create<SimulationStore>()(
  persist(
    (set, get) => ({
      status: 'idle',
      language: 'cpp',
      speed: 1,
      isLoopRunning: false,
      mcus: new Map(),
      activeMCUId: null,
      pins: new Map(),

      setStatus: (status) => set({ status }),
      setLanguage: (language) => set({ language }),
      setSpeed: (speed) => set({ speed }),
      setIsLoopRunning: (isLoopRunning) => set({ isLoopRunning }),

      // MCU Management
      addMCU: (id, config) => {
        set((state) => {
          const newMCUs = new Map(state.mcus);
          newMCUs.set(id, { id, ...config });
          console.log(`✅ [Store] Added MCU: ${id} (${config.type})`);
          return {
            mcus: newMCUs,
            activeMCUId: state.activeMCUId || id
          };
        });
      },

      removeMCU: (id) => {
        set((state) => {
          const newMCUs = new Map(state.mcus);
          newMCUs.delete(id);
          console.log(`🗑️ [Store] Removed MCU: ${id}`);
          return {
            mcus: newMCUs,
            activeMCUId: state.activeMCUId === id
              ? (newMCUs.size > 0 ? Array.from(newMCUs.keys())[0] : null)
              : state.activeMCUId
          };
        });
      },

      updateMCUCode: (id, code) => {
        set((state) => {
          const mcu = state.mcus.get(id);
          if (!mcu) return state;

          const newMCUs = new Map(state.mcus);
          newMCUs.set(id, { ...mcu, code });
          return { mcus: newMCUs };
        });
      },

      updateMCULanguage: (id, language) => {
        set((state) => {
          const mcu = state.mcus.get(id);
          if (!mcu) return state;

          const newMCUs = new Map(state.mcus);
          newMCUs.set(id, { ...mcu, language });
          return { mcus: newMCUs };
        });
      },

      setMCUFirmware: (id, firmwarePath) => {
        set((state) => {
          const mcu = state.mcus.get(id);
          if (!mcu) return state;

          const newMCUs = new Map(state.mcus);
          newMCUs.set(id, { ...mcu, firmwarePath });
          return { mcus: newMCUs };
        });
      },

      setMCURunning: (id, isRunning) => {
        set((state) => {
          const mcu = state.mcus.get(id);
          if (!mcu) return state;

          const newMCUs = new Map(state.mcus);
          newMCUs.set(id, { ...mcu, isRunning });
          return { mcus: newMCUs };
        });
      },

      getMCU: (id) => get().mcus.get(id),

      getAllMCUs: () => Array.from(get().mcus.values()),

      setActiveMCU: (id) => set({ activeMCUId: id }),

      // Sync MCUs with canvas - remove phantom MCUs
      syncMCUsWithCanvas: (canvasNodeIds: string[]) => {
        set((state) => {
          const newMCUs = new Map(state.mcus);
          let changed = false;

          // Remove MCUs that are no longer on canvas
          for (const mcuId of newMCUs.keys()) {
            if (!canvasNodeIds.includes(mcuId)) {
              console.log(`🧹 [Store] Cleaning phantom MCU: ${mcuId}`);
              newMCUs.delete(mcuId);
              changed = true;
            }
          }

          if (!changed) return state;

          // Update activeMCUId if it was removed
          const newActiveMCUId = newMCUs.has(state.activeMCUId!)
            ? state.activeMCUId
            : (newMCUs.size > 0 ? Array.from(newMCUs.keys())[0] : null);

          console.log(`✅ [Store] Synced ${newMCUs.size} MCUs with canvas`);

          return {
            mcus: newMCUs,
            activeMCUId: newActiveMCUId
          };
        });
      },

      // Clear all MCUs
      clearAllMCUs: () => {
        console.log('🧹 [Store] Clearing all MCUs');
        set({ mcus: new Map(), activeMCUId: null });
      },

      setPinMode: (pin, mode) => {
        set((state) => {
          const newPins = new Map(state.pins);
          const existingPin = newPins.get(pin);
          newPins.set(pin, {
            pin,
            mode,
            value: existingPin?.value ?? 'LOW',
          });
          return { pins: newPins };
        });
      },

      digitalWrite: (pin, value) => {
        set((state) => {
          const pinState = state.pins.get(pin);
          // NeuroForge: allow writing even if mode is unknown for QEMU sync
          // if (!pinState || pinState.mode !== 'OUTPUT') { ... }
          const newPins = new Map(state.pins);
          newPins.set(pin, {
            pin,
            mode: pinState?.mode ?? 'OUTPUT',
            value
          });
          return { pins: newPins };
        });
      },

      analogWrite: (pin, value) => {
        set((state) => {
          const pinState = state.pins.get(pin);
          // NeuroForge: allow writing even if mode is unknown for QEMU sync
          const clampedValue = Math.max(0, Math.min(255, value));
          const newPins = new Map(state.pins);
          newPins.set(pin, {
            pin,
            mode: pinState?.mode ?? 'OUTPUT',
            value: clampedValue
          });
          return { pins: newPins };
        });
      },

      digitalRead: (pin) => {
        const pinState = get().pins.get(pin);
        if (!pinState) return 'LOW';
        if (typeof pinState.value === 'number') {
          return pinState.value > 127 ? 'HIGH' : 'LOW';
        }
        return pinState.value;
      },

      analogRead: (pin) => {
        const pinState = get().pins.get(pin);
        if (!pinState) return 0;
        if (typeof pinState.value === 'number') {
          return Math.round((pinState.value / 255) * 1023);
        }
        return pinState.value === 'HIGH' ? 1023 : 0;
      },

      getPinState: (pin) => get().pins.get(pin),

      resetPins: () => set({ pins: new Map() }),

      startSimulation: () => {
        set({ status: 'running', isLoopRunning: true });
      },

      stopSimulation: () => {
        set({ status: 'idle', isLoopRunning: false });
        get().resetPins();
      },

      pauseSimulation: () => {
        set({ status: 'paused', isLoopRunning: false });
      },

      resetSimulation: () => {
        set({ status: 'idle', isLoopRunning: false });
        get().resetPins();
      },
    }),
    {
      name: 'neuroforge-simulation-store',
      partialize: (state) => ({
        language: state.language,
        speed: state.speed,
        mcus: Array.from(state.mcus.entries()),
        activeMCUId: state.activeMCUId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray((state as any).mcus)) {
          (state as any).mcus = new Map((state as any).mcus);
        }
      },
    }
  )
);

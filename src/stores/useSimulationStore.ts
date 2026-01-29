import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  SimulationStatus, 
  Language, 
  BoardType, 
  BoardConfig,
  PinState 
} from '@/types';

interface SimulationStore {
  // Simulation state
  status: SimulationStatus;
  language: Language;
  speed: number;
  code: string;
  isLoopRunning: boolean;
  
  // Board selection
  selectedBoard: BoardType;
  
  // Pin states
  pins: Map<number, PinState>;
  
  // Actions
  setStatus: (status: SimulationStatus) => void;
  setLanguage: (language: Language) => void;
  setSpeed: (speed: number) => void;
  setCode: (code: string) => void;
  setIsLoopRunning: (isRunning: boolean) => void;
  setSelectedBoard: (board: BoardType) => void;
  
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

const defaultCodeMap: Record<Language, string> = {
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
      code: defaultCppCode,
      isLoopRunning: false,
      selectedBoard: 'arduino-uno',
      pins: new Map(),

      setStatus: (status) => set({ status }),
      setLanguage: (language) => {
        const currentLang = get().language;
        
        // If switching languages, update the default code
        if (language !== currentLang) {
          const newCode = defaultCodeMap[language];
          set({ language, code: newCode });
        } else {
          set({ language });
        }
      },
      setSpeed: (speed) => set({ speed }),
      setCode: (code) => set({ code }),
      setIsLoopRunning: (isLoopRunning) => set({ isLoopRunning }),
      setSelectedBoard: (selectedBoard) => set({ selectedBoard }),

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
          if (!pinState || pinState.mode !== 'OUTPUT') {
            console.warn(`Pin ${pin} is not set to OUTPUT mode`);
            return state;
          }
          const newPins = new Map(state.pins);
          newPins.set(pin, { ...pinState, value });
          return { pins: newPins };
        });
      },

      analogWrite: (pin, value) => {
        set((state) => {
          const pinState = state.pins.get(pin);
          if (!pinState || pinState.mode !== 'OUTPUT') {
            console.warn(`Pin ${pin} is not set to OUTPUT mode`);
            return state;
          }
          const clampedValue = Math.max(0, Math.min(255, value));
          const newPins = new Map(state.pins);
          newPins.set(pin, { ...pinState, value: clampedValue });
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
          // Convert PWM (0-255) to analog (0-1023)
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
        code: state.code,
        selectedBoard: state.selectedBoard,
        speed: state.speed,
      }),
    }
  )
);

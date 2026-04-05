export interface PinDefinition {
  logical_pin: number;
  physical_pin: number | null;
  label: string;
  pwm: boolean;
  interrupt: boolean;
  adc: boolean;
  dac: boolean;
  touch: boolean;
  input_only: boolean;
  strapping: boolean;
  warning: string | null;
}

export interface BoardMeta {
  id: string;
  name: string;
  manufacturer: string;
  mcu: string;
  frequency: number;
  languages: string[];
  asl_profiles: string[];
}

export interface SvgPinMapping {
  pin_id: string;
  svg_id: string;
  x: number;
  y: number;
}

export interface ToonBoard {
  version: string;
  board: BoardMeta;
  pins: PinDefinition[];
  svg_map: SvgPinMapping[];
}

// ============================================
// Component Mode Types
// ============================================

export type SignalDirection = 'input' | 'output' | 'bidirectional';
export type SignalType = 'digital' | 'pwm' | 'analog' | 'power' | 'gnd' | 'i2c' | 'spi' | 'uart';

export interface SignalAnchor {
  id: string;
  name: string;
  direction: SignalDirection;
  signalType: SignalType;
  x: number;
  y: number;
}

export interface AslHint {
  semanticType: string;
  defaultOperation: string;
  include: boolean;
  hmiWidget: string | null;
  hmiUnit: string | null;
  hmiMin: number | null;
  hmiMax: number | null;
}

export interface Restrictions {
  requiresPwm: boolean;
  requiresAdc: boolean;
  maxCurrentMa: number | null;
  notes: string | null;
}

export type ComponentCategory = 'sensor' | 'actuator' | 'indicator' | 'passive' | 'communication';

export interface ComponentMeta {
  id: string;
  name: string;
  category: ComponentCategory;
  subcategory: string | null;
  svgId: string | null;
  voltage: number | null;
}

export interface ToonComponent {
  version: string;
  component: ComponentMeta;
  signals: SignalAnchor[];
  asl_hints: AslHint[];
  restrictions: Restrictions;
}

// Component template presets
export interface ComponentTemplate {
  id: string;
  name: string;
  category: ComponentCategory;
  subcategory: string;
  description: string;
  defaultSignals: SignalAnchor[];
  defaultAslHints: AslHint[];
  defaultRestrictions: Restrictions;
}

export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    id: 'ldr-sensor',
    name: 'LDR Light Sensor',
    category: 'sensor',
    subcategory: 'light',
    description: 'Light Dependent Resistor for ambient light sensing',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-out', name: 'AO', direction: 'output', signalType: 'analog', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'light.intensity', defaultOperation: 'read', include: true, hmiWidget: 'slider', hmiUnit: 'lux', hmiMin: 0, hmiMax: 1000 }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: true, maxCurrentMa: null, notes: null }
  },
  {
    id: 'dht22-sensor',
    name: 'DHT22 Temperature/Humidity',
    category: 'sensor',
    subcategory: 'environmental',
    description: 'Digital temperature and humidity sensor',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-data', name: 'DATA', direction: 'bidirectional', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'temperature', defaultOperation: 'read', include: true, hmiWidget: 'gauge', hmiUnit: '°C', hmiMin: -40, hmiMax: 80 },
      { semanticType: 'humidity', defaultOperation: 'read', include: true, hmiWidget: 'gauge', hmiUnit: '%', hmiMin: 0, hmiMax: 100 }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 2, notes: 'Requires pull-up resistor on data line' }
  },
  {
    id: 'hc-sr04-sensor',
    name: 'HC-SR04 Ultrasonic Distance',
    category: 'sensor',
    subcategory: 'distance',
    description: 'Ultrasonic distance sensor',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-trig', name: 'TRIG', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-echo', name: 'ECHO', direction: 'output', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'distance', defaultOperation: 'read', include: true, hmiWidget: 'number', hmiUnit: 'cm', hmiMin: 2, hmiMax: 400 }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 15, notes: null }
  },
  {
    id: 'pir-sensor',
    name: 'PIR Motion Sensor',
    category: 'sensor',
    subcategory: 'motion',
    description: 'Passive Infrared motion detector',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-out', name: 'OUT', direction: 'output', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'motion.detected', defaultOperation: 'read', include: true, hmiWidget: 'indicator', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 50, notes: 'Warm-up time required after power-on' }
  },
  {
    id: 'mpu6050-sensor',
    name: 'MPU6050 IMU Sensor',
    category: 'sensor',
    subcategory: 'imu',
    description: '6-axis accelerometer and gyroscope',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-scl', name: 'SCL', direction: 'input', signalType: 'i2c', x: 0, y: 0 },
      { id: 'signal-sda', name: 'SDA', direction: 'bidirectional', signalType: 'i2c', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'acceleration.x', defaultOperation: 'read', include: true, hmiWidget: 'number', hmiUnit: 'g', hmiMin: -16, hmiMax: 16 },
      { semanticType: 'acceleration.y', defaultOperation: 'read', include: true, hmiWidget: 'number', hmiUnit: 'g', hmiMin: -16, hmiMax: 16 },
      { semanticType: 'acceleration.z', defaultOperation: 'read', include: true, hmiWidget: 'number', hmiUnit: 'g', hmiMin: -16, hmiMax: 16 },
      { semanticType: 'gyro.x', defaultOperation: 'read', include: true, hmiWidget: 'number', hmiUnit: '°/s', hmiMin: -2000, hmiMax: 2000 },
      { semanticType: 'gyro.y', defaultOperation: 'read', include: true, hmiWidget: 'number', hmiUnit: '°/s', hmiMin: -2000, hmiMax: 2000 },
      { semanticType: 'gyro.z', defaultOperation: 'read', include: true, hmiWidget: 'number', hmiUnit: '°/s', hmiMin: -2000, hmiMax: 2000 }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 3, notes: 'I2C address: 0x68 (AD0 low) or 0x69 (AD0 high)' }
  },
  {
    id: 'encoder-sensor',
    name: 'Rotary Encoder',
    category: 'sensor',
    subcategory: 'rotary',
    description: ' rotary encoder with push button',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-a', name: 'A', direction: 'output', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-b', name: 'B', direction: 'output', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-sw', name: 'SW', direction: 'output', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'rotation.position', defaultOperation: 'read', include: true, hmiWidget: 'number', hmiUnit: 'ticks', hmiMin: 0, hmiMax: null },
      { semanticType: 'button.pressed', defaultOperation: 'read', include: true, hmiWidget: 'button', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 1, notes: 'Requires pull-up resistors on A, B, SW' }
  },
  {
    id: 'servo-actuator',
    name: 'SG90 Servo Motor',
    category: 'actuator',
    subcategory: 'servo',
    description: 'Small servo motor for precise angle control',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-sig', name: 'SIG', direction: 'input', signalType: 'pwm', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'servo.angle', defaultOperation: 'write', include: true, hmiWidget: 'slider', hmiUnit: '°', hmiMin: 0, hmiMax: 180 }
    ],
    defaultRestrictions: { requiresPwm: true, requiresAdc: false, maxCurrentMa: 750, notes: 'Use external 5V supply for multiple servos' }
  },
  {
    id: 'dc-motor-actuator',
    name: 'DC Motor',
    category: 'actuator',
    subcategory: 'dc',
    description: 'Brushed DC motor',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-pwm', name: 'PWM', direction: 'input', signalType: 'pwm', x: 0, y: 0 },
      { id: 'signal-dir', name: 'DIR', direction: 'input', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'motor.speed', defaultOperation: 'write', include: true, hmiWidget: 'slider', hmiUnit: '%', hmiMin: 0, hmiMax: 100 },
      { semanticType: 'motor.direction', defaultOperation: 'write', include: true, hmiWidget: 'toggle', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: true, requiresAdc: false, maxCurrentMa: 1000, notes: 'Requires motor driver (L298N, DRV8833, etc.)' }
  },
  {
    id: 'stepper-actuator',
    name: 'Stepper Motor',
    category: 'actuator',
    subcategory: 'stepper',
    description: 'Bipolar stepper motor (4-wire)',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-a1', name: 'A1', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-a2', name: 'A2', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-b1', name: 'B1', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-b2', name: 'B2', direction: 'input', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'stepper.position', defaultOperation: 'write', include: true, hmiWidget: 'number', hmiUnit: 'steps', hmiMin: 0, hmiMax: null },
      { semanticType: 'stepper.speed', defaultOperation: 'write', include: true, hmiWidget: 'slider', hmiUnit: 'rpm', hmiMin: 1, hmiMax: 500 }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 2000, notes: 'Requires stepper driver (A4988, DRV8825, etc.)' }
  },
  {
    id: 'pump-actuator',
    name: 'Water Pump',
    category: 'actuator',
    subcategory: 'pump',
    description: 'Small water pump',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-ctrl', name: 'CTRL', direction: 'input', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'pump.on', defaultOperation: 'write', include: true, hmiWidget: 'toggle', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 500, notes: 'Use MOSFET or relay to control' }
  },
  {
    id: 'led-indicator',
    name: 'LED',
    category: 'indicator',
    subcategory: 'led',
    description: 'Light Emitting Diode',
    defaultSignals: [
      { id: 'signal-anode', name: ' anode', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-cathode', name: ' cathode', direction: 'input', signalType: 'gnd', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'led.on', defaultOperation: 'write', include: true, hmiWidget: 'toggle', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 20, notes: 'Use current-limiting resistor' }
  },
  {
    id: 'rgb-led-indicator',
    name: 'RGB LED',
    category: 'indicator',
    subcategory: 'rgb',
    description: 'Common cathode RGB LED',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-r', name: 'R', direction: 'input', signalType: 'pwm', x: 0, y: 0 },
      { id: 'signal-g', name: 'G', direction: 'input', signalType: 'pwm', x: 0, y: 0 },
      { id: 'signal-b', name: 'B', direction: 'input', signalType: 'pwm', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'led.color', defaultOperation: 'write', include: true, hmiWidget: 'colorpicker', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: true, requiresAdc: false, maxCurrentMa: 60, notes: 'Use current-limiting resistors for each color' }
  },
  {
    id: 'buzzer-indicator',
    name: 'Piezo Buzzer',
    category: 'indicator',
    subcategory: 'buzzer',
    description: 'Piezoelectric buzzer',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-sig', name: 'SIG', direction: 'input', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'buzzer.frequency', defaultOperation: 'write', include: true, hmiWidget: 'slider', hmiUnit: 'Hz', hmiMin: 100, hmiMax: 5000 }
    ],
    defaultRestrictions: { requiresPwm: true, requiresAdc: false, maxCurrentMa: 100, notes: null }
  },
  {
    id: '7seg-indicator',
    name: '7-Segment Display',
    category: 'indicator',
    subcategory: 'display',
    description: 'Single digit 7-segment display',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-a', name: 'A', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-b', name: 'B', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-c', name: 'C', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-d', name: 'D', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-e', name: 'E', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-f', name: 'F', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-g', name: 'G', direction: 'input', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-dp', name: 'DP', direction: 'input', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'display.digit', defaultOperation: 'write', include: true, hmiWidget: 'number', hmiUnit: null, hmiMin: 0, hmiMax: 9 }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 80, notes: 'Use current-limiting resistors or driver IC' }
  },
  {
    id: 'oled-indicator',
    name: 'OLED Display',
    category: 'indicator',
    subcategory: 'oled',
    description: 'OLED display module (SSD1306)',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-scl', name: 'SCL', direction: 'input', signalType: 'i2c', x: 0, y: 0 },
      { id: 'signal-sda', name: 'SDA', direction: 'bidirectional', signalType: 'i2c', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'display.text', defaultOperation: 'write', include: true, hmiWidget: 'text', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 50, notes: 'I2C address: 0x3C (most common)' }
  },
  {
    id: 'resistor-passive',
    name: 'Resistor',
    category: 'passive',
    subcategory: 'resistor',
    description: 'Fixed resistor',
    defaultSignals: [
      { id: 'signal-a', name: 'A', direction: 'bidirectional', signalType: 'analog', x: 0, y: 0 },
      { id: 'signal-b', name: 'B', direction: 'bidirectional', signalType: 'analog', x: 0, y: 0 }
    ],
    defaultAslHints: [],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: null, notes: 'Calculate power rating based on voltage and resistance' }
  },
  {
    id: 'potentiometer-passive',
    name: 'Potentiometer',
    category: 'passive',
    subcategory: 'potentiometer',
    description: 'Variable resistor',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'analog', x: 0, y: 0 },
      { id: 'signal-wiper', name: 'WIPER', direction: 'output', signalType: 'analog', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'potentiometer.value', defaultOperation: 'read', include: true, hmiWidget: 'slider', hmiUnit: '%', hmiMin: 0, hmiMax: 100 }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: true, maxCurrentMa: null, notes: null }
  },
  {
    id: 'rf-module-comm',
    name: 'RF Module (433MHz)',
    category: 'communication',
    subcategory: 'rf',
    description: '433MHz radio frequency transmitter/receiver',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-data', name: 'DATA', direction: 'bidirectional', signalType: 'digital', x: 0, y: 0 },
      { id: 'signal-ant', name: 'ANT', direction: 'input', signalType: 'analog', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'rf.received', defaultOperation: 'read', include: true, hmiWidget: 'indicator', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 30, notes: 'Use proper antenna for range' }
  },
  {
    id: 'bt-uart-comm',
    name: 'Bluetooth UART Module',
    category: 'communication',
    subcategory: 'bluetooth',
    description: 'HC-05/HC-06 Bluetooth serial module',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-tx', name: 'TX', direction: 'output', signalType: 'uart', x: 0, y: 0 },
      { id: 'signal-rx', name: 'RX', direction: 'input', signalType: 'uart', x: 0, y: 0 },
      { id: 'signal-en', name: 'EN', direction: 'input', signalType: 'digital', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'bt.connected', defaultOperation: 'read', include: true, hmiWidget: 'indicator', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 50, notes: 'Default baud: 9600, Default PIN: 1234' }
  },
  {
    id: 'can-comm',
    name: 'CAN Transceiver',
    category: 'communication',
    subcategory: 'can',
    description: 'CAN bus transceiver (MCP2551, SN65HVD230)',
    defaultSignals: [
      { id: 'signal-vcc', name: 'VCC', direction: 'input', signalType: 'power', x: 0, y: 0 },
      { id: 'signal-gnd', name: 'GND', direction: 'input', signalType: 'gnd', x: 0, y: 0 },
      { id: 'signal-tx', name: 'TXD', direction: 'input', signalType: 'uart', x: 0, y: 0 },
      { id: 'signal-rx', name: 'RXD', direction: 'output', signalType: 'uart', x: 0, y: 0 },
      { id: 'signal-can-h', name: 'CANH', direction: 'bidirectional', signalType: 'analog', x: 0, y: 0 },
      { id: 'signal-can-l', name: 'CANL', direction: 'bidirectional', signalType: 'analog', x: 0, y: 0 }
    ],
    defaultAslHints: [
      { semanticType: 'can.busStatus', defaultOperation: 'read', include: true, hmiWidget: 'indicator', hmiUnit: null, hmiMin: null, hmiMax: null }
    ],
    defaultRestrictions: { requiresPwm: false, requiresAdc: false, maxCurrentMa: 70, notes: 'Requires 120Ω termination resistors on each end of bus' }
  }
];

export const CATEGORIES: { value: ComponentCategory; label: string }[] = [
  { value: 'sensor', label: 'Sensor' },
  { value: 'actuator', label: 'Actuator' },
  { value: 'indicator', label: 'Indicator' },
  { value: 'passive', label: 'Passive' },
  { value: 'communication', label: 'Communication' }
];

export const SUBCATEGORIES: Record<ComponentCategory, string[]> = {
  sensor: ['light', 'environmental', 'distance', 'motion', 'imu', 'rotary', 'sound', 'other'],
  actuator: ['servo', 'dc', 'stepper', 'solenoid', 'pump', 'relay', 'other'],
  indicator: ['led', 'rgb', 'buzzer', '7-seg', 'oled', 'lcd', 'other'],
  passive: ['resistor', 'capacitor', 'potentiometer', 'inductor', 'crystal', 'other'],
  communication: ['rf', 'bluetooth', 'wifi', 'can', 'rs232', 'spi', 'i2c', 'other']
};

export const SIGNAL_TYPES: { value: SignalType; label: string }[] = [
  { value: 'digital', label: 'Digital' },
  { value: 'pwm', label: 'PWM' },
  { value: 'analog', label: 'Analog' },
  { value: 'power', label: 'Power (VCC)' },
  { value: 'gnd', label: 'Ground (GND)' },
  { value: 'i2c', label: 'I2C' },
  { value: 'spi', label: 'SPI' },
  { value: 'uart', label: 'UART' }
];

export const SIGNAL_DIRECTIONS: { value: SignalDirection; label: string }[] = [
  { value: 'input', label: 'Input (to component)' },
  { value: 'output', label: 'Output (from component)' },
  { value: 'bidirectional', label: 'Bidirectional' }
];

export const HMI_WIDGETS = [
  { value: 'slider', label: 'Slider' },
  { value: 'number', label: 'Number Input' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'toggle', label: 'Toggle Switch' },
  { value: 'button', label: 'Button' },
  { value: 'indicator', label: 'Status Indicator' },
  { value: 'colorpicker', label: 'Color Picker' },
  { value: 'text', label: 'Text Display' }
];

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  field: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ============================================
// Backend Validation Types (from Tauri)
// ============================================

export interface BoardValidationError {
  field: string | null;
  message: string;
  errorType: string;
}

export interface BoardValidationResult {
  valid: boolean;
  errors: BoardValidationError[];
}

export interface ComponentValidationError {
  field: string | null;
  message: string;
  errorType: string;
}

export interface ComponentValidationResult {
  valid: boolean;
  errors: ComponentValidationError[];
}

export interface SvgPinElement {
  id: string;
  cx: number;
  cy: number;
  r: number;
  data: Record<string, string>;
}

export const SUPPORTED_LANGUAGES = [
  'arduino-cpp',
  'micropython',
  'circuitpython',
  'esp-idf',
  'rust',
  'assembly'
] as const;

export const ASL_PROFILES = [
  'arduino-uno',
  'esp32-devkitc-v4',
  'raspberry-pi-pico',
  'esp32-s3',
  'stm32f4',
  'teensy-4.0'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export type AslProfile = typeof ASL_PROFILES[number];

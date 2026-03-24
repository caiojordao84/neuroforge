/**
 * index_additions.ts
 * Adições aos tipos globais — a integrar em src/types/index.ts
 * quando a portagem para Svelte/Rust estiver concluída.
 */

// --- SERVO ---

export type ServoType =
  | 'standard_90'
  | 'standard_180'
  | 'standard_270'
  | 'continuous_360';

export interface ServoModel {
  name: string;
  servoType: ServoType;
  minAngle: number;       // sempre 0
  maxAngle: number;       // 90 | 180 | 270 | 360
  minPulse: number;       // µs
  maxPulse: number;       // µs
  voltage: string;        // ex: "4.8–6V"
  torque: string;         // ex: "1.8 kg·cm @ 4.8V"
  current_stall: string;  // ex: "700mA"
  notes: string;
}

// --- POTENCIÓMETRO ---

export type TaperType = 'linear' | 'log' | 'antilog';

// --- RGB LED ---

export interface RGBChannelConfig {
  forwardVoltage: number;    // Vf do canal (V)
  resistor: number | 'USER'; // Resistor série (Ω) ou USER para custom
  customResistance?: number; // Só se resistor === 'USER'
}

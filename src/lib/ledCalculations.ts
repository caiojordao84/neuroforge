import { useSimulationStore } from '@/stores/useSimulationStore';

export type LedColorProfile =
  | 'RED'
  | 'GREEN'
  | 'BLUE'
  | 'YELLOW'
  | 'WHITE'
  | 'ORANGE'
  | 'UV'
  | 'USER';

export interface LedProfile {
  vf: number;      // Forward voltage (V)
  if_nom: number;  // Corrente nominal (A)
  if_max: number;  // Corrente máxima segura (A)
  mcd: number;     // Intensidade base (mcd)
  hex: string;     // Cor padrão para preview
}

export type ResistorOption = number | 'USER';

export interface MicrocontrollerProfile {
  key: 'PICO' | 'ESP32' | 'ARDUINO_R3' | 'GENERIC';
  name: string;
  v_out: number;   // Tensão típica de saída (V)
  max_ma: number;  // Corrente máxima por pino (mA)
}

// Dataset equivalente ao JSON especificado
export const ledProfiles: Record<LedColorProfile, LedProfile> = {
  RED:    { vf: 2.0, if_nom: 0.020, if_max: 0.030, mcd: 800,  hex: '#ff0000' },
  GREEN:  { vf: 3.2, if_nom: 0.020, if_max: 0.030, mcd: 2000, hex: '#00ff00' },
  BLUE:   { vf: 3.2, if_nom: 0.020, if_max: 0.030, mcd: 1500, hex: '#0000ff' },
  YELLOW: { vf: 2.1, if_nom: 0.020, if_max: 0.030, mcd: 700,  hex: '#ffff00' },
  WHITE:  { vf: 3.3, if_nom: 0.020, if_max: 0.030, mcd: 5000, hex: '#ffffff' },
  ORANGE: { vf: 2.0, if_nom: 0.020, if_max: 0.030, mcd: 900,  hex: '#ff8800' },
  UV:     { vf: 3.4, if_nom: 0.020, if_max: 0.030, mcd: 200,  hex: '#8b00ff' },
  USER:   { vf: 0.0, if_nom: 0.000, if_max: 0.000, mcd: 1000, hex: '#cccccc' },
};

export const resistorOptions: ResistorOption[] = [
  47, 68, 100, 150, 220, 330, 470, 1000, 2200, 'USER',
];

export const microcontrollers: Record<
  MicrocontrollerProfile['key'],
  MicrocontrollerProfile
> = {
  PICO: {
    key: 'PICO',
    name: 'Raspberry Pi Pico',
    v_out: 3.3,
    max_ma: 16,
  },
  ESP32: {
    key: 'ESP32',
    name: 'ESP32',
    v_out: 3.3,
    max_ma: 12,
  },
  ARDUINO_R3: {
    key: 'ARDUINO_R3',
    name: 'Arduino Uno R3',
    v_out: 5.0,
    max_ma: 40,
  },
  GENERIC: {
    key: 'GENERIC',
    name: 'Generic MCU',
    v_out: 5.0,
    max_ma: 20,
  },
};

// Helper para mapear o MCU ativo na simulação para um perfil conhecido
export function getActiveMicrocontrollerProfile(): MicrocontrollerProfile {
  const { getAllMCUs, activeMCUId } = useSimulationStore.getState() as any;

  if (!getAllMCUs) {
    return microcontrollers.GENERIC;
  }

  const all = getAllMCUs() ?? [];
  if (!all.length) {
    return microcontrollers.GENERIC;
  }

  const active =
    (activeMCUId && all.find((m: any) => m.id === activeMCUId)) || all[0];

  const type = String(active?.type ?? '').toLowerCase();

  if (type.includes('pico')) return microcontrollers.PICO;
  if (type.includes('esp32')) return microcontrollers.ESP32;
  if (type.includes('arduino')) return microcontrollers.ARDUINO_R3;

  return microcontrollers.GENERIC;
}

// LEI DE OHM

// Passo 1: I_real = (V_placa - Vf_led) / R
export function calculateRealCurrent(
  vSource: number,   // V_placa
  vf: number,        // Vf_led
  resistance: number // R_interno (ohms)
): number {
  if (resistance <= 0) return 0;
  if (vSource <= vf) return 0;
  return (vSource - vf) / resistance; // Amperes
}

// Passo 2: Intensidade = mcd_base * (I_real / If_nom)
export function calculateLuminousIntensity(
  mcdBase: number,
  iReal: number,
  iNom: number
): number {
  if (iNom <= 0) return 0;
  return mcdBase * (iReal / iNom);
}

export type SafetyStatus = 'safe' | 'warning' | 'error' | 'burned';

// Regras de segurança:
// - I_real > 20mA → warning
// - I_real > limite do MCU → error
// - I_real > If_nom * 1.5 → burned
export function getSafetyStatus(
  iReal: number,        // A
  iNom: number,         // A
  mcuMaxMa: number      // mA
): SafetyStatus {
  if (iNom > 0 && iReal > iNom * 1.5) {
    return 'burned';
  }

  const mcuMaxA = mcuMaxMa / 1000;

  if (iReal > mcuMaxA) {
    return 'error';
  }

  if (iReal > 0.020) {
    return 'warning';
  }

  return 'safe';
}

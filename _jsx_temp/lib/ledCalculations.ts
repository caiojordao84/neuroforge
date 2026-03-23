import { useSimulationStore } from '@/stores/useSimulationStore';

export type LedColorProfile =
  | 'RED'
  | 'GREEN'
  | 'BLUE'
  | 'YELLOW'
  | 'WHITE'
  | 'ORANGE'
  | 'UV'
  | 'IR'      // NOVO
  | 'RGB'     // NOVO — LED RGB genérico (usado no RGBLEDPropertiesPanel)
  | 'COLD'    // NOVO — White frio
  | 'WARM'    // NOVO — White quente
  | 'USER';

export interface LedProfile {
  vf: number;               // Forward voltage (V)
  if_nom: number;           // Corrente nominal (A)
  if_max: number;           // Corrente máxima segura (A)
  mcd: number;              // Intensidade base (mcd) — 0 para IR (invisível)
  hex: string;              // Cor padrão para preview
}

export type ResistorOption = number | 'USER';

export interface MicrocontrollerProfile {
  key: 'PICO' | 'ESP32' | 'ARDUINO_R3' | 'GENERIC';
  name: string;
  v_out: number;   // Tensão típica de saída (V)
  max_ma: number;  // Corrente máxima por pino (mA)
}

export const ledProfiles: Record<LedColorProfile, LedProfile> = {
  // --- Originais ---
  RED:    { vf: 2.0, if_nom: 0.020, if_max: 0.030, mcd: 800,   hex: '#ff0000' },
  GREEN:  { vf: 3.2, if_nom: 0.020, if_max: 0.030, mcd: 2000,  hex: '#00ff00' },
  BLUE:   { vf: 3.2, if_nom: 0.020, if_max: 0.030, mcd: 1500,  hex: '#0066ff' },
  YELLOW: { vf: 2.1, if_nom: 0.020, if_max: 0.030, mcd: 700,   hex: '#ffff00' },
  WHITE:  { vf: 3.3, if_nom: 0.020, if_max: 0.030, mcd: 5000,  hex: '#ffffff' },
  ORANGE: { vf: 2.0, if_nom: 0.020, if_max: 0.030, mcd: 900,   hex: '#ff6600' },
  UV:     { vf: 3.4, if_nom: 0.020, if_max: 0.030, mcd: 200,   hex: '#aa00ff' },
  USER:   { vf: 0.0, if_nom: 0.000, if_max: 0.000, mcd: 1000,  hex: '#cccccc' },

  // --- Novos perfis (guiaPreFase2C_Rust.md) ---
  IR:     { vf: 1.4, if_nom: 0.020, if_max: 0.100, mcd: 0,     hex: '#660000' },
  // mcd: 0 → invisível; hex escuro para indicar que existe no preview
  // if_max: 100mA — IR LEDs toleram correntes maiores (verificar datasheet)

  RGB:    { vf: 3.2, if_nom: 0.020, if_max: 0.030, mcd: 1500,  hex: '#ff00ff' },
  // Perfil genérico para canal de LED RGB (Vf do canal azul/verde)
  // Usado pelo RGBLEDPropertiesPanel como default de Vf

  COLD:   { vf: 3.3, if_nom: 0.020, if_max: 0.030, mcd: 14000, hex: '#cce6ff' },
  // White frio (~6000–7000K)

  WARM:   { vf: 3.1, if_nom: 0.020, if_max: 0.030, mcd: 13000, hex: '#ffcc88' },
  // White quente (~2700–3000K)
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

export function getActiveMicrocontrollerProfile(): MicrocontrollerProfile {
  const { getAllMCUs, activeMCUId } = useSimulationStore.getState() as any;

  if (!getAllMCUs) return microcontrollers.GENERIC;

  const all = getAllMCUs() ?? [];
  if (!all.length) return microcontrollers.GENERIC;

  const active =
    (activeMCUId && all.find((m: any) => m.id === activeMCUId)) || all[0];

  const type = String(active?.type ?? '').toLowerCase();

  if (type.includes('pico'))    return microcontrollers.PICO;
  if (type.includes('esp32'))   return microcontrollers.ESP32;
  if (type.includes('arduino')) return microcontrollers.ARDUINO_R3;

  return microcontrollers.GENERIC;
}

// --- LEI DE OHM ---

// I_real = (V_placa - Vf_led) / R
export function calculateRealCurrent(
  vSource: number,    // V_placa
  vf: number,         // Vf_led
  resistance: number  // Ω
): number {
  if (resistance <= 0) return 0;
  if (vSource <= vf)   return 0;
  return (vSource - vf) / resistance; // Amperes
}

// Intensidade luminosa = mcd_base × (I_real / If_nom)
export function calculateLuminousIntensity(
  mcdBase: number,
  iReal: number,
  iNom: number
): number {
  if (iNom <= 0) return 0;
  return mcdBase * (iReal / iNom);
}

export type SafetyStatus = 'safe' | 'warning' | 'error' | 'burned';

// safe    → I < 20mA e I < mcu.max_ma
// warning → I ≥ 20mA
// error   → I > mcu.max_ma
// burned  → I > If_nom × 1.5
export function getSafetyStatus(
  iReal: number,    // A
  iNom: number,     // A
  mcuMaxMa: number  // mA
): SafetyStatus {
  if (iNom > 0 && iReal > iNom * 1.5) return 'burned';

  const mcuMaxA = mcuMaxMa / 1000;
  if (iReal > mcuMaxA) return 'error';
  if (iReal > 0.020)   return 'warning';

  return 'safe';
}

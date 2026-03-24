/**
 * ledCalculations.ts
 * Cálculos eléctricos de LEDs.
 * Sem dependências externas — toda a lógica é pure function.
 *
 * OPÇÃO B: getActiveMicrocontrollerProfile() recebe o estado do store
 * como parâmetro em vez de o importar directamente. Isso permite:
 *   - Usar em contextos sem React (testes unitários, engine Rust-side)
 *   - Referenciar directamente nas futuras structs Rust
 *   - Testar de forma determinística sem mock de stores
 *
 * Uso nos componentes:
 * */
import { useSimulationStore } from '@/stores/useSimulationStore';
const state = useSimulationStore.getState();
const mcu = getActiveMicrocontrollerProfile(state);

// ─────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────

export type LedColorProfile =
  | 'RED'
  | 'GREEN'
  | 'BLUE'
  | 'YELLOW'
  | 'WHITE'
  | 'ORANGE'
  | 'UV'
  | 'IR'
  | 'RGB'
  | 'COLD'
  | 'WARM'
  | 'USER';

export interface LedProfile {
  vf: number;  // Forward voltage (V)
  if_nom: number;  // Corrente nominal (A)
  if_max: number;  // Corrente máxima segura (A)
  mcd: number;  // Intensidade base (mcd) — 0 para IR (invisível)
  hex: string;  // Cor padrão para preview
}

export type ResistorOption = number | 'USER';

export interface MicrocontrollerProfile {
  key: 'PICO' | 'ESP32' | 'ARDUINO_R3' | 'GENERIC';
  name: string;
  v_out: number;  // Tensão típica de saída (V)
  max_ma: number;  // Corrente máxima por pino (mA)
}

/**
 * Contrato mínimo do estado do SimulationStore que esta lib precisa.
 * Evita importar o store directamente — Opção B.
 */
export interface SimulationStoreSnapshot {
  getAllMCUs?: () => Array<{ id: string; type: string }> | null;
  activeMCUId?: string | null;
}

// ─────────────────────────────────────────────────────────────────
// Dados estáticos
// ─────────────────────────────────────────────────────────────────

export const ledProfiles: Record<LedColorProfile, LedProfile> = {
  RED: { vf: 2.0, if_nom: 0.020, if_max: 0.030, mcd: 800, hex: '#ff0000' },
  GREEN: { vf: 3.2, if_nom: 0.020, if_max: 0.030, mcd: 2000, hex: '#00ff00' },
  BLUE: { vf: 3.2, if_nom: 0.020, if_max: 0.030, mcd: 1500, hex: '#0066ff' },
  YELLOW: { vf: 2.1, if_nom: 0.020, if_max: 0.030, mcd: 700, hex: '#ffff00' },
  WHITE: { vf: 3.3, if_nom: 0.020, if_max: 0.030, mcd: 5000, hex: '#ffffff' },
  ORANGE: { vf: 2.0, if_nom: 0.020, if_max: 0.030, mcd: 900, hex: '#ff6600' },
  UV: { vf: 3.4, if_nom: 0.020, if_max: 0.030, mcd: 200, hex: '#aa00ff' },
  IR: { vf: 1.4, if_nom: 0.020, if_max: 0.100, mcd: 0, hex: '#660000' },
  RGB: { vf: 3.2, if_nom: 0.020, if_max: 0.030, mcd: 1500, hex: '#ff00ff' },
  COLD: { vf: 3.3, if_nom: 0.020, if_max: 0.030, mcd: 14000, hex: '#cce6ff' },
  WARM: { vf: 3.1, if_nom: 0.020, if_max: 0.030, mcd: 13000, hex: '#ffcc88' },
  USER: { vf: 0.0, if_nom: 0.000, if_max: 0.000, mcd: 1000, hex: '#cccccc' },
};

export const resistorOptions: ResistorOption[] = [
  47, 68, 100, 150, 220, 330, 470, 1000, 2200, 'USER',
];

export const microcontrollers: Record<MicrocontrollerProfile['key'], MicrocontrollerProfile> = {
  PICO: { key: 'PICO', name: 'Raspberry Pi Pico', v_out: 3.3, max_ma: 16 },
  ESP32: { key: 'ESP32', name: 'ESP32', v_out: 3.3, max_ma: 12 },
  ARDUINO_R3: { key: 'ARDUINO_R3', name: 'Arduino Uno R3', v_out: 5.0, max_ma: 40 },
  GENERIC: { key: 'GENERIC', name: 'Generic MCU', v_out: 5.0, max_ma: 20 },
};

// ─────────────────────────────────────────────────────────────────
// getActiveMicrocontrollerProfile — Opção B (pure, sem imports)
// ─────────────────────────────────────────────────────────────────

/**
 * Resolve o perfil do MCU activo a partir de um snapshot do store.
 *
 * @param snapshot - Resultado de useSimulationStore.getState()
 *                   (ou objecto vazio {} para fallback GENERIC)
 *
 * @example
 * // Em componente React:
 * const mcu = getActiveMicrocontrollerProfile(useSimulationStore.getState());
 *
 * @example
 * // Em teste unitário:
 * const mcu = getActiveMicrocontrollerProfile({});
 * // → microcontrollers.GENERIC
 */
export function getActiveMicrocontrollerProfile(
  snapshot: SimulationStoreSnapshot = {}
): MicrocontrollerProfile {
  const { getAllMCUs, activeMCUId } = snapshot;

  if (!getAllMCUs) return microcontrollers.GENERIC;

  const all = getAllMCUs() ?? [];
  if (!all.length) return microcontrollers.GENERIC;

  const active =
    (activeMCUId && all.find((m) => m.id === activeMCUId)) || all[0];

  const type = String(active?.type ?? '').toLowerCase();

  if (type.includes('pico')) return microcontrollers.PICO;
  if (type.includes('esp32')) return microcontrollers.ESP32;
  if (type.includes('arduino')) return microcontrollers.ARDUINO_R3;

  return microcontrollers.GENERIC;
}

// ─────────────────────────────────────────────────────────────────
// Cálculos eléctricos — Lei de Ohm
// ─────────────────────────────────────────────────────────────────

/**
 * Corrente real pelo LED: I = (V_source − Vf) / R
 * @returns Corrente em Amperes (0 se R ≤ 0 ou V_source ≤ Vf)
 */
export function calculateRealCurrent(
  vSource: number,  // V da placa
  vf: number,  // Tensão forward do LED
  resistance: number   // Resistência série (Ω)
): number {
  if (resistance <= 0) return 0;
  if (vSource <= vf) return 0;
  return (vSource - vf) / resistance;
}

/**
 * Intensidade luminosa estimada: mcd = mcd_base × (I_real / If_nom)
 * @returns mcd (0 se iNom ≤ 0, ex: IR invisível)
 */
export function calculateLuminousIntensity(
  mcdBase: number,
  iReal: number,
  iNom: number
): number {
  if (iNom <= 0) return 0;
  return mcdBase * (iReal / iNom);
}

export type SafetyStatus = 'safe' | 'warning' | 'error' | 'burned';

/**
 * Estado de segurança do LED:
 * - burned  → I_real > If_nom × 1.5
 * - error   → I_real > limite do pino MCU
 * - warning → I_real > 20 mA
 * - safe    → tudo OK
 */
export function getSafetyStatus(
  iReal: number,  // A
  iNom: number,  // A
  mcuMaxMa: number   // mA
): SafetyStatus {
  if (iNom > 0 && iReal > iNom * 1.5) return 'burned';
  if (iReal > mcuMaxMa / 1000) return 'error';
  if (iReal > 0.020) return 'warning';
  return 'safe';
}

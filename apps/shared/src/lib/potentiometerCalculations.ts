/**
 * potentiometerCalculations.ts
 * Cálculos eléctricos do Potenciómetro.
 * Usado por: PotentiometerPropertiesPanel, PotentiometerNode
 */

export type TaperType = 'linear' | 'log' | 'antilog';

/**
 * Mapeia percentagem (0–100) para fracção real (0–1) conforme o taper.
 *
 * - linear:  resposta proporcional directa
 * - log:     lento no início, rápido no fim (audio taper / Type A)
 * - antilog: rápido no início, lento no fim (Type C)
 */
export function taperMap(percentage: number, taper: TaperType): number {
  const p = Math.max(0, Math.min(100, percentage)) / 100;
  switch (taper) {
    case 'log':
      return p === 0 ? 0 : Math.log10(1 + 9 * p) / Math.log10(10);
    case 'antilog':
      return 1 - Math.log10(1 + 9 * (1 - p)) / Math.log10(10);
    case 'linear':
    default:
      return p;
  }
}

/**
 * Resistência no wiper dado o total, posição e taper.
 * @returns Resistência em Ohm
 */
export function getWiperResistance(
  totalResistance: number,
  percentage: number,
  taper: TaperType
): number {
  return totalResistance * taperMap(percentage, taper);
}

/**
 * Tensão no wiper dado VCC, posição e taper.
 * @returns Tensão em Volts
 */
export function getWiperVoltage(
  percentage: number,
  taper: TaperType,
  vcc = 5.0
): number {
  return vcc * taperMap(percentage, taper);
}

/**
 * Valor ADC (0–1023) correspondente à posição e taper.
 * Usado pelo PotentiometerNode ao emitir analogChange.
 */
export function getAdcValue(
  percentage: number,
  taper: TaperType,
  resolution = 1023
): number {
  return Math.round(taperMap(percentage, taper) * resolution);
}

/**
 * Potência dissipada no wiper (P = V² / R_wiper).
 * Útil para verificar se excede o powerRating.
 * @returns Potência em Watts (0 se R_wiper = 0)
 */
export function getWiperPower(
  totalResistance: number,
  percentage: number,
  taper: TaperType,
  vcc = 5.0
): number {
  const r = getWiperResistance(totalResistance, percentage, taper);
  if (r === 0) return 0;
  const v = getWiperVoltage(percentage, taper, vcc);
  return (v * v) / r;
}

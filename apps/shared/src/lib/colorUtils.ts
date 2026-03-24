/**
 * colorUtils.ts
 * Utilitários de conversão de cor partilhados.
 * Usado por: RGBLEDNode (demo rainbow), RGBLEDPropertiesPanel
 */

/**
 * Converte HSL para RGB.
 * @param h - Hue: 0–360
 * @param s - Saturation: 0–1
 * @param l - Lightness: 0–1
 * @returns [r, g, b] cada um 0–255
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Converte RGB para string CSS hex.
 * @param r - 0–255
 * @param g - 0–255
 * @param b - 0–255
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converte hex CSS para RGB.
 * @param hex - ex: '#ff0000' ou 'ff0000'
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Connection Colors Store
// Loads and manages CSS variables from connection-colors.toon

import { writable, derived, get } from 'svelte/store';
import { readFile } from '@tauri-apps/plugin-fs';
import { resolveResource } from '@tauri-apps/api/path';

// Connection type keys from connection-colors.toon
export type ConnectionType = 
  | 'power' 
  | 'gnd' 
  | 'digital' 
  | 'analog' 
  | 'pwm' 
  | 'i2c' 
  | 'spi' 
  | 'uart' 
  | 'reserved' 
  | 'warning';

// Color mapping interface
export interface ConnectionColor {
  key: ConnectionType;
  hex: string;
  name: string;
  cssVar: string;
}

// Connection colors store - loaded from connection-colors.toon
export const connectionColors = writable<ConnectionColor[]>([
  { key: 'power', hex: '#DC2626', name: 'Power (VCC/5V/3V3)', cssVar: '--color-wire-power' },
  { key: 'gnd', hex: '#171717', name: 'Ground', cssVar: '--color-wire-gnd' },
  { key: 'digital', hex: '#2563EB', name: 'Digital I/O', cssVar: '--color-wire-digital' },
  { key: 'analog', hex: '#CA8A04', name: 'Analog I/O', cssVar: '--color-wire-analog' },
  { key: 'pwm', hex: '#EA580C', name: 'PWM Output', cssVar: '--color-wire-pwm' },
  { key: 'i2c', hex: '#16A34A', name: 'I2C (SDA/SCL)', cssVar: '--color-wire-i2c' },
  { key: 'spi', hex: '#7C3AED', name: 'SPI (MOSI/MISO/SCK)', cssVar: '--color-wire-spi' },
  { key: 'uart', hex: '#0891B2', name: 'UART (TX/RX)', cssVar: '--color-wire-uart' },
  { key: 'reserved', hex: '#6B7280', name: 'Reserved / N/A', cssVar: '--color-wire-reserved' },
  { key: 'warning', hex: '#F59E0B', name: 'Strapping / Caution', cssVar: '--color-wire-warning' },
]);

// Derived store for CSS variables string
export const connectionColorCssVars = derived(
  connectionColors,
  ($colors) => {
    return $colors
      .map(c => `${c.cssVar}: ${c.hex};`)
      .join('\n    ');
  }
);

// Helper to get color by type - returns hex color
export function getConnectionColor(type: ConnectionType): string {
  const colors = get(connectionColors);
  const found = colors.find(c => c.key === type);
  return found?.hex ?? '#6B7280'; // Default to reserved color
}

// Helper to get CSS variable name for type
export function getConnectionColorVar(type: ConnectionType): string {
  const colors = get(connectionColors);
  const found = colors.find(c => c.key === type);
  return found?.cssVar ?? '--color-wire-reserved';
}

// Initialize colors from connection-colors.toon (if available)
export async function loadConnectionColors() {
  try {
    // Try to load from docs/boards/connection-colors.toon
    // This uses Tauri's file system API
    const resourcePath = await resolveResource('shared/static/boards/connection-colors.toon');
    const content = await readFile(resourcePath);
    
    // Parse the TOON content - look for cssVariables section
    const text = new TextDecoder().decode(content);
    const cssVarsMatch = text.match(/cssVariables:\s*\|([\s\S]*?)(?=\n\S|\n\n|$)/);
    
    if (cssVarsMatch) {
      // Extract CSS custom properties
      const cssContent = cssVarsMatch[1];
      const varMatches = cssContent.match(/--color-wire-\w+:\s*#[0-9A-Fa-f]{6}/g);
      
      if (varMatches) {
        const parsedColors: ConnectionColor[] = [];
        
        // Get current defaults for name lookup
        const currentColors = get(connectionColors);
        
        for (const match of varMatches) {
          const [cssVar, hex] = match.split(/:\s*/);
          const key = cssVar.replace('--color-wire-', '') as ConnectionType;
          
          // Get human-readable name from the store default
          const defaultColor = currentColors.find(cc => cc.key === key);
          
          if (defaultColor) {
            parsedColors.push({
              key,
              hex,
              name: defaultColor.name,
              cssVar,
            });
          }
        }
        
        if (parsedColors.length > 0) {
          connectionColors.set(parsedColors);
        }
      }
    }
  } catch (e) {
    // File not available or parsing failed - use defaults
    console.warn('Could not load connection-colors.toon, using defaults:', e);
  }
}
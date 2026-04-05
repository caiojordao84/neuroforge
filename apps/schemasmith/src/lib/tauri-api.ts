// Tauri command wrappers for SchemaSmith backend validation
import { invoke } from '@tauri-apps/api/core';
import type { BoardValidationResult, ComponentValidationResult, ToonBoard, ToonComponent } from './types';

// Convert frontend ToonBoard to neuroforge-asl BoardProfile format
// This is a simple pass-through since we're using the same JSON format
function toBoardProfile(toon: ToonBoard): Record<string, unknown> {
  return {
    id: toon.board.id,
    name: toon.board.name,
    manufacturer: toon.board.manufacturer || null,
    mcu: toon.board.mcu || null,
    architecture: null,
    boardFamily: null,
    clockHz: toon.board.frequency || null,
    flashBytes: null,
    sramBytes: null,
    eepromBytes: null,
    voltageMv: null,
    pinMap: {
      logicalPins: toon.pins.map(pin => ({
        name: pin.label,
        physicalName: pin.physical_pin?.toString() || pin.label,
        defaultMode: null,
        restrictions: null,
        signalType: null
      })),
      physicalPins: toon.pins
        .filter(p => p.physical_pin !== null)
        .map(pin => ({
          name: pin.physical_pin?.toString() || pin.label,
          package: null,
          pinNumber: pin.physical_pin
        }))
    },
    pinCapabilities: {},
    bootWarnings: [],
    currentLimits: {},
    aslTarget: {
      platform: toon.board.languages[0] || 'arduino',
      version: null,
      includes: [],
      defines: {},
      pinAliases: {},
      agentSkill: null,
      confidenceFloor: null,
      extensions: {}
    },
    svgMap: toon.svg_map.length > 0 ? {
      svgContent: '',
      viewBox: null,
      pinAnchors: toon.svg_map.map(m => ({
        pin: m.pin_id,
        x: m.x,
        y: m.y,
        label: null
      }))
    } : null
  };
}

// Validate board TOON content
export async function validateBoard(toonContent: string): Promise<BoardValidationResult> {
  return await invoke<BoardValidationResult>('validate_board', { toonContent });
}

// Validate component TOON content
export async function validateComponent(toonContent: string): Promise<ComponentValidationResult> {
  return await invoke<ComponentValidationResult>('validate_component', { toonContent });
}

// Export board to TOON file (accepts ToonBoard, converts to format backend expects)
export async function exportBoardToon(board: ToonBoard, path: string): Promise<void> {
  const profile = toBoardProfile(board);
  return await invoke('export_board_toon', { board: profile, path });
}

// Export component to TOON file
export async function exportComponentToon(component: ToonComponent, path: string): Promise<void> {
  return await invoke('export_component_toon', { component, path });
}

// Load board from TOON file
export async function loadBoardFromFile(path: string): Promise<string> {
  return await invoke<string>('load_board_from_file', { path });
}

// Load component from TOON file
export async function loadComponentFromFile(path: string): Promise<string> {
  return await invoke<string>('load_component_from_file', { path });
}

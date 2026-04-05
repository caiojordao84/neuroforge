import type { ToonBoard, PinDefinition, BoardMeta, SvgPinMapping } from './types';

/**
 * Parse a TOON JSON string into a ToonBoard object
 */
export function parseToon(toonJson: string): ToonBoard {
  const parsed = JSON.parse(toonJson);
  
  if (!parsed.version || !parsed.board || !parsed.pins) {
    throw new Error('Invalid TOON format: missing required fields');
  }
  
  return parsed as ToonBoard;
}

/**
 * Serialize a ToonBoard object to a JSON string
 */
export function serializeToon(board: ToonBoard): string {
  return JSON.stringify(board, null, 2);
}

/**
 * Create an empty board with defaults
 */
export function createEmptyBoard(): ToonBoard {
  return {
    version: '1.0.0',
    board: {
      id: '',
      name: '',
      manufacturer: '',
      mcu: '',
      frequency: 133000000,
      languages: ['arduino-cpp'],
      asl_profiles: []
    },
    pins: [],
    svg_map: []
  };
}

/**
 * Add or update a pin in the board
 */
export function updatePin(board: ToonBoard, pin: PinDefinition): ToonBoard {
  const existingIndex = board.pins.findIndex(p => p.logical_pin === pin.logical_pin);
  
  let newPins: PinDefinition[];
  if (existingIndex >= 0) {
    newPins = [...board.pins];
    newPins[existingIndex] = pin;
  } else {
    newPins = [...board.pins, pin];
  }
  
  return {
    ...board,
    pins: newPins
  };
}

/**
 * Remove a pin from the board
 */
export function removePin(board: ToonBoard, logicalPin: number): ToonBoard {
  return {
    ...board,
    pins: board.pins.filter(p => p.logical_pin !== logicalPin)
  };
}

/**
 * Update board metadata
 */
export function updateBoardMeta(board: ToonBoard, meta: Partial<BoardMeta>): ToonBoard {
  return {
    ...board,
    board: {
      ...board.board,
      ...meta
    }
  };
}

/**
 * Update SVG pin mapping
 */
export function updateSvgMap(board: ToonBoard, mappings: SvgPinMapping[]): ToonBoard {
  return {
    ...board,
    svg_map: mappings
  };
}

/**
 * Create a default pin definition
 */
export function createDefaultPin(logicalPin: number, label: string = ''): PinDefinition {
  return {
    logical_pin: logicalPin,
    physical_pin: null,
    label: label || `GP${logicalPin}`,
    pwm: false,
    interrupt: false,
    adc: false,
    dac: false,
    touch: false,
    input_only: false,
    strapping: false,
    warning: null
  };
}

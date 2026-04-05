import { writable, derived, get } from 'svelte/store';
import type { ToonBoard, PinDefinition, BoardMeta, SvgPinMapping, ValidationIssue, SvgPinElement } from './types';
import { createEmptyBoard, serializeToon } from './toon-serializer';
import { extractPinsFromSvg, pinsToSvgMappings } from './svg-pin-extractor';
import { validateBoard, isBoardValid, countIssues } from './wire-validator';

// SVG content store
export const svgContent = writable<string>('');

// Extracted pins from SVG
export const extractedPins = writable<SvgPinElement[]>([]);

// Board state store
export const boardStore = writable<ToonBoard>(createEmptyBoard());

// Currently selected pin for editing
export const selectedPin = writable<number | null>(null);

// Validation issues
export const validationIssues = writable<ValidationIssue[]>([]);

// Derived store for TOON JSON
export const toonJson = derived(boardStore, ($board: ToonBoard) => serializeToon($board));

// Derived store for validation status
export const isValid = derived(validationIssues, ($issues: ValidationIssue[]) => isBoardValid($issues));

// Derived store for issue counts
export const issueCounts = derived(validationIssues, ($issues: ValidationIssue[]) => countIssues($issues));

// Actions
export function setSvgContent(content: string) {
  svgContent.set(content);
  const pins = extractPinsFromSvg(content);
  extractedPins.set(pins);
  
  // Auto-map pins to svg_map
  if (pins.length > 0) {
    const mappings = pinsToSvgMappings(pins);
    boardStore.update((board: ToonBoard) => ({
      ...board,
      svg_map: mappings
    }));
  }
}

export function updateBoardMeta(meta: Partial<BoardMeta>) {
  boardStore.update((board: ToonBoard) => ({
    ...board,
    board: {
      ...board.board,
      ...meta
    }
  }));
  runValidation();
}

export function addOrUpdatePin(pin: PinDefinition) {
  boardStore.update((board: ToonBoard) => {
    const existingIndex = board.pins.findIndex((p: PinDefinition) => p.logical_pin === pin.logical_pin);
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
  });
  runValidation();
}

export function removePin(logicalPin: number) {
  boardStore.update((board: ToonBoard) => ({
    ...board,
    pins: board.pins.filter((p: PinDefinition) => p.logical_pin !== logicalPin)
  }));
  
  const current = get(selectedPin);
  if (current === logicalPin) {
    selectedPin.set(null);
  }
  runValidation();
}

export function selectPin(logicalPin: number | null) {
  selectedPin.set(logicalPin);
}

export function loadBoard(board: ToonBoard) {
  boardStore.set(board);
  runValidation();
}

export function newBoard() {
  boardStore.set(createEmptyBoard());
  selectedPin.set(null);
  validationIssues.set([]);
  svgContent.set('');
  extractedPins.set([]);
}

export function runValidation() {
  const board = get(boardStore);
  const issues = validateBoard(
    board.pins,
    board.board.id,
    board.board.mcu,
    board.board.frequency,
    board.board.languages
  );
  validationIssues.set(issues);
}

// Initialize with validation
runValidation();

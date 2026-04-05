import { writable, derived, get } from 'svelte/store';
import type { PinDefinition, ToonComponent, SignalAnchor, ValidationIssue } from './types';
import { validateConnection } from './wire-validator';

// ============================================
// Connection Types
// ============================================

export interface Connection {
  id: string;
  componentId: string;
  componentName: string;
  signalId: string;
  signalName: string;
  signalType: string;
  boardPinId: string;
  boardPinLabel: string;
  validated: boolean;
  issues: ValidationIssue[];
}

export interface CanvasElement {
  id: string;
  type: 'board' | 'component';
  x: number;
  y: number;
  svgContent: string;
  name: string;
}

// Dragging state
export interface DragState {
  isDragging: boolean;
  elementId: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// Wire drawing state
export interface WireDrawState {
  isDrawing: boolean;
  sourceType: 'anchor' | 'pin' | null;
  sourceId: string | null;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

// ============================================
// Stores
// ============================================

// Canvas elements (boards and components on canvas)
export const canvasElements = writable<CanvasElement[]>([]);

// Connections between board pins and component anchors
export const connections = writable<Connection[]>([]);

// Currently selected element
export const selectedElement = writable<string | null>(null);

// Drag state for moving elements
export const dragState = writable<DragState>({
  isDragging: false,
  elementId: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
});

// Wire drawing state
export const wireDrawState = writable<WireDrawState>({
  isDrawing: false,
  sourceType: null,
  sourceId: null,
  sourceX: 0,
  sourceY: 0,
  targetX: 0,
  targetY: 0
});

// Highlighted pins/anchors during wire drawing
export const highlightedPins = writable<string[]>([]);

// Currently hovered pin/anchor
export const hoveredAnchor = writable<{ id: string; type: 'anchor' | 'pin'; x: number; y: number } | null>(null);

// Derived: connection count
export const connectionCount = derived(connections, ($connections) => $connections.length);

// Derived: validation summary
export const validationSummary = derived(connections, ($connections) => {
  const valid = $connections.filter(c => c.validated).length;
  const warnings = $connections.filter(c => c.issues.some(i => i.severity === 'warning')).length;
  const errors = $connections.filter(c => c.issues.some(i => i.severity === 'error')).length;
  return { valid, warnings, errors, total: $connections.length };
});

// ============================================
// Actions
// ============================================

// Add a board to the canvas
export function addBoard(boardId: string, name: string, svgContent: string, pins: PinDefinition[]) {
  const element: CanvasElement = {
    id: `board-${boardId}`,
    type: 'board',
    x: 100,
    y: 100,
    svgContent,
    name
  };
  
  canvasElements.update(elements => [...elements, element]);
  
  return element;
}

// Add a component to the canvas
export function addComponent(componentId: string, name: string, svgContent: string, signals: SignalAnchor[]) {
  const element: CanvasElement = {
    id: `component-${componentId}`,
    type: 'component',
    x: 400,
    y: 100,
    svgContent,
    name
  };
  
  canvasElements.update(elements => [...elements, element]);
  
  return element;
}

// Remove an element from canvas
export function removeElement(elementId: string) {
  // Remove all connections associated with this element
  connections.update(conns => 
    conns.filter(c => c.componentId !== elementId && c.boardPinId !== elementId)
  );
  
  canvasElements.update(elements => 
    elements.filter(e => e.id !== elementId)
  );
}

// Move element
export function moveElement(elementId: string, x: number, y: number) {
  canvasElements.update(elements => 
    elements.map(e => e.id === elementId ? { ...e, x, y } : e)
  );
}

// Start dragging element
export function startDrag(elementId: string, startX: number, startY: number) {
  const element = get(canvasElements).find(e => e.id === elementId);
  if (!element) return;
  
  dragState.set({
    isDragging: true,
    elementId,
    startX: startX - element.x,
    startY: startY - element.y,
    currentX: startX,
    currentY: startY
  });
}

// Update drag position
export function updateDrag(currentX: number, currentY: number) {
  dragState.update(state => {
    if (state.isDragging && state.elementId) {
      const newX = currentX - state.startX;
      const newY = currentY - state.startY;
      moveElement(state.elementId, newX, newY);
      return { ...state, currentX, currentY };
    }
    return state;
  });
}

// End drag
export function endDrag() {
  dragState.set({
    isDragging: false,
    elementId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  });
}

// Start drawing wire from an anchor/pin
export function startWireDraw(sourceType: 'anchor' | 'pin', sourceId: string, x: number, y: number) {
  wireDrawState.set({
    isDrawing: true,
    sourceType,
    sourceId,
    sourceX: x,
    sourceY: y,
    targetX: x,
    targetY: y
  });
}

// Update wire target position
export function updateWireDraw(x: number, y: number) {
  wireDrawState.update(state => ({ ...state, targetX: x, targetY: y }));
}

// End wire drawing - complete the connection
export function endWireDraw(targetType: 'anchor' | 'pin', targetId: string, targetX: number, targetY: number, boardPins: PinDefinition[], componentSignals: SignalAnchor[]) {
  const drawState = get(wireDrawState);
  
  if (!drawState.isDrawing || !drawState.sourceType || !drawState.sourceId) {
    cancelWireDraw();
    return;
  }
  
  // Determine which is anchor and which is pin
  let anchorId: string;
  let pinId: string;
  let signalType: string;
  let signalName: string;
  let boardPinLabel: string;
  
  if (drawState.sourceType === 'anchor' && targetType === 'pin') {
    anchorId = drawState.sourceId;
    pinId = targetId;
    
    // Get signal info
    const signal = componentSignals.find(s => s.id === anchorId);
    signalType = signal?.signalType || 'digital';
    signalName = signal?.name || anchorId;
    
    const pin = boardPins.find(p => p.label === pinId);
    boardPinLabel = pin?.label || pinId;
  } else if (drawState.sourceType === 'pin' && targetType === 'anchor') {
    pinId = drawState.sourceId;
    anchorId = targetId;
    
    const signal = componentSignals.find(s => s.id === anchorId);
    signalType = signal?.signalType || 'digital';
    signalName = signal?.name || anchorId;
    
    const pin = boardPins.find(p => p.label === pinId);
    boardPinLabel = pin?.label || pinId;
  } else {
    // Can't connect same types
    cancelWireDraw();
    return;
  }
  
  // Validate the connection
  const validation = validateConnection(signalType, pinId, boardPins);
  
  // Find the component this anchor belongs to
  const elements = get(canvasElements);
  const componentElement = elements.find(e => e.type === 'component');
  
  const connection: Connection = {
    id: `conn-${Date.now()}`,
    componentId: componentElement?.id || '',
    componentName: componentElement?.name || '',
    signalId: anchorId,
    signalName,
    signalType,
    boardPinId: pinId,
    boardPinLabel,
    validated: validation.valid,
    issues: validation.issues
  };
  
  connections.update(conns => [...conns, connection]);
  
  cancelWireDraw();
}

// Cancel wire drawing
export function cancelWireDraw() {
  wireDrawState.set({
    isDrawing: false,
    sourceType: null,
    sourceId: null,
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 0
  });
  highlightedPins.set([]);
}

// Remove a connection
export function removeConnection(connectionId: string) {
  connections.update(conns => conns.filter(c => c.id !== connectionId));
}

// Clear all connections
export function clearConnections() {
  connections.set([]);
}

// Clear canvas
export function clearCanvas() {
  canvasElements.set([]);
  connections.set([]);
  selectedElement.set(null);
}

// Get connections for export
export function getConnectionsForExport(): Connection[] {
  return get(connections);
}

// Select element
export function selectElement(elementId: string | null) {
  selectedElement.set(elementId);
}

// Highlight compatible pins during wire drawing
export function highlightCompatiblePins(signalType: string, boardPins: PinDefinition[]) {
  const compatible: string[] = [];
  
  for (const pin of boardPins) {
    const validation = validateConnection(signalType, pin.label, boardPins);
    if (validation.valid || validation.issues.every(i => i.severity !== 'error')) {
      compatible.push(pin.label);
    }
  }
  
  highlightedPins.set(compatible);
}
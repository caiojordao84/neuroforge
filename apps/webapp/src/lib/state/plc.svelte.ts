import { asl } from '@neuroforge/shared/state/asl.svelte.ts';

export type LadderElementType = 
  | 'contact_no'   // Normally Open contact
  | 'contact_nc'   // Normally Closed contact
  | 'coil_output'  // Output coil
  | 'coil_set'     // Set coil (latch)
  | 'coil_reset'   // Reset coil (unlatch)
  | 'ton'          // Timer On Delay
  | 'tof'          // Timer Off Delay
  | 'tp'           // Timer Pulse
  | 'ctu'          // Counter Up
  | 'ctd'          // Counter Down
  | 'connector';   // Connection wire

export interface LadderElement {
  id: string;
  type: LadderElementType;
  x: number;
  y: number;
  ref: string;        // e.g., "I0.0", "Q0.0"
  description: string;
  preset?: number;    // For timers/counters
  negated?: boolean; // For negated contacts/coils
  set?: boolean;      // For set coils
  reset?: boolean;   // For reset coils
}

export interface Rung {
  id: string;
  elements: LadderElement[];
}

class PlcState {
  elements = $state<LadderElement[]>([]);
  rungs = $state<Rung[]>([
    { id: 'rung-0', elements: [] }
  ]);
  
  selectedElement = $state<LadderElement | null>(null);
  hoveredElement = $state<LadderElement | null>(null);
  
  zoom = $state(1);
  pan = $state({ x: 0, y: 0 });
  
  aslCode = $state('');
  
  rungCount = $derived(this.rungs.length);
  
  private generateId(): string {
    return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  addElement(type: LadderElementType, x: number, y: number) {
    const element: LadderElement = {
      id: this.generateId(),
      type,
      x,
      y,
      ref: this.generateRef(type),
      description: '',
      preset: type.includes('ton') || type.includes('tof') || type.includes('tp') ? 1000 : 
              type.includes('ctu') || type.includes('ctd') ? 0 : undefined,
      negated: false,
      set: type === 'coil_set',
      reset: type === 'coil_reset'
    };
    
    this.elements = [...this.elements, element];
    this.assignToRung(element);
  }
  
  private generateRef(type: LadderElementType): string {
    const counts = this.elements.reduce((acc, el) => {
      acc[el.type] = (acc[el.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const prefix = type.startsWith('contact') ? 'I' :
                   type.startsWith('coil') ? 'Q' :
                   type.includes('timer') || type.includes('counter') ? 'T' : 'X';
    
    const count = counts[type] || 0;
    return `${prefix}${count}`;
  }
  
  private assignToRung(element: LadderElement) {
    // Simple logic: assign to first empty rung or create new rung
    const rowHeight = 80;
    const rungIndex = Math.floor(element.y / rowHeight);
    
    if (rungIndex >= this.rungs.length) {
      // Create new rungs up to this index
      while (this.rungs.length <= rungIndex) {
        this.rungs = [...this.rungs, { 
          id: `rung-${this.rungs.length}`, 
          elements: [] 
        }];
      }
    }
  }
  
  selectElement(element: LadderElement | null) {
    this.selectedElement = element;
    if (element) {
      this.hoveredElement = null;
    }
  }
  
  hoverElement(element: LadderElement | null) {
    if (!this.selectedElement) {
      this.hoveredElement = element;
    }
  }
  
  deleteSelected() {
    if (this.selectedElement) {
      this.elements = this.elements.filter(el => el.id !== this.selectedElement!.id);
      this.selectedElement = null;
    }
  }
  
  clearAll() {
    this.elements = [];
    this.rungs = [{ id: 'rung-0', elements: [] }];
    this.selectedElement = null;
    this.aslCode = '';
  }
  
  zoomIn() {
    this.zoom = Math.min(this.zoom + 0.1, 2);
  }
  
  zoomOut() {
    this.zoom = Math.max(this.zoom - 0.1, 0.5);
  }
  
  resetZoom() {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
  }
  
  /**
   * Generate ASL code from the ladder diagram
   */
  async generateAsl() {
    if (!asl.ready) {
      throw new Error('WASM not initialized');
    }
    
    // Convert ladder elements to LD text representation
    const ldText = this.ladderToText();
    
    try {
      // Use the WASM transpiler to convert LD to ASL
      this.aslCode = asl.crossTranspile(ldText, 'ld', 'asl');
    } catch (e) {
      // Fallback: generate ASL manually if WASM doesn't support ld
      this.aslCode = this.generateAslManual();
    }
  }
  
  private ladderToText(): string {
    // Generate LD (Ladder Diagram) text format for transpilation
    return this.elements.map(el => {
      switch (el.type) {
        case 'contact_no': return `|${el.ref}|`;
        case 'contact_nc': return `|/${el.ref}|`;
        case 'coil_output': return `(${el.ref})`;
        case 'coil_set': return `(S ${el.ref})`;
        case 'coil_reset': return `(R ${el.ref})`;
        case 'ton': return `[TON ${el.ref} PT:=${el.preset}]`;
        case 'tof': return `[TOF ${el.ref} PT:=${el.preset}]`;
        case 'tp': return `[TP ${el.ref} PT:=${el.preset}]`;
        case 'ctu': return `[CTU ${el.ref} PV:=${el.preset}]`;
        case 'ctd': return `[CTD ${el.ref} PV:=${el.preset}]`;
        case 'connector': return `----`;
        default: return '';
      }
    }).join('\n');
  }
  
  private generateAslManual(): string {
    // Manual ASL generation fallback
    const program = {
      program: {
        variables: this.elements
          .filter(el => el.ref)
          .map(el => ({
            name: el.ref,
            type: el.type.startsWith('coil') ? 'BOOL' :
                   el.type.includes('timer') ? 'TON' :
                   el.type.includes('counter') ? 'CTU' : 'BOOL',
            initialValue: false
          })),
        rungs: this.rungs.map((rung, idx) => ({
          id: rung.id,
          expression: rung.elements.map(el => this.elementToExpression(el)).join(' AND ')
        }))
      }
    };
    
    return JSON.stringify(program, null, 2);
  }
  
  private elementToExpression(el: LadderElement): string {
    switch (el.type) {
      case 'contact_no': return el.ref;
      case 'contact_nc': return `NOT ${el.ref}`;
      case 'coil_output': return `${el.ref} := `;
      case 'coil_set': return `SET(${el.ref})`;
      case 'coil_reset': return `RESET(${el.ref})`;
      default: return el.ref;
    }
  }
  
  /**
   * Import ASL code and generate ladder diagram
   */
  async importAsl(aslText: string) {
    if (!asl.ready) {
      throw new Error('WASM not initialized');
    }
    
    try {
      // Use WASM to convert ASL to LD
      const ldText = asl.crossTranspile(aslText, 'asl', 'ld');
      this.textToLadder(ldText);
    } catch {
      // Manual parsing fallback
      this.parseAslManual(aslText);
    }
  }
  
  private textToLadder(ldText: string) {
    // Parse LD text back to ladder elements
    const lines = ldText.split('\n').filter(Boolean);
    
    this.elements = [];
    let currentX = 100;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('|')) {
        // Contact
        const isNC = trimmed.startsWith('|/');
        const ref = trimmed.replace(/\|[\/]?/g, '').trim();
        
        this.elements.push({
          id: this.generateId(),
          type: isNC ? 'contact_nc' : 'contact_no',
          x: currentX,
          y: index * 80 + 60,
          ref,
          description: '',
          negated: isNC
        });
        currentX += 80;
      } else if (trimmed.startsWith('(')) {
        // Coil
        const isSet = trimmed.includes('(S');
        const isReset = trimmed.includes('(R');
        const ref = trimmed.replace(/[\(\)S R]/g, '').trim();
        
        this.elements.push({
          id: this.generateId(),
          type: isSet ? 'coil_set' : isReset ? 'coil_reset' : 'coil_output',
          x: currentX,
          y: index * 80 + 60,
          ref,
          description: '',
          set: isSet,
          reset: isReset
        });
      }
    });
  }
  
  private parseAslManual(aslText: string) {
    try {
      const parsed = JSON.parse(aslText);
      
      if (parsed.program?.variables) {
        // Clear and rebuild from ASL
        this.elements = [];
        
        parsed.program.variables.forEach((v: { name: string; type: string }, idx: number) => {
          const type = this.variableToElementType(v.type);
          if (type) {
            this.elements.push({
              id: this.generateId(),
              type,
              x: 100 + (idx * 80) % 400,
              y: Math.floor(idx / 5) * 80 + 60,
              ref: v.name,
              description: ''
            });
          }
        });
      }
    } catch {
      console.error('Failed to parse ASL');
    }
  }
  
  private variableToElementType(varType: string): LadderElementType | null {
    switch (varType.toUpperCase()) {
      case 'BOOL': return 'contact_no';
      case 'TON': return 'ton';
      case 'TOF': return 'tof';
      case 'TP': return 'tp';
      case 'CTU': return 'ctu';
      case 'CTD': return 'ctd';
      default: return 'contact_no';
    }
  }
}

export const plcState = new PlcState();

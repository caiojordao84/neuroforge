import { writable, derived, get } from 'svelte/store';
import type { ToonComponent, SignalAnchor, AslHint, Restrictions, ComponentMeta, ComponentTemplate, SvgPinElement } from './types';
import { COMPONENT_TEMPLATES } from './types';

// ============================================
// Component Store
// ============================================

// SVG content store
export const componentSvgContent = writable<string>('');

// Extracted signal anchors from SVG (circles with class="signal-anchor")
export const extractedAnchors = writable<SvgPinElement[]>([]);

// Component state store
export const componentStore = writable<ToonComponent>(createEmptyComponent());

// Currently selected signal for editing
export const selectedSignal = writable<string | null>(null);

// Derived store for component TOON JSON
export const componentToonJson = derived(componentStore, ($component: ToonComponent) => JSON.stringify($component, null, 2));

// Derived store for validation
export const isComponentValid = derived(componentStore, ($component: ToonComponent) => {
  return validateComponent($component);
});

// Create empty component
export function createEmptyComponent(): ToonComponent {
  return {
    version: '1.0.0',
    component: {
      id: '',
      name: '',
      category: 'sensor',
      subcategory: null,
      svgId: null,
      voltage: null
    },
    signals: [],
    asl_hints: [],
    restrictions: {
      requiresPwm: false,
      requiresAdc: false,
      maxCurrentMa: null,
      notes: null
    }
  };
}

// Validate component
export function validateComponent(component: ToonComponent): boolean {
  // Check required fields
  if (!component.component.id || !component.component.name) {
    return false;
  }
  
  // Must have at least one signal
  if (component.signals.length === 0) {
    return false;
  }
  
  // Validate signal IDs are unique
  const signalIds = component.signals.map(s => s.id);
  if (new Set(signalIds).size !== signalIds.length) {
    return false;
  }
  
  return true;
}

// Set SVG content and extract anchors
export function setComponentSvgContent(content: string) {
  componentSvgContent.set(content);
  const anchors = extractAnchorsFromSvg(content);
  extractedAnchors.set(anchors);
  
  // Auto-create signals from extracted anchors
  if (anchors.length > 0) {
    const newSignals: SignalAnchor[] = anchors.map((anchor, index) => ({
      id: anchor.id || `signal-${index}`,
      name: anchor.data.name || anchor.data.label || `Signal ${index + 1}`,
      direction: (anchor.data.direction as SignalAnchor['direction']) || 'input',
      signalType: (anchor.data.type as SignalAnchor['signalType']) || 'digital',
      x: anchor.cx,
      y: anchor.cy
    }));
    
    componentStore.update((c: ToonComponent) => ({
      ...c,
      signals: newSignals
    }));
  }
}

// Extract signal anchors from SVG (circles with class="signal-anchor")
export function extractAnchorsFromSvg(svgString: string): SvgPinElement[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  
  const anchors: SvgPinElement[] = [];
  
  // Find all circle elements with class "signal-anchor"
  const circles = doc.querySelectorAll('circle.signal-anchor');
  
  circles.forEach((circle) => {
    const id = circle.id || '';
    const cx = parseFloat(circle.getAttribute('cx') || '0');
    const cy = parseFloat(circle.getAttribute('cy') || '0');
    const r = parseFloat(circle.getAttribute('r') || '8');
    
    // Extract data attributes
    const data: Record<string, string> = {};
    for (const attr of Array.from(circle.attributes)) {
      if (attr.name.startsWith('data-')) {
        data[attr.name.slice(5)] = attr.value;
      }
    }
    
    anchors.push({
      id,
      cx,
      cy,
      r,
      data
    });
  });
  
  return anchors;
}

// Update component metadata
export function updateComponentMeta(meta: Partial<ComponentMeta>) {
  componentStore.update((c: ToonComponent) => ({
    ...c,
    component: {
      ...c.component,
      ...meta
    }
  }));
}

// Add or update a signal
export function addOrUpdateSignal(signal: SignalAnchor) {
  componentStore.update((c: ToonComponent) => {
    const existingIndex = c.signals.findIndex((s: SignalAnchor) => s.id === signal.id);
    let newSignals: SignalAnchor[];
    
    if (existingIndex >= 0) {
      newSignals = [...c.signals];
      newSignals[existingIndex] = signal;
    } else {
      newSignals = [...c.signals, signal];
    }
    
    return {
      ...c,
      signals: newSignals
    };
  });
}

// Remove a signal
export function removeSignal(signalId: string) {
  componentStore.update((c: ToonComponent) => ({
    ...c,
    signals: c.signals.filter((s: SignalAnchor) => s.id !== signalId)
  }));
  
  const current = get(selectedSignal);
  if (current === signalId) {
    selectedSignal.set(null);
  }
}

// Select a signal for editing
export function selectSignal(signalId: string | null) {
  selectedSignal.set(signalId);
}

// Add or update ASL hint
export function addOrUpdateAslHint(hint: AslHint) {
  componentStore.update((c: ToonComponent) => {
    const existingIndex = c.asl_hints.findIndex((h: AslHint) => h.semanticType === hint.semanticType);
    let newHints: AslHint[];
    
    if (existingIndex >= 0) {
      newHints = [...c.asl_hints];
      newHints[existingIndex] = hint;
    } else {
      newHints = [...c.asl_hints, hint];
    }
    
    return {
      ...c,
      asl_hints: newHints
    };
  });
}

// Remove ASL hint
export function removeAslHint(semanticType: string) {
  componentStore.update((c: ToonComponent) => ({
    ...c,
    asl_hints: c.asl_hints.filter((h: AslHint) => h.semanticType !== semanticType)
  }));
}

// Update restrictions
export function updateRestrictions(restrictions: Partial<Restrictions>) {
  componentStore.update((c: ToonComponent) => ({
    ...c,
    restrictions: {
      ...c.restrictions,
      ...restrictions
    }
  }));
}

// Load a template
export function loadTemplate(template: ComponentTemplate) {
  componentStore.set({
    version: '1.0.0',
    component: {
      id: template.id,
      name: template.name,
      category: template.category,
      subcategory: template.subcategory,
      svgId: null,
      voltage: 3.3
    },
    signals: template.defaultSignals,
    asl_hints: template.defaultAslHints,
    restrictions: template.defaultRestrictions
  });
  
  // Clear SVG content when loading template
  componentSvgContent.set('');
  extractedAnchors.set([]);
}

// Load component from TOON file
export function loadComponent(component: ToonComponent) {
  componentStore.set(component);
}

// Reset to new component
export function newComponent() {
  componentStore.set(createEmptyComponent());
  selectedSignal.set(null);
  componentSvgContent.set('');
  extractedAnchors.set([]);
}

// Get template by ID
export function getTemplateById(id: string): ComponentTemplate | undefined {
  return COMPONENT_TEMPLATES.find(t => t.id === id);
}

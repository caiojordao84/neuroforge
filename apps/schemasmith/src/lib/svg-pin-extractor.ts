import type { SvgPinElement, SvgPinMapping } from './types';

/**
 * Extract pin circles from an SVG string
 */
export function extractPinsFromSvg(svgString: string): SvgPinElement[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  
  const pins: SvgPinElement[] = [];
  
  // Find all circle elements with class "pin"
  const circles = doc.querySelectorAll('circle.pin');
  
  circles.forEach((circle) => {
    const id = circle.id || '';
    const cx = parseFloat(circle.getAttribute('cx') || '0');
    const cy = parseFloat(circle.getAttribute('cy') || '0');
    const r = parseFloat(circle.getAttribute('r') || '5');
    
    // Extract data attributes
    const data: Record<string, string> = {};
    for (const attr of Array.from(circle.attributes)) {
      if (attr.name.startsWith('data-')) {
        data[attr.name.slice(5)] = attr.value;
      }
    }
    
    // Extract classes
    const classes = (circle.getAttribute('class') || '').split(' ').filter(Boolean);
    
    pins.push({
      id,
      cx,
      cy,
      r,
      data: {
        ...data,
        classes: classes.join(' ')
      }
    });
  });
  
  return pins;
}

/**
 * Convert extracted pins to SvgPinMapping
 */
export function pinsToSvgMappings(pins: SvgPinElement[]): SvgPinMapping[] {
  return pins.map((pin, index) => {
    const pinNumber = pin.data.pin || pin.data.label?.replace(/\D/g, '') || String(index);
    return {
      pin_id: `pin-${pinNumber}`,
      svg_id: pin.id || `svg-pin-${index}`,
      x: pin.cx,
      y: pin.cy
    };
  });
}

/**
 * Get pin info from SVG by clicking coordinates
 */
export function findPinAtPosition(
  pins: SvgPinElement[],
  x: number,
  y: number,
  tolerance: number = 10
): SvgPinElement | null {
  for (const pin of pins) {
    const distance = Math.sqrt(
      Math.pow(x - pin.cx, 2) + Math.pow(y - pin.cy, 2)
    );
    if (distance <= pin.r + tolerance) {
      return pin;
    }
  }
  return null;
}

/**
 * Convert SVG viewBox to canvas coordinates
 */
export function svgToCanvasCoords(
  svgElement: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const pt = svgElement.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const svgP = pt.matrixTransform(svgElement.getScreenCTM()?.inverse());
  return { x: svgP.x, y: svgP.y };
}

/**
 * Load SVG from a URL
 */
export async function loadSvgFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load SVG: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Load SVG from a file path (for Tauri)
 */
export async function loadSvgFromFile(filePath: string): Promise<string> {
  // This will be used with Tauri fs plugin
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  return readTextFile(filePath);
}

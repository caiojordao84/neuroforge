<script lang="ts">
  import { plcState, type LadderElement } from '$lib/state/plc.svelte.ts';
  
  let canvasRef = $state<HTMLDivElement | null>(null);
  
  const ELEMENT_WIDTH = 60;
  const ELEMENT_HEIGHT = 40;
  const RAIL_WIDTH = 20;
  const RUNG_SPACING = 80;
  
  function getElementPosition(el: LadderElement): { x: number; y: number } {
    return { x: el.x, y: el.y };
  }
  
  function renderContact(element: LadderElement): string {
    const isNC = element.type === 'contact_nc';
    const isNegated = element.negated || isNC;
    
    if (isNC) {
      // NC contact: || with diagonal slash
      return `
        <line x1="0" y1="${ELEMENT_HEIGHT/2}" x2="${ELEMENT_WIDTH}" y2="${ELEMENT_HEIGHT/2}" stroke="currentColor" stroke-width="2"/>
        <line x1="${ELEMENT_WIDTH/2}" y1="0" x2="${ELEMENT_WIDTH/2}" y2="${ELEMENT_HEIGHT}" stroke="currentColor" stroke-width="2"/>
        <line x1="${ELEMENT_WIDTH/3}" y1="0" x2="${ELEMENT_WIDTH*2/3}" y2="${ELEMENT_HEIGHT}" stroke="currentColor" stroke-width="2" transform="rotate(180 ${ELEMENT_WIDTH/2} ${ELEMENT_HEIGHT/2})"/>
      `;
    } else {
      // NO contact: simple vertical lines
      return `
        <line x1="0" y1="${ELEMENT_HEIGHT/2}" x2="${ELEMENT_WIDTH/3}" y2="${ELEMENT_HEIGHT/2}" stroke="currentColor" stroke-width="2"/>
        <line x1="${ELEMENT_WIDTH*2/3}" y1="${ELEMENT_HEIGHT/2}" x2="${ELEMENT_WIDTH}" y2="${ELEMENT_HEIGHT/2}" stroke="currentColor" stroke-width="2"/>
        <line x1="${ELEMENT_WIDTH/3}" y1="0" x2="${ELEMENT_WIDTH/3}" y2="${ELEMENT_HEIGHT/2}" stroke="currentColor" stroke-width="2"/>
        <line x1="${ELEMENT_WIDTH/3}" y1="${ELEMENT_HEIGHT/2}" x2="${ELEMENT_WIDTH/3}" y2="${ELEMENT_HEIGHT}" stroke="currentColor" stroke-width="2"/>
        <line x1="${ELEMENT_WIDTH*2/3}" y1="0" x2="${ELEMENT_WIDTH*2/3}" y2="${ELEMENT_HEIGHT/2}" stroke="currentColor" stroke-width="2"/>
        <line x1="${ELEMENT_WIDTH*2/3}" y1="${ELEMENT_HEIGHT/2}" x2="${ELEMENT_WIDTH*2/3}" y2="${ELEMENT_HEIGHT}" stroke="currentColor" stroke-width="2"/>
      `;
    }
  }
  
  function renderCoil(element: LadderElement): string {
    const isSet = element.type === 'coil_set';
    const isReset = element.type === 'coil_reset';
    
    let label = '';
    if (isSet) label = 'S';
    else if (isReset) label = 'R';
    
    return `
      <rect x="0" y="0" width="${ELEMENT_WIDTH}" height="${ELEMENT_HEIGHT}" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <text x="${ELEMENT_WIDTH/2}" y="${ELEMENT_HEIGHT/2 + 4}" text-anchor="middle" fill="currentColor" font-size="10" font-family="monospace">${label}</text>
    `;
  }
  
  function renderTimer(element: LadderElement): string {
    const type = element.type.toUpperCase();
    return `
      <rect x="0" y="0" width="${ELEMENT_WIDTH + 20}" height="${ELEMENT_HEIGHT}" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <text x="${(ELEMENT_WIDTH + 20)/2}" y="${ELEMENT_HEIGHT/2 - 4}" text-anchor="middle" fill="currentColor" font-size="8" font-family="monospace">${type}</text>
      <text x="${(ELEMENT_WIDTH + 20)/2}" y="${ELEMENT_HEIGHT/2 + 8}" text-anchor="middle" fill="currentColor" font-size="6" font-family="monospace">${element.ref}</text>
    `;
  }
  
  function renderCounter(element: LadderElement): string {
    const type = element.type.toUpperCase();
    return `
      <rect x="0" y="0" width="${ELEMENT_WIDTH + 20}" height="${ELEMENT_HEIGHT}" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <text x="${(ELEMENT_WIDTH + 20)/2}" y="${ELEMENT_HEIGHT/2 - 4}" text-anchor="middle" fill="currentColor" font-size="8" font-family="monospace">${type}</text>
      <text x="${(ELEMENT_WIDTH + 20)/2}" y="${ELEMENT_HEIGHT/2 + 8}" text-anchor="middle" fill="currentColor" font-size="6" font-family="monospace">${element.ref}</text>
    `;
  }
  
  function renderConnector(): string {
    return `
      <circle cx="${ELEMENT_WIDTH/2}" cy="${ELEMENT_HEIGHT/2}" r="4" fill="currentColor"/>
    `;
  }
  
  function renderElement(element: LadderElement): string {
    switch (element.type) {
      case 'contact_no':
      case 'contact_nc':
        return renderContact(element);
      case 'coil_output':
      case 'coil_set':
      case 'coil_reset':
        return renderCoil(element);
      case 'ton':
      case 'tof':
      case 'tp':
        return renderTimer(element);
      case 'ctu':
      case 'ctd':
        return renderCounter(element);
      case 'connector':
        return renderConnector();
      default:
        return '';
    }
  }
  
  function handleElementClick(element: LadderElement, event: MouseEvent) {
    event.stopPropagation();
    plcState.selectElement(element);
  }
  
  function handleCanvasClick() {
    plcState.selectElement(null);
  }
  
  function handleElementMouseEnter(element: LadderElement) {
    plcState.hoverElement(element);
  }
  
  function handleElementMouseLeave() {
    plcState.hoverElement(null);
  }
</script>

<div 
  bind:this={canvasRef}
  class="absolute inset-0 overflow-auto"
  style="transform: scale({plcState.zoom}); transform-origin: top left;"
  onclick={handleCanvasClick}
  role="application"
  aria-label="Ladder Diagram Canvas"
>
  <svg 
    width="1200" 
    height={Math.max(plcState.rungs.length * RUNG_SPACING + 200, 600)} 
    class="w-full h-full"
  >
    <!-- Power Rails -->
    <g class="power-rails">
      <!-- Left Power Rail -->
      <line 
        x1="{40}" y1="0" 
        x2="{40}" y2="{plcState.rungs.length * RUNG_SPACING + 100}" 
        stroke="#FFD300" 
        stroke-width="4"
      />
      <!-- Right Power Rail -->
      <line 
        x1="{600}" y1="0" 
        x2="{600}" y2="{plcState.rungs.length * RUNG_SPACING + 100}" 
        stroke="#FFD300" 
        stroke-width="4"
      />
      
      <!-- Rung Connections -->
      {#each plcState.rungs as rung, idx}
        <line 
          x1="{40}" y1="{idx * RUNG_SPACING + 60}" 
          x2="{600}" y2="{idx * RUNG_SPACING + 60}" 
          stroke="#FFD300" 
          stroke-width="2"
          opacity="0.3"
        />
      {/each}
    </g>
    
    <!-- Elements -->
    {#each plcState.elements as element (element.id)}
      {@const pos = getElementPosition(element)}
      {@const isSelected = plcState.selectedElement?.id === element.id}
      {@const isHovered = plcState.hoveredElement?.id === element.id}
      
      <g 
        transform="translate({pos.x}, {pos.y})"
        class="cursor-pointer transition-all duration-150"
        class:text-primary-container={isSelected}
        class:text-white={!isSelected}
        class:opacity-50={isHovered && !isSelected}
        onclick={(e) => handleElementClick(element, e)}
        onmouseenter={() => handleElementMouseEnter(element)}
        onmouseleave={handleElementMouseLeave}
        role="button"
        tabindex="0"
        aria-label="{element.type} - {element.ref}"
      >
        <!-- Selection highlight -->
        {#if isSelected}
          <rect 
            x="-4" y="-4" 
            width="{ELEMENT_WIDTH + (element.type.includes('timer') || element.type.includes('counter') ? 24 : 0) + 8}" 
            height="{ELEMENT_HEIGHT + 8}" 
            fill="none" 
            stroke="#FFD300" 
            stroke-width="2" 
            stroke-dasharray="4 2"
            rx="4"
          />
        {/if}
        
        <!-- Element SVG -->
        {@html renderElement(element)}
        
        <!-- Reference Label -->
        <text 
          x="{ELEMENT_WIDTH/2}" 
          y="{ELEMENT_HEIGHT + 12}" 
          text-anchor="middle" 
          fill="white" 
          font-size="8" 
          font-family="monospace"
          opacity="0.7"
        >
          {element.ref}
        </text>
      </g>
    {/each}
    
    <!-- Instructions overlay when empty -->
    {#if plcState.elements.length === 0}
      <text 
        x="320" 
        y="200" 
        text-anchor="middle" 
        fill="white" 
        font-size="14" 
        font-family="monospace"
        opacity="0.4"
      >
        Drag elements from the toolbox to create your ladder diagram
      </text>
    {/if}
  </svg>
</div>

<script lang="ts">
  import { 
    canvasElements, 
    connections,
    wireDrawState,
    dragState,
    highlightedPins,
    hoveredAnchor,
    selectedElement,
    startDrag,
    updateDrag,
    endDrag,
    startWireDraw,
    updateWireDraw,
    endWireDraw,
    cancelWireDraw,
    selectElement,
    removeElement,
    highlightCompatiblePins,
    removeConnection,
    type Connection,
    type CanvasElement
  } from '$lib/connectionStore.svelte';
  import { boardStore } from '$lib/boardStore.svelte';
  import { componentStore } from '$lib/componentStore.svelte';
  import WireOverlay from '$lib/components/WireOverlay.svelte';
  
  let canvasRef: HTMLDivElement;
  let svgRef: SVGSVGElement;
  
  // Handle mouse down on canvas element (start drag or start wire)
  function handleElementMouseDown(e: MouseEvent, element: CanvasElement) {
    e.stopPropagation();
    
    const target = e.target as HTMLElement;
    const isAnchor = target.classList.contains('signal-anchor');
    const isPin = target.classList.contains('board-pin');
    
    if (isAnchor || isPin) {
      // Start wire drawing
      const rect = target.getBoundingClientRect();
      const canvasRect = canvasRef.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - canvasRect.left;
      const y = rect.top + rect.height / 2 - canvasRect.top;
      
      const anchorId = target.getAttribute('data-id') || '';
      const sourceType = isAnchor ? 'anchor' : 'pin';
      
      startWireDraw(sourceType, anchorId, x, y);
      
      // Highlight compatible pins based on signal type
      if (isAnchor) {
        // Get signal type from component signals
        const signal = $componentStore.signals.find(s => s.id === anchorId);
        if (signal && $boardStore.pins.length > 0) {
          highlightCompatiblePins(signal.signalType, $boardStore.pins);
        }
      }
    } else if (element.type === 'board' || element.type === 'component') {
      // Start dragging element
      selectElement(element.id);
      startDrag(element.id, e.clientX, e.clientY);
    }
  }
  
  // Handle mouse move on canvas
  function handleCanvasMouseMove(e: MouseEvent) {
    const canvasRect = canvasRef.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    
    if ($wireDrawState.isDrawing) {
      updateWireDraw(x, y);
    } else if ($dragState.isDragging) {
      updateDrag(e.clientX, e.clientY);
    }
  }
  
  // Handle mouse up on canvas
  function handleCanvasMouseUp(e: MouseEvent) {
    if ($wireDrawState.isDrawing) {
      // Check if we're over a pin
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target) {
        const isPin = target.classList.contains('board-pin');
        const isAnchor = target.classList.contains('signal-anchor');
        
        if (isPin || isAnchor) {
          const pinId = target.getAttribute('data-id') || '';
          const canvasRect = canvasRef.getBoundingClientRect();
          const x = e.clientX - canvasRect.left;
          const y = e.clientY - canvasRect.top;
          
          endWireDraw(
            isPin ? 'pin' : 'anchor',
            pinId,
            x, y,
            $boardStore.pins,
            $componentStore.signals
          );
        } else {
          cancelWireDraw();
        }
      } else {
        cancelWireDraw();
      }
    }
    
    endDrag();
  }
  
  // Handle right click to cancel wire drawing
  function handleContextMenu(e: MouseEvent) {
    if ($wireDrawState.isDrawing) {
      e.preventDefault();
      cancelWireDraw();
    }
  }
  
  // Handle click on canvas background to deselect
  function handleCanvasClick(e: MouseEvent) {
    if (e.target === canvasRef || e.target === svgRef) {
      selectElement(null);
    }
  }
  
  // Handle keydown for delete
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && $wireDrawState.isDrawing) {
      cancelWireDraw();
    }
    if (e.key === 'Delete' && $selectedElement) {
      removeElement($selectedElement);
    }
  }
  
  // Get wire color based on connection validation
  function getWireColor(connection: Connection): string {
    if (!connection.validated) return 'var(--text-secondary)';
    const hasErrors = connection.issues.some(i => i.severity === 'error');
    const hasWarnings = connection.issues.some(i => i.severity === 'warning');
    if (hasErrors) return 'var(--error)';
    if (hasWarnings) return 'var(--warning)';
    return 'var(--success)';
  }
  
  // Get wire color for drawing state
  function getDrawingWireColor(): string {
    return 'var(--accent-primary)';
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div 
  class="canvas"
  bind:this={canvasRef}
  on:mousemove={handleCanvasMouseMove}
  on:mouseup={handleCanvasMouseUp}
  on:contextmenu={handleContextMenu}
  on:click={handleCanvasClick}
  role="application"
  aria-label="Connection canvas"
  tabindex="0"
>
  <!-- Grid background -->
  <svg class="grid-svg" width="100%" height="100%">
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border-color)" stroke-width="0.5" opacity="0.3"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
  
  <!-- Wire overlay -->
  <WireOverlay />
  
  <!-- Canvas elements -->
  {#each $canvasElements as element (element.id)}
    <div 
      class="canvas-element {element.type}"
      class:selected={$selectedElement === element.id}
      style="left: {element.x}px; top: {element.y}px;"
      on:mousedown={(e) => handleElementMouseDown(e, element)}
      role="button"
      tabindex="0"
    >
      {#if element.type === 'board' && $boardStore.svg_map.length > 0}
        <!-- Render board SVG with pins -->
        <div class="board-content">
          <div class="board-name">{element.name || $boardStore.board.name || 'Board'}</div>
          <svg viewBox="0 0 400 300" class="board-svg">
            <!-- Board outline -->
            <rect x="10" y="10" width="380" height="280" rx="8" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="2"/>
            <!-- Pins -->
            {#each $boardStore.pins as pin}
              <circle 
                class="board-pin" 
                class:highlighted={$highlightedPins.includes(pin.label)}
                cx={getPinX(pin.logical_pin, $boardStore.pins.length)} 
                cy={getPinY(pin.logical_pin, $boardStore.pins.length)} 
                r="8"
                data-id={pin.label}
                data-type="pin"
              >
                <title>{pin.label} {pin.pwm ? '(PWM)' : ''} {pin.adc ? '(ADC)' : ''}</title>
              </circle>
              <text 
                x={getPinX(pin.logical_pin, $boardStore.pins.length) + 15} 
                y={getPinY(pin.logical_pin, $boardStore.pins.length) + 4}
                class="pin-label"
              >
                {pin.label}
              </text>
            {/each}
          </svg>
        </div>
      {:else if element.type === 'component' && $componentStore.signals.length > 0}
        <!-- Render component with signal anchors -->
        <div class="component-content">
          <div class="component-name">{element.name || $componentStore.component.name || 'Component'}</div>
          <svg viewBox="0 0 200 300" class="component-svg">
            <!-- Component outline -->
            <rect x="10" y="10" width="180" height="280" rx="8" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="2"/>
            <!-- Signal anchors -->
            {#each $componentStore.signals as signal, i}
              <circle 
                class="signal-anchor"
                class:highlighted={$wireDrawState.isDrawing && $highlightedPins.length > 0}
                cx="30" 
                cy={50 + i * 40} 
                r="8"
                data-id={signal.id}
                data-type="anchor"
              >
                <title>{signal.name} ({signal.signalType})</title>
              </circle>
              <text x="50" y={54 + i * 40} class="signal-label">
                {signal.name}
              </text>
              <text x="160" y={54 + i * 40} class="signal-type-label">
                {signal.signalType}
              </text>
            {/each}
          </svg>
        </div>
      {:else}
        <!-- Empty placeholder -->
        <div class="empty-element">
          <span class="empty-icon">{element.type === 'board' ? '📋' : '🔌'}</span>
          <span class="empty-label">{element.name || 'Drop here'}</span>
        </div>
      {/if}
    </div>
  {/each}
  
  <!-- Empty state -->
  {#if $canvasElements.length === 0}
    <div class="empty-canvas">
      <div class="empty-icon-large">🔗</div>
      <h3>Connection Canvas</h3>
      <p>Load a board and component to start wiring</p>
    </div>
  {/if}
</div>

<script context="module" lang="ts">
  // Helper functions for pin positioning
  function getPinX(pinNum: number, totalPins: number): number {
    const cols = Math.ceil(Math.sqrt(totalPins));
    const col = (pinNum - 1) % cols;
    return 40 + col * 60;
  }
  
  function getPinY(pinNum: number, totalPins: number): number {
    const cols = Math.ceil(Math.sqrt(totalPins));
    const row = Math.floor((pinNum - 1) / cols);
    return 60 + row * 40;
  }
</script>

<style>
  .canvas {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 600px;
    overflow: hidden;
    cursor: crosshair;
  }
  
  .grid-svg {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }
  
  .canvas-element {
    position: absolute;
    cursor: move;
    user-select: none;
    transition: box-shadow 0.2s ease;
  }
  
  .canvas-element:hover {
    z-index: 10;
  }
  
  .canvas-element.selected {
    z-index: 20;
  }
  
  .canvas-element.board {
    width: 400px;
    height: 300px;
  }
  
  .canvas-element.component {
    width: 200px;
    height: 300px;
  }
  
  .board-content,
  .component-content {
    width: 100%;
    height: 100%;
  }
  
  .board-name,
  .component-name {
    position: absolute;
    top: -24px;
    left: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
  }
  
  .board-svg,
  .component-svg {
    width: 100%;
    height: 100%;
  }
  
  .board-pin,
  .signal-anchor {
    fill: var(--bg-tertiary);
    stroke: var(--accent-primary);
    stroke-width: 2;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .board-pin:hover,
  .signal-anchor:hover {
    fill: var(--accent-primary);
    transform: scale(1.2);
  }
  
  .board-pin.highlighted,
  .signal-anchor.highlighted {
    fill: var(--success);
    stroke: var(--success);
    animation: pulse 1s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .pin-label,
  .signal-label {
    font-size: 10px;
    fill: var(--text-secondary);
    font-family: monospace;
  }
  
  .signal-type-label {
    font-size: 9px;
    fill: var(--text-secondary);
    font-family: monospace;
    text-anchor: end;
  }
  
  .empty-element {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--bg-tertiary);
    border: 2px dashed var(--border-color);
    border-radius: 8px;
  }
  
  .empty-icon {
    font-size: 24px;
    margin-bottom: 8px;
  }
  
  .empty-label {
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .empty-canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text-secondary);
  }
  
  .empty-icon-large {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  .empty-canvas h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    color: var(--text-primary);
  }
  
  .empty-canvas p {
    margin: 0;
    font-size: 14px;
  }
</style>
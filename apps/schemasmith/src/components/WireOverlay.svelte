<script lang="ts">
  import { 
    wireDrawState, 
    connections,
    canvasElements,
    type Connection 
  } from '$lib/connectionStore.svelte';
  
  // Get wire color based on validation state
  function getWireColor(connection: Connection): string {
    if (!connection.validated) return 'var(--text-secondary)';
    const hasErrors = connection.issues.some(i => i.severity === 'error');
    const hasWarnings = connection.issues.some(i => i.severity === 'warning');
    if (hasErrors) return 'var(--error)';
    if (hasWarnings) return 'var(--warning)';
    return 'var(--success)';
  }
  
  // Get wire opacity
  function getWireOpacity(connection: Connection): number {
    if (!connection.validated) return 0.5;
    const hasErrors = connection.issues.some(i => i.severity === 'error');
    return hasErrors ? 0.6 : 1;
  }
  
  // Calculate wire path with curve
  function getWirePath(x1: number, y1: number, x2: number, y2: number): string {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.3, 100);
    
    // Create a bezier curve
    return `M ${x1} ${y1} Q ${midX} ${midY - curvature} ${x2} ${y2}`;
  }
  
  // Get anchor positions from canvas elements
  // This would need to be calculated based on element positions
  function getAnchorPosition(elementId: string, signalId: string, isSource: boolean): { x: number; y: number } | null {
    const element = $canvasElements.find(e => e.id === elementId);
    if (!element) return null;
    
    // Find signal index
    const signalIndex = element.type === 'component' ? 
      parseInt(signalId.replace('signal-', '')) || 0 : 0;
    
    // Calculate position based on element type and position
    if (element.type === 'component') {
      const x = element.x + 30; // anchor position
      const y = element.y + 50 + signalIndex * 40;
      return { x, y };
    } else {
      // For board pins, we'd need to map pin labels to positions
      // For now, return center of board
      const x = element.x + 200;
      const y = element.y + 150;
      return { x, y };
    }
  }
  
  // Simplified wire routing - connect element centers
  function getConnectionEndpoints(connection: Connection): { x1: number; y1: number; x2: number; y2: number } | null {
    const componentEl = $canvasElements.find(e => e.type === 'component');
    const boardEl = $canvasElements.find(e => e.type === 'board');
    
    if (!componentEl || !boardEl) return null;
    
    // Component anchor position (simplified)
    const signalIndex = connection.signalId.includes('signal-') ? 
      parseInt(connection.signalId.replace('signal-', '')) - 1 : 0;
    const x1 = componentEl.x + 30;
    const y1 = componentEl.y + 50 + Math.max(signalIndex, 0) * 40;
    
    // Board pin position (simplified - need actual mapping)
    const x2 = boardEl.x + 200;
    const y2 = boardEl.y + 100;
    
    return { x1, y1, x2, y2 };
  }
</script>

<svg class="wire-overlay">
  <!-- Existing connections -->
  {#each $connections as connection (connection.id)}
    {@const endpoints = getConnectionEndpoints(connection)}
    {#if endpoints}
      <g class="wire-group">
        <path
          class="wire"
          d={getWirePath(endpoints.x1, endpoints.y1, endpoints.x2, endpoints.y2)}
          stroke={getWireColor(connection)}
          stroke-width="3"
          fill="none"
          opacity={getWireOpacity(connection)}
        />
        <!-- Connection point markers -->
        <circle cx={endpoints.x1} cy={endpoints.y1} r="4" fill={getWireColor(connection)} />
        <circle cx={endpoints.x2} cy={endpoints.y2} r="4" fill={getWireColor(connection)} />
      </g>
    {/if}
  {/each}
  
  <!-- Wire being drawn -->
  {#if $wireDrawState.isDrawing}
    <g class="wire-drawing">
      <path
        class="wire-drawing-path"
        d={getWirePath($wireDrawState.sourceX, $wireDrawState.sourceY, $wireDrawState.targetX, $wireDrawState.targetY)}
        stroke="var(--accent-primary)"
        stroke-width="3"
        fill="none"
        stroke-dasharray="8,4"
      />
      <circle 
        cx={$wireDrawState.sourceX} 
        cy={$wireDrawState.sourceY} 
        r="6" 
        fill="var(--accent-primary)"
        class="source-point"
      />
      <circle 
        cx={$wireDrawState.targetX} 
        cy={$wireDrawState.targetY} 
        r="4" 
        fill="var(--accent-primary)"
        class="target-point"
      />
    </g>
  {/if}
</svg>

<style>
  .wire-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
  }
  
  .wire {
    transition: stroke 0.2s ease, opacity 0.2s ease;
  }
  
  .wire-drawing-path {
    animation: dash 0.5s linear infinite;
  }
  
  @keyframes dash {
    to {
      stroke-dashoffset: -12;
    }
  }
  
  .source-point {
    animation: pulse-source 1s ease-in-out infinite;
  }
  
  .target-point {
    animation: pulse-target 0.8s ease-in-out infinite;
  }
  
  @keyframes pulse-source {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }
  
  @keyframes pulse-target {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
  }
</style>
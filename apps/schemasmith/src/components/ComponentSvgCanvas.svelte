<script lang="ts">
  import { 
    componentSvgContent, 
    extractedAnchors, 
    selectedSignal,
    selectSignal,
    componentStore 
  } from '$lib/componentStore.svelte';
  
  let svgContainer: HTMLDivElement;
  let hoveredAnchor: string | null = null;
  
  // Handle click on SVG anchors
  function handleAnchorClick(anchorId: string) {
    const signal = $componentStore.signals.find(s => s.id === anchorId);
    if (signal) {
      selectSignal(anchorId);
    }
  }
  
  // Handle click on SVG background (clear selection)
  function handleSvgClick(e: MouseEvent) {
    if (e.target === svgContainer || (e.target as Element).tagName === 'svg') {
      selectSignal(null);
    }
  }
  
  // Get anchor color based on signal type
  function getAnchorColor(signalType: string): string {
    const colors: Record<string, string> = {
      'power': '#ff6b6b',
      'gnd': '#4ecdc4',
      'digital': '#95e1d3',
      'pwm': '#ffd93d',
      'analog': '#a8e6cf',
      'i2c': '#dcedc1',
      'spi': '#ffeaa7',
      'uart': '#fab1a0'
    };
    return colors[signalType] || '#eaeaea';
  }
  
  // Get anchor color for extracted but unassigned anchors
  function getExtractedAnchorColor(data: Record<string, string>): string {
    const type = data.type || data.signalType || 'digital';
    return getAnchorColor(type);
  }
</script>

<div 
  class="svg-canvas" 
  bind:this={svgContainer}
  on:click={handleSvgClick}
>
  {#if $componentSvgContent}
    <div class="svg-wrapper">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html $componentSvgContent}
      
      <!-- Render anchors over SVG -->
      <svg class="anchors-overlay" viewBox="0 0 800 600">
        <!-- Anchors from extracted SVG elements -->
        {#each $extractedAnchors as anchor}
          <circle
            cx={anchor.cx}
            cy={anchor.cy}
            r={anchor.r + 2}
            class="anchor"
            class:selected={$selectedSignal === anchor.id}
            class:hovered={hoveredAnchor === anchor.id}
            style="fill: {getExtractedAnchorColor(anchor.data)}"
            on:click|stopPropagation={() => handleAnchorClick(anchor.id)}
            on:mouseenter={() => hoveredAnchor = anchor.id}
            on:mouseleave={() => hoveredAnchor = null}
          />
        {/each}
        
        <!-- Anchors from signals (in case SVG was cleared) -->
        {#each $componentStore.signals as signal}
          {#if !$extractedAnchors.find(a => a.id === signal.id)}
            <circle
              cx={signal.x}
              cy={signal.y}
              r="10"
              class="anchor"
              class:selected={$selectedSignal === signal.id}
              class:hovered={hoveredAnchor === signal.id}
              style="fill: {getAnchorColor(signal.signalType)}"
              on:click|stopPropagation={() => handleAnchorClick(signal.id)}
              on:mouseenter={() => hoveredAnchor = signal.id}
              on:mouseleave={() => hoveredAnchor = null}
            />
          {/if}
        {/each}
      </svg>
    </div>
  {:else}
    <div class="empty-canvas">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <circle cx="15.5" cy="8.5" r="1.5"/>
          <circle cx="8.5" cy="15.5" r="1.5"/>
          <circle cx="15.5" cy="15.5" r="1.5"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </div>
      <p>Load a component SVG or select a template</p>
      <p class="hint">SVG should contain circles with class="signal-anchor"</p>
    </div>
  {/if}
</div>

<style>
  .svg-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .svg-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .svg-wrapper :global(svg) {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }
  
  .anchors-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  
  .anchors-overlay circle.anchor {
    cursor: pointer;
    pointer-events: all;
    stroke: var(--bg-primary);
    stroke-width: 2;
    opacity: 0.8;
    transition: all 0.15s ease;
  }
  
  .anchors-overlay circle.anchor:hovered {
    opacity: 1;
    r: 12;
  }
  
  .anchors-overlay circle.anchor.selected {
    opacity: 1;
    stroke: white;
    stroke-width: 3;
    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
  }
  
  .empty-canvas {
    text-align: center;
    color: var(--text-secondary);
    padding: 40px;
  }
  
  .empty-icon {
    color: var(--accent-primary);
    opacity: 0.5;
    margin-bottom: 16px;
  }
  
  .empty-canvas p {
    margin: 0 0 8px;
    font-size: 14px;
  }
  
  .empty-canvas .hint {
    font-size: 12px;
    color: var(--text-secondary);
    opacity: 0.7;
  }
</style>

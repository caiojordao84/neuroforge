<script lang="ts">
  import { svgContent, extractedPins, selectPin, boardStore } from '$lib/boardStore.svelte';
  import type { SvgPinElement } from '$lib/types';
  
  let svgContainer: HTMLDivElement;
  let svgElement: SVGSVGElement | null = null;
  
  // Handle SVG click to select pins
  function handleSvgClick(event: MouseEvent) {
    if (!svgElement) return;
    
    const rect = svgElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Find the closest pin
    const pins = $extractedPins;
    let closest: SvgPinElement | null = null;
    let minDist = Infinity;
    
    for (const pin of pins) {
      // Scale factor from viewBox
      const viewBox = svgElement.viewBox.baseVal;
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;
      
      const pinX = pin.cx * scaleX;
      const pinY = pin.cy * scaleY;
      const dist = Math.sqrt(Math.pow(x - pinX, 2) + Math.pow(y - pinY, 2));
      
      if (dist < minDist && dist < 30) {
        minDist = dist;
        closest = pin;
      }
    }
    
    if (closest) {
      const pinNum = parseInt(closest.data.pin || '0', 10);
      if (!isNaN(pinNum)) {
        selectPin(pinNum);
      }
    }
  }
  
  function handleSvgLoad(event: Event) {
    const target = event.target as HTMLDivElement;
    svgElement = target.querySelector('svg');
  }
  
  // Get pin color based on its properties
  function getPinColor(pin: SvgPinElement): string {
    if (pin.data.classes?.includes('pin-analog')) return '#3b82f6';
    if (pin.data.classes?.includes('pin-power')) return '#ef4444';
    if (pin.data.classes?.includes('pin-gnd')) return '#6b7280';
    if (pin.data.classes?.includes('pin-reserved')) return '#f59e0b';
    if (pin.data.warning) return '#f59e0b';
    return '#22c55e';
  }
</script>

<div 
  class="svg-canvas" 
  bind:this={svgContainer}
  on:click={handleSvgClick}
  on:load={handleSvgLoad}
>
  {#if $svgContent}
    <div class="svg-wrapper">
      {@html $svgContent}
    </div>
    
    {#if $extractedPins.length > 0}
      <div class="pin-overlay">
        {#each $extractedPins as pin}
          <div 
            class="pin-marker"
            style="
              left: {pin.cx}px; 
              top: {pin.cy}px;
              background-color: {getPinColor(pin)};
            "
            title="{pin.data.label || pin.data.pin || 'Pin'}"
          ></div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="placeholder">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8" cy="8" r="2"/>
        <circle cx="16" cy="8" r="2"/>
        <circle cx="8" cy="16" r="2"/>
        <circle cx="16" cy="16" r="2"/>
      </svg>
      <p>Load an SVG board file to begin</p>
    </div>
  {/if}
</div>

<style>
  .svg-canvas {
    flex: 1;
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .svg-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  
  .svg-wrapper :global(svg) {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }
  
  .pin-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  
  .pin-marker {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    cursor: pointer;
    pointer-events: auto;
    transition: transform 0.15s ease;
  }
  
  .pin-marker:hover {
    transform: translate(-50%, -50%) scale(1.3);
  }
  
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--text-secondary);
  }
  
  .placeholder p {
    margin: 0;
    font-size: 14px;
  }
</style>

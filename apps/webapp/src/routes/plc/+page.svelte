<script lang="ts">
  import { onMount } from 'svelte';
  import LadderCanvas from '$lib/components/plc/LadderCanvas.svelte';
  import LadderToolbox from '$lib/components/plc/LadderToolbox.svelte';
  import { plcState, type LadderElement } from '$lib/state/plc.svelte.ts';
  
  let isMobile = $state(false);
  
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 1024;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });
  
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    const elementType = event.dataTransfer?.getData('elementType');
    if (!elementType) return;
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    plcState.addElement(elementType as LadderElement['type'], x, y);
  }
  
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }
</script>

<div class="h-screen w-full flex flex-col overflow-hidden bg-background pt-14">
  <!-- Toolbar -->
  <div class="h-10 bg-white/[0.02] border-b border-white/5 flex items-center justify-between px-4">
    <div class="flex items-center gap-2">
      <span class="font-mono text-[10px] font-bold uppercase text-white/50 flex items-center gap-2">
        <span class="material-symbols-outlined text-xs">view_week</span> LADDER DIAGRAM
      </span>
      <span class="text-white/20">|</span>
      <span class="font-mono text-[9px] text-white/40">{plcState.elements.length} elements</span>
    </div>
    
    <div class="flex items-center gap-2">
      <button 
        class="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-surface-bright text-white rounded-sm"
        onclick={() => plcState.zoomIn()}
      >
        <span class="material-symbols-outlined text-xs">zoom_in</span>
      </button>
      <button 
        class="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-surface-bright text-white rounded-sm"
        onclick={() => plcState.zoomOut()}
      >
        <span class="material-symbols-outlined text-xs">zoom_out</span>
      </button>
      <button 
        class="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-surface-bright text-white rounded-sm"
        onclick={() => plcState.resetZoom()}
      >
        <span class="material-symbols-outlined text-xs">fit_screen</span>
      </button>
      <button 
        class="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-error/80 text-white rounded-sm"
        onclick={() => plcState.clearAll()}
      >
        <span class="material-symbols-outlined text-xs">delete</span>
      </button>
    </div>
  </div>
  
  <!-- Main Workspace -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Toolbox Sidebar -->
    <LadderToolbox />
    
    <!-- Canvas Area -->
    <div class="flex-1 relative overflow-hidden" ondrop={handleDrop} ondragover={handleDragOver}>
      <!-- Background Orbs -->
      <div class="absolute top-1/4 left-1/3 w-96 h-96 bg-primary-container/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div class="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[160px] pointer-events-none"></div>
      
      <!-- Grid Lines -->
      <div class="absolute inset-0 opacity-20 pointer-events-none">
        <svg class="w-full h-full">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" stroke-width="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      <!-- Ladder Canvas -->
      <LadderCanvas />
    </div>
    
    <!-- Properties Panel -->
    <div class="w-64 bg-[#131221] border-l border-white/10 flex flex-col">
      <div class="h-10 bg-white/[0.02] border-b border-white/5 flex items-center px-4">
        <span class="font-mono text-[10px] font-bold uppercase text-white/50">PROPERTIES</span>
      </div>
      
      <div class="flex-1 p-4 overflow-y-auto">
        {#if plcState.selectedElement}
          <div class="space-y-3">
            <div>
              <label class="block text-[9px] font-mono uppercase text-white/40 mb-1">Type</label>
              <div class="text-xs text-primary-container font-mono">{plcState.selectedElement.type}</div>
            </div>
            
            <div>
              <label class="block text-[9px] font-mono uppercase text-white/40 mb-1">Reference</label>
              <input 
                type="text" 
                class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-primary-container focus:outline-none"
                bind:value={plcState.selectedElement.ref}
                placeholder="e.g., I0.0"
              />
            </div>
            
            <div>
              <label class="block text-[9px] font-mono uppercase text-white/40 mb-1">Description</label>
              <input 
                type="text" 
                class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-primary-container focus:outline-none"
                bind:value={plcState.selectedElement.description}
                placeholder="Description..."
              />
            </div>
            
            {#if plcState.selectedElement.type.includes('timer') || plcState.selectedElement.type.includes('counter')}
              <div>
                <label class="block text-[9px] font-mono uppercase text-white/40 mb-1">Preset Time / Count</label>
                <input 
                  type="number" 
                  class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-primary-container focus:outline-none"
                  bind:value={plcState.selectedElement.preset}
                  placeholder="0"
                />
              </div>
            {/if}
            
            <button 
              class="w-full mt-4 py-2 text-[9px] font-bold uppercase tracking-widest bg-error/80 text-white rounded hover:bg-error transition-colors"
              onclick={() => plcState.deleteSelected()}
            >
              Delete Element
            </button>
          </div>
        {:else}
          <div class="text-center text-white/30 text-xs py-8">
            <span class="material-symbols-outlined text-4xl mb-2">touch_app</span>
            <p>Select an element<br/>to edit properties</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Status Bar -->
  <div class="h-6 bg-[#0d0d14] border-t border-white/5 flex items-center justify-between px-4">
    <div class="flex items-center gap-4">
      <span class="font-mono text-[9px] text-white/40">
        Zoom: {Math.round(plcState.zoom * 100)}%
      </span>
      <span class="font-mono text-[9px] text-white/40">
        Rungs: {plcState.rungCount}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
      <span class="font-mono text-[9px] text-white/40">PLC Ready</span>
    </div>
  </div>
</div>

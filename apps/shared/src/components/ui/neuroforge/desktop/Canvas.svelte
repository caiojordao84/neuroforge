<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteFlow, Controls, Background, BackgroundVariant, MiniMap, type Connection, type Edge, type Node } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import BoardNode from './nodes/BoardNode.svelte';
  import ComponentNode from './nodes/ComponentNode.svelte';
  import Oscilloscope from './Oscilloscope.svelte';
  import SerialMonitor from './SerialMonitor.svelte';

  import { simManager } from '../../../../lib/simulation/simManager';

  const nodeTypes = {
    board: BoardNode,
    component: ComponentNode
  };

  // Provide some initial data replacing the mock
  let nodes = $state<Node[]>([
    {
      id: 'mcu-1',
      type: 'board',
      position: { x: 150, y: 150 },
      data: { label: 'MCU_01', mcu: 'RP2040', status: 'running' }
    },
    {
      id: 'mcu-2',
      type: 'board',
      position: { x: 550, y: 300 },
      data: { label: 'MCU_02', mcu: 'ESP32', status: 'idle' }
    }
  ]);

  let edges = $state<Edge[]>([
    { 
      id: 'e1-2', 
      source: 'mcu-1', 
      sourceHandle: 'tx', 
      target: 'mcu-2', 
      targetHandle: 'rx', 
      animated: true, 
      style: "stroke: #FFD300; stroke-width: 2; opacity: 0.8;" 
    }
  ]);

  function handleConnect(connection: Connection) {
    edges = [
      ...edges,
      {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        animated: true,
        style: "stroke: #FFD300; stroke-width: 2; opacity: 0.8;"
      } as Edge
    ];
  }

  let wrapper: HTMLElement;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer || !wrapper) return;

    const dataStr = e.dataTransfer.getData('application/svelteflow');
    if (!dataStr) return;

    const parsed = JSON.parse(dataStr);
    
    // Simplistic screen-to-flow projection for now
    // (In production, use `useSvelteFlow().screenToFlowPosition`)
    const bounds = wrapper.getBoundingClientRect();
    const position = {
      x: e.clientX - bounds.left - 40,
      y: e.clientY - bounds.top - 40,
    };

    const newNode = {
      id: `${parsed.type}-${Date.now()}`,
      type: parsed.type,
      position,
      data: { 
        label: parsed.componentType, 
        componentType: parsed.componentType, 
        status: 'off' 
      }
    };

    nodes = [...nodes, newNode];
  }

  let simCanvas: HTMLCanvasElement;
  let renderWorker: Worker;

  onMount(() => {
    // Phase 3: Setup Layer 2 (OffscreenCanvas rendering)
    const initSim = async () => {
      try {
        await simManager.initialize();

        const offscreen = simCanvas.transferControlToOffscreen();
        
        // Spin up the Web Worker
        renderWorker = new Worker(new URL('../../../../lib/simulation/render.worker.ts', import.meta.url), { type: 'module' });
        
        if (simManager.buffer) {
           renderWorker.postMessage({
              type: 'INIT',
              payload: { canvas: offscreen, buffer: simManager.buffer }
           }, [offscreen]);

           // Pre-load default MVP connection colors
           const colors = [
             { key: 'digital', hex: '#2563EB', name: 'Digital' },
             { key: 'power', hex: '#DC2626', name: 'Power' },
             { key: 'gnd', hex: '#16A34A', name: 'Ground' }
           ];
           renderWorker.postMessage({
             type: 'UPDATE_COLORS',
             payload: { colors: colors }
           });
           
           // Start Rust WASM logic ticking which populates the buffer seamlessly
           simManager.startLogicTicks();
        }

        // Setup resize observer for the canvas wrapper
        const ro = new ResizeObserver((entries) => {
          for (let entry of entries) {
            renderWorker.postMessage({
              type: 'RESIZE',
              payload: { width: entry.contentRect.width, height: entry.contentRect.height }
            });
          }
        });
        ro.observe(wrapper);

        return () => {
          ro.disconnect();
          renderWorker.terminate();
        };

      } catch(e) {
        console.error("Could not init simulation SAB base:", e);
      }
    };
    initSim();
  });

  // Keep Worker synced with physical layout routing
  $effect(() => {
    if (renderWorker && edges.length > 0) {
      // For MVP, we send mock geometries to verify the pipeline.
      // In production, we'd use `getBezierPath` from xyflow passing source and target positions.
      const mockGeometryEdges = edges.map(e => ({
        id: e.id,
        type: 'digital',
        svgPath: `M 150 150 C 200 150 200 300 550 300`, // Hardcoded mockup path bridging the 2 test nodes
        bufferIndex: 0 // Will blink based on first byte of SAB memory
      }));

      renderWorker.postMessage({
        type: 'SYNC_GEOMETRY',
        payload: { edges: mockGeometryEdges }
      });
    }
  });

  // Phase 5 Context Menu State
  let contextMenu = $state<{ show: boolean, x: number, y: number, nodeId: string | null }>({ show: false, x: 0, y: 0, nodeId: null });
  let showOscilloscope = $state(true);

  function handleNodeContextMenu(evt: any, node?: any) {
    if (evt.preventDefault) evt.preventDefault();
    const event = evt.detail ? evt.detail.event : evt;
    const targetNode = evt.detail ? evt.detail.node : node;
    if (event && targetNode) {
       contextMenu = { show: true, x: event.clientX, y: event.clientY, nodeId: targetNode.id };
    }
  }

  function handlePaneClick() {
    if (contextMenu.show) {
      contextMenu.show = false;
    }
  }

  function toggleBreakPoint() {
    alert(`Breakpoint toggled for Node: ${contextMenu.nodeId}\nExecution will halt here.`);
    contextMenu.show = false;
  }
</script>

<div 
  bind:this={wrapper}
  class="flex-1 relative overflow-hidden h-full w-full bg-background"
  ondragover={handleDragOver}
  ondrop={handleDrop}
  role="region"
>
  <!-- Subtle Background Orbs -->
  <div class="absolute top-1/4 left-1/3 w-96 h-96 bg-primary-container/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
  <div class="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[160px] pointer-events-none z-0"></div>

  <div class="absolute inset-0 z-10">
    <!-- Layer 1 topology -->
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      onconnect={handleConnect}
      onnodecontextmenu={handleNodeContextMenu}
      onpaneclick={handlePaneClick}
      fitView
      colorMode="dark"
      class="neuroforge-theme"
      style="background-color: transparent;"
    >
      <Controls />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.1)" bgColor="#0a0a0f" />
      <MiniMap 
        nodeColor={(n: any) => {
          if (n.type === 'board') return '#FFD300';
          return '#1A1A24';
        }}
        maskColor="#00000080"
        style="background-color: #1A1A24; border: 1px solid #ffffff10; border-radius: 8px;"
      />
    </SvelteFlow>
  </div>

  <!-- Layer 2 Overlay renderer (Zero-latency SAB driven paths) -->
  <canvas 
    bind:this={simCanvas} 
    class="absolute inset-0 z-20 w-full h-full pointer-events-none" 
  ></canvas>

  <!-- Context Menu Popup -->
  {#if contextMenu.show}
    <div 
      class="fixed bg-[#1A1A24] border border-white/20 rounded shadow-2xl p-1 z-50 flex flex-col min-w-[150px]"
      style="top: {contextMenu.y}px; left: {contextMenu.x}px;"
    >
      <button 
        class="text-left px-3 py-2 text-xs text-white/80 hover:bg-primary-container/20 hover:text-primary-container rounded flex items-center gap-2"
        onclick={toggleBreakPoint}
      >
        <div class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div> Toggle Breakpoint
      </button>
      <button 
        class="text-left px-3 py-2 text-xs text-white/80 hover:bg-primary-container/20 hover:text-primary-container rounded flex items-center gap-2"
        onclick={() => { showOscilloscope = !showOscilloscope; contextMenu.show = false; }}
      >
        <span class="material-symbols-outlined text-[14px]">query_stats</span> {showOscilloscope ? 'Hide' : 'Show'} Oscilloscope
      </button>
    </div>
  {/if}

  <!-- Floating Phase 5 Widgets -->
  <div class="absolute bottom-4 right-4 z-40 flex flex-col gap-4">
    {#if showOscilloscope}
      <Oscilloscope title="Oscilloscope [Simulated Pin D0]" bufferIndex={0} />
    {/if}
    <div class="w-80">
      <SerialMonitor />
    </div>
  </div>
</div>

<style>
  :global(.neuroforge-theme .svelte-flow) {
    background: transparent;
  }
  :global(.neuroforge-theme .svelte-flow__controls) {
    background: #1A1A24;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    overflow: hidden;
  }
  :global(.neuroforge-theme .svelte-flow__controls-button) {
    background: transparent;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }
  :global(.neuroforge-theme .svelte-flow__controls-button:hover) {
    background: rgba(255, 255, 255, 0.05);
  }
  :global(.neuroforge-theme .svelte-flow__controls-button:last-child) {
    border-bottom: none;
  }
</style>

<script lang="ts">
  import { SvelteFlow, Controls, Background, BackgroundVariant, MiniMap, type Connection, type Edge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import BoardNode from './nodes/BoardNode.svelte';
  import ComponentNode from './nodes/ComponentNode.svelte';

  const nodeTypes = {
    board: BoardNode,
    component: ComponentNode
  };

  // Provide some initial data replacing the mock
  let nodes = $state([
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
    <!-- SvelteFlow is the Layer 1 topology -->
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      onconnect={handleConnect}
      fitView
      class="neuroforge-theme"
    >
      <Controls />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      <MiniMap 
        nodeColor={(n) => {
          if (n.type === 'board') return '#FFD300';
          return '#1A1A24';
        }}
        maskColor="#00000080"
        style="background-color: #1A1A24; border: 1px solid #ffffff10; border-radius: 8px;"
      />
    </SvelteFlow>
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

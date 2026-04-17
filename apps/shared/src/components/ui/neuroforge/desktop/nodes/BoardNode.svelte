<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  let { data, isConnectable = true } = $props<{
    data: { label: string; mcu: string; status?: "running" | "idle" | "error" };
    isConnectable?: boolean;
  }>();
</script>

<div class="w-48 bg-surface-container-lowest border-2 {data.status === 'running' ? 'border-primary-container shadow-[0_0_20px_rgba(255,211,0,0.2)]' : 'border-white/10 shadow-lg'} rounded-lg p-1 transition-colors relative">
  <!-- Target Handles (Left) -->
  <Handle 
    type="target" 
    position={Position.Left} 
    id="rx" 
    style="top: 25%; left: -8px; width: 14px; height: 14px; background: #FFD300; border: 2px solid #1A1A24;" 
    {isConnectable} 
  />
  <Handle 
    type="target" 
    position={Position.Left} 
    id="in_2" 
    style="top: 50%; left: -8px; width: 14px; height: 14px; background: #FFD300; border: 2px solid #1A1A24;" 
    {isConnectable} 
  />

  <!-- Source Handles (Right) -->
  <Handle 
    type="source" 
    position={Position.Right} 
    id="tx" 
    style="top: 25%; right: -8px; width: 14px; height: 14px; background: #FFD300; border: 2px solid #1A1A24;" 
    {isConnectable} 
  />
  <Handle 
    type="source" 
    position={Position.Right} 
    id="out_2" 
    style="top: 50%; right: -8px; width: 14px; height: 14px; background: #FFD300; border: 2px solid #1A1A24;" 
    {isConnectable} 
  />

  <div class="h-full w-full bg-surface-container-low rounded-sm flex flex-col p-3 border border-white/5 relative">
    <div class="flex justify-between items-start mb-4">
      <span class="font-mono text-[10px] {data.status === 'running' ? 'text-primary-container' : 'text-white/60'} font-bold">
        {data.label}
      </span>
      {#if data.status === 'running'}
        <div class="w-2 h-2 rounded-full bg-primary-container animate-pulse"></div>
      {:else}
        <div class="w-2 h-2 rounded-full bg-white/20"></div>
      {/if}
    </div>
    
    <div class="flex-1 flex flex-col items-center justify-center opacity-80 py-4">
      <span class="material-symbols-outlined text-4xl {data.status === 'running' ? 'text-white/80' : 'text-white/40'} mb-2">memory</span>
      <span class="text-[10px] {data.status === 'running' ? 'text-white/80' : 'text-white/40'} uppercase font-bold tracking-tighter">
        {data.mcu}
      </span>
    </div>
    
    <div class="mt-2 flex flex-wrap gap-1">
      <div class="w-2 h-2 bg-blue-500/50 rounded-full"></div>
      <div class="w-2 h-2 bg-green-500/50 rounded-full"></div>
      <div class="w-2 h-2 bg-white/20 rounded-full"></div>
    </div>
  </div>
</div>

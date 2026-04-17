<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  let { data, isConnectable = true } = $props<{
    data: { label: string; componentType: string; status?: "on" | "off" | "error" };
    isConnectable?: boolean;
  }>();
</script>

<div class="w-32 bg-surface-container-lowest border border-white/10 rounded-md p-2 shadow-lg hover:border-primary-container transition-colors relative">
  <!-- Top Handle -->
  <Handle 
    type="target" 
    position={Position.Top} 
    id="in" 
    style="width: 10px; height: 10px; background: #FFD300; border: 1px solid #1A1A24;" 
    {isConnectable} 
  />

  <!-- Bottom Handle -->
  <Handle 
    type="source" 
    position={Position.Bottom} 
    id="out" 
    style="width: 10px; height: 10px; background: #FFD300; border: 1px solid #1A1A24;" 
    {isConnectable} 
  />

  <div class="flex flex-col items-center justify-center text-center">
    <div class="w-8 h-8 rounded-full mb-2 flex items-center justify-center {data.status === 'on' ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' : 'bg-surface-container-high border border-white/10'}">
      <span class="material-symbols-outlined text-sm {data.status === 'on' ? 'text-white' : 'text-white/40'}">
        {data.componentType === 'LED' ? 'lightbulb' : 'settings'}
      </span>
    </div>
    
    <span class="font-mono text-[9px] text-white/80 font-bold uppercase tracking-widest block truncate w-full">
      {data.label}
    </span>
    <span class="font-mono text-[8px] text-white/40 uppercase tracking-tighter">
      {data.componentType}
    </span>
  </div>
</div>

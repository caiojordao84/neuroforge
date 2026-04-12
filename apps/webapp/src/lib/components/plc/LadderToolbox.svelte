<script lang="ts">
  import type { LadderElementType } from '$lib/state/plc.svelte.ts';
  
  interface ToolboxItem {
    type: LadderElementType;
    label: string;
    icon: string;
    category: 'contacts' | 'coils' | 'timers' | 'counters' | 'connectors';
  }
  
  const toolboxItems: ToolboxItem[] = [
    // Contacts
    { type: 'contact_no', label: 'NO Contact', icon: 'toggle_on', category: 'contacts' },
    { type: 'contact_nc', label: 'NC Contact', icon: 'toggle_off', category: 'contacts' },
    // Coils
    { type: 'coil_output', label: 'Output Coil', icon: 'output', category: 'coils' },
    { type: 'coil_set', label: 'Set Coil', icon: 'add_circle', category: 'coils' },
    { type: 'coil_reset', label: 'Reset Coil', icon: 'remove_circle', category: 'coils' },
    // Timers
    { type: 'ton', label: 'TON', icon: 'timer', category: 'timers' },
    { type: 'tof', label: 'TOF', icon: 'timer', category: 'timers' },
    { type: 'tp', label: 'TP', icon: 'timer', category: 'timers' },
    // Counters
    { type: 'ctu', label: 'CTU', icon: 'exposure_plus_1', category: 'counters' },
    { type: 'ctd', label: 'CTD', icon: 'exposure_minus_1', category: 'counters' },
    // Connectors
    { type: 'connector', label: 'Connector', icon: 'link', category: 'connectors' },
  ];
  
  const categories = [
    { id: 'contacts', label: 'Contacts', icon: 'toggle_on' },
    { id: 'coils', label: 'Coils', icon: 'output' },
    { id: 'timers', label: 'Timers', icon: 'timer' },
    { id: 'counters', label: 'Counters', icon: 'plus_minus' },
    { id: 'connectors', label: 'Connectors', icon: 'link' },
  ] as const;
  
  let expandedCategories = $state<Set<string>>(new Set(['contacts', 'coils']));
  
  function toggleCategory(categoryId: string) {
    const newSet = new Set(expandedCategories);
    if (newSet.has(categoryId)) {
      newSet.delete(categoryId);
    } else {
      newSet.add(categoryId);
    }
    expandedCategories = newSet;
  }
  
  function handleDragStart(event: DragEvent, item: ToolboxItem) {
    event.dataTransfer?.setData('elementType', item.type);
    event.dataTransfer!.effectAllowed = 'copy';
  }
  
  function getItemsByCategory(category: string): ToolboxItem[] {
    return toolboxItems.filter(item => item.category === category);
  }
</script>

<aside class="w-56 bg-[#131221] border-r border-white/10 flex flex-col z-40">
  <div class="h-10 bg-white/[0.02] border-b border-white/5 flex items-center px-4">
    <span class="font-mono text-[10px] font-bold uppercase text-primary-container flex items-center gap-2">
      <span class="material-symbols-outlined text-xs">build</span> TOOLBOX
    </span>
  </div>
  
  <div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
    {#each categories as category}
      <div class="category-group">
        <button 
          class="w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/5 rounded transition-all"
          onclick={() => toggleCategory(category.id)}
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-sm text-primary-container">{category.icon}</span>
            {category.label}
          </span>
          <span class="material-symbols-outlined text-xs transition-transform {expandedCategories.has(category.id) ? 'rotate-180' : ''}">
            expand_more
          </span>
        </button>
        
        {#if expandedCategories.has(category.id)}
          <div class="mt-1 space-y-1 pl-2">
            {#each getItemsByCategory(category.id) as item}
              <div 
                class="toolbox-item px-3 py-2 hover:bg-white/5 rounded cursor-grab flex items-center gap-2 text-[10px] text-white/60 hover:text-white transition-all active:scale-[0.98]"
                draggable="true"
                ondragstart={(e) => handleDragStart(e, item)}
                role="button"
                tabindex="0"
              >
                <span class="material-symbols-outlined text-sm text-primary-container/70">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  
  <div class="p-3 border-t border-white/5">
    <div class="text-[9px] text-white/30 font-mono text-center">
      Drag elements to canvas
    </div>
  </div>
</aside>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 211, 0, 0.2);
    border-radius: 2px;
  }
  
  .toolbox-item:hover {
    border-left: 2px solid var(--color-primary-container);
  }
</style>

<script>
  let categories = [
    {
      name: 'Digital Outputs',
      icon: 'settings_input_component',
      items: ['LED', 'RGB LED', 'Addressable LED Strip', 'LED Matrix', '8x8 LED Matrix', '16x16 RGB Matrix']
    },
    {
      name: 'Digital Inputs',
      icon: 'radio_button_checked',
      items: ['Push Button', 'PIR motion detector']
    }
  ];

  let searchQuery = "";
</script>

<aside class="w-64 bg-[#131221] border-r border-white/5 flex flex-col z-20 shrink-0 h-full">
  <div class="p-4 border-b border-white/5">
    <div class="flex items-center justify-between mb-2">
      <span class="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-container">COMPONENTS</span>
      <span class="text-[9px] text-white/30 font-mono">v4.2-STABLE</span>
    </div>
    <div class="relative">
      <input 
        bind:value={searchQuery}
        class="w-full bg-black/20 border-0 border-b border-white/10 text-xs py-2 focus:ring-0 focus:border-primary-container placeholder:text-white/20" 
        placeholder="Search components..." 
        type="text"
      />
    </div>
  </div>
  
  <div class="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
    {#each categories as category}
      <div>
        <div class="px-2 py-1 flex items-center justify-between group cursor-pointer">
          <span class="font-mono text-[11px] font-bold uppercase text-white/90 flex items-center gap-2">
            <span class="material-symbols-outlined text-xs text-primary-container">{category.icon}</span> 
            {category.name}
          </span>
          <span class="material-symbols-outlined text-xs text-white/20">expand_more</span>
        </div>
        
        <div class="mt-1 space-y-0.5">
          {#each category.items as item}
            <div 
              class="px-3 py-1.5 hover:bg-white/5 rounded cursor-grab text-[11px] text-on-surface flex items-center gap-2 transition-colors active:cursor-grabbing"
              draggable="true"
              role="button"
              tabindex="0"
              ondragstart={(e) => {
                if (e.dataTransfer) {
                  e.dataTransfer.setData('application/svelteflow', JSON.stringify({ type: 'component', componentType: item }));
                  e.dataTransfer.effectAllowed = 'move';
                }
              }}
            >
              <div class="w-1.5 h-1.5 rounded-full bg-white/20"></div> 
              {item}
            </div>
          {/each}
        </div>
      </div>
    {/each}
    
    <div class="px-2 py-4 text-[9px] text-white/20 font-mono text-center uppercase tracking-widest">
      and 12 more categories
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
</style>

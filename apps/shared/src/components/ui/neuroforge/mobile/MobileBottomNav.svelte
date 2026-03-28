<script>
  let activeTab = 'canvas';
  let tabs = [
    { id: 'canvas', name: 'Canvas', icon: 'layers', filled: true },
    { id: 'code', name: 'Code', icon: 'code', filled: false },
    { id: 'library', name: 'Library', icon: 'inventory_2', filled: false },
    { id: 'status', name: 'Status', icon: 'analytics', filled: false }
  ];
</script>

<nav class="fixed bottom-0 left-0 w-full z-50 flex justify-around items-end pb-[safe-area-inset-bottom] bg-surface-container-lowest/90 backdrop-blur-xl border-t border-white/5 rounded-t-lg">
  {#each tabs as tab}
    <button 
      class="flex flex-col items-center justify-center pt-2 pb-3 px-4 transition-all {activeTab === tab.id ? 'bg-surface-bright border-t-2 border-primary-container text-primary-container' : 'text-on-surface-variant hover:text-on-surface'}"
      onclick={() => activeTab = tab.id}
    >
      <span class="material-symbols-outlined mb-1" style="font-variation-settings: 'FILL' {activeTab === tab.id ? 1 : 0};">
        {tab.icon}
      </span>
      <span class="font-mono text-[10px] uppercase font-bold">{tab.name}</span>
    </button>
  {/each}
</nav>

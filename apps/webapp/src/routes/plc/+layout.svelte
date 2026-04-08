<script lang="ts">
  import type { Snippet } from 'svelte';
  
  let { children }: { children: Snippet } = $props();
  
  let activeTab = $state<'ladder' | 'logic' | 'settings'>('ladder');
  
  const tabs = [
    { id: 'ladder', label: 'Ladder', icon: 'view_week' },
    { id: 'logic', label: 'Logic', icon: 'account_tree' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ] as const;
</script>

<div class="h-screen w-full flex flex-col overflow-hidden bg-background">
  <!-- Custom Header for PLC Route -->
  <header class="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-[#131221] shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <a href="/" class="text-2xl font-black italic text-primary-container tracking-tighter hover:text-white transition-colors">NeuroForge</a>
        <div class="h-4 w-[1px] bg-white/10 mx-2"></div>
        <span class="font-industrial font-bold italic uppercase tracking-wider text-primary-container text-sm">
          PLC_EDITOR
        </span>
      </div>
    </div>
    
    <div class="flex items-center gap-2 bg-black/30 p-0.5 rounded">
      {#each tabs as tab}
        <button 
          class="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all {activeTab === tab.id ? 'bg-surface-bright text-white' : 'text-white/40 hover:text-white/80'}"
          onclick={() => activeTab = tab.id}
        >
          <span class="material-symbols-outlined text-xs">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="flex items-center gap-4">
      <button class="p-2 text-on-surface-variant hover:bg-surface-container-highest/50 transition-all active:scale-[0.97] rounded">
        <span class="material-symbols-outlined">play_circle</span>
      </button>
      <button class="p-2 text-on-surface-variant hover:bg-surface-container-highest/50 transition-all active:scale-[0.97] rounded">
        <span class="material-symbols-outlined">stop_circle</span>
      </button>
    </div>
  </header>
  
  <!-- Main Content -->
  <main class="flex-1 pt-14">
    {@render children()}
  </main>
</div>

<style>
  :global(body) {
    overflow: hidden;
  }
</style>

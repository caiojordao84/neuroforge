<script lang="ts">
  import { ideState } from '$lib/state/ide.svelte.ts';
  import CodeEditor from '@neuroforge/shared/components/CodeEditor.svelte';
  
  let showLangMenu = $state(false);
  const languages = ['cpp', 'rust', 'python'];

  function selectLang(lang: string) {
    ideState.language = lang;
    showLangMenu = false;
    ideState.addLog(`Switched language to ${lang.toUpperCase()}`, 'info');
  }
</script>

<aside class="w-[480px] glass-panel border-l border-white/10 flex flex-col z-40">
  <!-- Upper Section: Code Editor -->
  <div class="flex-1 flex flex-col border-b border-white/5 relative">
    <div class="h-10 bg-white/[0.02] border-b border-white/5 flex items-center justify-between px-4">
      <div class="flex items-center gap-0.5 h-full">
        <!-- Tab: main (source) -->
        <button 
          class="flex items-center gap-1.5 px-3 h-full text-xs font-medium cursor-pointer transition-all {!ideState.isAslView ? 'text-primary-container bg-primary-container/10' : 'text-on-surface-variant hover:bg-white/5'}"
          onclick={() => ideState.isAslView = false}
        >
          <span class="material-symbols-outlined text-xs">description</span> main
        </button>
        
        <!-- Tab: ASL (transpiled) -->
        <button 
          class="flex items-center px-3 h-full text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors border-l border-white/5 {ideState.isAslView ? 'text-primary-container bg-primary-container/10' : 'text-on-surface-variant hover:bg-white/5'}"
          onclick={() => ideState.toggleAslView()}
        >
          ASL
        </button>
        
        <!-- Lang Selector -->
        <div class="relative h-full flex items-center ml-2 border-l border-white/5 pl-2">
          <button 
            class="flex items-center gap-1 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider hover:text-white transition-colors"
            onclick={() => showLangMenu = !showLangMenu}
          >
            {ideState.language} <span class="material-symbols-outlined text-[12px]">expand_more</span>
          </button>
          
          {#if showLangMenu}
            <div class="absolute top-10 left-0 w-32 glass-panel shadow-2xl z-50 py-1 bg-[#131221]">
              {#each languages as lang}
                <button 
                  class="w-full text-left px-3 py-1.5 text-[10px] font-mono uppercase hover:bg-primary-container/20 hover:text-primary-container transition-colors {ideState.language === lang ? 'text-primary-container' : 'text-on-surface-variant'}"
                  onclick={() => selectLang(lang)}
                >
                  {lang}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <div class="flex items-center gap-1 bg-black/30 p-0.5 rounded mr-2">
        <button class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-surface-bright text-white rounded-sm">Code</button>
        <button class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white/60">GRAPHIC</button>
      </div>
    </div>
    
    <!-- Editor Content -->
    <div class="flex-1 bg-surface-container-lowest overflow-hidden">
      {#if ideState.isAslView}
        <CodeEditor 
          height="100%"
          language="json" 
          readOnly={true}
          value={ideState.transpiledAsl}
        />
      {:else}
        <CodeEditor 
          height="100%"
          language={ideState.language} 
          bind:value={ideState.code}
        />
      {/if}
    </div>
  </div>
  
  <!-- Lower Section: Terminal -->
  <div class="h-64 flex flex-col bg-black/40">
    <div class="h-8 border-b border-white/5 px-4 flex items-center justify-between">
      <span class="font-mono text-[10px] font-bold uppercase text-white/50 flex items-center gap-2">
        <span class="material-symbols-outlined text-xs">terminal</span> CONSOLE OUTPUT
      </span>
      <div class="flex gap-2">
        <button class="text-white/30 hover:text-primary-container transition-colors" title="Copy Log" onclick={() => navigator.clipboard.writeText(JSON.stringify(ideState.terminalLogs))}><span class="material-symbols-outlined text-xs">content_copy</span></button>
        <button class="text-white/30 hover:text-primary-container transition-colors" title="Clear" onclick={() => ideState.terminalLogs = []}><span class="material-symbols-outlined text-xs">delete_sweep</span></button>
        <button class="text-white/30 hover:text-primary-container transition-colors" title="Pause"><span class="material-symbols-outlined text-xs">pause</span></button>
      </div>
    </div>
    <div class="flex-1 p-3 font-mono text-[10px] overflow-y-auto space-y-1 custom-scrollbar">
      {#each ideState.terminalLogs as log}
        <div class="flex gap-2">
          <span class="text-white/20">[{log.time}]</span>
          <span class={log.type === 'error' ? 'text-error' : log.type === 'success' ? 'text-primary-container' : 'text-blue-400'}>
            {log.msg}
          </span>
        </div>
      {/each}
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

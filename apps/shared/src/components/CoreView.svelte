<script lang="ts">
  import { onMount } from 'svelte';
  import { SupportedLanguage, LANGUAGES } from '../lib/types/transpiler';
  import { DEFAULT_SOURCE_CODE } from '../lib/constants';
  import { orchestrator } from '../lib/ai/orchestration';
  import { asl } from '../state/asl.svelte';
  import { providerState } from '../lib/ai/state/provider.svelte';
  import { library } from '../state/library.svelte';
  
  import CodeEditor from './CodeEditor.svelte';
  import ProviderSettings from './ProviderSettings.svelte';

  // --- Props ---
  let { } = $props();

  // --- State ---
  let sourceCode = $state(DEFAULT_SOURCE_CODE);
  let sourceLang = $state<string>(SupportedLanguage.ARDUINO);
  let targetLang = $state<string>(SupportedLanguage.RUST);
  
  let boardsCatalogue = $state<{ id: string; name: string; boardProfileId: string; family: string; path: string; }[]>([]);
  let platform = $state<string>('');
  let currentBoardProfile = $state<any>(null);
  
  let loadingCatalogue = $state(true);
  let catalogueError = $state<string | null>(null);
  
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let transpileResult = $state<any>(null);
  let copied = $state(false);
  let isBrowser = $state(false);
  let showProviderSettings = $state(false);

  onMount(async () => { 
    isBrowser = true; 

    // Load boards catalogue
    try {
      loadingCatalogue = true;
      const res = await fetch('/boards/boards-index.json');
      if (!res.ok) throw new Error('Failed to load boards catalogue');
      const data = await res.json();
      boardsCatalogue = data.boards;
      
      // Select first board or preferred default
      if (boardsCatalogue.length > 0) {
        const preferred = boardsCatalogue.find(b => b.id === 'arduino-uno-r3' || b.id === 'esp32-devkitc-v4');
        platform = preferred ? preferred.id : boardsCatalogue[0].id;
      }
      loadingCatalogue = false;
    } catch (e) {
      console.warn('Boards catalogue load failed:', e);
      catalogueError = 'Falha ao carregar catálogo de hardware';
      loadingCatalogue = false;
    }

    // Initialize WASM in background via unified state
    try {
      await asl.init();
    } catch (e) {
      console.warn('WASM initialization failed:', e);
    }
  });

  // Watch for platform changes to load board profile
  $effect(() => {
    if (platform && boardsCatalogue.length > 0 && asl.ready) {
      const board = boardsCatalogue.find(b => b.id === platform);
      if (board && board.path) {
        fetch(board.path)
          .then(res => res.text())
          .then(content => {
            if (board.path.endsWith('.toon')) {
              try {
                const json = asl.toonToJson(content);
                currentBoardProfile = JSON.parse(json);
                console.log('[CoreView] Board profile loaded (TOON):', currentBoardProfile);
              } catch (e) {
                console.error('[CoreView] Failed to parse board TOON:', e);
              }
            } else {
              try {
                currentBoardProfile = JSON.parse(content);
                console.log('[CoreView] Board profile loaded (JSON legacy):', currentBoardProfile);
              } catch (e) {
                console.error('[CoreView] Failed to parse legacy JSON:', e);
              }
            }
          })
          .catch(err => console.error('[CoreView] Failed to load board file:', err));
      }
    }
  });

  async function handleProcess() {
    if (!sourceCode.trim()) {
      error = "Please enter some source code.";
      return;
    }

    isLoading = true;
    error = null;
    transpileResult = null;

    try {
      // Use orchestrator with auto mode - tries server API first, falls back to WASM
      transpileResult = await orchestrator.transpile({
        sourceLang,
        targetLang,
        targetPlatform: platform,
        code: sourceCode,
        libraries: library.libraries.map(l => ({ name: l.name, source: l.content }))
      }, 'auto');
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred.";
    } finally {
      isLoading = false;
    }
  }

  function handleCopy() {
    if (transpileResult?.code) {
      navigator.clipboard.writeText(transpileResult.code);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }

  function swapLanguages() {
    const temp = sourceLang;
    sourceLang = targetLang;
    targetLang = temp;
  }
</script>

<div class="h-full w-full flex flex-col overflow-hidden bg-background">
  <!-- Controls Bar -->
  <div class="bg-[#131221] border-b border-white/5 px-4 py-3">
    <div class="flex flex-wrap items-end gap-4">
      <!-- Source Language -->
      <div class="flex flex-col gap-1 min-w-[180px]">
        <label for="core-source-lang" class="text-[9px] font-mono font-bold uppercase tracking-widest text-white/40">
          Source Language
        </label>
        <select 
          id="core-source-lang"
          bind:value={sourceLang}
          class="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs text-white font-mono focus:border-primary-container focus:outline-none transition-colors"
        >
          {#each LANGUAGES as lang}
            <option value={lang}>{lang}</option>
          {/each}
        </select>
      </div>

      <!-- Swap Button -->
      <button 
        class="p-2 text-on-surface-variant hover:text-primary-container hover:bg-primary-container/10 rounded transition-all active:scale-95 self-end"
        onclick={swapLanguages}
        title="Swap languages"
      >
        <span class="material-symbols-outlined text-lg">swap_horiz</span>
      </button>

      <!-- Target Language -->
      <div class="flex flex-col gap-1 min-w-[180px]">
        <label for="core-target-lang" class="text-[9px] font-mono font-bold uppercase tracking-widest text-white/40">
          Target Language
        </label>
        <select 
          id="core-target-lang"
          bind:value={targetLang}
          class="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs text-white font-mono focus:border-primary-container focus:outline-none transition-colors"
        >
          {#each LANGUAGES as lang}
            <option value={lang}>{lang}</option>
          {/each}
        </select>
      </div>

      <!-- Target Platform -->
      <div class="flex flex-col gap-1 min-w-[180px]">
        <label for="core-platform" class="text-[9px] font-mono font-bold uppercase tracking-widest text-white/40">
          Target Platform
        </label>
        <select 
          id="core-platform"
          bind:value={platform}
          disabled={loadingCatalogue || boardsCatalogue.length === 0}
          class="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs text-white font-mono focus:border-primary-container focus:outline-none transition-colors drop-shadow-sm disabled:opacity-50"
        >
          {#if loadingCatalogue}
            <option value="">Carregando boards...</option>
          {:else if catalogueError}
            <option value="">Erro no catálogo</option>
          {:else if boardsCatalogue.length === 0}
            <option value="">Nenhuma board encontrada</option>
          {:else}
            {#each boardsCatalogue as board}
              <option value={board.id}>{board.name}</option>
            {/each}
          {/if}
        </select>
      </div>

      <!-- Provider Status (Clickable) -->
      <button 
        onclick={() => showProviderSettings = !showProviderSettings}
        class="self-end flex items-center gap-2 px-2 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
        title="Click to configure AI provider"
      >
        <span class="material-symbols-outlined text-xs {$providerState.type !== 'none' && $providerState.apiKey ? 'text-green-400' : 'text-primary-container'}">
          {$providerState.type !== 'none' && $providerState.apiKey ? 'psychology' : 'memory'}
        </span>
        <span class="text-[9px] font-mono {$providerState.type !== 'none' && $providerState.apiKey ? 'text-green-400' : 'text-primary-container/80'}">
          {$providerState.type !== 'none' && $providerState.apiKey ? 'AI' : 'WASM'}
        </span>
      </button>

      <!-- Transpile Button -->
      <button 
        onclick={handleProcess}
        disabled={isLoading}
        class="self-end px-5 py-1.5 bg-primary-container text-black text-xs font-bold uppercase tracking-wider rounded hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-2 shadow-lg shadow-primary-container/20"
      >
        {#if isLoading}
          <div class="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
          PROCESSING...
        {:else}
          <span class="material-symbols-outlined text-sm">bolt</span>
          TRANSPILE
        {/if}
      </button>
    </div>
  </div>

  <!-- Editors Area -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Source Editor -->
    <div class="flex-1 flex flex-col border-r border-white/5 min-w-0">
      <div class="h-8 bg-white/[0.02] border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <span class="font-mono text-[10px] font-bold uppercase text-white/50 flex items-center gap-2">
          <span class="material-symbols-outlined text-xs">code</span> SOURCE
        </span>
        <span class="text-[9px] font-mono text-primary-container/70 bg-primary-container/10 px-2 py-0.5 rounded">
          {sourceLang}
        </span>
      </div>
      <div class="flex-1 bg-surface-container-lowest overflow-hidden">
        {#if isBrowser}
          <CodeEditor 
            height="100%"
            language="cpp"
            bind:value={sourceCode}
          />
        {/if}
      </div>
    </div>

    <!-- Output Editor -->
    <div class="flex-1 flex flex-col min-w-0 relative">
      <div class="h-8 bg-white/[0.02] border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <span class="font-mono text-[10px] font-bold uppercase text-primary-container flex items-center gap-2">
          <span class="material-symbols-outlined text-xs">terminal</span> TRANSPILED OUTPUT
        </span>
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-mono text-primary-container/70 bg-primary-container/10 px-2 py-0.5 rounded">
            {targetLang}
          </span>
          {#if transpileResult}
            <button 
              onclick={handleCopy}
              class="text-white/30 hover:text-primary-container transition-colors"
              title="Copy Code"
            >
              <span class="material-symbols-outlined text-xs">{copied ? 'check' : 'content_copy'}</span>
            </button>
          {/if}
        </div>
      </div>

      <div class="flex-1 bg-surface-container-lowest overflow-hidden relative">
        {#if isLoading}
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div class="w-12 h-12 border-4 rounded-full animate-spin mb-3 border-primary-container/30 border-t-primary-container"></div>
            <p class="text-primary-container font-mono text-[10px] font-bold uppercase tracking-widest animate-pulse">
              TRANSPILING LOGIC GATES...
            </p>
          </div>
        {/if}
        
        {#if error}
          <div class="p-8 flex flex-col items-center justify-center text-center h-full">
            <span class="material-symbols-outlined text-4xl text-error mb-3">warning</span>
            <h3 class="text-sm font-bold text-white mb-2">Process Failed</h3>
            <p class="text-white/50 text-xs max-w-md">{error}</p>
          </div>
        {:else if transpileResult && isBrowser}
          <CodeEditor 
            height="100%"
            language="rust"
            readOnly={true}
            value={transpileResult.code}
          />
        {:else if !transpileResult}
          <div class="p-8 flex flex-col items-center justify-center text-center h-full opacity-20">
            <span class="material-symbols-outlined text-5xl text-white/40 mb-3">memory</span>
            <p class="text-white/40 font-mono text-[10px] uppercase tracking-widest">Ready for input</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Provider Settings Modal -->
    {#if showProviderSettings}
      <div 
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 cursor-pointer" 
        role="button"
        tabindex="0"
        onclick={() => showProviderSettings = false}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') showProviderSettings = false; }}
      >
        <div 
          role="presentation"
          onclick={(e) => e.stopPropagation()} 
          onkeydown={(e) => e.stopPropagation()}
          class="bg-surface-container-high border border-white/10 rounded-lg p-6 max-w-md w-full mx-4 cursor-default"
        >
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-white">AI Provider Settings</h2>
            <button onclick={() => showProviderSettings = false} class="text-white/50 hover:text-white">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <ProviderSettings />
        </div>
      </div>
    {/if}
  </div>

  <!-- Analysis footer (Optional, can be expanded) -->
  {#if transpileResult && (transpileResult.notes || transpileResult.verification)}
    <div class="h-32 bg-[#131221] border-t border-white/5 overflow-auto p-4">
       <div class="grid grid-cols-2 gap-4">
          <div>
            <h4 class="text-[9px] font-bold uppercase text-white/40 mb-2">Notes</h4>
            <p class="text-[10px] font-mono text-white/60 whitespace-pre-wrap">{transpileResult.notes || 'None'}</p>
          </div>
          <div>
            <h4 class="text-[9px] font-bold uppercase text-white/40 mb-2">Hardware Verification</h4>
            <p class="text-[10px] font-mono text-white/60 whitespace-pre-wrap">{transpileResult.verification || 'Pending'}</p>
          </div>
       </div>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    overflow: hidden;
  }
</style>

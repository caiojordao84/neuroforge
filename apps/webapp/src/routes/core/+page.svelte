<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '$lib/components/desktop/TopBar.svelte';
  import { type TranspileRequest, type TranspileResult, SupportedLanguage, LANGUAGES } from '$lib/types';
  import { DEFAULT_SOURCE_CODE } from '$lib/constants';
  import { orchestrator } from '$lib/ai/orchestration';
  import { initWasm } from '$lib/wasm/index';
  import CodeEditor from '@neuroforge/shared/components/CodeEditor.svelte';
  import ProviderSettings from '$lib/components/provider/ProviderSettings.svelte';
  import { providerState } from '$lib/ai/state/provider.svelte';

  let sourceCode = $state(DEFAULT_SOURCE_CODE);
  let sourceLang = $state<string>(SupportedLanguage.ARDUINO);
  let targetLang = $state<string>(SupportedLanguage.RUST);
  let platform = $state("ESP32");
  
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let transpileResult = $state<TranspileResult | null>(null);
  let copied = $state(false);
  let isBrowser = $state(false);
  let showProviderSettings = $state(false);

  const platformOptions = [
    { value: 'STM32F4', label: 'STM32 F4 Series' },
    { value: 'STM32F1', label: 'STM32 F1 Series' },
    { value: 'ESP32', label: 'Espressif ESP32' },
    { value: 'ESP8266', label: 'Espressif ESP8266' },
    { value: 'Arduino Uno', label: 'Arduino Uno (ATmega328P)' },
    { value: 'Arduino Mega', label: 'Arduino Mega (ATmega2560)' },
    { value: 'RP2040', label: 'Raspberry Pi RP2040' },
    { value: 'nRF52840', label: 'Nordic nRF52840' },
    { value: 'Teensy 4.0', label: 'Teensy 4.0' },
    { value: 'Siemens S7-1200', label: 'Siemens S7-1200 (PLC)' },
    { value: 'Siemens S7-1500', label: 'Siemens S7-1500 (PLC)' },
    { value: 'Beckhoff TwinCAT', label: 'Beckhoff TwinCAT (PLC)' },
    { value: 'Generic IEC 61131-3 PLC', label: 'Generic IEC 61131-3 PLC' },
  ];

  let wasmReady = $state(false);

  onMount(async () => { 
    isBrowser = true; 
    // Initialize WASM in background
    try {
      await initWasm();
      wasmReady = true;
    } catch (e) {
      console.warn('WASM initialization failed:', e);
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
      // Server-side API key config is independent of client-side localStorage
      transpileResult = await orchestrator.transpile({
        sourceLang,
        targetLang,
        targetPlatform: platform,
        code: sourceCode
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

<div class="h-screen w-full flex flex-col overflow-hidden bg-background">
  <TopBar />
  
  <!-- Main content below topbar -->
  <div class="flex-1 flex flex-col overflow-auto pt-14">
    
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
            class="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs text-white font-mono focus:border-primary-container focus:outline-none transition-colors"
          >
            {#each platformOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
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
          {:else}
            <div class="h-full w-full flex items-center justify-center text-white/10 animate-pulse">
              <span class="material-symbols-outlined text-4xl">code</span>
            </div>
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

      <!-- Provider Settings Modal (outside conditionals) -->
      {#if showProviderSettings}
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showProviderSettings = false}>
          <div onclick={(e) => e.stopPropagation()} class="bg-surface-container-high border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
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

      <!-- Analysis Panels (shown after transpilation) -->
      {#if transpileResult}
        <div class="border-t border-white/5 bg-[#131221]">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
            <!-- Translation Notes -->
            <div class="bg-[#131221] p-4">
              <h3 class="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
                <span class="material-symbols-outlined text-xs text-blue-400">info</span>
                Translation Notes
              </h3>
              <div class="bg-black/30 rounded p-3 text-[10px] font-mono text-white/60 max-h-32 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                {transpileResult.notes || "No specific notes generated."}
              </div>
            </div>
            
            <!-- Verification -->
            <div class="bg-[#131221] p-4">
              <h3 class="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
                <span class="material-symbols-outlined text-xs text-green-400">check_circle</span>
                Verification & Hardware Check
              </h3>
              <div class="bg-black/30 rounded p-3 text-[10px] font-mono text-white/60 max-h-32 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                {transpileResult.verification || "Verification pending hardware test."}
              </div>
            </div>

            {#if transpileResult.optimizations}
              <div class="bg-[#131221] p-4 md:col-span-2">
                <h3 class="text-[10px] font-bold uppercase tracking-widest text-primary-container mb-2 flex items-center gap-2">
                  <span class="material-symbols-outlined text-xs">bolt</span>
                  Optimizations Applied
                </h3>
                <div class="bg-black/30 rounded p-3 text-[10px] font-mono text-primary-container/80 max-h-32 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                  {transpileResult.optimizations}
                </div>
              </div>
            {/if}

            {#if transpileResult.warnings}
              <div class="bg-[#131221] p-4 md:col-span-2">
                <h3 class="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-2">
                  <span class="material-symbols-outlined text-xs">warning</span>
                  Warnings
                </h3>
                <div class="bg-black/30 rounded p-3 text-[10px] font-mono text-amber-400/80 max-h-32 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                  {transpileResult.warnings}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(body) {
    overflow: hidden;
  }
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

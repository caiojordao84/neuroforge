<script lang="ts">
  /**
   * Provider Settings Component
   * 
   * UI for configuring AI provider settings.
   * API keys are stored in memory only (not persisted to localStorage).
   */

  import { providerState, isAIConfigured } from '../lib/ai/state/provider.svelte';
  import { APIKeyManager } from '../lib/ai/provider/api-key.manager';
  import type { AIProviderType } from '../lib/ai/provider/types';

  // Local state - API key input (stored in memory only via providerState)
  let openaiKey = $state('');
  let anthropicKey = $state('');
  let testStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let testMessage = $state('');

  // Provider options (removed 'local' - not needed with user-provided API)
  const providers = [
    { value: 'none', label: 'None (WASM only)', description: 'Use built-in WASM transpiler only' },
    { value: 'openai', label: 'OpenAI', description: 'Use your own OpenAI API key (from platform.openai.com)' },
    { value: 'anthropic', label: 'Anthropic Claude', description: 'Use your own Anthropic API key (from console.anthropic.com)' },
  ] as const;

  /**
   * Save provider settings (stores API key in memory only)
   */
  function saveProvider() {
    const type = $providerState.type;
    providerState.setType(type);
    
    // Store API key in memory (NOT localStorage)
    if (type === 'openai') {
      providerState.setApiKey(openaiKey);
    } else if (type === 'anthropic') {
      providerState.setApiKey(anthropicKey);
    } else if (type === 'none') {
      providerState.setApiKey('');
    }
    
    providerState.setError(null);
  }

  /**
   * Test connection to provider
   */
  async function testConnection() {
    testStatus = 'testing';
    testMessage = '';
    
    try {
      if ($providerState.type === 'none') {
        testStatus = 'error';
        testMessage = 'No provider configured';
        return;
      }
      
      // Get API key from state (in-memory)
      const apiKey = $providerState.apiKey;
      
      if (!apiKey) {
        testStatus = 'error';
        testMessage = 'API key not provided';
        return;
      }
      
      // For cloud providers, do a minimal API test
      const isOpenAI = $providerState.type === 'openai';
      const url = isOpenAI 
        ? 'https://api.openai.com/v1/models' 
        : 'https://api.anthropic.com/v1/messages';
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (isOpenAI) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }
      
      const response = await fetch(url, {
        method: isOpenAI ? 'GET' : 'POST',
        headers,
        body: isOpenAI ? undefined : JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      }).catch(() => null);
      
      if (response?.ok) {
        testStatus = 'success';
        testMessage = isOpenAI ? 'OpenAI key valid' : 'Anthropic key valid';
      } else if (response?.status === 401 || response?.status === 403) {
        testStatus = 'error';
        testMessage = 'Invalid API key';
      } else {
        testStatus = 'error';
        testMessage = 'API Error: ' + (response?.statusText || 'Unknown');
      }
    } catch (error) {
      testStatus = 'error';
      testMessage = error instanceof Error ? error.message : 'Connection test failed';
    }
  }

  /**
   * Clear all settings (clears in-memory API key)
   */
  function clearSettings() {
    providerState.reset();
    openaiKey = '';
    anthropicKey = '';
    testStatus = 'idle';
    testMessage = '';
  }
</script>

<div class="provider-settings p-4 bg-[#131221] rounded-lg border border-white/10">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm font-bold text-white flex items-center gap-2">
      <span class="material-symbols-outlined text-primary-container">psychology</span>
      AI Provider Settings
    </h3>
    {#if $isAIConfigured}
      <span class="text-[10px] font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
        CONFIGURED
      </span>
    {/if}
  </div>

  <!-- Provider Type -->
  <div class="mb-4">
    <label for="provider-type" class="block text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 mb-2">
      AI Provider
    </label>
    <select 
      id="provider-type"
      bind:value={$providerState.type}
      onchange={() => saveProvider()}
      class="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono focus:border-primary-container focus:outline-none transition-colors"
    >
      {#each providers as p}
        <option value={p.value}>{p.label}</option>
      {/each}
    </select>
    <p class="text-[10px] text-white/40 mt-1">
      {providers.find(p => p.value === $providerState.type)?.description}
    </p>
  </div>

  <!-- OpenAI API Key -->
  {#if $providerState.type === 'openai'}
    <div class="mb-4">
      <label for="openai-key" class="block text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 mb-2">
        OpenAI API Key
      </label>
      <input 
        id="openai-key"
        type="password" 
        bind:value={openaiKey}
        placeholder="sk-..."
        class="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono focus:border-primary-container focus:outline-none transition-colors"
      />
      <p class="text-[10px] text-white/40 mt-1">
        Get your API key from platform.openai.com
      </p>
    </div>
  {/if}

  <!-- Anthropic API Key -->
  {#if $providerState.type === 'anthropic'}
    <div class="mb-4">
      <label for="anthropic-key" class="block text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 mb-2">
        Anthropic API Key
      </label>
      <input 
        id="anthropic-key"
        type="password" 
        bind:value={anthropicKey}
        placeholder="sk-ant-..."
        class="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono focus:border-primary-container focus:outline-none transition-colors"
      />
      <p class="text-[10px] text-white/40 mt-1">
        Get your API key from console.anthropic.com
      </p>
    </div>
  {/if}

  <!-- Test Status -->
  {#if testStatus !== 'idle'}
    <div class="mb-4 p-2 rounded text-xs font-mono {testStatus === 'success' ? 'bg-green-400/10 text-green-400' : testStatus === 'error' ? 'bg-red-400/10 text-red-400' : 'bg-blue-400/10 text-blue-400'}">
      {#if testStatus === 'testing'}
        <span class="inline-block w-2 h-2 border border-current border-t-transparent rounded-full animate-spin mr-2"></span>
      {/if}
      {testMessage}
    </div>
  {/if}

  <!-- Error Message -->
  {#if $providerState.error}
    <div class="mb-4 p-2 rounded bg-red-400/10 text-red-400 text-xs font-mono">
      {$providerState.error}
    </div>
  {/if}

  <!-- Buttons -->
  <div class="flex gap-2">
    <button 
      onclick={saveProvider}
      class="flex-1 px-3 py-2 bg-primary-container text-black text-xs font-bold uppercase tracking-wider rounded hover:brightness-110 active:scale-95 transition-all"
    >
      Save
    </button>
    <button 
      onclick={testConnection}
      disabled={$providerState.type === 'none' || testStatus === 'testing'}
      class="px-3 py-2 bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
    >
      Test
    </button>
    <button 
      onclick={clearSettings}
      class="px-3 py-2 bg-white/5 text-white/50 text-xs font-bold uppercase tracking-wider rounded hover:bg-white/10 active:scale-95 transition-all"
    >
      Clear
    </button>
  </div>
</div>

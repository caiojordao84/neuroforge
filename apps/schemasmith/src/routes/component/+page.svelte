<script lang="ts">
  import { open, save } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  import { readTextFile } from '@tauri-apps/plugin-fs';
  
  import ComponentSvgCanvas from '../components/ComponentSvgCanvas.svelte';
  import SignalPanel from '../components/SignalPanel.svelte';
  import ComponentMetaForm from '../components/ComponentMetaForm.svelte';
  import AslHintForm from '../components/AslHintForm.svelte';
  import RestrictionsForm from '../components/RestrictionsForm.svelte';
  
  import { 
    setComponentSvgContent, 
    componentStore, 
    newComponent, 
    isComponentValid,
    componentToonJson,
    loadComponent
  } from '$lib/componentStore.svelte';
  import type { ToonComponent } from '$lib/types';
  
  let loading = false;
  let exportError = '';
  let exportSuccess = '';
  let copied = false;
  
  // Load SVG file using Tauri dialog
  async function handleLoadSvg() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'SVG',
          extensions: ['svg']
        }]
      });
      
      if (selected && typeof selected === 'string') {
        loading = true;
        const content = await readTextFile(selected);
        setComponentSvgContent(content);
      }
    } catch (err) {
      console.error('Failed to load SVG:', err);
    } finally {
      loading = false;
    }
  }
  
  // Load existing component TOON file
  async function handleLoadToon() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'TOON',
          extensions: ['json', 'toon']
        }]
      });
      
      if (selected && typeof selected === 'string') {
        loading = true;
        const content = await readTextFile(selected);
        const component = JSON.parse(content) as ToonComponent;
        loadComponent(component);
      }
    } catch (err) {
      console.error('Failed to load TOON:', err);
    } finally {
      loading = false;
    }
  }
  
  // Export TOON file
  async function handleExport() {
    if (!$isComponentValid) {
      exportError = 'Fix validation errors before exporting';
      return;
    }
    
    try {
      const defaultName = $componentStore.component.id 
        ? `${$componentStore.component.id}.toon` 
        : 'component.toon';
      
      const savePath = await save({
        defaultPath: defaultName,
        filters: [{
          name: 'TOON',
          extensions: ['toon', 'json']
        }]
      });
      
      if (savePath) {
        loading = true;
        const result = await invoke<string>('export_toon', {
          toon: $componentToonJson,
          outputPath: savePath
        });
        exportSuccess = `Exported to ${result}`;
        exportError = '';
        setTimeout(() => exportSuccess = '', 3000);
      }
    } catch (err) {
      exportError = String(err);
      console.error('Failed to export:', err);
    } finally {
      loading = false;
    }
  }
  
  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText($componentToonJson);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
  
  function handleNewComponent() {
    newComponent();
    exportError = '';
    exportSuccess = '';
  }
</script>

<div class="app">
  <header class="app-header">
    <div class="logo">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M9 21V9"/>
      </svg>
      <span>SchemaSmith</span>
      <span class="mode-badge">Component Mode</span>
    </div>
    
    <div class="mode-switcher">
      <a href="/" class="mode-btn">Board</a>
      <a href="/component" class="mode-btn active">Component</a>
    </div>
    
    <div class="toolbar">
      <button class="toolbar-btn" on:click={handleNewComponent}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        New
      </button>
      
      <button class="toolbar-btn" on:click={handleLoadSvg}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Load SVG
      </button>
      
      <button class="toolbar-btn" on:click={handleLoadToon}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Load TOON
      </button>
      
      <button 
        class="toolbar-btn primary" 
        on:click={handleExport}
        disabled={!$isComponentValid || loading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
      </button>
    </div>
  </header>
  
  {#if exportError}
    <div class="alert error">{exportError}</div>
  {/if}
  
  {#if exportSuccess}
    <div class="alert success">{exportSuccess}</div>
  {/if}
  
  <main class="app-main">
    <div class="sidebar">
      <SignalPanel />
      <AslHintForm />
      <RestrictionsForm />
    </div>
    
    <div class="workspace">
      <ComponentSvgCanvas />
    </div>
    
    <div class="right-panel">
      <ComponentMetaForm />
      <div class="toon-preview">
        <div class="preview-header">
          <h3>TOON Preview</h3>
          <button class="btn-copy" on:click={copyToClipboard}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        
        <div class="preview-content">
          <pre><code>{$componentToonJson}</code></pre>
        </div>
        
        <div class="preview-footer">
          <span class="status">
            {#if $isComponentValid}
              <span class="dot valid"></span> Ready to export
            {:else}
              <span class="dot invalid"></span> Fix errors first
            {/if}
          </span>
        </div>
      </div>
    </div>
  </main>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-primary);
  }
  
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--accent-primary);
    font-weight: 600;
    font-size: 16px;
  }
  
  .mode-badge {
    padding: 3px 8px;
    background: var(--accent-secondary);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: white;
  }
  
  .toolbar {
    display: flex;
    gap: 8px;
  }
  
  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .toolbar-btn:hover:not(:disabled) {
    border-color: var(--accent-primary);
    background: var(--bg-secondary);
  }
  
  .toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .toolbar-btn.primary {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: white;
  }
  
  .toolbar-btn.primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .alert {
    padding: 10px 20px;
    font-size: 13px;
    text-align: center;
  }
  
  .alert.error {
    background: rgba(255, 71, 87, 0.15);
    color: var(--error);
    border-bottom: 1px solid var(--error);
  }
  
  .alert.success {
    background: rgba(0, 210, 106, 0.15);
    color: var(--success);
    border-bottom: 1px solid var(--success);
  }
  
  .app-main {
    display: grid;
    grid-template-columns: 300px 1fr 320px;
    gap: 16px;
    padding: 16px;
    flex: 1;
    min-height: 0;
  }
  
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }
  
  .workspace {
    min-height: 0;
  }
  
  .right-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }
  
  .toon-preview {
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 200px;
  }
  
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .preview-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  
  .btn-copy {
    padding: 4px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
  }
  
  .btn-copy:hover {
    border-color: var(--accent-primary);
  }
  
  .preview-content {
    flex: 1;
    overflow: auto;
    padding: 12px;
    background: #0d0d14;
  }
  
  .preview-content pre {
    margin: 0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.5;
    color: #a0a0a0;
  }
  
  .preview-footer {
    padding: 8px 16px;
    background: var(--bg-primary);
    border-top: 1px solid var(--border-color);
  }
  
  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  .dot.valid {
    background: var(--success);
  }
  
  .dot.invalid {
    background: var(--error);
  }
  
  .mode-badge {
    padding: 3px 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
  }
  
  .mode-switcher {
    display: flex;
    gap: 4px;
    background: var(--bg-tertiary);
    padding: 3px;
    border-radius: 6px;
  }
  
  .mode-btn {
    padding: 6px 14px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 13px;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .mode-btn:hover {
    color: var(--text-primary);
  }
  
  .mode-btn.active {
    background: var(--accent-primary);
    color: white;
  }
</style>

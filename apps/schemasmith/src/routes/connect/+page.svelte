<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { readTextFile } from '@tauri-apps/plugin-fs';
  import { save } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  
  import ConnectionCanvas from '$lib/components/ConnectionCanvas.svelte';
  import ConnectionValidator from '$lib/components/ConnectionValidator.svelte';
  
  import { 
    canvasElements, 
    connections, 
    clearCanvas,
    addBoard,
    addComponent,
    getConnectionsForExport,
    validationSummary
  } from '$lib/connectionStore.svelte';
  import { boardStore } from '$lib/boardStore.svelte';
  import { componentStore } from '$lib/componentStore.svelte';
  import { parseToon } from '$lib/toon-serializer';
  import type { ToonBoard, ToonComponent } from '$lib/types';
  
  let loading = false;
  let exportSuccess = '';
  let exportError = '';
  
  // Load board from TOON file
  async function handleLoadBoard() {
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
        const board = parseToon(content) as ToonBoard;
        
        // Add board to canvas
        addBoard(board.board.id, board.board.name, '', board.pins);
      }
    } catch (err) {
      console.error('Failed to load board:', err);
      exportError = String(err);
    } finally {
      loading = false;
    }
  }
  
  // Load component from TOON file
  async function handleLoadComponent() {
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
        
        // Add component to canvas
        addComponent(component.component.id, component.component.name, '', component.signals);
      }
    } catch (err) {
      console.error('Failed to load component:', err);
      exportError = String(err);
    } finally {
      loading = false;
    }
  }
  
  // Load board from current editor
  function handleLoadCurrentBoard() {
    if ($boardStore.board.id) {
      addBoard($boardStore.board.id, $boardStore.name || $boardStore.board.name, '', $boardStore.pins);
    }
  }
  
  // Load component from current editor
  function handleLoadCurrentComponent() {
    if ($componentStore.component.id) {
      addComponent($componentStore.component.id, $componentStore.component.name, '', $componentStore.signals);
    }
  }
  
  // Export connections to TOON format
  async function handleExport() {
    try {
      const conns = getConnectionsForExport();
      
      if (conns.length === 0) {
        exportError = 'No connections to export';
        return;
      }
      
      const defaultName = 'connections.toon';
      const savePath = await save({
        defaultPath: defaultName,
        filters: [{
          name: 'TOON',
          extensions: ['toon', 'json']
        }]
      });
      
      if (savePath) {
        loading = true;
        
        // Format connections for export
        const toonContent = {
          version: '1.0.0',
          connections: conns.map(c => ({
            boardPin: c.boardPinId,
            componentAnchor: c.signalId,
            signalType: c.signalType,
            validated: c.validated
          }))
        };
        
        const result = await invoke<string>('export_toon', {
          toon: JSON.stringify(toonContent, null, 2),
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
  
  // Clear canvas
  function handleClear() {
    clearCanvas();
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
      <span class="mode-badge">Connection Mode</span>
    </div>
    
    <div class="mode-switcher">
      <a href="/" class="mode-btn">Board</a>
      <a href="/component" class="mode-btn">Component</a>
      <a href="/connect" class="mode-btn active">Connect</a>
    </div>
    
    <div class="toolbar">
      <button class="toolbar-btn" on:click={handleLoadBoard}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6"/>
        </svg>
        Load Board
      </button>
      
      <button class="toolbar-btn" on:click={handleLoadComponent}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6"/>
        </svg>
        Load Component
      </button>
      
      <div class="divider"></div>
      
      <button class="toolbar-btn" on:click={handleLoadCurrentBoard} disabled={!$boardStore.board.id}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
        </svg>
        Current Board
      </button>
      
      <button class="toolbar-btn" on:click={handleLoadCurrentComponent} disabled={!$componentStore.component.id}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        Current Component
      </button>
      
      <div class="divider"></div>
      
      <button class="toolbar-btn" on:click={handleClear}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Clear
      </button>
      
      <button 
        class="toolbar-btn primary" 
        on:click={handleExport}
        disabled={$connections.length === 0 || loading}
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
    <div class="canvas-area">
      <ConnectionCanvas />
    </div>
    
    <div class="side-panel">
      <ConnectionValidator />
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
  
  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .divider {
    width: 1px;
    height: 24px;
    background: var(--border-color);
    margin: 0 4px;
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
    grid-template-columns: 1fr 350px;
    gap: 16px;
    padding: 16px;
    flex: 1;
    min-height: 0;
  }
  
  .canvas-area {
    min-height: 0;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
  }
  
  .side-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }
</style>
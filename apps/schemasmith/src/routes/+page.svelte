<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';
  import { readTextFile } from '@tauri-apps/plugin-fs';
  
  import SvgCanvas from './components/SvgCanvas.svelte';
  import PinPanel from './components/PinPanel.svelte';
  import BoardMetaForm from './components/BoardMetaForm.svelte';
  import ValidationReport from './components/ValidationReport.svelte';
  import ToonPreview from './components/ToonPreview.svelte';
  
  import { 
    setSvgContent, 
    boardStore, 
    newBoard, 
    isValid,
    toonJson,
    loadBoard
  } from '$lib/boardStore.svelte';
  import { parseToon } from '$lib/toon-serializer';
  import type { ValidationResult } from '$lib/types';
  import { validateBoard, loadBoardFromFile, exportBoardToon } from '$lib/tauri-api';
  
  let loading = false;
  let exportError = '';
  let exportSuccess = '';
  
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
        setSvgContent(content);
      }
    } catch (err) {
      console.error('Failed to load SVG:', err);
    } finally {
      loading = false;
    }
  }
  
  // Load existing TOON file using backend validation
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
        // Use backend to load and validate
        const content = await loadBoardFromFile(selected);
        const board = parseToon(content);
        loadBoard(board);
      }
    } catch (err) {
      console.error('Failed to load TOON:', err);
    } finally {
      loading = false;
    }
  }
  
  // Export TOON file using backend validation
  async function handleExport() {
    if (!$isValid) {
      exportError = 'Fix validation errors before exporting';
      return;
    }
    
    try {
      const defaultName = $boardStore.board.id 
        ? `${$boardStore.board.id}.toon` 
        : 'board.toon';
      
      const savePath = await save({
        defaultPath: defaultName,
        filters: [{
          name: 'TOON',
          extensions: ['toon', 'json']
        }]
      });
      
      if (savePath) {
        loading = true;
        
        // Validate using backend first
        const validation = await validateBoard($toonJson);
        
        if (!validation.valid) {
          const errorMessages = validation.errors.map(e => e.message).join('; ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
        // Export using backend
        await exportBoardToon($boardStore, savePath);
        
        exportSuccess = `Exported to ${savePath}`;
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
  
  function handleNewBoard() {
    newBoard();
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
      <span class="mode-badge">Board Mode</span>
    </div>
    
    <div class="mode-switcher">
      <a href="/" class="mode-btn active">Board</a>
      <a href="/component" class="mode-btn">Component</a>
      <a href="/connect" class="mode-btn">Connect</a>
    </div>
    
    <div class="toolbar">
      <button class="toolbar-btn" on:click={handleNewBoard}>
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
        disabled={!$isValid || loading}
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
      <PinPanel />
      <ValidationReport />
    </div>
    
    <div class="workspace">
      <SvgCanvas />
    </div>
    
    <div class="right-panel">
      <BoardMetaForm />
      <ToonPreview />
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
</style>

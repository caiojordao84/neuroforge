<script lang="ts">
  import { 
    componentStore, 
    selectedSignal, 
    addOrUpdateSignal, 
    removeSignal, 
    selectSignal 
  } from '$lib/componentStore.svelte';
  import { SIGNAL_TYPES, SIGNAL_DIRECTIONS } from '$lib/types';
  import type { SignalAnchor } from '$lib/types';
  
  // Get the currently selected signal data
  let currentSignal: SignalAnchor | null = null;
  
  $: {
    const signalId = $selectedSignal;
    if (signalId !== null) {
      currentSignal = $componentStore.signals.find(s => s.id === signalId) || null;
    } else {
      currentSignal = null;
    }
  }
  
  // Form fields
  let signalId = '';
  let name = '';
  let direction: SignalAnchor['direction'] = 'input';
  let signalType: SignalAnchor['signalType'] = 'digital';
  
  // Sync form with selected signal
  $: if (currentSignal) {
    signalId = currentSignal.id;
    name = currentSignal.name;
    direction = currentSignal.direction;
    signalType = currentSignal.signalType;
  } else if ($selectedSignal !== null && $selectedSignal !== '') {
    // Initialize from first signal if any
    const firstSignal = $componentStore.signals[0];
    if (firstSignal) {
      signalId = firstSignal.id;
      name = firstSignal.name;
      direction = firstSignal.direction;
      signalType = firstSignal.signalType;
    }
  }
  
  function handleSave() {
    if (!signalId || !name) return;
    
    addOrUpdateSignal({
      id: signalId,
      name,
      direction,
      signalType,
      x: currentSignal?.x || 0,
      y: currentSignal?.y || 0
    });
  }
  
  function handleDelete() {
    if ($selectedSignal) {
      removeSignal($selectedSignal);
    }
  }
  
  function handleClose() {
    selectSignal(null);
  }
  
  function handleSelectSignal(id: string) {
    selectSignal(id);
  }
</script>

<div class="signal-panel">
  <div class="panel-header">
    <h3>Signal Configuration</h3>
    {#if $selectedSignal}
      <button class="close-btn" on:click={handleClose}>×</button>
    {/if}
  </div>
  
  {#if $selectedSignal !== null && currentSignal}
    <div class="form-content">
      <div class="form-group">
        <label for="signalId">Signal ID</label>
        <input 
          type="text" 
          id="signalId" 
          bind:value={signalId}
          placeholder="e.g., signal-vcc, signal-out"
        />
      </div>
      
      <div class="form-group">
        <label for="name">Name</label>
        <input 
          type="text" 
          id="name" 
          bind:value={name}
          placeholder="e.g., VCC, AO, DATA"
        />
      </div>
      
      <div class="form-group">
        <label for="direction">Direction</label>
        <select id="direction" bind:value={direction}>
          {#each SIGNAL_DIRECTIONS as dir}
            <option value={dir.value}>{dir.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="form-group">
        <label for="signalType">Signal Type</label>
        <select id="signalType" bind:value={signalType}>
          {#each SIGNAL_TYPES as type}
            <option value={type.value}>{type.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="form-actions">
        <button class="btn-save" on:click={handleSave}>Save Signal</button>
        <button class="btn-delete" on:click={handleDelete}>Delete</button>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>Click on an anchor in the canvas to configure signals</p>
      
      {#if $componentStore.signals.length > 0}
        <div class="signal-list">
          <h4>Configured Signals</h4>
          <ul>
            {#each $componentStore.signals as signal}
              <li>
                <button 
                  class="signal-item"
                  class:input={signal.direction === 'input'}
                  class:output={signal.direction === 'output'}
                  class:bidirectional={signal.direction === 'bidirectional'}
                  on:click={() => handleSelectSignal(signal.id)}
                >
                  <span class="signal-id">{signal.id}</span>
                  <span class="signal-name">{signal.name}</span>
                  <span class="signal-type">{signal.signalType}</span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .signal-panel {
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    min-width: 280px;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  
  .close-btn:hover {
    color: var(--text-primary);
  }
  
  .form-content {
    padding: 16px;
  }
  
  .form-group {
    margin-bottom: 12px;
  }
  
  .form-group label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
  
  .form-group input[type="text"],
  .form-group select {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 13px;
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--accent-primary);
  }
  
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  
  .btn-save {
    flex: 1;
    padding: 8px 12px;
    background: var(--accent-primary);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }
  
  .btn-save:hover {
    opacity: 0.9;
  }
  
  .btn-delete {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--error);
    border-radius: 4px;
    color: var(--error);
    font-size: 13px;
    cursor: pointer;
  }
  
  .btn-delete:hover {
    background: var(--error);
    color: white;
  }
  
  .empty-state {
    padding: 16px;
    text-align: center;
    color: var(--text-secondary);
  }
  
  .empty-state p {
    margin: 0 0 16px;
    font-size: 13px;
  }
  
  .signal-list h4 {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .signal-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .signal-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin-bottom: 4px;
    cursor: pointer;
    text-align: left;
  }
  
  .signal-item:hover {
    border-color: var(--accent-primary);
  }
  
  .signal-item.input {
    border-left: 3px solid #4ecdc4;
  }
  
  .signal-item.output {
    border-left: 3px solid #ff6b6b;
  }
  
  .signal-item.bidirectional {
    border-left: 3px solid #ffd93d;
  }
  
  .signal-id {
    font-weight: 600;
    color: var(--accent-primary);
    font-size: 11px;
    min-width: 60px;
  }
  
  .signal-name {
    flex: 1;
    font-size: 12px;
    color: var(--text-primary);
  }
  
  .signal-type {
    font-size: 10px;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 3px;
  }
</style>

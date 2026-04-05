<script lang="ts">
  import { 
    componentStore, 
    addOrUpdateAslHint, 
    removeAslHint 
  } from '$lib/componentStore.svelte';
  import { HMI_WIDGETS } from '$lib/types';
  import type { AslHint } from '$lib/types';
  
  let editingHint: AslHint | null = null;
  let isAdding = false;
  
  // Form fields
  let semanticType = '';
  let defaultOperation = 'read';
  let include = true;
  let hmiWidget: string | null = null;
  let hmiUnit: string | null = null;
  let hmiMin: number | null = null;
  let hmiMax: number | null = null;
  
  function startAdd() {
    isAdding = true;
    editingHint = null;
    resetForm();
  }
  
  function startEdit(hint: AslHint) {
    isAdding = false;
    editingHint = hint;
    semanticType = hint.semanticType;
    defaultOperation = hint.defaultOperation;
    include = hint.include;
    hmiWidget = hint.hmiWidget;
    hmiUnit = hint.hmiUnit;
    hmiMin = hint.hmiMin;
    hmiMax = hint.hmiMax;
  }
  
  function resetForm() {
    semanticType = '';
    defaultOperation = 'read';
    include = true;
    hmiWidget = null;
    hmiUnit = null;
    hmiMin = null;
    hmiMax = null;
    editingHint = null;
    isAdding = false;
  }
  
  function handleSave() {
    if (!semanticType) return;
    
    addOrUpdateAslHint({
      semanticType,
      defaultOperation,
      include,
      hmiWidget,
      hmiUnit: hmiUnit || null,
      hmiMin: hmiMin ?? null,
      hmiMax: hmiMax ?? null
    });
    
    resetForm();
  }
  
  function handleDelete(semanticTypeToDelete: string) {
    removeAslHint(semanticTypeToDelete);
    if (editingHint?.semanticType === semanticTypeToDelete) {
      resetForm();
    }
  }
  
  function handleCancel() {
    resetForm();
  }
</script>

<div class="aslhint-form">
  <div class="panel-header">
    <h3>ASL Hints</h3>
    <button class="add-btn" on:click={startAdd} disabled={isAdding}>
      + Add
    </button>
  </div>
  
  <div class="form-content">
    {#if isAdding || editingHint}
      <div class="hint-form">
        <div class="form-group">
          <label for="semanticType">Semantic Type</label>
          <input 
            type="text" 
            id="semanticType" 
            bind:value={semanticType}
            placeholder="e.g., temperature, motor.speed"
            disabled={!!editingHint}
          />
          <span class="hint">Unique identifier (e.g., temperature, light.intensity)</span>
        </div>
        
        <div class="form-group">
          <label for="defaultOperation">Default Operation</label>
          <select id="defaultOperation" bind:value={defaultOperation}>
            <option value="read">Read</option>
            <option value="write">Write</option>
            <option value="read-write">Read/Write</option>
          </select>
        </div>
        
        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={include} />
            Include in ASL
          </label>
        </div>
        
        <div class="form-group">
          <label for="hmiWidget">HMI Widget</label>
          <select id="hmiWidget" bind:value={hmiWidget}>
            <option value={null}>-- None --</option>
            {#each HMI_WIDGETS as widget}
              <option value={widget.value}>{widget.label}</option>
            {/each}
          </select>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="hmiUnit">HMI Unit</label>
            <input 
              type="text" 
              id="hmiUnit" 
              bind:value={hmiUnit}
              placeholder="e.g., °C, %, Hz"
            />
          </div>
          
          <div class="form-group">
            <label for="hmiMin">HMI Min</label>
            <input 
              type="number" 
              id="hmiMin" 
              bind:value={hmiMin}
              placeholder="Min"
            />
          </div>
          
          <div class="form-group">
            <label for="hmiMax">HMI Max</label>
            <input 
              type="number" 
              id="hmiMax" 
              bind:value={hmiMax}
              placeholder="Max"
            />
          </div>
        </div>
        
        <div class="form-actions">
          <button class="btn-save" on:click={handleSave}>
            {editingHint ? 'Update' : 'Add'}
          </button>
          <button class="btn-cancel" on:click={handleCancel}>Cancel</button>
        </div>
      </div>
    {/if}
    
    {#if $componentStore.asl_hints.length > 0}
      <div class="hint-list">
        {#each $componentStore.asl_hints as hint}
          <div class="hint-item" class:editing={editingHint?.semanticType === hint.semanticType}>
            <div class="hint-info">
              <span class="hint-semantic">{hint.semanticType}</span>
              <span class="hint-operation">{hint.defaultOperation}</span>
              {#if hint.hmiWidget}
                <span class="hint-widget">{hint.hmiWidget}</span>
              {/if}
            </div>
            <div class="hint-actions">
              <button class="edit-btn" on:click={() => startEdit(hint)}>Edit</button>
              <button class="delete-btn" on:click={() => handleDelete(hint.semanticType)}>×</button>
            </div>
          </div>
        {/each}
      </div>
    {:else if !isAdding}
      <div class="empty-state">
        <p>No ASL hints configured. Click "+ Add" to create one.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .aslhint-form {
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
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
  
  .add-btn {
    padding: 4px 10px;
    background: var(--accent-primary);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    cursor: pointer;
  }
  
  .add-btn:hover {
    opacity: 0.9;
  }
  
  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .form-content {
    padding: 16px;
  }
  
  .hint-form {
    padding: 12px;
    background: var(--bg-primary);
    border-radius: 6px;
    margin-bottom: 16px;
  }
  
  .form-group {
    margin-bottom: 10px;
  }
  
  .form-group label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
  
  .form-group input[type="text"],
  .form-group input[type="number"],
  .form-group select {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg-secondary);
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
  
  .form-group input:disabled {
    opacity: 0.6;
  }
  
  .form-group .hint {
    display: block;
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 2px;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  
  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
  }
  
  .checkbox-group input[type="checkbox"] {
    accent-color: var(--accent-primary);
  }
  
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  
  .btn-save {
    flex: 1;
    padding: 8px 12px;
    background: var(--accent-primary);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 13px;
    cursor: pointer;
  }
  
  .btn-cancel {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
  }
  
  .hint-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .hint-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }
  
  .hint-item.editing {
    border-color: var(--accent-primary);
  }
  
  .hint-info {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .hint-semantic {
    font-weight: 500;
    font-size: 12px;
    color: var(--text-primary);
  }
  
  .hint-operation {
    font-size: 10px;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 3px;
  }
  
  .hint-widget {
    font-size: 10px;
    color: var(--accent-primary);
    background: rgba(233, 69, 96, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
  }
  
  .hint-actions {
    display: flex;
    gap: 4px;
  }
  
  .edit-btn, .delete-btn {
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
  }
  
  .edit-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  
  .delete-btn {
    border-color: var(--error);
    color: var(--error);
  }
  
  .delete-btn:hover {
    background: var(--error);
    color: white;
  }
  
  .empty-state {
    text-align: center;
    color: var(--text-secondary);
    font-size: 13px;
  }
</style>

<script lang="ts">
  import { componentStore, updateRestrictions } from '$lib/componentStore.svelte';
  
  let requiresPwm = $componentStore.restrictions.requiresPwm;
  let requiresAdc = $componentStore.restrictions.requiresAdc;
  let maxCurrentMa: number | null = $componentStore.restrictions.maxCurrentMa;
  let notes = $componentStore.restrictions.notes || '';
  
  // Sync with store
  $: {
    requiresPwm = $componentStore.restrictions.requiresPwm;
    requiresAdc = $componentStore.restrictions.requiresAdc;
    maxCurrentMa = $componentStore.restrictions.maxCurrentMa;
    notes = $componentStore.restrictions.notes || '';
  }
  
  function handleSave() {
    updateRestrictions({
      requiresPwm,
      requiresAdc,
      maxCurrentMa: maxCurrentMa ?? null,
      notes: notes || null
    });
  }
</script>

<div class="restrictions-form">
  <div class="panel-header">
    <h3>Restrictions</h3>
  </div>
  
  <div class="form-content">
    <div class="form-group checkbox-group">
      <label>
        <input type="checkbox" bind:checked={requiresPwm} on:change={handleSave} />
        Requires PWM
      </label>
      <span class="hint">Component needs PWM output capability</span>
    </div>
    
    <div class="form-group checkbox-group">
      <label>
        <input type="checkbox" bind:checked={requiresAdc} on:change={handleSave} />
        Requires ADC
      </label>
      <span class="hint">Component needs analog-to-digital converter</span>
    </div>
    
    <div class="form-group">
      <label for="maxCurrentMa">Max Current (mA)</label>
      <input 
        type="number" 
        id="maxCurrentMa" 
        bind:value={maxCurrentMa}
        on:change={handleSave}
        min="0"
        placeholder="e.g., 500"
      />
      <span class="hint">Maximum current draw in milliamps</span>
    </div>
    
    <div class="form-group">
      <label for="notes">Notes</label>
      <textarea 
        id="notes" 
        bind:value={notes}
        on:change={handleSave}
        placeholder="Additional requirements, warnings, or setup notes..."
        rows="3"
      ></textarea>
    </div>
  </div>
</div>

<style>
  .restrictions-form {
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
  }
  
  .panel-header {
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  
  .form-content {
    padding: 16px;
  }
  
  .form-group {
    margin-bottom: 12px;
  }
  
  .form-group label {
    display: block;
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
  
  .form-group .hint {
    display: block;
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 2px;
  }
  
  .form-group input[type="number"],
  .form-group textarea {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 13px;
  }
  
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--accent-primary);
  }
  
  .checkbox-group {
    padding: 8px 0;
  }
  
  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
  }
  
  .checkbox-group input[type="checkbox"] {
    accent-color: var(--accent-primary);
    width: 16px;
    height: 16px;
  }
</style>

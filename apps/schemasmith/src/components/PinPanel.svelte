<script lang="ts">
  import { boardStore, selectedPin, addOrUpdatePin, removePin, selectPin, extractedPins } from '$lib/boardStore.svelte';
  import type { PinDefinition } from '$lib/types';
  
  // Get the currently selected pin data
  let currentPin: PinDefinition | null = null;
  
  $: {
    const pinNum = $selectedPin;
    if (pinNum !== null) {
      currentPin = $boardStore.pins.find(p => p.logical_pin === pinNum) || null;
    } else {
      currentPin = null;
    }
  }
  
  // Get extracted pin info for auto-fill
  function getExtractedPin(pinNum: number) {
    return $extractedPins.find(p => parseInt(p.data.pin || '0', 10) === pinNum);
  }
  
  // Form fields
  let logicalPin = $selectedPin ?? 0;
  let physicalPin: number | null = null;
  let label = '';
  let pwm = false;
  let interrupt = false;
  let adc = false;
  let dac = false;
  let touch = false;
  let inputOnly = false;
  let strapping = false;
  let warning = '';
  
  // Sync form with selected pin
  $: if (currentPin) {
    logicalPin = currentPin.logical_pin;
    physicalPin = currentPin.physical_pin;
    label = currentPin.label;
    pwm = currentPin.pwm;
    interrupt = currentPin.interrupt;
    adc = currentPin.adc;
    dac = currentPin.dac;
    touch = currentPin.touch;
    inputOnly = currentPin.input_only;
    strapping = currentPin.strapping;
    warning = currentPin.warning || '';
  } else if ($selectedPin !== null) {
    // Initialize from extracted data
    const extracted = getExtractedPin($selectedPin);
    if (extracted) {
      logicalPin = $selectedPin;
      label = extracted.data.label || extracted.data.pin || `GP${$selectedPin}`;
      pwm = extracted.data.pwm === 'true';
      interrupt = extracted.data.interrupt === 'true';
      adc = extracted.data.adc === 'true';
    }
  }
  
  function handleSave() {
    addOrUpdatePin({
      logical_pin: logicalPin,
      physical_pin: physicalPin,
      label,
      pwm,
      interrupt,
      adc,
      dac,
      touch,
      input_only: inputOnly,
      strapping,
      warning: warning || null
    });
  }
  
  function handleDelete() {
    if ($selectedPin !== null) {
      removePin($selectedPin);
    }
  }
  
  function handleClose() {
    selectPin(null);
  }
</script>

<div class="pin-panel">
  <div class="panel-header">
    <h3>Pin Configuration</h3>
    <button class="close-btn" on:click={handleClose}>×</button>
  </div>
  
  {#if $selectedPin !== null}
    <div class="form-content">
      <div class="form-group">
        <label for="logicalPin">Logical Pin</label>
        <input 
          type="number" 
          id="logicalPin" 
          bind:value={logicalPin}
          min="0"
          max="255"
        />
      </div>
      
      <div class="form-group">
        <label for="physicalPin">Physical Pin</label>
        <input 
          type="number" 
          id="physicalPin" 
          bind:value={physicalPin}
          min="0"
        />
      </div>
      
      <div class="form-group">
        <label for="label">Label</label>
        <input 
          type="text" 
          id="label" 
          bind:value={label}
          placeholder="e.g., GP0, LED_BUILTIN"
        />
      </div>
      
      <div class="form-group checkbox-group">
        <label>
          <input type="checkbox" bind:checked={pwm} />
          PWM
        </label>
        <label>
          <input type="checkbox" bind:checked={interrupt} />
          Interrupt
        </label>
        <label>
          <input type="checkbox" bind:checked={adc} />
          ADC
        </label>
        <label>
          <input type="checkbox" bind:checked={dac} />
          DAC
        </label>
      </div>
      
      <div class="form-group checkbox-group">
        <label>
          <input type="checkbox" bind:checked={touch} />
          Touch
        </label>
        <label>
          <input type="checkbox" bind:checked={inputOnly} />
          Input Only
        </label>
        <label>
          <input type="checkbox" bind:checked={strapping} />
          Strapping
        </label>
      </div>
      
      <div class="form-group">
        <label for="warning">Warning</label>
        <textarea 
          id="warning" 
          bind:value={warning}
          placeholder="Optional warning message..."
          rows="2"
        ></textarea>
      </div>
      
      <div class="form-actions">
        <button class="btn-save" on:click={handleSave}>Save Pin</button>
        <button class="btn-delete" on:click={handleDelete}>Delete</button>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>Click on a pin in the canvas to configure it</p>
      
      {#if $boardStore.pins.length > 0}
        <div class="pin-list">
          <h4>Configured Pins</h4>
          <ul>
            {#each $boardStore.pins as pin}
              <li>
                <button 
                  class="pin-item"
                  class:has-warning={pin.warning}
                  on:click={() => selectPin(pin.logical_pin)}
                >
                  <span class="pin-number">{pin.logical_pin}</span>
                  <span class="pin-label">{pin.label}</span>
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
  .pin-panel {
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
    display: grid;
    grid-template-columns: repeat(2, 1fr);
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
  
  .pin-list h4 {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .pin-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .pin-item {
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
  
  .pin-item:hover {
    border-color: var(--accent-primary);
  }
  
  .pin-item.has-warning {
    border-color: var(--warning);
  }
  
  .pin-number {
    font-weight: 600;
    color: var(--accent-primary);
    min-width: 24px;
  }
  
  .pin-label {
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>

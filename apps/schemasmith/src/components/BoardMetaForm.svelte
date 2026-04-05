<script lang="ts">
  import { boardStore, updateBoardMeta } from '$lib/boardStore.svelte';
  import { SUPPORTED_LANGUAGES, ASL_PROFILES } from '$lib/types';
  
  let id = $boardStore.board.id;
  let name = $boardStore.board.name;
  let manufacturer = $boardStore.board.manufacturer;
  let mcu = $boardStore.board.mcu;
  let frequency = $boardStore.board.frequency;
  let languages = [...$boardStore.board.languages];
  let aslProfiles = [...$boardStore.board.asl_profiles];
  
  // Format frequency as MHz for display
  let frequencyMhz = frequency / 1000000;
  
  function handleSave() {
    updateBoardMeta({
      id: id.toLowerCase().replace(/\s+/g, '-'),
      name,
      manufacturer,
      mcu,
      frequency: frequencyMhz * 1000000,
      languages,
      asl_profiles: aslProfiles
    });
  }
  
  function toggleLanguage(lang: string) {
    if (languages.includes(lang)) {
      languages = languages.filter(l => l !== lang);
    } else {
      languages = [...languages, lang];
    }
  }
  
  function toggleProfile(profile: string) {
    if (aslProfiles.includes(profile)) {
      aslProfiles = aslProfiles.filter(p => p !== profile);
    } else {
      aslProfiles = [...aslProfiles, profile];
    }
  }
</script>

<div class="board-meta-form">
  <div class="form-header">
    <h3>Board Metadata</h3>
  </div>
  
  <div class="form-content">
    <div class="form-row">
      <div class="form-group">
        <label for="boardId">Board ID</label>
        <input 
          type="text" 
          id="boardId" 
          bind:value={id}
          placeholder="my-custom-board"
        />
        <span class="hint">kebab-case (lowercase with dashes)</span>
      </div>
    </div>
    
    <div class="form-row two-col">
      <div class="form-group">
        <label for="boardName">Board Name</label>
        <input 
          type="text" 
          id="boardName" 
          bind:value={name}
          placeholder="My Custom Board"
        />
      </div>
      
      <div class="form-group">
        <label for="manufacturer">Manufacturer</label>
        <input 
          type="text" 
          id="manufacturer" 
          bind:value={manufacturer}
          placeholder="ACME Electronics"
        />
      </div>
    </div>
    
    <div class="form-row two-col">
      <div class="form-group">
        <label for="mcu">MCU</label>
        <input 
          type="text" 
          id="mcu" 
          bind:value={mcu}
          placeholder="RP2040"
        />
      </div>
      
      <div class="form-group">
        <label for="frequency">Frequency (MHz)</label>
        <input 
          type="number" 
          id="frequency" 
          bind:value={frequencyMhz}
          min="1"
          max="1000"
          step="0.001"
        />
      </div>
    </div>
    
    <div class="form-group">
      <label>Languages</label>
      <div class="checkbox-grid">
        {#each SUPPORTED_LANGUAGES as lang}
          <label class="checkbox-item">
            <input 
              type="checkbox" 
              checked={languages.includes(lang)}
              on:change={() => toggleLanguage(lang)}
            />
            <span>{lang}</span>
          </label>
        {/each}
      </div>
    </div>
    
    <div class="form-group">
      <label>ASL Profiles</label>
      <div class="checkbox-grid">
        {#each ASL_PROFILES as profile}
          <label class="checkbox-item">
            <input 
              type="checkbox" 
              checked={aslProfiles.includes(profile)}
              on:change={() => toggleProfile(profile)}
            />
            <span>{profile}</span>
          </label>
        {/each}
      </div>
    </div>
    
    <button class="btn-save" on:click={handleSave}>Save Metadata</button>
  </div>
</div>

<style>
  .board-meta-form {
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
  }
  
  .form-header {
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .form-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  
  .form-content {
    padding: 16px;
  }
  
  .form-row {
    margin-bottom: 12px;
  }
  
  .form-row.two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
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
  
  .form-group input {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 13px;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }
  
  .hint {
    display: block;
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 2px;
  }
  
  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  
  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  
  .checkbox-item input {
    width: auto;
  }
  
  .btn-save {
    width: 100%;
    padding: 10px;
    background: var(--accent-primary);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 8px;
  }
  
  .btn-save:hover {
    opacity: 0.9;
  }
</style>

<script lang="ts">
  import { componentStore, updateComponentMeta, loadTemplate, newComponent, getTemplateById } from '$lib/componentStore.svelte';
  import { CATEGORIES, SUBCATEGORIES, COMPONENT_TEMPLATES, type ComponentCategory } from '$lib/types';
  
  let selectedCategory: ComponentCategory = $componentStore.component.category;
  let selectedSubcategory = $componentStore.component.subcategory;
  
  // Sync with store
  $: {
    selectedCategory = $componentStore.component.category;
    selectedSubcategory = $componentStore.component.subcategory;
  }
  
  // Get subcategories for current category
  $: availableSubcategories = SUBCATEGORIES[selectedCategory] || [];
  
  // Get templates for current category
  $: availableTemplates = COMPONENT_TEMPLATES.filter(t => t.category === selectedCategory);
  
  function handleMetaChange(field: string, value: any) {
    updateComponentMeta({ [field]: value });
  }
  
  function handleCategoryChange() {
    selectedSubcategory = availableSubcategories[0] || null;
    updateComponentMeta({
      category: selectedCategory,
      subcategory: selectedSubcategory
    });
  }
  
  function handleTemplateSelect(templateId: string) {
    const template = getTemplateById(templateId);
    if (template) {
      loadTemplate(template);
    }
  }
  
  function handleNew() {
    newComponent();
  }
</script>

<div class="component-meta">
  <div class="panel-header">
    <h3>Component Metadata</h3>
    <button class="new-btn" on:click={handleNew}>New</button>
  </div>
  
  <div class="form-content">
    <!-- Template Selection -->
    <div class="form-group">
      <label for="template">Load Template</label>
      <select id="template" on:change={(e) => handleTemplateSelect(e.currentTarget.value)}>
        <option value="">-- Select Template --</option>
        {#each availableTemplates as template}
          <option value={template.id}>{template.name}</option>
        {/each}
      </select>
    </div>
    
    <hr class="divider" />
    
    <!-- Basic Info -->
    <div class="form-group">
      <label for="componentId">Component ID</label>
      <input 
        type="text" 
        id="componentId" 
        value={$componentStore.component.id}
        on:input={(e) => handleMetaChange('id', e.currentTarget.value)}
        placeholder="e.g., ldr-sensor, servo-01"
      />
    </div>
    
    <div class="form-group">
      <label for="name">Name</label>
      <input 
        type="text" 
        id="name" 
        value={$componentStore.component.name}
        on:input={(e) => handleMetaChange('name', e.currentTarget.value)}
        placeholder="e.g., LDR Light Sensor"
      />
    </div>
    
    <!-- Category -->
    <div class="form-group">
      <label for="category">Category</label>
      <select 
        id="category" 
        bind:value={selectedCategory}
        on:change={handleCategoryChange}
      >
        {#each CATEGORIES as cat}
          <option value={cat.value}>{cat.label}</option>
        {/each}
      </select>
    </div>
    
    <!-- Subcategory -->
    <div class="form-group">
      <label for="subcategory">Subcategory</label>
      <select 
        id="subcategory" 
        bind:value={selectedSubcategory}
        on:change={(e) => handleMetaChange('subcategory', e.currentTarget.value)}
      >
        {#each availableSubcategories as sub}
          <option value={sub}>{sub}</option>
        {/each}
      </select>
    </div>
    
    <!-- Voltage -->
    <div class="form-group">
      <label for="voltage">Operating Voltage (V)</label>
      <input 
        type="number" 
        id="voltage" 
        value={$componentStore.component.voltage}
        on:input={(e) => handleMetaChange('voltage', parseFloat(e.currentTarget.value) || null)}
        min="0"
        max="48"
        step="0.1"
        placeholder="e.g., 3.3, 5, 12"
      />
    </div>
    
    <!-- SVG ID -->
    <div class="form-group">
      <label for="svgId">SVG Element ID</label>
      <input 
        type="text" 
        id="svgId" 
        value={$componentStore.component.svgId || ''}
        on:input={(e) => handleMetaChange('svgId', e.currentTarget.value || null)}
        placeholder="ID of component in SVG"
      />
    </div>
  </div>
</div>

<style>
  .component-meta {
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
  
  .new-btn {
    padding: 4px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
  }
  
  .new-btn:hover {
    border-color: var(--accent-primary);
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
  
  .divider {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 16px 0;
  }
</style>

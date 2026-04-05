<script lang="ts">
  import { toonJson, isValid } from '$lib/boardStore.svelte';
  
  let copied = false;
  
  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText($toonJson);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
</script>

<div class="toon-preview">
  <div class="preview-header">
    <h3>TOON Preview</h3>
    <button class="btn-copy" on:click={copyToClipboard}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  </div>
  
  <div class="preview-content">
    <pre><code>{$toonJson}</code></pre>
  </div>
  
  <div class="preview-footer">
    <span class="status">
      {#if $isValid}
        <span class="dot valid"></span> Ready to export
      {:else}
        <span class="dot invalid"></span> Fix errors first
      {/if}
    </span>
  </div>
</div>

<style>
  .toon-preview {
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 400px;
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
</style>

<script lang="ts">
  import { validationIssues, issueCounts, isValid } from '$lib/boardStore.svelte';
</script>

<div class="validation-report">
  <div class="report-header">
    <h3>Validation</h3>
    <div class="status-badge" class:valid={$isValid} class:invalid={!$isValid}>
      {$isValid ? 'Valid' : 'Invalid'}
    </div>
  </div>
  
  <div class="issue-counts">
    <span class="count error">{$issueCounts.errors} errors</span>
    <span class="count warning">{$issueCounts.warnings} warnings</span>
  </div>
  
  {#if $validationIssues.length > 0}
    <ul class="issue-list">
      {#each $validationIssues as issue}
        <li class="issue-item" class:error={issue.severity === 'error'} class:warning={issue.severity === 'warning'}>
          <span class="issue-icon">
            {#if issue.severity === 'error'}
              ✕
            {:else}
              ⚠
            {/if}
          </span>
          <div class="issue-content">
            <p class="issue-message">{issue.message}</p>
            {#if issue.field}
              <p class="issue-field">{issue.field}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="empty-state">
      <p>No validation issues</p>
    </div>
  {/if}
</div>

<style>
  .validation-report {
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
  }
  
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .report-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  
  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
    text-transform: uppercase;
  }
  
  .status-badge.valid {
    background: var(--success);
    color: white;
  }
  
  .status-badge.invalid {
    background: var(--error);
    color: white;
  }
  
  .issue-counts {
    display: flex;
    gap: 12px;
    padding: 8px 16px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .count {
    font-size: 12px;
    font-weight: 500;
  }
  
  .count.error {
    color: var(--error);
  }
  
  .count.warning {
    color: var(--warning);
  }
  
  .issue-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .issue-item {
    display: flex;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .issue-item:last-child {
    border-bottom: none;
  }
  
  .issue-item.error {
    background: rgba(255, 71, 87, 0.1);
  }
  
  .issue-item.warning {
    background: rgba(255, 184, 0, 0.1);
  }
  
  .issue-icon {
    font-size: 14px;
    flex-shrink: 0;
  }
  
  .issue-item.error .issue-icon {
    color: var(--error);
  }
  
  .issue-item.warning .issue-icon {
    color: var(--warning);
  }
  
  .issue-content {
    flex: 1;
    min-width: 0;
  }
  
  .issue-message {
    margin: 0;
    font-size: 12px;
    color: var(--text-primary);
  }
  
  .issue-field {
    margin: 2px 0 0;
    font-size: 11px;
    color: var(--text-secondary);
  }
  
  .empty-state {
    padding: 24px 16px;
    text-align: center;
    color: var(--text-secondary);
  }
  
  .empty-state p {
    margin: 0;
    font-size: 13px;
  }
</style>

<script lang="ts">
  import { 
    connections, 
    validationSummary,
    canvasElements,
    removeConnection,
    clearConnections,
    type Connection
  } from '$lib/connectionStore.svelte';
  import { boardStore } from '$lib/boardStore.svelte';
  import { componentStore } from '$lib/componentStore.svelte';
  
  let expandedConnection: string | null = null;
  
  function toggleConnection(id: string) {
    expandedConnection = expandedConnection === id ? null : id;
  }
  
  function getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }
  
  function getConnectionStatus(connection: Connection): 'valid' | 'warning' | 'error' {
    const hasErrors = connection.issues.some(i => i.severity === 'error');
    const hasWarnings = connection.issues.some(i => i.severity === 'warning');
    if (hasErrors) return 'error';
    if (hasWarnings) return 'warning';
    return 'valid';
  }
</script>

<div class="validator-panel">
  <div class="panel-header">
    <h3>Connection Validator</h3>
    {#if $connections.length > 0}
      <button class="clear-btn" on:click={clearConnections}>Clear All</button>
    {/if}
  </div>
  
  <!-- Summary -->
  <div class="summary">
    <div class="summary-item total">
      <span class="summary-value">{$validationSummary.total}</span>
      <span class="summary-label">Total</span>
    </div>
    <div class="summary-item valid">
      <span class="summary-value">{$validationSummary.valid}</span>
      <span class="summary-label">Valid</span>
    </div>
    <div class="summary-item warning">
      <span class="summary-value">{$validationSummary.warnings}</span>
      <span class="summary-label">Warnings</span>
    </div>
    <div class="summary-item error">
      <span class="summary-value">{$validationSummary.errors}</span>
      <span class="summary-label">Errors</span>
    </div>
  </div>
  
  <!-- Connections list -->
  <div class="connections-list">
    {#if $connections.length === 0}
      <div class="empty-state">
        <p>No connections yet</p>
        <p class="hint">Drag from a component signal to a board pin</p>
      </div>
    {:else}
      {#each $connections as connection (connection.id)}
        {@const status = getConnectionStatus(connection)}
        <div class="connection-item {status}">
          <button 
            class="connection-header"
            on:click={() => toggleConnection(connection.id)}
          >
            <div class="connection-status-icon">
              {#if status === 'valid'}✓{:else if status === 'warning'}⚠{:else}✕{/if}
            </div>
            <div class="connection-info">
              <span class="connection-signal">{connection.signalName}</span>
              <span class="connection-arrow">→</span>
              <span class="connection-pin">{connection.boardPinLabel}</span>
            </div>
            <div class="connection-type-badge">{connection.signalType}</div>
          </button>
          
          {#if expandedConnection === connection.id}
            <div class="connection-details">
              <div class="detail-row">
                <span class="detail-label">Component:</span>
                <span class="detail-value">{connection.componentName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Signal ID:</span>
                <span class="detail-value">{connection.signalId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Board Pin:</span>
                <span class="detail-value">{connection.boardPinId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Validated:</span>
                <span class="detail-value">{connection.validated ? 'Yes' : 'No'}</span>
              </div>
              
              {#if connection.issues.length > 0}
                <div class="issues-section">
                  <span class="issues-label">Issues:</span>
                  {#each connection.issues as issue}
                    <div class="issue-item {issue.severity}">
                      <span class="issue-icon">{getSeverityIcon(issue.severity)}</span>
                      <span class="issue-message">{issue.message}</span>
                    </div>
                  {/each}
                </div>
              {/if}
              
              <button 
                class="remove-btn"
                on:click|stopPropagation={() => removeConnection(connection.id)}
              >
                Remove Connection
              </button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
  
  <!-- Canvas elements info -->
  {#if $canvasElements.length > 0}
    <div class="elements-section">
      <h4>Canvas Elements</h4>
      {#each $canvasElements as element}
        <div class="element-item {element.type}">
          <span class="element-type">{element.type}</span>
          <span class="element-name">{element.name}</span>
        </div>
      {/each}
    </div>
  {/if}
  
  <!-- Board pins reference -->
  {#if $boardStore.pins.length > 0}
    <div class="pins-section">
      <h4>Board Pins</h4>
      <div class="pins-grid">
        {#each $boardStore.pins as pin}
          <div class="pin-badge" class:pwm={pin.pwm} class:adc={pin.adc} class:interrupt={pin.interrupt}>
            <span class="pin-label">{pin.label}</span>
            <span class="pin-capabilities">
              {#if pin.pwm}PWM{/if}
              {#if pin.adc}ADC{/if}
              {#if pin.interrupt}INT{/if}
              {#if pin.strapping}⚠{/if}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .validator-panel {
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 100%;
    overflow-y: auto;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .clear-btn {
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .clear-btn:hover {
    border-color: var(--error);
    color: var(--error);
  }
  
  .summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  
  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: var(--bg-tertiary);
    border-radius: 6px;
  }
  
  .summary-value {
    font-size: 18px;
    font-weight: 700;
  }
  
  .summary-label {
    font-size: 10px;
    color: var(--text-secondary);
    text-transform: uppercase;
  }
  
  .summary-item.total .summary-value { color: var(--text-primary); }
  .summary-item.valid .summary-value { color: var(--success); }
  .summary-item.warning .summary-value { color: var(--warning); }
  .summary-item.error .summary-value { color: var(--error); }
  
  .connections-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary);
  }
  
  .empty-state p {
    margin: 0 0 8px 0;
  }
  
  .empty-state .hint {
    font-size: 12px;
    color: var(--text-secondary);
    opacity: 0.7;
  }
  
  .connection-item {
    background: var(--bg-tertiary);
    border-radius: 6px;
    overflow: hidden;
    border-left: 3px solid var(--border-color);
  }
  
  .connection-item.valid {
    border-left-color: var(--success);
  }
  
  .connection-item.warning {
    border-left-color: var(--warning);
  }
  
  .connection-item.error {
    border-left-color: var(--error);
  }
  
  .connection-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
  }
  
  .connection-status-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }
  
  .connection-item.valid .connection-status-icon {
    background: var(--success);
    color: white;
  }
  
  .connection-item.warning .connection-status-icon {
    background: var(--warning);
    color: white;
  }
  
  .connection-item.error .connection-status-icon {
    background: var(--error);
    color: white;
  }
  
  .connection-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  
  .connection-signal {
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .connection-arrow {
    color: var(--text-secondary);
  }
  
  .connection-pin {
    color: var(--accent-primary);
    font-family: monospace;
  }
  
  .connection-type-badge {
    padding: 2px 6px;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-size: 10px;
    color: var(--text-secondary);
    text-transform: uppercase;
  }
  
  .connection-details {
    padding: 12px;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .detail-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }
  
  .detail-label {
    color: var(--text-secondary);
  }
  
  .detail-value {
    color: var(--text-primary);
    font-family: monospace;
  }
  
  .issues-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color);
  }
  
  .issues-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    display: block;
    margin-bottom: 8px;
  }
  
  .issue-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 11px;
    margin-bottom: 4px;
  }
  
  .issue-item.error {
    background: rgba(255, 71, 87, 0.15);
  }
  
  .issue-item.warning {
    background: rgba(255, 184, 0, 0.15);
  }
  
  .issue-item.info {
    background: rgba(160, 160, 160, 0.15);
  }
  
  .issue-icon {
    flex-shrink: 0;
  }
  
  .issue-message {
    color: var(--text-primary);
  }
  
  .remove-btn {
    margin-top: 8px;
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--error);
    border-radius: 4px;
    color: var(--error);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .remove-btn:hover {
    background: var(--error);
    color: white;
  }
  
  .elements-section,
  .pins-section {
    border-top: 1px solid var(--border-color);
    padding-top: 12px;
  }
  
  .elements-section h4,
  .pins-section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .element-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    margin-bottom: 4px;
    font-size: 11px;
  }
  
  .element-type {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 600;
  }
  
  .element-item.board .element-type {
    background: var(--accent-secondary);
    color: white;
  }
  
  .element-item.component .element-type {
    background: var(--accent-primary);
    color: white;
  }
  
  .element-name {
    color: var(--text-primary);
  }
  
  .pins-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .pin-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 10px;
  }
  
  .pin-label {
    font-family: monospace;
    color: var(--text-primary);
  }
  
  .pin-capabilities {
    font-size: 8px;
    color: var(--text-secondary);
  }
  
  .pin-badge.pwm {
    border: 1px solid var(--accent-primary);
  }
  
  .pin-badge.adc {
    border: 1px solid var(--success);
  }
  
  .pin-badge.interrupt {
    border: 1px solid var(--warning);
  }
</style>
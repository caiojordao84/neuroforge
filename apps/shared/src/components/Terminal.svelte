<script lang="ts">
  import { serial } from '../state/serial.svelte';
</script>

<div class="flex flex-col h-full bg-zinc-950 text-green-400 font-mono text-sm p-4 overflow-y-auto">
  {#each serial.terminalLines as line (line.id)}
    <div class="mb-1">
      <span class="text-zinc-500">[{line.timestamp}]</span> 
      <span class:text-red-400={line.level === 'error'} 
            class:text-yellow-400={line.level === 'warn'}
            class:text-blue-400={line.level === 'info'}
            class:text-green-400={line.level === 'success'}>
        {line.message}
      </span>
    </div>
  {/each}
</div>

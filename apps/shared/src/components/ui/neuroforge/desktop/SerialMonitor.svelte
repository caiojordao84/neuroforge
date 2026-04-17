<script lang="ts">
  import { onMount } from 'svelte';
  
  let logs: string[] = $state([]);
  let inputMessage = $state("");

  // This would natively bind to the Rust SimEngine Tx/Rx registers via simManager
  // For now, it provides a functional mock interface for Phase 5 proof.
  onMount(() => {
    logs.push("[SYSTEM] Connected to virtual UART on baud 115200");
    
    const simInterval = setInterval(() => {
      // Mock random incoming telemetry from WASM payload
      if (Math.random() > 0.95) {
        logs = [...logs, `[TICK] Sensor read: ${Math.floor(Math.random() * 1024)}`];
      }
    }, 100);

    return () => clearInterval(simInterval);
  });

  function sendMessage(e: Event) {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    logs = [...logs, `> ${inputMessage}`];
    // TODO: Write inputMessage bytes into SimManager SAB Rx queue.
    inputMessage = "";
  }
</script>

<div class="h-64 bg-[#0a0a0f] border border-white/10 rounded overflow-hidden flex flex-col font-mono shadow-2xl relative z-40 pointer-events-auto">
  <div class="bg-white/5 px-2 py-1 flex items-center justify-between border-b border-white/5">
    <span class="text-[10px] uppercase font-bold text-white/50">Serial Monitor</span>
    <span class="text-[9px] text-green-400 font-bold">115200 baud</span>
  </div>
  
  <div class="flex-1 overflow-y-auto p-2 text-[11px] text-white/80 space-y-1">
    {#each logs as log}
      <div class="{log.startsWith('>') ? 'text-primary-container' : 'text-white/70'}">{log}</div>
    {/each}
  </div>

  <form onsubmit={sendMessage} class="flex border-t border-white/10">
    <input 
      type="text" 
      bind:value={inputMessage}
      placeholder="Type message..." 
      class="flex-1 bg-transparent border-none text-[11px] text-white p-2 focus:outline-none focus:ring-1 focus:ring-primary-container"
    />
    <button type="submit" class="px-3 bg-white/5 hover:bg-white/10 text-[10px] text-primary-container uppercase font-bold transition-colors">
      Send
    </button>
  </form>
</div>

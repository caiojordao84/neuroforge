<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { serial } from '../state/serial.svelte';

  let ports = $state<{name: string, type: string}[]>([]);
  let selectedPort = $state('');

  onMount(async () => {
    try {
      ports = await invoke('serial_list_ports');
      if (ports.length > 0) selectedPort = ports[0].name;
    } catch (e) {
      serial.addTerminalLine(`Erro lista ports: ${e}`, 'error');
    }
  });

  async function connect() {
    try {
      await invoke('serial_open', { portName: selectedPort, baudRate: 9600 });
      serial.addTerminalLine(`Conectado à porta ${selectedPort}`, 'success');
    } catch (e) {
      serial.addTerminalLine(`Erro conexão: ${e}`, 'error');
    }
  }

  async function disconnect() {
    try {
      await invoke('serial_close');
      serial.addTerminalLine('Porta fechada.', 'info');
    } catch (e) {
      serial.addTerminalLine(`Erro ao fechar: ${e}`, 'error');
    }
  }
</script>

<div class="flex items-center gap-2 p-2 bg-zinc-900 rounded">
  <select class="bg-zinc-800 text-white p-1 rounded" bind:value={selectedPort}>
    {#each ports as p}
      <option value={p.name}>{p.name} ({p.type})</option>
    {/each}
  </select>
  <button class="bg-blue-600 px-3 py-1 rounded hover:bg-blue-500" onclick={connect}>Ligar</button>
  <button class="bg-red-600 px-3 py-1 rounded hover:bg-red-500" onclick={disconnect}>Desligar</button>
</div>

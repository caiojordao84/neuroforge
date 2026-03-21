<script lang="ts">
  import { ui } from '../state/ui.svelte';
</script>
<div class="w-64 h-full bg-zinc-900 border-r border-zinc-800 p-2 flex flex-col gap-2 transition-all"
     class:hidden={!ui.sidebarOpen}>
  <div class="font-semibold px-2 py-1 text-zinc-300 uppercase text-xs">Menu</div>
  <button class="text-left px-2 py-1 hover:bg-zinc-800 rounded">Blocks</button>
  <button class="text-left px-2 py-1 hover:bg-zinc-800 rounded">Code</button>
</div>

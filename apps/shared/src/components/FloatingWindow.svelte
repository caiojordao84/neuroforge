<script lang="ts">
  export let title = "Window";
</script>
<div class="fixed top-10 right-10 w-64 bg-zinc-800 border border-zinc-700 rounded shadow-lg overflow-hidden">
  <div class="bg-zinc-900 border-b border-zinc-700 p-2 font-semibold text-sm flex justify-between cursor-move">
    {title}
    <button class="text-zinc-500 hover:text-white">&times;</button>
  </div>
  <div class="p-2">
    <slot></slot>
  </div>
</div>

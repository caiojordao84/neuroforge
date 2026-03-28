<script lang="ts">
  import '../app.css'; // This imports "@neuroforge/shared/styles/neuroforge.css"
  import { onMount } from 'svelte';
  import { asl } from '@neuroforge/shared/state/asl.svelte.ts';

  let { children } = $props();

  onMount(() => {
    // Inicializa o motor WASM ASL no carregamento da app
    asl.init().then(() => {
      console.log('[NeuroForge] Motor ASL inicializado v' + asl.version());
    });
  });
</script>

<svelte:head>
  <title>NeuroForge IDE</title>
</svelte:head>

{@render children()}

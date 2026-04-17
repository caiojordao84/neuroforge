<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { asl } from '@neuroforge/shared/state/asl.svelte.ts';
  import { NeuroForgeTopBar } from '@neuroforge/shared';

  let { children } = $props();

  onMount(() => {
    // Inicializa o motor WASM ASL no desktop (Tauri)
    asl.init().then(() => {
      console.log('[NeuroForge Desktop] Motor ASL Ready');
    });
  });
</script>

<NeuroForgeTopBar />

{@render children()}

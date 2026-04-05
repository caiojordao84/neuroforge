<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { loadConnectionColors } from '$lib/connectionColors.svelte';

  onMount(() => loadConnectionColors());
</script>

<div class="app-container">
  <slot />
</div>

<style>
  .app-container {
    min-height: 100vh;
  }
</style>

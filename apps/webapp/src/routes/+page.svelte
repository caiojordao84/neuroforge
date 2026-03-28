<script lang="ts">
  import { onMount } from 'svelte';
  import { DesktopIDE, MobileIDE } from '@neuroforge/shared';
  
  let isMobile = $state(false);

  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 1024;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });
</script>

{#if isMobile}
  <MobileIDE />
{:else}
  <DesktopIDE />
{/if}

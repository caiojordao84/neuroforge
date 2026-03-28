<script>
  import MobileTopBar from './MobileTopBar.svelte';
  import MobileCanvas from './MobileCanvas.svelte';
  import MobileBottomNav from './MobileBottomNav.svelte';
</script>

<div class="h-screen w-full flex flex-col overflow-hidden bg-background">
  <MobileTopBar />
  
  <!-- Canvas and Overlays -->
  <MobileCanvas />
  
  <!-- Bottom Navigation -->
  <MobileBottomNav />
  
  <!-- Visual Polish: Decorative Corner accents -->
  <div class="fixed bottom-20 left-4 pointer-events-none opacity-20">
    <div class="w-12 h-12 border-l-2 border-b-2 border-primary-container"></div>
  </div>
  <div class="fixed bottom-20 right-4 pointer-events-none opacity-20">
    <div class="w-12 h-12 border-r-2 border-b-2 border-primary-container"></div>
  </div>
</div>

<style>
  :global(body) {
    min-height: max(884px, 100dvh);
    overflow: hidden;
  }
</style>

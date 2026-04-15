<script>
  import { ideState } from '../../../../state/ide.svelte.ts';
  import TopBar from './TopBar.svelte';
  import SecondaryToolbar from './SecondaryToolbar.svelte';
  import SideBar from './SideBar.svelte';
  import Canvas from './Canvas.svelte';
  import CodePanel from './CodePanel.svelte';
  import Footer from './Footer.svelte';
</script>

<div class="h-screen w-full flex flex-col overflow-hidden bg-background pt-14">
  <SecondaryToolbar />
  
  <main class="flex-1 relative flex overflow-hidden">
    <!-- Components Sidebar -->
    <SideBar />
    
    <!-- Workspace -->
    <Canvas />
    
    <!-- Editor & Terminal -->
    {#if ideState.isCodePanelOpen}
      <CodePanel />
    {/if}
  </main>
  
  <Footer />
</div>

<style>
  :global(body) {
    overflow: hidden;
  }
</style>

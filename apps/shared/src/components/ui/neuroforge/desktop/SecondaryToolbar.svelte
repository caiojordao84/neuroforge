<script lang="ts">
  import { ideState } from '../../../../state/ide.svelte.ts';
</script>

<div class="mt-14 h-12 flex items-center justify-between px-6 bg-[#1B1A2A] border-b border-white/5 z-30">
  <div class="flex items-center gap-1">
    <button class="p-2 text-on-surface-variant hover:bg-white/5 rounded transition-colors" title="Copy">
      <span class="material-symbols-outlined text-sm">content_copy</span>
    </button>
    <button class="p-2 text-on-surface-variant hover:bg-white/5 rounded transition-colors" title="Cut">
      <span class="material-symbols-outlined text-sm">content_cut</span>
    </button>
    <button class="p-2 text-on-surface-variant hover:bg-white/5 rounded transition-colors" title="Paste">
      <span class="material-symbols-outlined text-sm">content_paste</span>
    </button>
    <div class="w-[1px] h-4 bg-white/10 mx-2"></div>
    <button class="p-2 text-on-surface-variant hover:bg-white/5 rounded transition-colors" title="Undo">
      <span class="material-symbols-outlined text-sm">undo</span>
    </button>
    <button class="p-2 text-on-surface-variant hover:bg-white/5 rounded transition-colors" title="Redo">
      <span class="material-symbols-outlined text-sm">redo</span>
    </button>
    <button class="p-2 text-on-surface-variant hover:bg-white/5 rounded transition-colors ml-2" title="Add text">
      <span class="material-symbols-outlined text-sm">title</span>
    </button>
  </div>
  
  <div class="flex items-center gap-3">
    <button class="px-3 py-1.5 flex items-center gap-2 border border-white/10 hover:bg-white/5 transition-colors rounded text-xs font-medium uppercase text-on-surface-variant">
      <span class="material-symbols-outlined text-xs">code</span> Code Editor
    </button>
    
    <!-- RUN Button: Yellow square with lightning icon -->
    <button 
      class="bg-primary-container text-background w-12 h-12 rounded flex flex-col items-center justify-center active:scale-95 transition-all hover:bg-primary-fixed-dim shadow-[0_0_15px_rgba(255,211,0,0.2)]"
      onclick={() => ideState.runSimulation()}
    >
      <span class="material-symbols-outlined text-xl leading-none" style="font-variation-settings: 'FILL' 1;">bolt</span>
      <span class="text-[9px] font-black leading-none mt-0.5">RUN</span>
    </button>
    
    <div class="w-[1px] h-4 bg-white/10 mx-1"></div>
    <button class="p-2 text-on-surface-variant hover:bg-white/5 rounded transition-colors" title="Share">
      <span class="material-symbols-outlined text-sm">share</span>
    </button>
    <button class="p-2 text-on-surface-variant hover:bg-white/5 rounded transition-colors" title="Favorites">
      <span class="material-symbols-outlined text-sm">star</span>
    </button>
  </div>
</div>

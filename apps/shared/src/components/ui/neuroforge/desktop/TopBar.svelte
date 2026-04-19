<script lang="ts">
  import { page } from '$app/stores';
</script>

<header class="fixed top-0 left-0 w-full z-50 hidden lg:flex justify-between items-center px-6 h-14 bg-[#131221] shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
  <div class="flex items-center gap-6">
    <div class="flex items-center gap-2">
      <span class="text-2xl font-black italic text-primary-container tracking-tighter">NeuroForge</span>
      <div class="h-4 w-[1px] bg-white/10 mx-2"></div>
      <span class="font-industrial font-bold italic uppercase tracking-wider text-primary-container text-sm">
        ESP32_MAIN_LOOP
      </span>
    </div>
    <nav class="flex items-center gap-4 ml-4">
      <a 
        class="text-xs font-mono font-medium uppercase transition-all duration-300 pb-1 {$page.url.pathname === '/' ? 'text-primary-container border-b-2 border-primary-container' : 'text-on-surface-variant hover:text-on-surface'}" 
        href="/"
      >
        Simulation
      </a>
      <a 
        class="text-xs font-mono font-medium uppercase transition-all duration-300 pb-1 {$page.url.pathname === '/plc' ? 'text-primary-container border-b-2 border-primary-container' : 'text-on-surface-variant hover:text-on-surface'}" 
        href="/plc"
      >
        PLC
      </a>
      <a 
        class="text-xs font-mono font-medium uppercase transition-all duration-300 pb-1 {$page.url.pathname === '/core' ? 'text-primary-container border-b-2 border-primary-container' : 'text-on-surface-variant hover:text-on-surface'}" 
        href="/core"
      >
        Core
      </a>
      <a 
        class="text-xs font-mono font-medium uppercase transition-all duration-300 pb-1 {$page.url.pathname === '/schemasmith' ? 'text-primary-container border-b-2 border-primary-container' : 'text-on-surface-variant hover:text-on-surface'}" 
        href="/schemasmith"
      >
        Schemasmith
      </a>
    </nav>
  </div>
  
  <div class="flex items-center gap-4">
    <div class="flex items-center gap-1">
      <button class="p-2 text-on-surface-variant hover:bg-surface-container-highest/50 transition-all active:scale-[0.97] rounded">
        <span class="material-symbols-outlined">play_circle</span>
      </button>
      <button class="p-2 text-on-surface-variant hover:bg-surface-container-highest/50 transition-all active:scale-[0.97] rounded">
        <span class="material-symbols-outlined">stop_circle</span>
      </button>
      <button class="p-2 text-on-surface-variant hover:bg-surface-container-highest/50 transition-all active:scale-[0.97] rounded">
        <span class="material-symbols-outlined">settings</span>
      </button>
    </div>
    
    <div class="flex items-center gap-2 pl-4 border-l border-white/10">
      <div class="w-8 h-8 rounded-full border-2 border-primary-container overflow-hidden p-[1px]">
        <img 
          alt="User Profile" 
          class="w-full h-full object-cover rounded-full" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1d9lO6K6nzXrkQGwh7CulIZLXIRvIhx6W6WhM98ghOeTpQP8BrigoOiWayG2g436mx34YFgOthkMTu5OaJjeFxaab0fJ8JVxYdnuCAbn7NB7b52B6bh106j_BX0uDxB3CeygosrhXceP_oozRoBxBM7PPBHF-7pmaHT1KGpd0AcBf6di5LjQmSQtTxGjLEGNrNB3VFCYr4J7HiisyW9OwTpVn4L76K7x9vEuWuDDc7EukLL34dq95Qk8nfCf2BFMnousuzljyXXnb"
        />
      </div>
    </div>
  </div>
</header>

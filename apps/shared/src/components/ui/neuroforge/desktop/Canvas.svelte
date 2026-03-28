<div class="flex-1 relative overflow-hidden">
  <!-- Subtle Background Orbs -->
  <div class="absolute top-1/4 left-1/3 w-96 h-96 bg-primary-container/5 rounded-full blur-[120px] pointer-events-none"></div>
  <div class="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[160px] pointer-events-none"></div>

  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
    <svg class="absolute inset-0 w-full h-full">
      <path d="M 400 400 L 700 350" fill="none" opacity="0.3" stroke="#FFD300" stroke-dasharray="4 4" stroke-width="1"></path>
      <path d="M 400 450 L 750 600" fill="none" opacity="0.1" stroke="#FFD300" stroke-width="1"></path>
    </svg>
    
    <div class="relative pointer-events-auto">
      <div class="w-48 h-56 bg-surface-container-lowest border-2 border-primary-container rounded-lg p-1 shadow-[0_0_20px_rgba(255,211,0,0.2)]">
        <div class="h-full w-full bg-surface-container-low rounded-sm flex flex-col p-3 border border-white/5">
          <div class="flex justify-between items-start mb-4">
            <span class="font-mono text-[10px] text-primary-container font-bold">MCU_01</span>
            <div class="w-2 h-2 rounded-full bg-primary-container animate-pulse"></div>
          </div>
          
          <div class="flex-1 flex flex-col items-center justify-center opacity-80">
            <span class="material-symbols-outlined text-4xl text-white/40 mb-2">memory</span>
            <span class="text-[10px] text-white/40 uppercase font-bold tracking-tighter">RP2040</span>
          </div>
          
          <div class="mt-4 flex flex-wrap gap-1">
            <div class="w-2 h-2 bg-blue-500/50 rounded-full"></div>
            <div class="w-2 h-2 bg-green-500/50 rounded-full"></div>
            <div class="w-2 h-2 bg-white/20 rounded-full"></div>
          </div>
        </div>
      </div>
      
      <div class="absolute -right-2 top-1/4 flex flex-col gap-4">
        <div class="w-4 h-4 rounded-full bg-primary-container border-2 border-surface-container-low shadow-lg"></div>
        <div class="w-4 h-4 rounded-full bg-primary-container border-2 border-surface-container-low shadow-lg"></div>
      </div>
    </div>
  </div>
</div>

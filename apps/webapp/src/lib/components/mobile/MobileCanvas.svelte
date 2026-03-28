<main class="flex-1 mt-16 mb-20 relative technical-grid flex items-center justify-center overflow-hidden">
  <!-- Telemetry HUD (Floating Overlays) -->
  <div class="absolute top-6 left-6 flex flex-col gap-2 z-10">
    <div class="glass-panel px-3 py-1.5 flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
      <span class="font-mono text-[10px] font-bold tracking-tighter text-on-surface">CORE_STATUS: READY</span>
    </div>
    <div class="glass-panel px-3 py-1.5 flex items-center gap-2">
      <span class="font-mono text-[10px] font-bold tracking-tighter text-on-surface-variant">VOLTAGE: <span class="text-primary-container">3.32V</span></span>
    </div>
  </div>
  
  <div class="absolute top-6 right-6 z-10">
    <div class="glass-panel px-3 py-1.5 flex items-center gap-2">
      <span class="material-symbols-outlined text-[14px] text-on-surface-variant">wifi</span>
      <span class="font-mono text-[10px] font-bold tracking-tighter text-on-surface-variant">RF_LINK: 94%</span>
    </div>
  </div>
  
  <!-- Central Microcontroller Node -->
  <div class="relative group cursor-pointer">
    <!-- Glow effect -->
    <div class="absolute -inset-4 bg-primary-container/10 blur-xl rounded-lg group-hover:bg-primary-container/20 transition-all duration-500"></div>
    
    <!-- MCU Body -->
    <div class="relative w-48 h-64 bg-surface-container border-2 border-primary-container rounded-lg p-4 flex flex-col justify-between shadow-[0_0_15px_rgba(255,211,0,0.3)]">
      <div class="flex justify-between items-start">
        <div class="w-10 h-10 border border-white/10 flex items-center justify-center rounded-sm">
          <span class="material-symbols-outlined text-primary-container" style="font-variation-settings: 'FILL' 1;">memory</span>
        </div>
        <span class="font-mono text-[8px] text-on-surface-variant rotate-90 origin-right translate-y-4">ESP32-S3-WROOM-1</span>
      </div>
      
      <div class="flex flex-col gap-1">
        <div class="h-0.5 w-full bg-white/5"></div>
        <div class="h-0.5 w-full bg-white/5"></div>
        <div class="h-0.5 w-full bg-white/5"></div>
      </div>
      
      <div class="text-center">
        <h2 class="font-industrial text-xl italic font-bold tracking-widest text-on-surface">ESP32-S3</h2>
        <p class="font-mono text-[9px] text-primary-container mt-1 uppercase tracking-tighter">Dual Core Xtensa</p>
      </div>
      
      <div class="flex justify-between items-end">
        <div class="flex gap-1">
          <span class="w-1.5 h-1.5 bg-green-500/50 rounded-full"></span>
          <span class="w-1.5 h-1.5 bg-blue-500/50 rounded-full"></span>
        </div>
        <span class="material-symbols-outlined text-white/20 text-sm">qr_code_2</span>
      </div>
    </div>
    
    <!-- Virtual Wiring Indicators -->
    <div class="absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-8">
      <div class="flex items-center">
        <div class="w-12 h-px bg-primary-container/40"></div>
        <div class="w-2 h-2 rounded-full border border-primary-container -ml-1"></div>
      </div>
    </div>
    <div class="absolute -right-12 top-1/3 flex items-center">
      <div class="w-2 h-2 rounded-full border border-primary-container -mr-1 z-10"></div>
      <div class="w-12 h-px bg-primary-container/40"></div>
    </div>
  </div>
  
  <!-- Floating Action Button (RUN) -->
  <div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
    <button class="bg-primary-container hover:bg-primary-fixed-dim active:scale-95 transition-all duration-150 px-8 py-4 flex items-center gap-3 shadow-[0_0_30px_rgba(255,211,0,0.2)]">
      <span class="material-symbols-outlined text-black font-bold" style="font-variation-settings: 'FILL' 1;">bolt</span>
      <span class="font-mono font-bold text-black uppercase tracking-widest text-lg">RUN</span>
    </button>
  </div>
</main>

<style>
  .technical-grid {
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 24px 24px;
  }
</style>

<script lang="ts">
  // Schemasmith is a desktop-first tool.
  // In the web environment, we provide a placeholder or a link to download.
</script>

<div class="h-screen pt-14 flex flex-col items-center justify-center bg-background p-8 text-center">
  <div class="max-w-md">
    <span class="material-symbols-outlined text-6xl text-primary-container mb-4">architecture</span>
    <h1 class="text-2xl font-bold text-white mb-2 uppercase tracking-tight italic">Schemasmith</h1>
    <p class="text-white/60 text-sm mb-6 font-mono leading-relaxed">
      Hardware Definition & SVG Mapping Tool.
    </p>
    
    <div class="bg-primary-container/10 border border-primary-container/20 rounded-lg p-6 mb-8">
      <p class="text-xs text-primary-container font-mono mb-4 text-left">
        <span class="font-bold">NOTE:</span> Schemasmith requer acesso direto ao sistema de arquivos para mapeamento de SVG e exportação de TOON. 
      </p>
      <div class="flex flex-col gap-3">
        <a 
          href="http://localhost:1420"
          target="_blank"
          class="block w-full py-3 bg-primary-container text-black text-xs font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all shadow-lg shadow-primary-container/20"
        >
          Lançar Desktop Agent
        </a>
        <p class="text-[10px] text-white/40 italic">
          Certifique-se que o NeuroForge Desktop está em execução.
        </p>
      </div>
    </div>
    
    <div class="grid grid-cols-3 gap-4 opacity-50">
      <div class="flex flex-col items-center">
        <span class="material-symbols-outlined text-xl mb-1">imagesmode</span>
        <span class="text-[8px] font-mono uppercase">SVG Map</span>
      </div>
      <div class="flex flex-col items-center">
        <span class="material-symbols-outlined text-xl mb-1">table_chart</span>
        <span class="text-[8px] font-mono uppercase">I/O Table</span>
      </div>
      <div class="flex flex-col items-center">
        <span class="material-symbols-outlined text-xl mb-1">save</span>
        <span class="text-[8px] font-mono uppercase">TOON Export</span>
      </div>
    </div>
  </div>
</div>

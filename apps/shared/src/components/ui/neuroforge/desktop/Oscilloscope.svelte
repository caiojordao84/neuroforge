<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { simManager } from '../../../../lib/simulation/simManager';

  let { bufferIndex = 0, title = "Oscilloscope" } = $props<{ bufferIndex?: number, title?: string }>();
  let canvas: HTMLCanvasElement;
  let rafId: number;
  
  // History buffer
  const HISTORY_SIZE = 100;
  const history = new Uint8Array(HISTORY_SIZE);
  let head = 0;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // 1. Record current state
      if (simManager.stateArray) {
         history[head] = simManager.stateArray[bufferIndex];
         head = (head + 1) % HISTORY_SIZE;
      }

      // 2. Draw History
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Draw Signal
      ctx.strokeStyle = "#4ade80"; // Bright green
      ctx.lineWidth = 2;
      ctx.beginPath();

      const dx = canvas.width / HISTORY_SIZE;
      for (let i = 0; i < HISTORY_SIZE; i++) {
         const idx = (head + i) % HISTORY_SIZE;
         const val = history[idx];
         const x = i * dx;
         // Maps val 0 to bottom, 1 to top
         const y = val > 0 ? 5 : canvas.height - 5; 
         
         if (i === 0) ctx.moveTo(x, y);
         else ctx.lineTo(x, y);
      }
      ctx.stroke();

      rafId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(rafId);
    };
  });
</script>

<div class="bg-[#1a1a24] border border-white/10 rounded-md p-2 flex flex-col gap-1 z-50 shadow-xl pointer-events-auto">
  <div class="text-[10px] font-mono text-white/50 font-bold uppercase tracking-widest">{title} (Pin Index: {bufferIndex})</div>
  <canvas bind:this={canvas} width="200" height="40" class="bg-black/50 rounded"></canvas>
</div>

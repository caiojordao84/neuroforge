<script lang="ts">
  import { asl } from '../state/asl.svelte';

  interface Props {
    source:   string;
    language: string;   // 'cpp' | 'rust' | 'python' | ...
  }

  let { source, language }: Props = $props();

  // Estado derivado — recalcula sempre que source/language mudam
  let aslTree    = $derived.by(() => {
    if (!asl.ready || !source.trim()) return null;
    try {
      return asl.parseToAsl(source, language);
    } catch (e) {
      return { error: String(e) };
    }
  });

  let diagnostics = $derived.by(() => {
    if (!asl.ready || !source.trim()) return [];
    try {
      return asl.getDiagnostics(source, language);
    } catch {
      return [];
    }
  });

  // Inicializar WASM quando o componente monta
  $effect(() => { asl.init(); });

  const severityClass: Record<string, string> = {
    error:   'text-red-400',
    warning: 'text-yellow-400',
    info:    'text-blue-400',
  };
</script>

<div class="flex flex-col h-full bg-zinc-950 text-zinc-100 font-mono text-xs">
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
    <span class="text-zinc-400 font-sans text-sm font-medium">ASL IR</span>
    {#if asl.ready}
      <span class="text-zinc-500 text-xs">v{asl.version()}</span>
    {:else if asl.error}
      <span class="text-red-400 text-xs">WASM erro: {asl.error}</span>
    {:else}
      <span class="text-zinc-500 text-xs animate-pulse">a carregar WASM…</span>
    {/if}
  </div>

  <!-- Diagnósticos -->
  {#if diagnostics.length > 0}
    <div class="shrink-0 border-b border-zinc-800 max-h-28 overflow-y-auto">
      {#each diagnostics as d}
        <div class="px-3 py-1 flex gap-2 text-xs {severityClass[d.severity] ?? 'text-zinc-300'}">
          <span class="uppercase font-bold w-14 shrink-0">{d.severity}</span>
          <span class="text-zinc-400 shrink-0">{d.context}</span>
          <span>{d.message}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ASL tree JSON -->
  <div class="flex-1 overflow-auto p-3">
    {#if !asl.ready}
      <p class="text-zinc-600 italic">WASM a inicializar…</p>
    {:else if !source.trim()}
      <p class="text-zinc-600 italic">Sem código fonte.</p>
    {:else if aslTree && 'error' in (aslTree as object)}
      <p class="text-red-400">Erro: {(aslTree as { error: string }).error}</p>
    {:else}
      <pre class="text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">{JSON.stringify(aslTree, null, 2)}</pre>
    {/if}
  </div>
</div>

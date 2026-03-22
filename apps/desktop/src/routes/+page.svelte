<script lang="ts">
  import { CodeEditorWithTabs, ASLViewer } from '@neuroforge/shared/src/components/index';
  import { files } from '@neuroforge/shared/src/state/files.svelte.ts';
  import { asl } from '@neuroforge/shared/src/state/asl.svelte.ts';

  // Inicializar WASM na montagem da página
  $effect(() => { asl.init(); });

  // Source activo para o ASLViewer (código do ficheiro activo)
  let activeSource   = $derived(files.activeFile?.content ?? '');
  let activeLanguage = $derived(files.activeFile?.language ?? 'cpp');
</script>

<div class="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden">
  <!-- Editor de código (esquerda) -->
  <div class="flex-1 flex flex-col min-w-0">
    <CodeEditorWithTabs
      tabs={files.editorTabs}
      activeTabId={files.activeFileId ?? ''}
      height="100%"
      onTabChange={(id) => files.setActiveFile(id)}
      onCodeChange={(id, value) => files.updateContent(id, value)}
      onTabClose={(id) => files.closeFile(id)}
    />
  </div>

  <!-- ASL Viewer (direita — 320px fixo) -->
  <div class="w-80 shrink-0 border-l border-zinc-800 flex flex-col">
    <ASLViewer source={activeSource} language={activeLanguage} />
  </div>
</div>

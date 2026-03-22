<script lang="ts">
  import { CodeEditorWithTabs, ASLViewer } from '@neuroforge/shared/src/components/index';
  import type { EditorTab } from '@neuroforge/shared/src/components/CodeEditorWithTabs.svelte';

  let tabs = $state<EditorTab[]>([
    { id: 'main', label: 'main.ino', value: 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}', language: 'cpp' },
    { id: 'lib',  label: 'helper.h',  value: '// helper', language: 'cpp' },
  ]);

  let activeTabId = $state('main');

  // Source activo para o ASLViewer
  let activeSource = $derived(tabs.find(t => t.id === activeTabId)?.value ?? '');
  let activeLang   = $derived(tabs.find(t => t.id === activeTabId)?.language ?? 'cpp');
</script>

<div class="flex h-full w-full overflow-hidden bg-zinc-950 text-white">
  <!-- Editor -->
  <div class="flex-1 flex flex-col">
    <CodeEditorWithTabs
      bind:tabs
      bind:activeTabId
      height="100%"
      onCodeChange={(id, val) => {
        tabs = tabs.map(t => t.id === id ? { ...t, value: val } : t);
      }}
    />
  </div>

  <!-- ASL Viewer (painel direito) -->
  <div class="w-80 border-l border-zinc-800 shrink-0">
    <ASLViewer source={activeSource} language={activeLang} />
  </div>
</div>

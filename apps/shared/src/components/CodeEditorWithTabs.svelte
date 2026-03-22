<script lang="ts">
  import { onMount } from 'svelte';
  import loader from '@monaco-editor/loader';
  import type * as Monaco from 'monaco-editor';

  export interface EditorTab {
    id:       string;
    label:    string;
    value:    string;
    language: string;
    modified?: boolean;
  }

  interface Props {
    tabs:        EditorTab[];
    activeTabId?: string;
    readOnly?:   boolean;
    height?:     string;
    onTabChange?: (tabId: string) => void;
    onCodeChange?: (tabId: string, value: string) => void;
    onTabClose?:  (tabId: string) => void;
  }

  let {
    tabs        = $bindable([]),
    activeTabId = $bindable(''),
    readOnly    = false,
    height      = '100%',
    onTabChange,
    onCodeChange,
    onTabClose,
  }: Props = $props();

  // Use plain `let` — $state on DOM refs can cause timing issues with bind:this
  let container: HTMLDivElement;
  let monaco: typeof Monaco | undefined;
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined;

  // Mapa tabId → Monaco model
  const models = new Map<string, Monaco.editor.ITextModel>();

  const langMap: Record<string, string> = {
    cpp: 'cpp', c: 'c', arduino: 'cpp',
    rust: 'rust', python: 'python', micropython: 'python',
    upython: 'python', st: 'plaintext',
  };

  function monacoLang(lang: string) { return langMap[lang] ?? 'plaintext'; }

  function ensureModel(tab: EditorTab): Monaco.editor.ITextModel {
    if (!monaco) throw new Error('Monaco não inicializado');
    let m = models.get(tab.id);
    if (!m) {
      const uri = monaco.Uri.parse(`neuroforge://tab/${tab.id}`);
      m = monaco.editor.createModel(tab.value, monacoLang(tab.language), uri);
      models.set(tab.id, m);
    }
    return m;
  }

  function switchTab(tabId: string) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !editor || !monaco) return;
    activeTabId = tabId;
    editor.setModel(ensureModel(tab));
    onTabChange?.(tabId);
  }

  onMount(() => {
    (async () => {
      monaco = await loader.init();

      monaco.editor.defineTheme('neuroforge-dark', {
        base: 'vs-dark', inherit: true, rules: [
          { token: 'comment',  foreground: '6A9955' },
          { token: 'keyword',  foreground: '569CD6', fontStyle: 'bold' },
          { token: 'string',   foreground: 'CE9178' },
          { token: 'number',   foreground: 'B5CEA8' },
          { token: 'function', foreground: 'DCDCAA' },
        ],
        colors: {
          'editor.background':              '#09090b',
          'editor.foreground':              '#e4e4e7',
          'editorLineNumber.foreground':    '#3f3f46',
          'editorCursor.foreground':        '#3b82f6',
          'editor.selectionBackground':     '#1e3a5f',
          'editor.lineHighlightBackground': '#18181b',
        },
      });

      if (!container) {
        console.error('[CodeEditorWithTabs] container not available');
        return;
      }

      console.log('[CodeEditorWithTabs] container:', container.offsetWidth, 'x', container.offsetHeight);

      editor = monaco.editor.create(container, {
        model: null,
        theme: 'neuroforge-dark', readOnly,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2, insertSpaces: true,
        bracketPairColorization: { enabled: true },
        padding: { top: 8, bottom: 8 },
      });

      editor.onDidChangeModelContent(() => {
        const value = editor!.getValue();
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab && tab.value !== value) {
          tab.value = value;
          tab.modified = true;
          onCodeChange?.(activeTabId, value);
        }
      });

      // Activar primeira tab
      if (tabs.length > 0) {
        if (!activeTabId) activeTabId = tabs[0].id;
        switchTab(activeTabId);
      }
    })();
  });

  // Cleanup on unmount via $effect
  $effect(() => {
    return () => {
      editor?.dispose();
      models.forEach(m => m.dispose());
      models.clear();
    };
  });

  // Sync active source from external updates
  $effect(() => {
    if (!editor || !monaco) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      const model = ensureModel(tab);
      if (editor.getModel() !== model) {
        editor.setModel(model);
      }
    }
  });
</script>

<div style="display: flex; flex-direction: column; height: {height};">
  <!-- Tab bar -->
  <div style="display: flex; align-items: center; background: #18181b; border-bottom: 1px solid #27272a; overflow-x: auto; flex-shrink: 0;">
    {#each tabs as tab (tab.id)}
      <button
        style="display: flex; align-items: center; gap: 4px; padding: 8px 16px; font-size: 13px;
               border-right: 1px solid #27272a; white-space: nowrap; cursor: pointer; border: none;
               background: {activeTabId === tab.id ? '#09090b' : 'transparent'};
               color: {activeTabId === tab.id ? '#f4f4f5' : '#a1a1aa'};
               border-top: {activeTabId === tab.id ? '2px solid #3b82f6' : '2px solid transparent'};"
        onclick={() => switchTab(tab.id)}
      >
        {tab.label}
        {#if tab.modified}
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #60a5fa; display: inline-block;"></span>
        {/if}
        {#if onTabClose}
          <span
            style="margin-left: 4px; color: #71717a; cursor: pointer;"
            role="button"
            tabindex="0"
            onclick={(e) => { e.stopPropagation(); onTabClose?.(tab.id); }}
            onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onTabClose?.(tab.id); } }}
          >✕</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Editor container — uses explicit inline styles to avoid Tailwind issues -->
  <div style="flex: 1; position: relative; min-height: 0;">
    <div bind:this={container} style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
  </div>
</div>

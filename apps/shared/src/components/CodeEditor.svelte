<script lang="ts">
  import { onMount } from 'svelte';
  const browser = typeof window !== 'undefined';
  import loader from '@monaco-editor/loader';
  import type * as Monaco from 'monaco-editor';

  interface Props {
    value?:        string;
    language?:     string;    // 'cpp' | 'python' | 'rust' | 'plaintext'
    theme?:        string;    // 'neuroforge-dark' (default)
    readOnly?:     boolean;
    height?:       string;    // CSS height, ex: '100%'
    onChange?:     (value: string) => void;
  }

  let {
    value    = $bindable(''),
    language = 'cpp',
    theme    = 'neuroforge-dark',
    readOnly = false,
    height   = '100%',
    onChange,
  }: Props = $props();

  let container = $state<HTMLDivElement | undefined>();
  let editorInstance = $state<Monaco.editor.IStandaloneCodeEditor | undefined>();
  let monacoRef = $state<typeof Monaco | undefined>();

  // Guard against setValue → onDidChangeModelContent → setValue loop
  let settingValue = false;

  // Mapeia nomes internos NeuroForge para IDs Monaco
  const langMap: Record<string, string> = {
    cpp: 'cpp', c: 'c', arduino: 'cpp',
    rust: 'rust', python: 'python', micropython: 'python',
    upython: 'python', st: 'plaintext', iec61131: 'plaintext',
  };

  onMount(() => {
    let internalEditor: Monaco.editor.IStandaloneCodeEditor | undefined;

    const init = async () => {
      if (!browser) return;
      const m = await loader.init();
      monacoRef = m;

      // Tema escuro personalizado
      m.editor.defineTheme('neuroforge-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment',   foreground: '6A9955' },
          { token: 'keyword',   foreground: '569CD6', fontStyle: 'bold' },
          { token: 'string',    foreground: 'CE9178' },
          { token: 'number',    foreground: 'B5CEA8' },
          { token: 'type',      foreground: '4EC9B0' },
          { token: 'function',  foreground: 'DCDCAA' },
        ],
        colors: {
          'editor.background':           '#09090b',
          'editor.foreground':           '#e4e4e7',
          'editorLineNumber.foreground': '#3f3f46',
          'editorCursor.foreground':     '#3b82f6',
          'editor.selectionBackground':  '#1e3a5f',
          'editor.lineHighlightBackground': '#18181b',
        },
      });

      if (!container) return;

      internalEditor = m.editor.create(container, {
        value,
        language: langMap[language] ?? 'plaintext',
        theme: 'neuroforge-dark',
        readOnly,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        minimap:          { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap:         'off',
        tabSize:          2,
        insertSpaces:     true,
        automaticLayout:  true,
        bracketPairColorization: { enabled: true },
        renderWhitespace: 'none',
        smoothScrolling:  true,
        cursorBlinking:   'smooth',
        padding:          { top: 8, bottom: 8 },
      });

      // Set the reactive ref AFTER editor is created
      editorInstance = internalEditor;

      internalEditor.onDidChangeModelContent(() => {
        if (settingValue) return; // skip if we're setting value programmatically
        const v = internalEditor!.getValue();
        if (value !== v) {
          value = v;
          onChange?.(v);
        }
      });
    };

    init();

    return () => {
      internalEditor?.dispose();
    };
  });

  // Sync external value changes → Monaco editor
  $effect(() => {
    const ed = editorInstance;
    const v = value;
    if (ed && v !== ed.getValue()) {
      settingValue = true;
      ed.setValue(v);
      settingValue = false;
    }
  });

  // Sync language changes → Monaco editor model
  $effect(() => {
    const ed = editorInstance;
    const m = monacoRef;
    const lang = language; // track language prop
    if (ed && m) {
      const monacoLang = langMap[lang] ?? 'plaintext';
      const model = ed.getModel();
      if (model) {
        m.editor.setModelLanguage(model, monacoLang);
      }
    }
  });
</script>

<div
  bind:this={container}
  style="height: {height}; width: 100%;"
  class="overflow-hidden rounded"
></div>


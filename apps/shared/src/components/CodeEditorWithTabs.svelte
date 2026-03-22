<script lang="ts">
  import loader from '@monaco-editor/loader';
  import type * as Monaco from 'monaco-editor';

  console.log('[CodeEditorWithTabs] Script executed');

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

  const extMap: Record<string, string> = {
    cpp: '.ino', arduino: '.ino', rust: '.rs', 
    python: '.py', micropython: '.py', upython: '.py', 
    st: '.st',
  };

  const headerExtMap: Record<string, string> = {
    cpp: '.h', arduino: '.h', rust: '.rs', 
    python: '.py', micropython: '.py', upython: '.py', 
    st: '.st',
  };

  const defaultContentMap: Record<string, string> = {
    cpp: '// arduino/cpp code',
    rust: '// rust code',
    python: '# python code',
    st: '(* structured text *)',
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

  function handleLanguageChange(event: Event) {
    const newLang = (event.target as HTMLSelectElement).value;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!monaco || !editor) return;

    // Update ALL tabs to match the new language environment
    tabs = tabs.map(tab => {
      const isMain = tab.id === 'main'; // simple heuristic for wireframe
      const isHelper = tab.label.toLowerCase().includes('helper');
      
      let newExt = extMap[newLang] ?? '.txt';
      if (isHelper && (newLang === 'cpp' || newLang === 'arduino')) {
        newExt = '.h';
      }

      const baseName = tab.label.split('.')[0] || tab.id;
      const newLabel = baseName + newExt;

      // If switching to a new language and the content is default/empty, reset it
      let newValue = tab.value;
      const isDefault = tab.value.trim() === '' || 
                        tab.value.trim() === '// helper' || 
                        tab.value.trim() === '// helper header' ||
                        Object.values(defaultContentMap).includes(tab.value.trim());

      if (isHelper && isDefault) {
        newValue = defaultContentMap[newLang] ?? tab.value;
      }

      const updatedTab = { 
        ...tab, 
        language: newLang,
        label: newLabel,
        value: newValue,
      };

      // Update Monaco model language and content if it exists
      const model = models.get(tab.id);
      if (model) {
        monaco!.editor.setModelLanguage(model, monacoLang(newLang));
        if (newValue !== tab.value) {
          model.setValue(newValue);
        }
      }

      return updatedTab;
    });

    // Notify parent
    if (activeTab) {
      onCodeChange?.(activeTabId, activeTab.value);
    }
  }

  $effect(() => {
    if (!container) return; // Wait until container is bound

    let isCancelled = false;

    (async () => {
      try {
        console.log('[CodeEditorWithTabs] Starting loader.init()');
        monaco = await loader.init();
        if (isCancelled) return;

        console.log('[CodeEditorWithTabs] loader.init() completed', !!monaco);

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

        console.log('[CodeEditorWithTabs] Creating editor in container:', container.offsetWidth, 'x', container.offsetHeight);

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

        console.log('[CodeEditorWithTabs] Editor created successfully');

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
          console.log('[CodeEditorWithTabs] Switching to tab:', activeTabId);
          switchTab(activeTabId);
        }
      } catch (err) {
        console.error('[CodeEditorWithTabs] Initialization Error:', err);
      }
    })();

    return () => {
      isCancelled = true;
      editor?.dispose();
      models.forEach(m => m.dispose());
      models.clear();
    };
  });

  // removed old effect cleanup

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
  <div style="display: flex; align-items: center; background: #18181b; border-bottom: 1px solid #27272a; overflow-x: auto; flex-shrink: 0; justify-content: space-between;">
    <div style="display: flex; align-items: center;">
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

    <!-- Language Selector -->
    <div style="padding: 0 12px;">
      <select
        style="background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46; border-radius: 4px; padding: 2px 8px; font-size: 12px; outline: none; cursor: pointer;"
        value={tabs.find(t => t.id === activeTabId)?.language ?? 'cpp'}
        onchange={handleLanguageChange}
      >
        <option value="cpp">C++ (Arduino)</option>
        <option value="rust">Rust</option>
        <option value="python">MicroPython</option>
        <option value="st">Structured Text</option>
      </select>
    </div>
  </div>

  <!-- Editor container — uses explicit inline styles to avoid Tailwind issues -->
  <div style="flex: 1; position: relative; min-height: 0;">
    <div bind:this={container} style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
  </div>
</div>

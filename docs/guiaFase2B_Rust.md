Tenho tudo. Quadro completo confirmado. Escrevo o guia.

***

# Guia Sub-Fase 2B — Editores de Código + ASL Viewer

## Estado confirmado antes de começar

| Item | Estado real |
|---|---|
| `@monaco-editor/loader ^1.4.0` | ✅ instalado em `apps/shared` |
| `crates/neuroforge-asl/src/wasm/bindings.rs` | ✅ expõe `wasm_transpile`, `wasm_transpile_with_map`, `wasm_parse_to_asl`, `wasm_get_diagnostics`, `wasm_version`, `wasm_supported_langs` |
| `wasm-bindgen = "0.2"` no crate | ✅ configurado |
| `build:wasm` script na raiz | ⚠️ aponta para `apps/webapp/` — precisa de update |
| `apps/desktop/package.json` | ⚠️ SvelteKit + Tauri 2, **falta adicionar** `@tauri-apps/api` |
| `.gitignore` (raiz) | ⚠️ `.svelte-kit/` ainda não está no root gitignore |
| `+page.svelte` | ✅ stub vazio, pronto para receber layout |
| `tailwindcss ^4` com `@import "tailwindcss"` | ✅ configurado |

***

## Pré-requisitos antes da 2B

### 1. Corrigir `.gitignore` — adicionar `.svelte-kit/`

Adicionar ao `.gitignore` na raiz:

```
# SvelteKit generated
.svelte-kit/
```

### 2. Adicionar `@tauri-apps/api` ao desktop

O `SerialMonitor.svelte` já usa `invoke` mas `@tauri-apps/api` não está no `package.json` do desktop. 

```bash
pnpm --filter @neuroforge/desktop add @tauri-apps/api
```

### 3. Script WASM para `apps/shared/`

O script actual da raiz envia o output para `apps/webapp/` que já não existe.  Actualizar o `package.json` da raiz:

```json
"build:wasm": "cd crates/neuroforge-asl && wasm-pack build --target web --out-dir ../../apps/shared/src/lib/wasm --no-default-features"
```

> **Nota importante:** O flag `--no-default-features` é obrigatório porque o feature `native` inclui `tokio`, que não compila para `wasm32`. 

Correr uma vez localmente para gerar o output antes de usar nos componentes:

```bash
pnpm build:wasm
```

Isto gera em `apps/shared/src/lib/wasm/`:
```
neuroforge_asl.js          ← glue code JS
neuroforge_asl_bg.wasm     ← binário WASM
neuroforge_asl.d.ts        ← tipos TypeScript
package.json               ← gerado pelo wasm-pack
```

Adicionar ao `.gitignore`:
```
# WASM build output (gerado automaticamente)
apps/shared/src/lib/wasm/
```

***

## 1. Store WASM — `asl.svelte.ts`

O WASM precisa de ser inicializado uma única vez de forma assíncrona. Criar um store dedicado em `apps/shared/src/state/`:

```ts
// apps/shared/src/state/asl.svelte.ts

type WasmModule = typeof import('../lib/wasm/neuroforge_asl.js');

class AslState {
  ready    = $state(false);
  error    = $state<string | null>(null);
  #mod: WasmModule | null = null;

  async init() {
    if (this.ready) return;
    try {
      const mod = await import('../lib/wasm/neuroforge_asl.js');
      await mod.default(); // chama init() do wasm-bindgen
      this.#mod = mod;
      this.ready = true;
    } catch (e) {
      this.error = String(e);
    }
  }

  version(): string {
    return this.#mod?.wasm_version() ?? '—';
  }

  supportedLangs(): string[] {
    return (this.#mod?.wasm_supported_langs() ?? '').split(',').filter(Boolean);
  }

  transpile(source: string, fromLang: string, toLang: string): string {
    if (!this.#mod) throw new Error('WASM não inicializado');
    return this.#mod.wasm_transpile(source, fromLang, toLang);
  }

  transpileWithMap(source: string, fromLang: string, toLang: string): { output: string; source_map: [number, number][] } {
    if (!this.#mod) throw new Error('WASM não inicializado');
    return JSON.parse(this.#mod.wasm_transpile_with_map(source, fromLang, toLang));
  }

  parseToAsl(source: string, lang: string): unknown {
    if (!this.#mod) throw new Error('WASM não inicializado');
    return JSON.parse(this.#mod.wasm_parse_to_asl(source, lang));
  }

  getDiagnostics(source: string, lang: string): Array<{ severity: string; context: string; message: string }> {
    if (!this.#mod) throw new Error('WASM não inicializado');
    return JSON.parse(this.#mod.wasm_get_diagnostics(source, lang));
  }
}

export const asl = new AslState();
```

Adicionar ao barrel `apps/shared/src/state/index.ts`:
```ts
export { asl } from './asl.svelte.ts';
```

***

## 2. `CodeEditor.svelte`

O editor Monaco via `@monaco-editor/loader` não usa React — é a API standalone.  Criar em `apps/shared/src/components/`:

```svelte
<!-- apps/shared/src/components/CodeEditor.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
  let monaco: typeof Monaco | undefined;

  // Mapeia nomes internos NeuroForge para IDs Monaco
  const langMap: Record<string, string> = {
    cpp: 'cpp', c: 'c', arduino: 'cpp',
    rust: 'rust', python: 'python', micropython: 'python',
    upython: 'python', st: 'plaintext', iec61131: 'plaintext',
  };

  onMount(async () => {
    monaco = await loader.init();

    // Tema escuro personalizado
    monaco.editor.defineTheme('neuroforge-dark', {
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

    editor = monaco.editor.create(container, {
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
      automaticLayout:  true,     // responde a resize do container
      bracketPairColorization: { enabled: true },
      renderWhitespace: 'none',
      smoothScrolling:  true,
      cursorBlinking:   'smooth',
      padding:          { top: 8, bottom: 8 },
    });

    editor.onDidChangeModelContent(() => {
      const v = editor!.getValue();
      value = v;
      onChange?.(v);
    });
  });

  // Sincroniza `value` externo → editor (sem loop: só actualiza se diferente)
  $effect(() => {
    if (editor && editor.getValue() !== value) {
      editor.setValue(value);
    }
  });

  // Sincroniza `language` → modelo Monaco
  $effect(() => {
    if (editor && monaco) {
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, langMap[language] ?? 'plaintext');
    }
  });

  onDestroy(() => {
    editor?.dispose();
  });
</script>

<div
  bind:this={container}
  style="height: {height}; width: 100%;"
  class="overflow-hidden rounded"
></div>
```

***

## 3. `CodeEditorWithTabs.svelte`

Gere múltiplos ficheiros com tabs — cada tab tem o seu próprio modelo Monaco para preservar histórico de undo/redo independente.

```svelte
<!-- apps/shared/src/components/CodeEditorWithTabs.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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

  let container = $state<HTMLDivElement | undefined>();
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

  // Garante que existe um model para cada tab
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

  onMount(async () => {
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

    if (!container) return;

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
      // Marcar tab como modificada
      tabs = tabs.map(t => t.id === activeTabId ? { ...t, value, modified: true } : t);
      onCodeChange?.(activeTabId, value);
    });

    // Activar primeira tab
    if (tabs.length > 0) {
      if (!activeTabId) activeTabId = tabs[0].id;
      switchTab(activeTabId);
    }
  });

  // Reagir a tabs adicionadas/removidas externamente
  $effect(() => {
    if (!monaco) return;
    // Criar models para tabs novas
    tabs.forEach(t => ensureModel(t));
    // Destruir models de tabs removidas
    models.forEach((_, id) => {
      if (!tabs.find(t => t.id === id)) {
        models.get(id)?.dispose();
        models.delete(id);
      }
    });
  });

  onDestroy(() => {
    editor?.dispose();
    models.forEach(m => m.dispose());
    models.clear();
  });
</script>

<div class="flex flex-col h-full" style="height: {height};">
  <!-- Tab bar -->
  <div class="flex items-center bg-zinc-900 border-b border-zinc-800 overflow-x-auto shrink-0">
    {#each tabs as tab (tab.id)}
      <button
        class="flex items-center gap-1 px-4 py-2 text-sm border-r border-zinc-800 whitespace-nowrap
               transition-colors
               {activeTabId === tab.id
                  ? 'bg-zinc-950 text-zinc-100 border-t-2 border-t-blue-500'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
        onclick={() => switchTab(tab.id)}
      >
        {tab.label}
        {#if tab.modified}
          <span class="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
        {/if}
        {#if onTabClose}
          <span
            class="ml-1 text-zinc-500 hover:text-zinc-200 leading-none"
            onclick={(e) => { e.stopPropagation(); onTabClose?.(tab.id); }}
          >✕</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Editor -->
  <div bind:this={container} class="flex-1 overflow-hidden"></div>
</div>
```

***

## 4. `ASLViewer.svelte`

Consome `asl.parseToAsl()` do WASM para renderizar a árvore ASL IR em modo debug. É o componente que prova que o pipeline Rust→WASM→Svelte está funcional. 

```svelte
<!-- apps/shared/src/components/ASLViewer.svelte -->
<script lang="ts">
  import { asl } from '../state/asl.svelte.ts';

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
```

***

## 5. Actualizar `index.ts` dos componentes

Criar `apps/shared/src/components/index.ts` — barrel de re-exports para facilitar imports no desktop:

```ts
// apps/shared/src/components/index.ts
export { default as CodeEditor }         from './CodeEditor.svelte';
export { default as CodeEditorWithTabs } from './CodeEditorWithTabs.svelte';
export { default as ASLViewer }          from './ASLViewer.svelte';
export { default as Terminal }           from './Terminal.svelte';
export { default as SerialMonitor }      from './SerialMonitor.svelte';
export { default as SerialTerminalPanel }from './SerialTerminalPanel.svelte';
export { default as SimulationModeToggle}from './SimulationModeToggle.svelte';
export { default as PropertiesPanel }    from './PropertiesPanel.svelte';
export { default as TopToolbar }         from './TopToolbar.svelte';
export { default as LeftSidebar }        from './LeftSidebar.svelte';
export { default as FloatingWindow }     from './FloatingWindow.svelte';
export { default as ComponentsLibrary }  from './ComponentsLibrary.svelte';
```

***

## 6. Smoke test em `+page.svelte`

Para validar que tudo funciona — montar um layout de teste que exercita os três componentes da 2B:

```svelte
<!-- apps/desktop/src/routes/+page.svelte -->
<script lang="ts">
  import '../app.css';
  import { CodeEditorWithTabs, ASLViewer } from '@neuroforge/shared/src/components/index.ts';
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

<div class="flex h-screen w-screen overflow-hidden">
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
```

***

## 7. CI `svelte.yml` — adicionar step WASM

```yaml
  build-wasm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      - uses: Swatinem/rust-cache@v2
      - run: cargo install wasm-pack --locked
      - run: |
          cd crates/neuroforge-asl
          wasm-pack build --target web `
            --out-dir ../../apps/shared/src/lib/wasm `
            --no-default-features
```

***

## Checklist de saída da Sub-Fase 2B

- [ ] `.gitignore` corrigido — `.svelte-kit/` e `apps/shared/src/lib/wasm/` ignorados
- [ ] `@tauri-apps/api` adicionado ao `apps/desktop/package.json`
- [ ] `pnpm build:wasm` corre sem erros — output em `apps/shared/src/lib/wasm/`
- [ ] `apps/shared/src/state/asl.svelte.ts` criado
- [ ] `apps/shared/src/state/index.ts` actualizado com `asl`
- [ ] `apps/shared/src/components/CodeEditor.svelte` criado
- [ ] `apps/shared/src/components/CodeEditorWithTabs.svelte` criado
- [ ] `apps/shared/src/components/ASLViewer.svelte` criado
- [ ] `apps/shared/src/components/index.ts` barrel criado
- [ ] `+page.svelte` atualizado com smoke test
- [ ] `pnpm --filter @neuroforge/shared svelte-check` verde
- [ ] `pnpm --filter @neuroforge/desktop svelte-check` verde
- [ ] `pnpm dev:desktop` — janela abre, Monaco renderiza, ASLViewer mostra "a carregar WASM…" e depois o JSON do ASL IR
- [ ] CI `build-wasm` verde
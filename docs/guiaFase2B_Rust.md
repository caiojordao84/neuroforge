# Guia Sub-Fase 2B — Editores de Código e ASL Viewer

## Estado confirmado antes de escrever

| Item | Estado real |
|---|---|
| `CodeEditor.svelte` | ✅ **Já existe e está completo** — Monaco, tema `neuroforge-dark`, `langMap`, `$bindable`, `onMount`/`dispose`  |
| `CodeEditorWithTabs.svelte` | ✅ **Já existe e está completo** — multi-model Monaco, tab bar, `switchTab`, `ensureModel`, `onCodeChange`  |
| `ASLViewer.svelte` | ✅ **Já existe e está completo** — consome `asl.parseToAsl`, diagnósticos, lazy WASM init  |
| `asl.svelte.ts` | ✅ **Já existe** — `AslState` com `init()`, `transpile()`, `parseToAsl()`, `getDiagnostics()`  |
| `apps/shared/src/lib/wasm/` | ❌ **Não existe** — directório `lib/` ausente de `apps/shared/src/`  |
| `apps/shared/src/state/index.ts` | ⚠️ **`asl` não exportado** — `asl.svelte.ts` existe mas precisa ser adicionado ao barrel  |
| `apps/desktop/src-tauri/src/transport/serial.rs` | ✅ Existe — 4 commands Tauri  |
| `.svelte-kit/` committed | ⚠️ Deve ser removido do git (ver nota no fim) |

**Conclusão:** Os três componentes da 2B **já foram escritos** no mesmo commit `4d59dd5` — além do esperado. O que falta é a **ligação ao WASM real**: o bundle `neuroforge_asl.js` ainda não foi copiado para `apps/shared/src/lib/wasm/`, e o `asl` não está exportado no `index.ts`. 

***

## Tarefas da Sub-Fase 2B

### 1. Gerar o Bundle WASM para `apps/shared`

O `asl.svelte.ts` importa de `'../lib/wasm/neuroforge_asl.js'` — esse caminho aponta para `apps/shared/src/lib/wasm/`.  O script de build na raiz aponta para `apps/webapp/src/lib/wasm` — precisa de um script dedicado para `shared`.

**Adicionar ao `package.json` raiz** (junto ao script existente `build:wasm`): 

```json
"build:wasm:shared": "cd crates/neuroforge-asl && wasm-pack build --target web --out-dir ../../apps/shared/src/lib/wasm"
```

**Correr o build:**
```bash
# Windows (com wasi-sdk v25 já configurado de Fase 1)
pnpm build:wasm:shared

# Resultado esperado em apps/shared/src/lib/wasm/:
# ├── neuroforge_asl.js
# ├── neuroforge_asl_bg.wasm
# ├── neuroforge_asl_bg.wasm.d.ts
# └── neuroforge_asl.d.ts
```

**Verificar tamanho:**
```bash
# Deve ser < 2 MB (validado na Fase 1)
ls -lh apps/shared/src/lib/wasm/neuroforge_asl_bg.wasm
```

**Adicionar ao `.gitignore`** (ficheiros gerados não devem ser commitados):
```gitignore
# WASM gerado — regenerado em build/CI
apps/shared/src/lib/wasm/
apps/webapp/src/lib/wasm/

# SvelteKit generated files
apps/desktop/.svelte-kit/
apps/webapp/.svelte-kit/
apps/mobile/.svelte-kit/
```

***

### 2. Adicionar `asl` ao barrel de exports

O `apps/shared/src/state/index.ts` exporta `serial`, `connection`, `library`, `ui`, `files` — mas não `asl`.  O `ASLViewer.svelte` importa `asl` directamente do ficheiro — funciona, mas deve ser adicionado ao barrel para consistência.

**`apps/shared/src/state/index.ts`** — adicionar linha:
```ts
export { serial }     from './serial.svelte.ts';
export { connection } from './connection.svelte.ts';
export { library }    from './library.svelte.ts';
export { ui }         from './ui.svelte.ts';
export { files }      from './files.svelte.ts';
export { asl }        from './asl.svelte.ts';   // ← NOVO
```

***

### 3. Verificar os Tauri commands necessários para o ASL Viewer

O `ASLViewer.svelte` usa **WASM directamente** (sem Tauri invoke) — é o padrão correcto para o `apps/shared`, que é partilhado com WebApp e Mobile.  Não são necessários novos commands Tauri para a 2B.

O `asl.svelte.ts` inicializa o WASM com `import('../lib/wasm/neuroforge_asl.js')` — funciona em qualquer contexto browser (Tauri WebView incluído). 

**Confirmar que o `vite.config.ts` do desktop inclui suporte a assets WASM:**

```ts
// apps/desktop/vite.config.ts — verificar/adicionar optimizeDeps
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'esnext' },

  // WASM precisa de ser excluído do optimizeDeps
  optimizeDeps: {
    exclude: ['@neuroforge/shared'],
  },

  // Ficheiros .wasm devem ser servidos com tipo MIME correcto
  assetsInclude: ['**/*.wasm'],
});
```

***

### 4. Verificar `CodeEditor.svelte` — Tokenizer Arduino

O `CodeEditor.svelte` actual **define um tema** mas **não registou um tokenizer Arduino/C++ customizado**.  O `langMap` mapeia `arduino → 'cpp'` que funciona, mas o original React tinha um tokenizer específico.

**Verificar se o tokenizer Arduino do original está documentado:**
```bash
# Confirmar se o ficheiro original tinha tokenizer custom
# O CodeEditor.tsx original usava monaco.languages.setMonarchTokensProvider
# Verificar crates/neuroforge-asl/src/parser/language_registry.rs
# para ver se as keywords Arduino estão lá
```

Para a 2B, o Monaco com `language: 'cpp'` é suficiente para Arduino/C++. O tokenizer completo vai para a 2G (polish) se necessário.

***

### 5. `CodeEditorWithTabs.svelte` — `files.svelte.ts` integration

O `CodeEditorWithTabs.svelte` expõe `onCodeChange(tabId, value)` mas **não integra com `files.svelte.ts`**.  Este stub de store precisa de ser expandido para a 2B para que o editor persista o código editado.

**`apps/shared/src/state/files.svelte.ts`** — expandir do stub actual:

```ts
// apps/shared/src/state/files.svelte.ts

export interface ProjectFile {
  id:       string;
  name:     string;
  language: string;      // 'cpp' | 'python' | 'rust' | 'st'
  content:  string;
  modified: boolean;
  path?:    string;      // caminho no filesystem (Desktop)
}

const STORAGE_KEY = 'neuroforge-files-store';
const genId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

class FilesState {
  files          = $state<ProjectFile[]>([]);
  activeFileId   = $state<string | null>(null);

  // Derived — ficheiro activo para o editor
  activeFile = $derived(
    this.files.find(f => f.id === this.activeFileId) ?? null
  );

  // Derived — tabs para CodeEditorWithTabs
  editorTabs = $derived(
    this.files.map(f => ({
      id:       f.id,
      label:    f.name,
      value:    f.content,
      language: f.language,
      modified: f.modified,
    }))
  );

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.files        = parsed.files        ?? [];
        this.activeFileId = parsed.activeFileId ?? null;
      }
      // Se não há ficheiros, criar um ficheiro de boas-vindas
      if (this.files.length === 0) {
        this.newFile('main.cpp', 'cpp',
          '// NeuroForge — RP2040 / Arduino\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n'
        );
      }
    } catch {}
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      files: this.files, activeFileId: this.activeFileId,
    }));
  }

  newFile(name: string, language: string, content = ''): string {
    const f: ProjectFile = { id: genId(), name, language, content, modified: false };
    this.files = [...this.files, f];
    this.activeFileId = f.id;
    this.persist();
    return f.id;
  }

  updateContent(id: string, content: string) {
    this.files = this.files.map(f =>
      f.id === id ? { ...f, content, modified: true } : f
    );
    this.persist();
  }

  saveFile(id: string) {
    this.files = this.files.map(f =>
      f.id === id ? { ...f, modified: false } : f
    );
    this.persist();
  }

  closeFile(id: string) {
    const remaining = this.files.filter(f => f.id !== id);
    this.files = remaining;
    if (this.activeFileId === id)
      this.activeFileId = remaining.at(-1)?.id ?? null;
    this.persist();
  }

  setActiveFile(id: string) {
    this.activeFileId = id;
    this.persist();
  }

  renameFile(id: string, name: string) {
    this.files = this.files.map(f =>
      f.id === id ? { ...f, name, modified: true } : f
    );
    this.persist();
  }
}

export const files = new FilesState();
```

***

### 6. Integrar `CodeEditorWithTabs` com `files` + `asl`

Criar a página de teste em `apps/desktop/src/routes/+page.svelte` que junta o editor + ASL viewer, servindo como prova de funcionamento end-to-end da 2B:

```svelte
<!-- apps/desktop/src/routes/+page.svelte -->
<script lang="ts">
  import CodeEditorWithTabs from '@neuroforge/shared/src/components/CodeEditorWithTabs.svelte';
  import ASLViewer          from '@neuroforge/shared/src/components/ASLViewer.svelte';
  import { files }          from '@neuroforge/shared/src/state/files.svelte.ts';
  import { asl }            from '@neuroforge/shared/src/state/asl.svelte.ts';

  // Inicializar WASM na montagem da página
  $effect(() => { asl.init(); });

  // Fonte activa para o ASLViewer (código do ficheiro activo)
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
```

**Nota sobre o alias `@neuroforge/shared`:** O `tsconfig.json` e `vite.config.ts` do Desktop precisam de mapear o package workspace. O pnpm já resolve automaticamente `@neuroforge/shared` via `workspace:*`. Confirmar que o alias está em `apps/desktop/tsconfig.json`:

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@neuroforge/shared/*": ["../shared/src/*"]
    }
  }
}
```

***

### 7. CI — Adicionar `build:wasm:shared` ao `svelte.yml`

```yaml
# .github/workflows/svelte.yml — adicionar job build-wasm-shared
  build-wasm-shared:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: wasm32-unknown-unknown }
      - run: cargo install wasm-pack
      - run: pnpm build:wasm:shared
      - name: Check WASM size
        run: |
          SIZE=$(wc -c < apps/shared/src/lib/wasm/neuroforge_asl_bg.wasm)
          [ "$SIZE" -lt 2097152 ] || (echo "WASM > 2 MB!" && exit 1)
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @neuroforge/shared svelte-check
      - run: pnpm --filter @neuroforge/desktop svelte-check
```

***

## Checklist de saída da Sub-Fase 2B

- [ ] `pnpm build:wasm:shared` corre sem erros e produz `apps/shared/src/lib/wasm/neuroforge_asl_bg.wasm`
- [ ] `.gitignore` actualizado — `apps/shared/src/lib/wasm/` e `apps/desktop/.svelte-kit/` ignorados
- [ ] `files.svelte.ts` expandido com `ProjectFile`, `editorTabs`, `updateContent`, `saveFile`, `closeFile`
- [ ] `apps/shared/src/state/index.ts` exporta `asl`
- [ ] `apps/desktop/src/routes/+page.svelte` mostra editor + ASL viewer lado a lado
- [ ] `apps/desktop/tsconfig.json` tem path alias `@neuroforge/shared/*`
- [ ] `apps/desktop/vite.config.ts` tem `assetsInclude: ['**/*.wasm']` e `optimizeDeps.exclude`
- [ ] `package.json` raiz tem script `build:wasm:shared`
- [ ] `tauri dev` abre janela com Monaco funcional (escrever código → ASL tree actualiza em tempo real)
- [ ] `asl.ready === true` visível no header do ASLViewer (versão do crate)
- [ ] `pnpm --filter @neuroforge/shared svelte-check` verde
- [ ] `pnpm --filter @neuroforge/desktop svelte-check` verde
- [ ] CI `svelte.yml` verde (incluindo `build-wasm-shared`)

***

## Nota Adicional — `.svelte-kit/` no Git

O commit `4d59dd5` incluiu `apps/desktop/.svelte-kit/` — ficheiros gerados automaticamente pelo SvelteKit.  Devem ser removidos do tracking:

```bash
git rm -r --cached apps/desktop/.svelte-kit/
# Depois commit com mensagem: "chore: untrack .svelte-kit generated files"
```
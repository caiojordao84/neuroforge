Tenho tudo. Agora tenho o quadro completo real do repositório. Escrevo o guia.

***

# Guia React Tombstone + Sub-Fase 2A

## Estado confirmado antes de escrever

| Item | Estado real |
|---|---|
| `apps/desktop/` | ✅ Existe — Tauri 2 esqueleto, `package.json` com `svelte ^5`, `@tauri-apps/cli ^2` |
| `apps/desktop/src-tauri/src/lib.rs` | ✅ Existe — `tauri::Builder::default()` vazio, sem commands |
| `apps/desktop/src-tauri/Cargo.toml` | ✅ Existe — `tauri 2`, `neuroforge-asl` como dependência, **sem** `tauri-plugin-serialport` |
| `apps/shared/package.json` | ✅ Existe — `@xyflow/svelte ^1.0.0`, `@monaco-editor/loader`, `bits-ui`, `tailwindcss ^4` — **Svelte já instalado, sem React** |
| `apps/webapp/`, `apps/mobile/` | ✅ Existem no pnpm-workspace |
| `pnpm-workspace.yaml` | ✅ Correcto — 4 packages |
| `vite.config.ts` (raiz) | ⚠️ **Raiz ainda tem `@vitejs/plugin-react`** — é o Vite da SPA React legacy |
| `src/` (raiz) | ⚠️ **SPA React legacy** — todos os `.tsx`, stores Zustand, `FlowEditor.tsx` (42KB) |
| `src/stores/` | ✅ Lidos — `useSerialStore`, `useConnectionStore`, `useLibraryStore`, `useSimulationStore`, `useUIStore`, `useFileStore`, `useQEMUStore` |
| `src/components/` | ✅ Lidos — 22 ficheiros `.tsx` + subdirs `boards/`, `nodes/`, `edges/`, `ui/` |
| `server/` | ⚠️ **Node.js server ainda existe** — eliminar com o Tombstone |
| CI Svelte | ❌ Não existe — só `rust.yml` |

**Conclusão crítica:** `apps/shared` **já tem Svelte 5 e `@xyflow/svelte`** — o monorepo Svelte está pronto. O que falta é: (1) eliminar a SPA React da raiz, (2) criar o SvelteKit em `apps/desktop/src/`, (3) criar os stores Svelte, (4) implementar `transport/serial.rs`. 

***

## Pré-condição — React Tombstone

### 1. Eliminar a SPA React da raiz

```powershell
# Na raiz do repositório, executar no PowerShell:
Remove-Item -Recurse -Force src
Remove-Item -Recurse -Force server
Remove-Item -Force index.html, vite.config.ts, postcss.config.js, tailwind.config.js, tsconfig.app.json, tsconfig.node.json, components.json, eslint.config.js

# ATENÇÃO: NÃO APAGUE o package.json da raiz!
# Ele contém os scripts vitais do workspace (dev:desktop, build:wasm, check:rust, etc).
# Se houver um package-lock.json antigo (o pnpm usa pnpm-lock.yaml), pode apagá-lo:
if (Test-Path package-lock.json) { Remove-Item -Force package-lock.json }
```

> ⚠️ Preservar intactos: `Cargo.toml`, `Cargo.lock`, `pnpm-workspace.yaml`, `crates/`, `apps/`, `docs/`, `.github/`, `public/` (assets), `AGENTS.md`

### 2. Desinstalar dependências React do workspace

```powershell
# Verificar se algum apps/* ainda tem react — não devem, mas confirmar
Select-String -Path "apps/*/package.json" -Pattern '"react"'
# Resultado esperado: sem output
```

O `apps/shared/package.json` já **não tem React** — só Svelte 5, `@xyflow/svelte`, `bits-ui`, Tailwind CSS 4.  Nenhuma remoção adicional necessária.

### 3. Criar `svelte.yml` no CI

Criar `.github/workflows/svelte.yml` — inicialmente só verifica que o build não quebra:

```yaml
name: Svelte

on:
  push:
    branches: [preRust]
  pull_request:
    branches: [preRust]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @neuroforge/shared svelte-check
      - run: pnpm --filter @neuroforge/desktop svelte-check
```

**Critério de saída do Tombstone:** `cargo check --workspace` verde. `grep -r "react" apps/*/package.json` sem output. CI `rust.yml` continua verde.

***

## Sub-Fase 2A — Setup + Stores + Componentes Atómicos

### 1. Setup SvelteKit em `apps/desktop/`

O `apps/desktop/` tem Tauri 2 mas **não tem SvelteKit** — só `src-tauri/`. Criar a estrutura frontend:

```
apps/desktop/
├── src/                          ← NOVO
│   ├── app.html
│   ├── app.css
│   └── routes/
│       └── +page.svelte          ← entry point
├── svelte.config.js              ← NOVO
├── vite.config.ts                ← NOVO (Svelte, sem React)
├── tsconfig.json                 ← NOVO
└── package.json                  ← já existe, adicionar svelte-check + @sveltejs/kit
```

**`apps/desktop/svelte.config.js`:**
```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
  },
};
```

**`apps/desktop/vite.config.ts`:**
```ts
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  // Tauri espera que o dev server corra em 1420
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'esnext' },
});
```

**`apps/desktop/package.json`** — adicionar devDependencies:
```json
{
  "name": "@neuroforge/desktop",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev":          "tauri dev",
    "build":        "tauri build",
    "svelte-check": "svelte-check --tsconfig ./tsconfig.json"
  },
  "dependencies": {
    "@neuroforge/shared": "workspace:*"
  },
  "devDependencies": {
    "@tauri-apps/cli":              "^2",
    "@sveltejs/kit":                "^2.0.0",
    "@sveltejs/adapter-static":     "^3.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "svelte":                       "^5.0.0",
    "svelte-check":                 "^4.0.0",
    "typescript":                   "^5.5.0",
    "vite":                         "^6.0.0"
  }
}
```

### 2. Tauri `tauri.conf.json`

Verificar/criar `apps/desktop/src-tauri/tauri.conf.json` com `devUrl` apontando para o SvelteKit dev server:

```json
{
  "app": {
    "windows": [{ "title": "NeuroForge", "width": 1400, "height": 900 }]
  },
  "build": {
    "devUrl": "http://localhost:1420",
    "frontendDist": "../build"
  },
  "identifier": "com.neuroforge.desktop",
  "plugins": {}
}
```

### 3. Stores Svelte 5 Runes em `apps/shared/src/state/`

Cada store é um **singleton exportado** — sem `createStore()`, sem `writable()`. Svelte 5 Runes usam classes com `$state`.

***

#### `serial.svelte.ts`
Migração de `useSerialStore.ts` (Zustand) → Runes. 

```ts
// apps/shared/src/state/serial.svelte.ts

export type SerialLineType = 'output' | 'input' | 'error' | 'system';

export interface SerialLine {
  id: string;
  timestamp: string;
  text: string;
  type: SerialLineType;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface TerminalLine {
  id: string;
  timestamp: string;
  message: string;
  level: LogLevel;
}

const genId = () => Math.random().toString(36).substring(2, 9);
const ts    = () => new Date().toLocaleTimeString();

class SerialState {
  serialLines  = $state<SerialLine[]>([]);
  terminalLines = $state<TerminalLine[]>([]);
  baudRate     = $state(9600);
  autoScroll   = $state(true);

  addSerialLine(text: string, type: SerialLineType = 'output') {
    const line: SerialLine = { id: genId(), timestamp: ts(), text, type };
    this.serialLines = [...this.serialLines.slice(-499), line];
  }

  clearSerial()              { this.serialLines = []; }
  setBaudRate(r: number)     { this.baudRate = r; }
  setAutoScroll(v: boolean)  { this.autoScroll = v; }

  exportSerial(): string {
    return this.serialLines.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
  }

  // serialPrint preserva comportamento: sem \n → acrescenta à última linha
  serialPrint(text: string) {
    const last = this.serialLines.at(-1);
    if (last && last.type === 'output' && !last.text.endsWith('\n')) {
      const updated = [...this.serialLines];
      updated[updated.length - 1] = { ...last, text: last.text + text };
      this.serialLines = updated;
    } else {
      this.addSerialLine(text, 'output');
    }
  }

  serialPrintln(text: string) { this.addSerialLine(text, 'output'); }

  addTerminalLine(message: string, level: LogLevel = 'info') {
    const line: TerminalLine = { id: genId(), timestamp: ts(), message, level };
    this.terminalLines = [...this.terminalLines.slice(-199), line];
  }

  clearTerminal() { this.terminalLines = []; }
}

export const serial = new SerialState();
```

***

#### `connection.svelte.ts`
Migração de `useConnectionStore.ts`.  O tipo `Node`/`Edge` vem de `@xyflow/svelte`.

```ts
// apps/shared/src/state/connection.svelte.ts
import type { Node, Edge } from '@xyflow/svelte';

export interface WireConnection {
  id: string;
  source: string; // "nodeId:handleId"
  target: string;
}

const STORAGE_KEY = 'neuroforge-connection-store';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

class ConnectionState {
  nodes:       $state<Node[]>           = [];
  edges:       $state<Edge[]>           = [];
  connections: $state<WireConnection[]> = [];

  constructor() {
    const saved = loadFromStorage();
    if (saved) {
      this.nodes       = saved.nodes       ?? [];
      this.edges       = saved.edges       ?? [];
      this.connections = saved.connections ?? [];
    }
  }

  // Persistência automática — chamar após mutações
  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: this.nodes, edges: this.edges, connections: this.connections,
    }));
  }

  setNodes(nodes: Node[])  { this.nodes = nodes;  this.persist(); }
  setEdges(edges: Edge[])  { this.edges = edges;  this.persist(); }

  addNode(node: Node) {
    this.nodes = [...this.nodes, node];
    this.persist();
  }

  removeNode(id: string) {
    this.nodes       = this.nodes.filter(n => n.id !== id);
    this.edges       = this.edges.filter(e => e.source !== id && e.target !== id);
    this.connections = this.connections.filter(
      c => !c.source.startsWith(id) && !c.target.startsWith(id)
    );
    this.persist();
  }

  updateNode(id: string, data: Record<string, unknown>) {
    this.nodes = this.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n);
    this.persist();
  }

  updateNodePosition(id: string, pos: { x: number; y: number }) {
    this.nodes = this.nodes.map(n => n.id === id ? { ...n, position: pos } : n);
    this.persist();
  }

  addEdge(edge: Edge) {
    this.edges = [...this.edges, edge];
    this.connections = [...this.connections, {
      id: edge.id,
      source: `${edge.source}:${edge.sourceHandle ?? 'default'}`,
      target: `${edge.target}:${edge.targetHandle ?? 'default'}`,
    }];
    this.persist();
  }

  removeEdge(id: string) {
    this.edges       = this.edges.filter(e => e.id !== id);
    this.connections = this.connections.filter(c => c.id !== id);
    this.persist();
  }

  getConnectionsForPin(pinId: string): WireConnection[] {
    return this.connections.filter(c => c.source === pinId || c.target === pinId);
  }

  getComponentConnectedToPin(pin: number): { componentId: string; handleId: string } | null {
    const pinId = `board:D${pin}`;
    const conn  = this.connections.find(c => c.source === pinId || c.target === pinId);
    if (!conn) return null;
    const other = conn.source === pinId ? conn.target : conn.source;
    const [componentId, handleId = 'default'] = other.split(':');
    return { componentId, handleId };
  }

  clearAll() {
    this.nodes = []; this.edges = []; this.connections = [];
    this.persist();
  }
}

export const connection = new ConnectionState();
```

***

#### `library.svelte.ts`
Migração de `useLibraryStore.ts`.  `importLibraryFromUrl` no Desktop usa `fetch` nativo — sem alteração de comportamento.

```ts
// apps/shared/src/state/library.svelte.ts
export type Language = 'cpp' | 'micropython' | 'rust' | 'python';

export interface Library {
  id: string;
  name: string;
  content: string;
  language: Language;
  url?: string;
  isExternal: boolean;
  lastModified: number;
}

const STORAGE_KEY = 'neuroforge-library-store';
const genId = () => `lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

class LibraryState {
  libraries      = $state<Library[]>([]);
  activeLibraryId = $state<string | null>(null);

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.libraries       = parsed.libraries       ?? [];
        this.activeLibraryId = parsed.activeLibraryId ?? null;
      }
    } catch {}
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      libraries: this.libraries, activeLibraryId: this.activeLibraryId,
    }));
  }

  addLibrary(name: string, language: Language, content = ''): string {
    const lib: Library = { id: genId(), name, language, content, isExternal: false, lastModified: Date.now() };
    this.libraries = [...this.libraries, lib];
    this.activeLibraryId = lib.id;
    this.persist();
    return lib.id;
  }

  updateLibrary(id: string, updates: Partial<Library>) {
    this.libraries = this.libraries.map(l =>
      l.id === id ? { ...l, ...updates, lastModified: Date.now() } : l
    );
    this.persist();
  }

  deleteLibrary(id: string) {
    const newLibs = this.libraries.filter(l => l.id !== id);
    this.libraries = newLibs;
    if (this.activeLibraryId === id)
      this.activeLibraryId = newLibs[0]?.id ?? null;
    this.persist();
  }

  setActiveLibrary(id: string | null) {
    this.activeLibraryId = id;
    this.persist();
  }

  async importLibraryFromUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch library');
    const content = await res.text();
    const fileName = url.split('/').at(-1) ?? 'imported_lib';
    const language: Language = fileName.endsWith('.py') ? 'micropython' : 'cpp';
    const lib: Library = { id: genId(), name: fileName, content, language, url, isExternal: true, lastModified: Date.now() };
    this.libraries = [...this.libraries, lib];
    this.activeLibraryId = lib.id;
    this.persist();
    return lib.id;
  }
}

export const library = new LibraryState();
```

***

#### `ui.svelte.ts` e `files.svelte.ts`

Estes são migrados na **Sub-Fase 2F** (com `useUIStore` e `useFileStore`). Para a 2A, criar apenas stubs de exportação:

```ts
// apps/shared/src/state/ui.svelte.ts — stub para 2A
export class UiState {
  sidebarOpen = $state(true);
  activePanel = $state<string | null>(null);
}
export const ui = new UiState();
```

```ts
// apps/shared/src/state/files.svelte.ts — stub para 2A
export class FilesState {
  currentFile = $state<string | null>(null);
}
export const files = new FilesState();
```

#### `index.ts` — barrel de exports
```ts
// apps/shared/src/state/index.ts
export { serial }     from './serial.svelte.ts';
export { connection } from './connection.svelte.ts';
export { library }    from './library.svelte.ts';
export { ui }         from './ui.svelte.ts';
export { files }      from './files.svelte.ts';
```

***

### 4. `transport/serial.rs` no Tauri backend

Criar `apps/desktop/src-tauri/src/transport/serial.rs` com os três commands Tauri necessários para esta fase. Usa `serialport` crate.

**`apps/desktop/src-tauri/Cargo.toml`** — adicionar dependências:
```toml
[dependencies]
tauri            = { version = "2", features = [] }
serde            = { workspace = true }
serde_json       = { workspace = true }
neuroforge-asl   = { path = "../../../crates/neuroforge-asl" }
serialport       = "4"
tauri-plugin-serialport = "2"    # plugin oficial Tauri para serial
```

**`apps/desktop/src-tauri/src/transport/mod.rs`:**
```rust
pub mod serial;
```

**`apps/desktop/src-tauri/src/transport/serial.rs`:**
```rust
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct SerialPortInfo {
    pub name:  String,
    pub r#type: String,
}

/// Lista todas as portas série disponíveis no sistema.
#[command]
pub fn serial_list_ports() -> Result<Vec<SerialPortInfo>, String> {
    serialport::available_ports()
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|p| {
            let kind = match p.port_type {
                serialport::SerialPortType::UsbPort(_)    => "usb",
                serialport::SerialPortType::BluetoothPort => "bluetooth",
                serialport::SerialPortType::PciPort       => "pci",
                serialport::SerialPortType::Unknown       => "unknown",
            };
            Ok(SerialPortInfo { name: p.port_name, r#type: kind.to_string() })
        })
        .collect()
}

/// Estado partilhado da porta aberta (gerido pelo AppState do Tauri)
use std::sync::Mutex;

pub struct SerialState {
    pub port: Mutex<Option<Box<dyn serialport::SerialPort>>>,
}

impl SerialState {
    pub fn new() -> Self {
        Self { port: Mutex::new(None) }
    }
}

/// Abre uma porta série com o baud rate especificado.
#[command]
pub fn serial_open(
    state: tauri::State<SerialState>,
    port_name: String,
    baud_rate: u32,
) -> Result<(), String> {
    let port = serialport::new(&port_name, baud_rate)
        .timeout(std::time::Duration::from_millis(10))
        .open()
        .map_err(|e| e.to_string())?;
    *state.port.lock().unwrap() = Some(port);
    Ok(())
}

/// Fecha a porta série activa.
#[command]
pub fn serial_close(state: tauri::State<SerialState>) -> Result<(), String> {
    *state.port.lock().unwrap() = None;
    Ok(())
}

/// Envia dados pela porta série.
#[command]
pub fn serial_write(
    state: tauri::State<SerialState>,
    data: Vec<u8>,
) -> Result<usize, String> {
    let mut guard = state.port.lock().unwrap();
    let port = guard.as_mut().ok_or("Porta serial não aberta")?;
    port.write(&data).map_err(|e| e.to_string())
}
```

**`apps/desktop/src-tauri/src/lib.rs`** — registar commands e state:
```rust
mod transport;
use transport::serial::{SerialState, serial_list_ports, serial_open, serial_close, serial_write};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SerialState::new())
        .invoke_handler(tauri::generate_handler![
            serial_list_ports,
            serial_open,
            serial_close,
            serial_write,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

***

### 5. Componentes atómicos — lista e abordagem

Estes componentes **não dependem de SvelteFlow** — migram directamente com Svelte 5 Runes. Criar em `apps/shared/src/components/`.

| Componente Svelte | Origem React | Store usado |
|---|---|---|
| `Terminal.svelte` | `Terminal.tsx` (3.7KB) | `serial.terminalLines` |
| `SerialMonitor.svelte` | `SerialMonitor.tsx` (6.4KB) | `serial.serialLines`, `serial.baudRate` |
| `SerialTerminalPanel.svelte` | `SerialTerminalPanel.tsx` (8.3KB) | `serial` + Tauri `serial_write` |
| `SimulationModeToggle.svelte` | `SimulationModeToggle.tsx` (3.2KB) | `ui` |
| `PropertiesPanel.svelte` | `PropertiesPanel.tsx` (2.1KB) | `connection.nodes` |
| `TopToolbar.svelte` | `TopToolbar.tsx` (6.2KB) | `ui`, `files` |
| `LeftSidebar.svelte` | `LeftSidebar.tsx` (4.6KB) | `ui` |
| `FloatingWindow.svelte` | `FloatingWindow.tsx` (12.6KB) | `ui` |
| `ComponentsLibrary.svelte` | `ComponentsLibrary.tsx` (5.5KB) | `library` |

**Padrão de migração React → Svelte 5:**

```svelte
<!-- SerialMonitor.svelte -->
<script lang="ts">
  import { serial } from '../state/index.ts';

  // Sem props obrigatórias por agora — estado vem do store singleton
  let inputText = $state('');

  function handleSend() {
    if (!inputText.trim()) return;
    serial.addSerialLine(inputText, 'input');
    inputText = '';
    // Na 2A: TODO invoke('serial_write', ...) quando porta estiver aberta
  }
</script>

<div class="serial-monitor flex flex-col h-full">
  <div class="output flex-1 overflow-y-auto font-mono text-sm p-2">
    {#each serial.serialLines as line (line.id)}
      <div class="line {line.type}">[{line.timestamp}] {line.text}</div>
    {/each}
  </div>
  <div class="input flex gap-2 p-2 border-t border-zinc-700">
    <input
      bind:value={inputText}
      onkeydown={(e) => e.key === 'Enter' && handleSend()}
      class="flex-1 bg-zinc-900 text-white px-2 py-1 rounded text-sm"
      placeholder="Enviar..."
    />
    <button onclick={handleSend} class="px-3 py-1 bg-blue-600 rounded text-sm">
      Enviar
    </button>
  </div>
</div>
```

***

### 6. WASM do crate `neuroforge-asl` no Desktop

O `package.json` raiz já tem o script `build:wasm`.  Para integrar no Desktop:

```bash
# Gerar o WASM (correr uma vez; depois o CI trata)
pnpm build:wasm
# Output: apps/webapp/src/lib/wasm/
# Para o Desktop, copiar para apps/shared/src/lib/wasm/ ou criar script dedicado
```

Adicionar script dedicado ao `package.json` raiz:
```json
"build:wasm:desktop": "cd crates/neuroforge-asl && wasm-pack build --target web --out-dir ../../apps/shared/src/lib/wasm"
```

***

### 7. CI `svelte.yml` actualizado para 2A

```yaml
name: Svelte

on:
  push:    { branches: [preRust] }
  pull_request: { branches: [preRust] }

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @neuroforge/shared svelte-check
      - run: pnpm --filter @neuroforge/desktop svelte-check

  build-wasm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: wasm32-unknown-unknown }
      - run: cargo install wasm-pack
      - run: pnpm build:wasm:desktop
```

***

## Checklist de saída da Sub-Fase 2A

- [ ] `src/` da raiz eliminado — zero ficheiros `.tsx`
- [ ] `server/` eliminado
- [ ] `vite.config.ts` da raiz eliminado
- [ ] `apps/desktop/svelte.config.js` criado
- [ ] `apps/desktop/vite.config.ts` criado (SvelteKit, porta 1420)
- [ ] `apps/desktop/src-tauri/tauri.conf.json` com `devUrl: localhost:1420`
- [ ] `apps/shared/src/state/serial.svelte.ts` criado
- [ ] `apps/shared/src/state/connection.svelte.ts` criado
- [ ] `apps/shared/src/state/library.svelte.ts` criado
- [ ] `apps/shared/src/state/ui.svelte.ts` (stub)
- [ ] `apps/shared/src/state/files.svelte.ts` (stub)
- [ ] `apps/shared/src/state/index.ts` barrel
- [ ] `apps/desktop/src-tauri/src/transport/serial.rs` — 4 commands
- [ ] `apps/desktop/src-tauri/src/lib.rs` registado com `manage(SerialState)` + 4 handlers
- [ ] 9 componentes atómicos em `apps/shared/src/components/`
- [ ] `cargo check --workspace` verde
- [ ] `pnpm --filter @neuroforge/shared svelte-check` verde
- [ ] `pnpm --filter @neuroforge/desktop svelte-check` verde
- [ ] `tauri dev` abre janela com página Svelte (mesmo que vazia)
- [ ] `.github/workflows/svelte.yml` verde
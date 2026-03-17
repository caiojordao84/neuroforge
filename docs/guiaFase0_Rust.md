Aqui está o guia completo da Fase 0, em blocos sequenciais com verificações de sucesso em cada passo.

***

# Fase 0 — Setup do Monorepo NeuroForge

> Todos os blocos indicam se precisam de **PowerShell Admin** (`PS-ADMIN`) ou **PowerShell normal** (`PS`). Corre cada bloco na ordem indicada e verifica o output antes de avançar.

***

## Bloco 1 — Instalar Rust via rustup

> 🔴 **PS-ADMIN**

```powershell
# Descarregar e instalar rustup
winget install --id Rustlang.Rustup -e --source winget

# Fechar e reabrir o PowerShell após a instalação, depois verificar:
rustup --version
rustc --version
cargo --version
```

**✅ Esperado:**

```
rustup 1.28.x
rustc 1.8x.x (stable)
cargo 1.8x.x
```


***

## Bloco 2 — Configurar Rust toolchain e targets

> 🟡 **PS normal** (após reabrir)

```powershell
# Garantir stable como default
rustup default stable

# Target Windows x64 MSVC (já instalado por defeito, confirmar)
rustup target add x86_64-pc-windows-msvc

# Target WASM (obrigatório para o crate neuroforge-asl no WebApp)
rustup target add wasm32-unknown-unknown

# Componentes úteis para desenvolvimento
rustup component add clippy rustfmt rust-analyzer

# Verificar targets instalados
rustup target list --installed
```

**✅ Esperado na lista:**

```
wasm32-unknown-unknown (installed)
x86_64-pc-windows-msvc (installed)
```


***

## Bloco 3 — Instalar ferramentas Rust globais

> 🟡 **PS normal**

```powershell
# wasm-pack — build do crate para WASM
cargo install wasm-pack

# Tauri CLI v2
cargo install tauri-cli --version "^2"

# Verificar
wasm-pack --version
cargo tauri --version
```

**✅ Esperado:**

```
wasm-pack 0.13.x
cargo-tauri 2.x.x
```

> ⚠️ Este bloco demora — o `cargo install` compila os binários localmente. Espera 5–15 minutos.

***

## Bloco 4 — Instalar Tauri CLI também via pnpm (para os apps)

> 🟡 **PS normal**

```powershell
# Tauri CLI como dev dependency global pnpm (usado nos apps desktop/mobile)
pnpm add -g @tauri-apps/cli@^2

# Verificar
pnpm tauri --version
```

**✅ Esperado:**

```
@tauri-apps/cli 2.x.x
```


***

## Bloco 5 — Criar estrutura de monorepo

> 🟡 **PS normal** — navegar para o repositório

```powershell
cd D:\Documents\NeuroForge\neuroforge

# Criar estrutura de directórios do monorepo
New-Item -ItemType Directory -Force -Path @(
    "apps/desktop/src-tauri/src/transport",
    "apps/desktop/src-tauri/src/firmware",
    "apps/desktop/src-tauri/capabilities",
    "apps/webapp/src/routes",
    "apps/webapp/src/lib/wasm",
    "apps/webapp/static",
    "apps/mobile/src-tauri/src",
    "apps/mobile/src-tauri/capabilities",
    "apps/shared/src/components/simulation/nodes",
    "apps/shared/src/components/simulation/edges",
    "apps/shared/src/components/flow-editor/nodes",
    "apps/shared/src/components/ladder-editor/elements",
    "apps/shared/src/components/code-editor",
    "apps/shared/src/components/asl-viewer",
    "apps/shared/src/components/serial",
    "apps/shared/src/components/firmware",
    "apps/shared/src/components/ui",
    "apps/shared/src/state",
    "apps/shared/src/engine",
    "crates/neuroforge-asl/src/schema",
    "crates/neuroforge-asl/src/types",
    "crates/neuroforge-asl/src/executor",
    "crates/neuroforge-asl/src/parser",
    "crates/neuroforge-asl/src/helpers",
    "crates/neuroforge-asl/src/flow",
    "crates/neuroforge-asl/src/transforms",
    "crates/neuroforge-asl/src/plugins/core",
    "crates/neuroforge-asl/src/plugins/c/shims",
    "crates/neuroforge-asl/src/plugins/python/shims",
    "crates/neuroforge-asl/src/plugins/rust_std/shims",
    "crates/neuroforge-asl/src/plugins/rust_embassy/shims",
    "crates/neuroforge-asl/src/plugins/plc",
    "crates/neuroforge-asl/src/optimizer",
    "crates/neuroforge-asl/src/analysis",
    "crates/neuroforge-asl/wasm",
    "crates/neuroforge-transport/src",
    "crates/neuroforge-firmware/src",
    "firmware/templates",
    "firmware/boards",
    "docs/legacy/poc",
    "tests/roundtrip",
    "tests/hardware-in-the-loop",
    "tests/ci",
    ".github/workflows"
)

Write-Host "✅ Estrutura de directorios criada."
```


***

## Bloco 6 — Criar `Cargo.toml` raiz (Workspace)

> 🟡 **PS normal**

```powershell
@'
[workspace]
members = [
    "crates/neuroforge-asl",
    "crates/neuroforge-transport",
    "crates/neuroforge-firmware",
    "apps/desktop/src-tauri",
    "apps/mobile/src-tauri",
]
resolver = "2"

[workspace.dependencies]
serde             = { version = "1", features = ["derive"] }
serde_json        = "1"
tokio             = { version = "1", features = ["full"] }
thiserror         = "1"
anyhow            = "1"
tracing           = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[profile.release]
opt-level     = "z"
lto           = true
codegen-units = 1
strip         = true

[profile.wasm-release]
inherits  = "release"
opt-level = "s"
'@ | Set-Content -Encoding UTF8 "Cargo.toml"

Write-Host "✅ Cargo.toml raiz criado."
```


***

## Bloco 7 — Criar `Cargo.toml` dos crates

> 🟡 **PS normal**

```powershell
# --- neuroforge-asl ---
@'
[package]
name    = "neuroforge-asl"
version = "4.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
serde       = { workspace = true }
serde_json  = { workspace = true }
thiserror   = { workspace = true }
anyhow      = { workspace = true }
wasm-bindgen = "0.2"

[dev-dependencies]
serde_json = { workspace = true }
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/Cargo.toml"

# --- neuroforge-transport ---
@'
[package]
name    = "neuroforge-transport"
version = "0.1.0"
edition = "2021"

[dependencies]
serde      = { workspace = true }
serde_json = { workspace = true }
tokio      = { workspace = true }
thiserror  = { workspace = true }
anyhow     = { workspace = true }
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-transport/Cargo.toml"

# --- neuroforge-firmware ---
@'
[package]
name    = "neuroforge-firmware"
version = "0.1.0"
edition = "2021"

[dependencies]
serde      = { workspace = true }
serde_json = { workspace = true }
thiserror  = { workspace = true }
anyhow     = { workspace = true }
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-firmware/Cargo.toml"

Write-Host "✅ Cargo.toml dos crates criados."
```


***

## Bloco 8 — Criar `lib.rs` placeholder nos crates

> 🟡 **PS normal**

```powershell
# neuroforge-asl
@'
//! neuroforge-asl — Motor ASL universal do NeuroForge
//! Migração de TypeScript → Rust em curso (Fase 1+)

pub mod types;
pub mod transforms;
pub mod flow;
pub mod executor;
pub mod parser;
pub mod helpers;
pub mod plugins;
pub mod optimizer;
pub mod analysis;
pub mod schema;
pub mod transpile;
'@ | Set-Content -Encoding UTF8 "crates/neuroforge-asl/src/lib.rs"

# Criar mod.rs / lib.rs placeholders mínimos para compilar
$placeholders = @(
    "crates/neuroforge-asl/src/transpile.rs",
    "crates/neuroforge-asl/src/schema/mod.rs",
    "crates/neuroforge-asl/src/types/mod.rs",
    "crates/neuroforge-asl/src/executor/mod.rs",
    "crates/neuroforge-asl/src/parser/mod.rs",
    "crates/neuroforge-asl/src/helpers/mod.rs",
    "crates/neuroforge-asl/src/flow/mod.rs",
    "crates/neuroforge-asl/src/transforms/mod.rs",
    "crates/neuroforge-asl/src/plugins/mod.rs",
    "crates/neuroforge-asl/src/plugins/core/mod.rs",
    "crates/neuroforge-asl/src/optimizer/mod.rs",
    "crates/neuroforge-asl/src/analysis/mod.rs",
    "crates/neuroforge-asl/wasm/bindings.rs",
    "crates/neuroforge-transport/src/lib.rs",
    "crates/neuroforge-firmware/src/lib.rs"
)

foreach ($file in $placeholders) {
    "// TODO: implementar" | Set-Content -Encoding UTF8 $file
}

Write-Host "✅ Placeholders lib.rs/mod.rs criados."
```


***

## Bloco 9 — Criar `Cargo.toml` dos apps Tauri

> 🟡 **PS normal**

```powershell
# --- desktop ---
@'
[package]
name    = "neuroforge-desktop"
version = "0.1.0"
edition = "2021"

[lib]
name = "neuroforge_desktop_lib"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri          = { version = "2", features = [] }
serde          = { workspace = true }
serde_json     = { workspace = true }
neuroforge-asl = { path = "../../crates/neuroforge-asl" }

[profile.release]
panic = "abort"
codegen-units = 1
opt-level = "s"
'@ | Set-Content -Encoding UTF8 "apps/desktop/src-tauri/Cargo.toml"

# Ficheiros mínimos para compilar
@'
fn main() {
    tauri_build::build()
}
'@ | Set-Content -Encoding UTF8 "apps/desktop/src-tauri/build.rs"

@'
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
'@ | Set-Content -Encoding UTF8 "apps/desktop/src-tauri/src/lib.rs"

@'
fn main() {
    neuroforge_desktop_lib::run()
}
'@ | Set-Content -Encoding UTF8 "apps/desktop/src-tauri/src/main.rs"

# --- mobile (placeholder mínimo por agora) ---
Copy-Item "apps/desktop/src-tauri/Cargo.toml" "apps/mobile/src-tauri/Cargo.toml"
(Get-Content "apps/mobile/src-tauri/Cargo.toml") -replace 'neuroforge-desktop','neuroforge-mobile' |
    Set-Content -Encoding UTF8 "apps/mobile/src-tauri/Cargo.toml"
Copy-Item "apps/desktop/src-tauri/build.rs"      "apps/mobile/src-tauri/build.rs"
Copy-Item "apps/desktop/src-tauri/src/lib.rs"    "apps/mobile/src-tauri/src/lib.rs"
Copy-Item "apps/desktop/src-tauri/src/main.rs"   "apps/mobile/src-tauri/src/main.rs"

Write-Host "✅ Cargo.toml e ficheiros mínimos dos apps Tauri criados."
```


***

## Bloco 10 — Criar `pnpm-workspace.yaml` e `package.json` raiz

> 🟡 **PS normal**

```powershell
@'
packages:
  - "apps/desktop"
  - "apps/webapp"
  - "apps/mobile"
  - "apps/shared"
'@ | Set-Content -Encoding UTF8 "pnpm-workspace.yaml"

@'
{
  "name": "neuroforge",
  "version": "4.0.0",
  "private": true,
  "scripts": {
    "dev:desktop": "pnpm --filter @neuroforge/desktop dev",
    "dev:webapp":  "pnpm --filter @neuroforge/webapp dev",
    "build:wasm":  "cd crates/neuroforge-asl && wasm-pack build --target web --out-dir ../../apps/webapp/src/lib/wasm",
    "check:rust":  "cargo check --workspace",
    "test:rust":   "cargo test --workspace",
    "lint:rust":   "cargo clippy --workspace -- -D warnings"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
'@ | Set-Content -Encoding UTF8 "package.json"

Write-Host "✅ pnpm-workspace.yaml e package.json raiz criados."
```


***

## Bloco 11 — Criar `package.json` dos apps

> 🟡 **PS normal**

```powershell
# shared
@'
{
  "name": "@neuroforge/shared",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@xyflow/svelte": "^1.0.0",
    "@monaco-editor/loader": "^1.4.0",
    "bits-ui": "^1.0.0",
    "tailwind-variants": "^0.2.0"
  },
  "devDependencies": {
    "svelte": "^5.0.0",
    "typescript": "^5.5.0",
    "@sveltejs/kit": "^2.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
'@ | Set-Content -Encoding UTF8 "apps/shared/package.json"

# webapp
@'
{
  "name": "@neuroforge/webapp",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev":   "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@neuroforge/shared": "workspace:*"
  },
  "devDependencies": {
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "svelte": "^5.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.5.0"
  }
}
'@ | Set-Content -Encoding UTF8 "apps/webapp/package.json"

# desktop
@'
{
  "name": "@neuroforge/desktop",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev":   "tauri dev",
    "build": "tauri build"
  },
  "dependencies": {
    "@neuroforge/shared": "workspace:*"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "svelte": "^5.0.0",
    "vite": "^6.0.0"
  }
}
'@ | Set-Content -Encoding UTF8 "apps/desktop/package.json"

# mobile (placeholder)
@'
{
  "name": "@neuroforge/mobile",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev":   "tauri android dev",
    "build": "tauri android build"
  },
  "dependencies": {
    "@neuroforge/shared": "workspace:*"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "svelte": "^5.0.0"
  }
}
'@ | Set-Content -Encoding UTF8 "apps/mobile/package.json"

Write-Host "✅ package.json dos apps criados."
```


***

## Bloco 12 — Arquivar ficheiros da Fase 0 (limpeza preRust)

> 🟡 **PS normal**

```powershell
# Arquivar poc/ se existir
if (Test-Path "poc") {
    Copy-Item -Recurse "poc" "docs/legacy/poc"
    Remove-Item -Recurse -Force "poc"
    Write-Host "✅ poc/ arquivado em docs/legacy/poc/"
}

# Arquivar fixes.md se existir
if (Test-Path "fixes.md") {
    Move-Item "fixes.md" "docs/legacy/fixes.md"
    Write-Host "✅ fixes.md arquivado em docs/legacy/"
}

Write-Host "✅ Limpeza Fase 0 concluída."
```


***

## Bloco 13 — Verificação de compilação Rust

> 🟡 **PS normal**

```powershell
cd D:\Documents\NeuroForge\neuroforge

# Verificar que o workspace Rust compila sem erros
cargo check --workspace

# Verificar que o crate ASL compila para WASM
cd crates/neuroforge-asl
cargo check --target wasm32-unknown-unknown
cd ../..
```

**✅ Esperado:** zero erros. Warnings de `dead_code` nos placeholders são normais e esperados.

***

## Bloco 14 — Instalar dependências pnpm e verificar workspace

> 🟡 **PS normal**

```powershell
cd D:\Documents\NeuroForge\neuroforge
pnpm install

# Verificar que o workspace resolve correctamente
pnpm ls -r --depth 0
```

**✅ Esperado:** lista os 4 packages (`desktop`, `webapp`, `mobile`, `shared`) sem erros de resolução.

***

## Bloco 15 — Commit inicial da Fase 0

> 🟡 **PS normal**

```powershell
cd D:\Documents\NeuroForge\neuroforge

git add .
git status

# Confirmar que os ficheiros correctos estão staged antes de commitar
# Depois:
git commit -m "feat: Fase 0 — monorepo Cargo + pnpm workspace setup

- Cargo.toml raiz com workspace members (neuroforge-asl, transport, firmware, desktop, mobile)
- Crate neuroforge-asl com estrutura completa de módulos (placeholders)
- Crates neuroforge-transport e neuroforge-firmware (placeholders)
- Apps desktop/mobile com Cargo.toml e ficheiros Tauri mínimos
- Apps webapp/shared com package.json SvelteKit + @xyflow/svelte
- pnpm-workspace.yaml com 4 packages
- Arquivados: poc/ e fixes.md em docs/legacy/
- Targets Rust: x86_64-pc-windows-msvc + wasm32-unknown-unknown"

git push origin preRust
```


***

## Ordem de execução resumida

| Bloco | Acção | Tipo |
| :-- | :-- | :-- |
| 1 | Instalar rustup | PS-ADMIN |
| 2 | Targets + componentes Rust | PS |
| 3 | wasm-pack + tauri-cli (cargo) | PS |
| 4 | tauri-cli (pnpm) | PS |
| 5 | Criar estrutura de dirs | PS |
| 6–9 | Criar todos os Cargo.toml | PS |
| 10–11 | Criar workspace pnpm + package.json | PS |
| 12 | Arquivar poc/ e fixes.md | PS |
| 13 | `cargo check --workspace` ✅ | PS |
| 14 | `pnpm install` ✅ | PS |
| 15 | Commit e push | PS |

> ⚠️ **Não elimines ainda** `blocklyToASL.ts`, `Transpiler.ts`, `example.ts` e `useQEMUStore.ts` — essas eliminações são da **Fase 0B** (após a Fase 1 do crate ASL estar funcional) para não quebrar o build React existente enquanto a migração decorre.


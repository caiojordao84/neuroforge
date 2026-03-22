import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss(),
    // Shim para resolver `import * from "env"` gerado pelo wasm-pack (tree-sitter)
    {
      name: 'wasm-env-shim',
      resolveId(source) {
        if (source === 'env') {
          return resolve(__dirname, '../shared/src/lib/wasm/env.js');
        }
      }
    }
  ],
  // Tauri espera que o dev server corra em 1420
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      allow: [
        resolve(__dirname, '..'),   // apps/ (inclui shared/)
        resolve(__dirname, '../..') // raíz do monorepo (node_modules, etc.)
      ]
    }
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'esnext' },
});

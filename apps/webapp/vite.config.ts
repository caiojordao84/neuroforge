import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@neuroforge/shared': resolve(__dirname, '../shared/src')
    }
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    {
      name: 'wasm-env-shim',
      resolveId(source) {
        if (source === 'env') {
          return resolve(__dirname, '../shared/src/lib/wasm/env.js');
        }
      }
    }
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    fs: {
      allow: [
        resolve(__dirname, '..'),   // apps/ (inclui shared/)
        resolve(__dirname, '../..') // raíz do monorepo
      ]
    }
  },
  ssr: {
    noExternal: ['@neuroforge/shared']
  },
  build: {
    rollupOptions: {
      external: ['neuroforge_asl', 'neuroforge_asl.js', 'neuroforge_asl_bg.wasm']
    }
  }
});

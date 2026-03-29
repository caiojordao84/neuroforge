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
    fs: {
      allow: [
        resolve(__dirname, '..'),   // apps/ (inclui shared/)
        resolve(__dirname, '../..') // raíz do monorepo
      ]
    }
  },
  ssr: {
    noExternal: ['@neuroforge/shared']
  }
});

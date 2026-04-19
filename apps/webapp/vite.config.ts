import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const crossOriginIsolation = () => ({
  name: 'cross-origin-isolation',
  configureServer(server: any) {
    server.middlewares.use((_req: any, res: any, next: any) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless'); // Allow cross-origin images without CORP
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      res.setHeader('Origin-Agent-Cluster', '?1');
      next();
    });
  }
});

export default defineConfig({
  resolve: {
    alias: {
      '@neuroforge/shared': resolve(__dirname, '../shared/src'),
      '@shared': resolve(__dirname, '../shared/src'),
      '@neuroforge/shared/state/asl.svelte.ts': resolve(__dirname, './src/lib/state/asl.svelte.ts'),
      '@neuroforge/shared/wasm': resolve(__dirname, './src/lib/wasm/pkg/neuroforge_asl.js')
    }
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    crossOriginIsolation(),
    {
      name: 'wasm-env-shim',
      resolveId(source) {
        if (source === 'env') {
          return resolve(__dirname, './src/lib/wasm/env.js');
        }
      }
    }
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Origin-Agent-Cluster": "?1"
    },
    fs: {
      allow: [
        resolve(__dirname, '..'),   // apps/ (inclui shared/)
        resolve(__dirname, '../..') // raíz do monorepo
      ]
    }
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Origin-Agent-Cluster": "?1"
    }
  },
  ssr: {
    noExternal: ['@neuroforge/shared']
  },
  optimizeDeps: {
    exclude: ['@neuroforge/shared/wasm']
  },
  build: {
    rollupOptions: {
      // Removing explicit externals to allow Vite to handle the excluded dep naturally
    }
  }
});

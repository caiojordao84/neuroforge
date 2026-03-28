import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    alias: {
      '@neuroforge/shared': '../shared/src'
    }
  }
  // Removido runes: true para permitir que componentes legados coexistam com Svelte 5 auto-detectado
};

export default config;

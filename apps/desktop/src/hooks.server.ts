import type { Handle } from '@sveltejs/kit';

/**
 * Server hooks for NeuroForge Desktop (Tauri).
 * Adds COOP/COEP headers to enable SharedArrayBuffer for the simulation engine.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Origin-Agent-Cluster', '?1');

  return response;
};

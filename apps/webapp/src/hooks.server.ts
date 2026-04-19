import type { Handle } from '@sveltejs/kit';

/**
 * Server hooks for NeuroForge WebApp.
 * Adds COOP/COEP headers to enable SharedArrayBuffer for the simulation engine.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

    event.setHeaders({
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Origin-Agent-Cluster': '?1'
    });

  return response;
};

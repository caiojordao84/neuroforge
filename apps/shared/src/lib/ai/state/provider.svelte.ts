/**
 * Provider State Management
 * 
 * Svelte state management for AI provider settings.
 * API keys are stored in memory only (not persisted).
 */

import { writable, derived, get } from 'svelte/store';
import { APIKeyManager } from '@shared/lib/ai/provider/api-key.manager';
import type { AIProviderType, ProviderState } from '@shared/lib/ai/provider/types';

/**
 * Provider state with user-provided API key (in-memory only)
 */
export interface UserProviderState extends ProviderState {
  apiKey: string; // User-provided, stored in memory only
}

/**
 * Create the provider store
 */
function createProviderStore() {
  // Get initial state from localStorage (for provider type only, NOT API key)
  const initial: UserProviderState = {
    type: APIKeyManager.getProviderType(),
    model: APIKeyManager.getModel(),
    configured: false, // Not configured until user provides API key
    apiKey: '', // In-memory only, never persisted
    error: null,
  };
  
  const { subscribe, set, update } = writable<UserProviderState>(initial);
  
  return {
    subscribe,
    
    /**
     * Set the provider type
     */
    setType: (type: AIProviderType) => {
      APIKeyManager.setProviderType(type);
      update(s => ({ 
        ...s, 
        type,
        // Will be configured once user provides API key
        configured: type !== 'none' && !!s.apiKey
      }));
    },
    
    /**
     * Set the model
     */
    setModel: (model: string) => {
      APIKeyManager.setModel(model);
      update(s => ({ ...s, model }));
    },
    
    /**
     * Set the user-provided API key (in-memory only, NOT persisted)
     */
    setApiKey: (apiKey: string) => {
      update(s => ({ 
        ...s, 
        apiKey,
        configured: s.type !== 'none' && !!apiKey
      }));
    },
    
    /**
     * Set configured status
     */
    setConfigured: (configured: boolean) => {
      update(s => ({ ...s, configured }));
    },
    
    /**
     * Set error message
     */
    setError: (error: string | null) => {
      update(s => ({ ...s, error }));
    },
    
    /**
     * Reset all settings (clears in-memory API key)
     */
    reset: () => {
      // Only clear persisted data from localStorage
      // API key remains in session but cleared from state
      APIKeyManager.clearAll();
      set({
        type: 'none',
        model: '',
        configured: false,
        apiKey: '',
        error: null,
      });
    },
    
    /**
     * Get current state
     */
    getState: () => {
      return get({ subscribe });
    },
  };
}

/**
 * Provider state store
 */
export const providerState = createProviderStore();

/**
 * Derived store for whether AI is available
 */
export const isAIConfigured = derived(
  providerState,
  $state => $state.type !== 'none' && $state.configured
);

/**
 * Derived store for currently selected provider name
 */
export const providerDisplayName = derived(
  providerState,
  $state => {
    switch ($state.type) {
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic Claude';
      case 'local': return 'Local Server';
      default: return 'None (WASM only)';
    }
  }
);

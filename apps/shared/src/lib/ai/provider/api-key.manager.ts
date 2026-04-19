/**
 * API Key Manager
 * 
 * Manages API keys stored in localStorage for AI provider authentication.
 */

import { STORAGE_KEYS, type AIProviderType } from './types';

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * API Key Manager class for managing AI provider API keys
 */
export class APIKeyManager {
  /**
   * Get OpenAI API key
   */
  static getOpenAIKey(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY);
  }

  /**
   * Set OpenAI API key
   */
  static setOpenAIKey(key: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.OPENAI_API_KEY, key);
  }

  /**
   * Get Anthropic API key
   */
  static getAnthropicKey(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(STORAGE_KEYS.ANTHROPIC_API_KEY);
  }

  /**
   * Set Anthropic API key
   */
  static setAnthropicKey(key: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.ANTHROPIC_API_KEY, key);
  }

  /**
   * Get selected provider type
   */
  static getProviderType(): AIProviderType {
    if (!isBrowser()) return 'none';
    const type = localStorage.getItem(STORAGE_KEYS.PROVIDER_TYPE);
    if (type === 'openai' || type === 'anthropic' || type === 'local' || type === 'none') {
      return type;
    }
    return 'none';
  }

  /**
   * Set selected provider type
   */
  static setProviderType(type: AIProviderType): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.PROVIDER_TYPE, type);
  }

  /**
   * Get selected model
   */
  static getModel(): string {
    if (!isBrowser()) return '';
    return localStorage.getItem(STORAGE_KEYS.MODEL) || '';
  }

  /**
   * Set selected model
   */
  static setModel(model: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.MODEL, model);
  }

  /**
   * Get local server base URL
   */
  static getBaseUrl(): string {
    if (!isBrowser()) return 'http://localhost:4096';
    return localStorage.getItem(STORAGE_KEYS.BASE_URL) || 'http://localhost:4096';
  }

  /**
   * Set local server base URL
   */
  static setBaseUrl(url: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.BASE_URL, url);
  }

  /**
   * Get API key for a specific provider type
   */
  static getAPIKeyForType(type: AIProviderType): string | null {
    switch (type) {
      case 'openai':
        return this.getOpenAIKey();
      case 'anthropic':
        return this.getAnthropicKey();
      default:
        return null;
    }
  }

  /**
   * Check if a provider is configured with API key
   */
  static isProviderConfigured(type: AIProviderType): boolean {
    if (type === 'none') return false;
    if (type === 'local') return true; // Local doesn't need API key
    return this.getAPIKeyForType(type) !== null && this.getAPIKeyForType(type) !== '';
  }

  /**
   * Clear all stored API keys and settings
   */
  static clearAll(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(STORAGE_KEYS.OPENAI_API_KEY);
    localStorage.removeItem(STORAGE_KEYS.ANTHROPIC_API_KEY);
    localStorage.removeItem(STORAGE_KEYS.PROVIDER_TYPE);
    localStorage.removeItem(STORAGE_KEYS.MODEL);
    localStorage.removeItem(STORAGE_KEYS.BASE_URL);
  }

  /**
   * Clear API key for a specific provider
   */
  static clearAPIKey(type: AIProviderType): void {
    if (!isBrowser()) return;
    switch (type) {
      case 'openai':
        localStorage.removeItem(STORAGE_KEYS.OPENAI_API_KEY);
        break;
      case 'anthropic':
        localStorage.removeItem(STORAGE_KEYS.ANTHROPIC_API_KEY);
        break;
    }
  }
}

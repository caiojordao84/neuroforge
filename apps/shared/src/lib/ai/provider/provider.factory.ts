/**
 * Provider Factory
 * 
 * Creates AI provider instances using @opencode-ai/sdk.
 */

import { createOpencode, createOpencodeClient } from "@opencode-ai/sdk";
import type { AIProvider, AIProviderConfig, ProviderCapability } from './types';
import { APIKeyManager } from './api-key.manager';
import { PROVIDER_MODELS } from './types';

/**
 * OpenCode wrapper that implements AIProvider interface
 */
class OpenCodeProvider implements AIProvider {
  private client: ReturnType<typeof createOpencodeClient> | null = null;
  private isEmbedded: boolean = false;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const apiKey = this.config.apiKey;
    const model = this.config.model || PROVIDER_MODELS[this.config.type as keyof typeof PROVIDER_MODELS] || 'local/default';

    if (this.config.type === 'local') {
      // Connect to local server
      const baseUrl = this.config.baseUrl || 'http://localhost:4096';
      this.client = createOpencodeClient({ baseUrl });
      this.isEmbedded = false;
    } else {
      // Use embedded OpenCode with API key
      const { client } = await createOpencode({
        config: {
          model,
          apiKey,
        }
      });
      this.client = client;
      this.isEmbedded = true;
    }
  }

  async sendMessage(params: {
    system?: string;
    message: string;
    temperature?: number;
  }): Promise<{ text: string; toolCalls?: never[] }> {
    if (!this.client) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }

    // Create session
    const session = await this.client.session.create({});
    const sessionId = session.data.id;

    // Send prompt
    const result = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        message: params.message,
        systemInstruction: params.system,
        outputFormat: 'text',
      }
    });

    // Extract response text
    const text = result.data.message?.parts?.[0]?.text || '';

    return { text };
  }

  async *streamMessage(params: {
    system?: string;
    message: string;
  }): AsyncGenerator<string> {
    if (!this.client) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }

    // For streaming, we use the session with streaming option
    const session = await this.client.session.create({});
    const sessionId = session.data.id;

    // Note: OpenCode SDK may not support streaming in all configurations
    // Fall back to non-streaming if not supported
    const result = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        message: params.message,
        systemInstruction: params.system,
        outputFormat: 'text',
      }
    });

    const text = result.data.message?.parts?.[0]?.text || '';
    yield text;
  }

  getCapability(): ProviderCapability {
    // Default capabilities based on provider type
    switch (this.config.type) {
      case 'openai':
        return {
          supportsStreaming: false,
          supportsTools: false,
          maxTokens: 128000,
          supportsVision: true,
        };
      case 'anthropic':
        return {
          supportsStreaming: false,
          supportsTools: false,
          maxTokens: 200000,
          supportsVision: true,
        };
      case 'local':
        return {
          supportsStreaming: false,
          supportsTools: false,
          maxTokens: 128000,
          supportsVision: false,
        };
      default:
        return {
          supportsStreaming: false,
          supportsTools: false,
          maxTokens: 64000,
        };
    }
  }

  async close(): Promise<void> {
    // OpenCode SDK handles cleanup automatically
    this.client = null;
  }
}

/**
 * Create an AI provider instance
 */
export async function createProvider(config: AIProviderConfig): Promise<AIProvider> {
  if (config.type === 'none') {
    throw new Error('Cannot create provider for type "none". Use WASM transpiler instead.');
  }

  const provider = new OpenCodeProvider(config);
  await provider.initialize();
  return provider;
}

/**
 * Create provider from stored preferences
 */
export async function createProviderFromStorage(): Promise<AIProvider | null> {
  const type = APIKeyManager.getProviderType();
  
  if (type === 'none' || !APIKeyManager.isProviderConfigured(type)) {
    return null;
  }

  const apiKey = APIKeyManager.getAPIKeyForType(type) || undefined;
  const model = APIKeyManager.getModel();
  const baseUrl = APIKeyManager.getBaseUrl();

  return createProvider({
    type,
    model: model || undefined,
    apiKey,
    baseUrl,
  });
}

/**
 * Check if any provider is configured
 */
export function isProviderConfigured(): boolean {
  const type = APIKeyManager.getProviderType();
  return type !== 'none' && APIKeyManager.isProviderConfigured(type);
}

/**
 * Get available provider types that are configured
 */
export function getAvailableProviders(): Array<{ type: AIProviderType; configured: boolean }> {
  return [
    { type: 'openai', configured: APIKeyManager.isProviderConfigured('openai') },
    { type: 'anthropic', configured: APIKeyManager.isProviderConfigured('anthropic') },
    { type: 'local', configured: true }, // Local is always "available"
    { type: 'none', configured: false },
  ];
}

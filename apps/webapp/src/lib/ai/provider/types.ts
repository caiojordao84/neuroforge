/**
 * AI Provider Integration Types
 * 
 * Type definitions for the NeuroForge AI Provider abstraction layer.
 */

import type { TranspileRequest, TranspileResult } from '$lib/types';

/**
 * Supported AI provider types
 */
export type AIProviderType = 'openai' | 'anthropic' | 'local' | 'none';

/**
 * Provider configuration
 */
export interface AIProviderConfig {
  type: AIProviderType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Provider capability metadata
 */
export interface ProviderCapability {
  supportsStreaming: boolean;
  supportsTools: boolean;
  maxTokens: number;
  supportsVision?: boolean;
}

/**
 * Tool call result from AI
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * OpenCode client wrapper interface
 */
export interface AIProvider {
  sendMessage(params: {
    system?: string;
    message: string;
    temperature?: number;
  }): Promise<{
    text: string;
    toolCalls?: ToolCall[];
  }>;
  
  streamMessage(params: {
    system?: string;
    message: string;
  }): AsyncGenerator<string>;
  
  getCapability(): ProviderCapability;
  
  close(): Promise<void>;
}

/**
 * Storage keys for localStorage
 */
export const STORAGE_KEYS = {
  OPENAI_API_KEY: 'neuroforge_openai_key',
  ANTHROPIC_API_KEY: 'neuroforge_anthropic_key',
  PROVIDER_TYPE: 'neuroforge_ai_provider',
  MODEL: 'neuroforge_ai_model',
  BASE_URL: 'neuroforge_opencode_url',
} as const;

/**
 * Default model configurations
 */
export const PROVIDER_MODELS = {
  openai: 'openai/gpt-4o',
  anthropic: 'anthropic/claude-3-5-sonnet-20241022',
  local: 'local/default',
} as const;

/**
 * Provider state for UI
 */
export interface ProviderState {
  type: AIProviderType;
  model: string;
  configured: boolean;
  error: string | null;
}

/**
 * Transpile mode selection
 */
export type TranspileMode = 'wasm' | 'ai' | 'auto';
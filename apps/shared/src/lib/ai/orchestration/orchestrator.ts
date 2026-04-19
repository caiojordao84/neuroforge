/**
 * Transpilation Orchestrator
 * 
 * Main orchestrator for AI-powered transpilation with WASM fallback.
 * Passes user's API key to server-side API for requests.
 */

import type { TranspileRequest, TranspileResult } from '@shared/lib/types';
import type { TranspileMode } from '@shared/lib/ai/provider/types';
import { asl } from '@shared/state/asl.svelte';
import { get } from 'svelte/store';
import { providerState } from '@shared/lib/ai/state/provider.svelte';

/**
 * Error types for orchestrator
 */
export class AIProviderError extends Error {
  constructor(message: string, public provider: string) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class APIKeyError extends AIProviderError {
  constructor(provider: string) {
    super(`API key not configured for ${provider}`, provider);
    this.name = 'APIKeyError';
  }
}

export class TranspileError extends Error {
  constructor(message: string, public code: string = '') {
    super(message);
    this.name = 'TranspileError';
  }
}

/**
 * Transpilation Orchestrator
 * Coordinates AI and WASM transpilation
 */
export class TranspilationOrchestrator {
  /**
   * Transpile using AI (with optional WASM fallback)
   */
  async transpile(request: TranspileRequest, mode: TranspileMode = 'auto'): Promise<TranspileResult> {
    // If mode is wasm only, use WASM directly
    if (mode === 'wasm') {
      return this.transpileWasm(request);
    }
    
    // Try AI first if configured
    if (mode === 'ai' || mode === 'auto') {
      try {
        return await this.transpileAI(request);
      } catch (error) {
        console.warn('AI transpilation failed:', error);
        
        // If mode is 'ai', throw the error
        if (mode === 'ai') {
          throw error;
        }
        
        // For 'auto' mode, fall back to WASM
        console.info('Falling back to WASM transpiler...');
      }
    }
    
    // Fall back to WASM
    return this.transpileWasm(request);
  }
  
  /**
   * Transpile using server-side API (calls /api/transpile)
   * Passes user's API key with each request
   */
  private async transpileAI(request: TranspileRequest): Promise<TranspileResult> {
    // Get user-provided API key from state
    const state = get(providerState);
    const apiKey = state.apiKey;
    const providerType = state.type;
    
    // If no API key configured, trigger fallback
    if (!apiKey || providerType === 'none') {
      throw new Error('AI provider not configured. Provide API key in settings.');
    }
    
    // Try calling server-side API with user's key
    const response = await fetch('/api/transpile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceLang: request.sourceLang,
        targetLang: request.targetLang,
        targetPlatform: request.targetPlatform,
        code: request.code,
        provider: providerType, // 'openai' or 'anthropic'
        apiKey: apiKey, // User-provided key
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // If fallback required, throw to trigger WASM fallback
      if (errorData.fallbackRequired) {
        throw new Error('AI provider not configured. Use WASM fallback.');
      }
      
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json() as TranspileResult;
    
    // Handle error responses
    if (result.error && result.fallbackRequired) {
      throw new Error('AI provider not configured. Use WASM fallback.');
    }
    
    return result;
  }
  
  /**
   * Transpile using WASM
   */
  private transpileWasm(request: TranspileRequest): TranspileResult {
    // Ensure WASM is ready (though it should be via layout/onMount init)
    if (!asl.ready) {
      throw new TranspileError('WASM engine is not initialized yet. Please wait a moment.');
    }

    // Convert language names to WASM format
    const fromLang = this.normalizeLanguage(request.sourceLang);
    const toLang = this.normalizeLanguage(request.targetLang);
    
    try {
      let code = "";
      if (request.libraries && request.libraries.length > 0) {
        const workspace = {
          main_source: request.code,
          libraries: request.libraries.map(l => ({ name: l.name, source: l.source }))
        };
        code = asl.transpileWorkspace(workspace, fromLang, toLang);
      } else {
        code = asl.transpile(request.code, fromLang, toLang);
      }
      return {
        code,
        notes: `Transpiled using WASM (neuroforge-asl)${request.libraries && request.libraries.length > 0 ? ' with VFS' : ''}`,
        verification: '',
        raw: code
      };
    } catch (error) {
      throw new TranspileError(
        `WASM transpilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        request.code
      );
    }
  }
  
  /**
   * Normalize language name for WASM
   */
  private normalizeLanguage(lang: string): string {
    const lower = lang.toLowerCase();
    
    // Map common names to WASM format
    const map: Record<string, string> = {
      'arduino c/c++': 'arduino',
      'arduino': 'arduino',
      'c (embedded/hal)': 'c',
      'c++ (embedded)': 'cpp',
      'rust (embedded-hal)': 'rust',
      'rust': 'rust',
      'micropython': 'micropython',
      'circuitpython': 'circuitpython',
      'python': 'python',
      'structured text (iec 61131-3)': 'iec-st',
      'lua (nodemcu)': 'lua',
      'javascript (espruino)': 'javascript',
      'zig (microzig)': 'zig',
      'ada (gnat)': 'ada',
      'forth (mecrisp)': 'forth',
    };
    
    return map[lower] || lower;
  }
  
  /**
   * Reset orchestrator state
   */
  async reset(): Promise<void> {
    // No longer need to reset provider since we use API calls
    // This method kept for API compatibility
  }
  
  /**
   * Check if AI is available
   */
  isAIAvailable(): boolean {
    // Try the API - it will return 503 if not configured
    // This always returns true to allow trying, fallback will handle failures
    return true;
  }
}

/**
 * Default orchestrator instance
 */
export const orchestrator = new TranspilationOrchestrator();

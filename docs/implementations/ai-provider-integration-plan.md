# AI Provider Integration Plan for NeuroForge Core Route

**Document Version:** 1.0  
**Date Created:** April 12, 2026  
**Target:** Replace hardcoded Gemini API with flexible @opencode-ai/sdk system  
**Scope:** Core transpilation route ONLY (NOT simulation route)

---

## Executive Summary

This plan outlines the integration of `@opencode-ai/sdk` into the NeuroForge webapp's core transpilation route. The goal is to replace the hardcoded Gemini API with a flexible AI system that:

1. Allows users to select their preferred AI provider (OpenAI, Anthropic, local servers)
2. Injects NeuroForge's complete ruleset (agents, skills, transpilation knowledge) into AI prompts
3. Maintains backward compatibility with the existing WASM transpiler
4. Respects the plugin/parser/type system architecture

---

## 1. Architecture Design

### 1.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     core/+page.svelte                           │
│                   (TranspileRequest)                           │
└─────────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   gemini.ts                              │
│            (GoogleGenAI - hardcoded)                     │
│            Model: gemini-3.1-pro-preview               │
└─────────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Google Gemini API                                │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     core/+page.svelte                           │
│                   (TranspileRequest)                           │
└─────────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              ai-provider.service.ts                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Provider Abstraction Layer                   │   │
│  │  - User preference (localStorage)                       │   │
│  │  - Provider Factory (OpenAI/Anthropic/Local)           │   │
│  │  - API Key management                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  │                   │                                         │   │
│  │                   ▼                                         │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │            Transpilation Orchestrator               │   │   │
│  │  │  - Ruleset Loader (agents + skills)               │   │   │
│  │  │  - Context Builder (language + board + plugins)     │   │   │
│  │  │  - Prompt Engineering                         │   │   │
│  │  │  - Response Parser                        │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │
│  │                   │                                         │   │
│  │                   ▼                                         │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │   opencode SDK Client Layer                       │   │   │
│  │  │   - createOpencode() / createOpencodeClient()    │   │   │
│  │  │   - Streaming (SSE) support                   │   │   │
│  │  │   - Tool execution                          │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────────────────────────────┐
│  WASM Engine    │    │     AI Provider Server                │
│  (Fallback)    │    │  (OpenAI/Anthropic/Local)            │
└─────────────────┘    └─────────────────────────────────────────┘
```

### 1.3 Design Principles

1. **Provider Agnostic:** The core transpilation logic should not care which AI provider is used
2. **Ruleset First:** NeuroForge's ruleset (agents, skills) should be the primary source of truth
3. **Graceful Degradation:** Fall back to WASM when AI fails or is unavailable
4. **User Control:** Users can select their provider and configure API keys
5. **Offline First:** Try local WASM first, then AI as enhancement

---

## 2. File Structure

### 2.1 New Files to Create

```
apps/webapp/src/lib/
├── ai/
│   ├── provider/
│   │   ├── index.ts              # Main export
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── provider.factory.ts  # Provider instantiation
│   │   ├── api-key.manager.ts # API key storage/retrieval
│   │   └── providers/
│   │       ├── openai.provider.ts
│   │       ├── anthropic.provider.ts
│   │       └── local.provider.ts
│   ├── ruleset/
│   │   ├── loader.ts          # Load agent/skills rules
│   │   ├── agent.ts        # Agent rules loader
│   │   ├── skills.ts      # Skills loader
│   │   └── contexts/
│   │       ├── language.context.ts
│   │       ├── board.context.ts
│   │       └── plugin.context.ts
│   ├── orchestration/
│   │   ├── index.ts          # Main orchestrator
│   │   ├── prompt.builder.ts # Build AI prompts
│   │   ├── response.ts     # Parse AI responses
│   │   └── tools/          # Tool definitions
│   │       └── transpile.tools.ts
│   └── state/
│       └── provider.svelte.ts  # Provider state management
├── components/
│   └── provider/
│       └── ProviderSettings.svelte  # Settings UI
└── routes/
    └── core/
        └── components/
            └── ProviderSelector.svelte  # Provider dropdown
```

### 2.2 Files to Modify

| File | Changes |
|------|--------|
| `apps/webapp/src/lib/services/gemini.ts` | **DEPRECATE** - Keep for backward compat, mark as deprecated |
| `apps/webapp/src/lib/types.ts` | Add AI provider types |
| `core/+page.svelte` | Import new AI service, add provider selector UI |
| `apps/webapp/package.json` | Add `@opencode-ai/sdk` dependency |
| `apps/webapp/src/lib/constants.ts` | Update system instruction for AI |

### 2.3 Directory Structure After Integration

```
apps/webapp/src/lib/
├── ai/                          # NEW: AI integration layer
├── services/
│   ├── gemini.ts              # DEPRECATED: Keep for compat
│   ├── transpiler_engine.ts   # WASM fallback
│   └── transpile.service.ts   # NEW: Unified service
├── wasm/
│   └── index.ts            # Existing (keep)
├── components/
│   └── provider/           # NEW: UI components
├── types.ts               # Modify: Add types
└── constants.ts          # Modify: Update constants
```

---

## 3. Provider Abstraction

### 3.1 Provider Configuration

```typescript
// apps/webapp/src/lib/ai/provider/types.ts

export type AIProviderType = 'openai' | 'anthropic' | 'local' | 'none';

export interface AIProviderConfig {
  type: AIProviderType;
  model?: string;          // e.g., "anthropic/claude-3-5-sonnet-20241022"
  apiKey?: string;        // Stored in localStorage
  baseUrl?: string;        // For local servers
}

export interface ProviderCapability {
  supportsStreaming: boolean;
  supportsTools: boolean;
  maxTokens: number;
}
```

### 3.2 API Key Storage

```typescript
// apps/webapp/src/lib/ai/provider/api-key.manager.ts

const STORAGE_KEYS = {
  OPENAI_API_KEY: 'neuroforge_openai_key',
  ANTHROPIC_API_KEY: 'neuroforge_anthropic_key',
  PROVIDER_TYPE: 'neuroforge_ai_provider',
  MODEL: 'neuroforge_ai_model',
} as const;

export class APIKeyManager {
  static getOpenAIKey(): string | null {
    return localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY);
  }
  
  static setOpenAIKey(key: string): void {
    localStorage.setItem(STORAGE_KEYS.OPENAI_API_KEY, key);
  }
  
  static getAnthropicKey(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ANTHROPIC_API_KEY);
  }
  
  static setAnthropicKey(key: string): void {
    localStorage.setItem(STORAGE_KEYS.ANTHROPIC_API_KEY, key);
  }
  
  static getProviderType(): AIProviderType {
    return (localStorage.getItem(STORAGE_KEYS.PROVIDER_TYPE) as AIProviderType) || 'none';
  }
  
  static setProviderType(type: AIProviderType): void {
    localStorage.setItem(STORAGE_KEYS.PROVIDER_TYPE, type);
  }
  
  static clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }
}
```

### 3.3 Provider Factory

```typescript
// apps/webapp/src/lib/ai/provider/provider.factory.ts

import { createOpencode, createOpencodeClient } from '@opencode-ai/sdk';
import type { AIProviderConfig, AIProviderType } from './types';

export async function createProvider(config: AIProviderConfig) {
  switch (config.type) {
    case 'openai': {
      const { client } = await createOpencode({
        config: {
          model: config.model || 'openai/gpt-4o',
          apiKey: config.apiKey,
        }
      });
      return client;
    }
    
    case 'anthropic': {
      const { client } = await createOpencode({
        config: {
          model: config.model || 'anthropic/claude-3-5-sonnet-20241022',
          apiKey: config.apiKey,
        }
      });
      return client;
    }
    
    case 'local': {
      const client = createOpencodeClient({
        baseUrl: config.baseUrl || 'http://localhost:4096'
      });
      return client;
    }
    
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export function isProviderConfigured(type: AIProviderType): boolean {
  // Check if API key is configured
  return false; // Implementation depends on key storage
}
```

### 3.4 Fallback Strategy

```typescript
// apps/webapp/src/lib/services/transpile.service.ts

import { transpile as wasmTranspile } from '$lib/wasm';
import { transpileCode as geminiTranspile } from '$lib/services/gemini';

export type TranspileMode = 'wasm' | 'ai' | 'auto';

export async function transpile(
  request: TranspileRequest,
  mode: TranspileMode = 'auto'
): Promise<TranspileResult> {
  // Auto mode: Try AI first, then WASM on failure
  if (mode === 'wasm' || mode === 'auto') {
    try {
      return wasmTranspile(request.code, request.sourceLang, request.targetLang);
    } catch (wasmError) {
      console.warn('WASM transpiler failed:', wasmError);
      if (mode === 'wasm') throw wasmError;
    }
  }
  
  if (mode === 'ai' || mode === 'auto') {
    try {
      return await transpileCode(request);
    } catch (aiError) {
      console.warn('AI transpiler failed:', aiError);
      throw aiError;
    }
  }
  
  throw new Error('All transpilation methods failed');
}
```

---

## 4. Ruleset Integration

### 4.1 Agent Rules Loader

```typescript
// apps/webapp/src/lib/ai/ruleset/agent.ts

import agentRules from '../../../../agent_skills/base/asl_fundamentals.md?raw';

export function loadAgentRules(): string {
  return agentRules;
}

// Additional agent context
export function getAgentContext(): string {
  return `
# NeuroForge Agent Context

## Role
You are an expert embedded systems code transpiler integrated into the NeuroForge platform.

## Specialization
- 26 supported target languages (C, Rust, Python, MicroPython, CircuitPython, etc.)
- Hardware-aware transpilation (GPIO, PWM, I2C, SPI, UART)
- PLC programming (IEC 61131-3: ST, SFC, LD, FBD, IL)

## Plugins
The transpiler uses a plugin architecture:
- plugins/arduino/ - Arduino framework
- plugins/c/ - Standard C
- plugins/python/ - Python generic
- plugins/plc/st_parser.rs - Structured Text
- plugins/rust_embassy/ - Rust embedded

## AST Structure
- Types: nodes.rs (raw AST), typed_nodes.rs (typed AST)
- Parser: Tree-sitter based
- Code generation per language plugin

## Constraints
- Preserve functional equivalence
- Maintain hardware pin mappings
- Apply language-specific best practices
- Generate compilable code
`;
}
```

### 4.2 Skills Loader

```typescript
// apps/webapp/src/lib/ai/ruleset/skills.ts

import languageSkills from '../../../../agent_skills/languages/*.md?raw';

const languageSkillMap: Record<string, string> = {
  'arduino': 'arduino-cpp-generic.md',
  'c': 'c-cpp-generic.md',
  'rust': 'rust-embassy-generic.md',
  'python': 'python-generic.md',
  'micropython': 'micropython-esp32.md',
  'circuitpython': 'circuitpython-esp32.md',
  // ... map all 26 languages
};

export function loadLanguageSkill(targetLang: string): string {
  const skillFile = languageSkillMap[targetLang.toLowerCase()];
  if (!skillFile) {
    console.warn(`No skill file for language: ${targetLang}`);
    return '';
  }
  return languageSkills[skillFile] || '';
}

export function getTargetLanguageRules(targetLang: string): string {
  const skill = loadLanguageSkill(targetLang);
  if (!skill) return '';
  
  return `
# ${targetLang} Translation Rules

${skill}
`;
}
```

### 4.3 Board/Component Context Loader

```typescript
// apps/webapp/src/lib/ai/ruleset/contexts/board.context.ts

import type { TranspileRequest } from '$lib/types';

// Board definitions loaded from docs/boards/
const boards = {
  'ESP32': {
    pins: [2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39],
    pwmPins: [2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33],
    avoidPins: [6,7,8,9,10,11], // Flash
    i2c: { sda: 21, scl: 22 },
    spi: { mosi: 23, miso: 19, sck: 18 },
    uart: { tx: 1, rx: 3 },
  },
  'Arduino Uno': {
    pins: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21],
    pwmPins: [3,5,6,9,10,11],
    avoidPins: [0,1], // UART
    analog: [A0,A1,A2,A3,A4,A5],
  },
  // ... all boards
};

export function buildBoardContext(platform: string): string {
  const board = boards[platform];
  if (!board) {
    return `# Platform: ${platform}\n(Generic board context)`;
  }
  
  return `
# Target Board: ${platform}

## Pin Configuration
- Available GPIO: ${board.pins.join(', ')}
- PWM-capable: ${board.pwmPins.join(', ')}
${board.avoidPins ? `- Avoid: ${board.avoidPins.join(', ')}` : ''}
${board.i2c ? `- I2C: SDA=${board.i2c.sda}, SCL=${board.i2c.scl}` : ''}
${board.spi ? `- SPI: MOSI=${board.spi.mosi}, MISO=${board.spi.miso}, SCK=${board.spi.sck}` : ''}

## Notes
- Use hardware PWM where available
- Avoid input-only pins for output
- Set correct pin modes in setup()
`;
}
```

### 4.4 Plugin Context Loader

```typescript
// apps/webapp/src/lib/ai/ruleset/contexts/plugin.context.ts

// Plugin system knowledge
export function buildPluginContext(sourceLang: string, targetLang: string): string {
  return `
# Transpilation Plugin Context

## Source Language: ${sourceLang}
- Parser: Tree-sitter based
- AST: nodes.rs (raw) → typed_nodes.rs (typed)

## Target Language: ${targetLang}
${getPluginDetails(targetLang)}

## Hardware Abstraction
- GPIO: pinMode(), digitalWrite(), digitalRead()
- PWM: analogWrite() / hardware PWM
- Timing: delay(), millis()
- I2C: Wire.begin(), Wire.write(), Wire.read()
- SPI: SPI.begin(), SPI.transfer()

## Code Structure
- setup()/loop() for Arduino
- main() for Rust embedded
- while True: for Python
`;
}

function getPluginDetails(lang: string): string {
  const plugins: Record<string, string> = {
    'rust': '- Generator: crates/neuroforge-asl/src/plugins/rust_std/, rust_embassy/',
    'python': '- Generator: crates/neuroforge-asl/src/plugins/python/',
    'arduino': '- Generator: crates/neuroforge-asl/src/plugins/arduino/',
    'plc': '- Generator: crates/neuroforge-asl/src/plugins/plc/, st_generator.rs',
  };
  return plugins[lang] || '- Generator: Generic';
}
```

---

## 5. Orchestration

### 5.1 Prompt Builder

```typescript
// apps/webapp/src/lib/ai/orchestration/prompt.builder.ts

import type { TranspileRequest } from '$lib/types';
import { loadAgentRules } from '../ruleset/agent';
import { getTargetLanguageRules } from '../ruleset/skills';
import { buildBoardContext } from '../ruleset/contexts/board.context';
import { buildPluginContext } from '../ruleset/contexts/plugin.context';
import { SYSTEM_INSTRUCTION } from '$lib/constants';

export interface TranspilePrompt {
  system: string;
  user: string;
}

export function buildTranspilePrompt(request: TranspileRequest): TranspilePrompt {
  const agentRules = loadAgentRules();
  const languageRules = getTargetLanguageRules(request.targetLang);
  const boardContext = buildBoardContext(request.targetPlatform);
  const pluginContext = buildPluginContext(request.sourceLang, request.targetLang);
  
  const systemInstruction = `
${SYSTEM_INSTRUCTION}

${agentRules}

${languageRules}

${boardContext}

${pluginContext}
`.trim();
  
  const userPrompt = `
SOURCE_LANGUAGE: ${request.sourceLang}
TARGET_LANGUAGE: ${request.targetLang}
TARGET_PLATFORM: ${request.targetPlatform}

CODE:
${request.code}

Please transpile the above code following the rules and context provided.
`.trim();
  
  return {
    system: systemInstruction,
    user: userPrompt,
  };
}
```

### 5.2 Transpilation Orchestrator

```typescript
// apps/webapp/src/lib/ai/orchestration/index.ts

import type { TranspileRequest, TranspileResult } from '$lib/types';
import { createProvider } from '../provider/provider.factory';
import { APIKeyManager } from '../provider/api-key.manager';
import { buildTranspilePrompt, parseTranspileResponse } from '.';

export class TranspilationOrchestrator {
  private provider: any;
  
  async transpile(request: TranspileRequest): Promise<TranspileResult> {
    const providerType = APIKeyManager.getProviderType();
    
    if (providerType === 'none') {
      throw new Error('No AI provider configured');
    }
    
    const config = {
      type: providerType,
      apiKey: this.getAPIKey(providerType),
      model: APIKeyManager.getModel(),
    };
    
    this.provider = await createProvider(config);
    const prompt = buildTranspilePrompt(request);
    
    const response = await this.provider.sendMessage({
      system: prompt.system,
      message: prompt.user,
    });
    
    return parseTranspileResponse(response.text);
  }
  
  private getAPIKey(type: string): string | undefined {
    // Implementation depends on key storage
    return undefined;
  }
}
```

### 5.3 Response Parser

```typescript
// apps/webapp/src/lib/ai/orchestration/response.ts

import type { TranspileResult } from '$lib/types';
import { parseResponse } from '../../services/gemini'; // Reuse existing parser

export function parseTranspileResponse(text: string): TranspileResult {
  // Reuse existing parser from gemini.ts
  return parseResponse(text);
}
```

---

## 6. Integration Points

### 6.1 Core Page Integration

```svelte
<!-- apps/webapp/src/routes/core/+page.svelte -->

<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '$lib/components/desktop/TopBar.svelte';
  import { type TranspileRequest, TranspileResult, SupportedLanguage, LANGUAGES } from '$lib/types';
  import { DEFAULT_SOURCE_CODE } from '$lib/constants';
  import { transpile } from '$lib/ai/orchestration';
  import { getProviderType, isProviderConfigured } from '$lib/ai/provider';
  
  let sourceCode = $state(DEFAULT_SOURCE_CODE);
  let sourceLang = $state(SupportedLanguage.ARDUINO);
  let targetLang = $state(SupportedLanguage.RUST);
  let platform = $state('ESP32');
  
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let transpileResult = $state<TranspileResult | null>(null);
  let providerType = $state(getProviderType());
  
  // ... existing code ...
  
  async function handleProcess() {
    if (!isProviderConfigured(providerType)) {
      error = 'Please configure an AI provider in settings';
      return;
    }
    
    isLoading = true;
    error = null;
    transpileResult = null;
    
    try {
      transpileResult = await transpile({
        sourceLang,
        targetLang,
        targetPlatform: platform,
        code: sourceCode,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Transpilation failed';
    } finally {
      isLoading = false;
    }
  }
</script>
```

### 6.2 Provider Settings Component

```svelte
<!-- apps/webapp/src/lib/components/provider/ProviderSettings.svelte -->

<script lang="ts">
  import { APIKeyManager } from '$lib/ai/provider/api-key.manager';
  import { getProviderType, setProviderType } from '$lib/ai/provider';
  
  let selectedProvider = $state(getProviderType());
  let openaiKey = $state('');
  let anthropicKey = $state('');
  
  function saveProvider() {
    setProviderType(selectedProvider);
    if (selectedProvider === 'openai' && openaiKey) {
      APIKeyManager.setOpenAIKey(openaiKey);
    } else if (selectedProvider === 'anthropic' && anthropicKey) {
      APIKeyManager.setAnthropicKey(anthropicKey);
    }
  }
</script>

<div class="provider-settings">
  <h3>AI Provider</h3>
  
  <select bind:value={selectedProvider}>
    <option value="none">None (WASM only)</option>
    <option value="openai">OpenAI</option>
    <option value="anthropic">Anthropic Claude</option>
    <option value="local">Local Server</option>
  </select>
  
  {#if selectedProvider === 'openai'}
    <input 
      type="password" 
      bind:value={openaiKey} 
      placeholder="OpenAI API Key"
    />
  {/if}
  
  {#if selectedProvider === 'anthropic'}
    <input 
      type="password" 
      bind:value={anthropicKey} 
      placeholder="Anthropic API Key"
    />
  {/if}
  
  <button onclick={saveProvider}>Save</button>
</div>
```

### 6.3 Backward Compatibility

```typescript
// apps/webapp/src/lib/services/gemini.ts (DEPRECATED)

/**
 * @deprecated Use ai/orchestration/index.ts instead
 * Kept for backward compatibility with existing code
 */
export const transpileCode = async (request: TranspileRequest): Promise<TranspileResult> => {
  // ... existing implementation ...
  console.warn('gemini.ts is deprecated. Use new AI provider system.');
};
```

---

## 7. Implementation Steps

### Phase 1: Foundation (Week 1)

| Task | Description | Files |
|------|------------|-------|
| 1.1 | Install @opencode-ai/sdk | `package.json` |
| 1.2 | Create provider types | `ai/provider/types.ts` |
| 1.3 | Create API key manager | `ai/provider/api-key.manager.ts` |
| 1.4 | Create provider factory | `ai/provider/provider.factory.ts` |
| 1.5 | Set up basic state | `ai/state/provider.svelte.ts` |

### Phase 2: Ruleset Integration (Week 2)

| Task | Description | Files |
|------|------------|-------|
| 2.1 | Create agent rules loader | `ai/ruleset/agent.ts` |
| 2.2 | Create skills loader | `ai/ruleset/skills.ts` |
| 2.3 | Create board context | `ai/ruleset/contexts/board.context.ts` |
| 2.4 | Create plugin context | `ai/ruleset/contexts/plugin.context.ts` |
| 2.5 | Create language skill maps | `ai/ruleset/language.map.ts` |

### Phase 3: Orchestration (Week 3)

| Task | Description | Files |
|------|------------|-------|
| 3.1 | Create prompt builder | `ai/orchestration/prompt.builder.ts` |
| 3.2 | Create response parser | `ai/orchestration/response.ts` |
| 3.3 | Create transpilation orchestrator | `ai/orchestration/index.ts` |
| 3.4 | Create unified service | `services/transpile.service.ts` |
| 3.5 | Add tool definitions | `ai/orchestration/tools/` |

### Phase 4: UI Integration (Week 4)

| Task | Description | Files |
|------|------------|-------|
| 4.1 | Create provider settings UI | `components/provider/ProviderSettings.svelte` |
| 4.2 | Add provider selector to core page | `routes/core/+page.svelte` |
| 4.3 | Add API key input modal | `components/provider/APIKeyModal.svelte` |
| 4.4 | Add provider status indicator | `components/provider/ProviderStatus.svelte` |

### Phase 5: Testing & Polish (Week 5)

| Task | Description |
|------|-------------|
| 5.1 | End-to-end testing with OpenAI |
| 5.2 | End-to-end testing with Anthropic |
| 5.3 | Fallback testing (WASM) |
| 5.4 | Error handling verification |
| 5.5 | Performance benchmarking |

---

## 8. Error Handling

### 8.1 Error Types

```typescript
// apps/webapp/src/lib/ai/types/errors.ts

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
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TranspileError';
  }
}

export class RateLimitError extends AIProviderError {
  constructor(provider: string, public retryAfter?: number) {
    super(`Rate limit exceeded for ${provider}`, provider);
    this.name = 'RateLimitError';
  }
}
```

### 8.2 Error Recovery

```typescript
// In orchestrator
async function transpileWithFallback(request: TranspileRequest): Promise<TranspileResult> {
  // Try AI provider first
  try {
    return await this.orchestrator.transpile(request);
  } catch (error) {
    if (error instanceof APIKeyError || error instanceof RateLimitError) {
      // Log and notify user
      console.error('AI provider error:', error);
    }
    
    // Fall back to WASM
    console.warn('Falling back to WASM transpiler');
    return wasmTranspile(request.code, request.sourceLang, request.targetLang);
  }
}
```

---

## 9. Security Considerations

### 9.1 API Key Storage

- **Do NOT** store API keys in localStorage in production
- Use httpOnly cookies or a backend proxy
- For local development, localStorage is acceptable with warnings

### 9.2 Input Validation

```typescript
function validateCodeInput(code: string): void {
  if (!code || typeof code !== 'string') {
    throw new Error('Invalid code input');
  }
  if (code.length > 50000) {
    throw new Error('Code input too large (max 50KB)');
  }
}
```

### 9.3 Output Sanitization

```typescript
function sanitizeOutput(code: string): string {
  // Remove potentially dangerous constructs
  return code
    .replace(/eval\s*\(/g, '// eval removed: ')
    .replace(/Function\s*\(/g, '// Function removed: ');
}
```

---

## 10. Dependencies

### 10.1 NPM Dependencies

```json
{
  "dependencies": {
    "@opencode-ai/sdk": "^1.0.0"
  }
}
```

### 10.2 Internal Dependencies

- `agent_skills/` - Must exist at project root
- `docs/boards/` - Must exist for board context
- `crates/neuroforge-asl/` - For WASM fallback

---

## 11. Success Criteria

1. **User Choice:** Users can select OpenAI, Anthropic, or local provider
2. **Ruleset Injection:** AI prompts include NeuroForge's complete ruleset
3. **Fallback Works:** WASM transpiler works when AI unavailable
4. **Backward Compatible:** Existing code continues to work
5. **Performance:** Transpilation completes within 10 seconds (AI) / 1 second (WASM)

---

## 12. Migration Path

### Immediate (Before Implementation)

1. Document current Gemini API usage
2. Identify all integration points
3. Create feature flags for gradual rollout

### During Implementation

1. Build new system alongside existing
2. Use feature flag to switch between systems
3. Run both systems in parallel for validation

### After Implementation

1. Remove feature flag
2. Deprecate gemini.ts (keep for compat)
3. Monitor usage and errors

---

## Appendix A: File Paths Reference

### Existing Files

| Path | Purpose |
|------|---------|
| `apps/webapp/src/lib/services/gemini.ts` | Current AI service |
| `apps/webapp/src/lib/constants.ts` | System instruction (217 lines) |
| `apps/webapp/src/lib/wasm/index.ts` | WASM wrapper |
| `agent_skills/base/asl_fundamentals.md` | Base rules |
| `agent_skills/languages/*.md` | 26 language skills |
| `docs/boards/*.toon` | Board definitions |

### New Files

| Path | Purpose |
|------|---------|
| `apps/webapp/src/lib/ai/provider/types.ts` | Provider types |
| `apps/webapp/src/lib/ai/provider/api-key.manager.ts` | Key storage |
| `apps/webapp/src/lib/ai/provider/provider.factory.ts` | Provider factory |
| `apps/webapp/src/lib/ai/ruleset/agent.ts` | Agent loader |
| `apps/webapp/src/lib/ai/ruleset/skills.ts` | Skills loader |
| `apps/webapp/src/lib/ai/ruleset/contexts/*.ts` | Context loaders |
| `apps/webapp/src/lib/ai/orchestration/prompt.builder.ts` | Prompt engineer |
| `apps/webapp/src/lib/ai/orchestration/response.ts` | Response parse |
| `apps/webapp/src/lib/ai/orchestration/index.ts` | Main orchestrator |
| `apps/webapp/src/lib/components/provider/*.svelte` | UI components |

---

## Appendix B: Testing Checklist

- [ ] OpenAI provider works with GPT-4o
- [ ] Anthropic provider works with Claude-3.5
- [ ] Local server connection works
- [ ] API keys are stored/retrieved correctly
- [ ] Provider settings persist across sessions
- [ ] Fallback to WASM works on AI failure
- [ ] Error messages are user-friendly
- [ ] Response parsing handles all output formats
- [ ] Ruleset is injected into all prompts
- [ ] Backward compatibility maintained

---

**End of Plan**

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | April 12, 2026 | Initial plan |
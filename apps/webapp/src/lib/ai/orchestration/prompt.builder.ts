/**
 * Prompt Builder
 * 
 * Builds transpilation prompts with full context injection.
 */

import type { TranspileRequest } from '$lib/types';
import { loadAgentContext, getTranspileSystemInstruction } from '$lib/ai/ruleset/agent';
import { getLanguageSkill } from '$lib/ai/ruleset/skills';
import { buildBoardContext } from '$lib/ai/ruleset/contexts/board.context';
import { buildPluginContext } from '$lib/ai/ruleset/contexts/plugin.context';
import { SYSTEM_INSTRUCTION } from '$lib/constants';

/**
 * Built transpilation prompt
 */
export interface TranspilePrompt {
  system: string;
  user: string;
}

/**
 * Build a transpilation prompt with full context
 */
export function buildTranspilePrompt(request: TranspileRequest): TranspilePrompt {
  // Load all context components
  const agentContext = loadAgentContext();
  const transpileSystem = getTranspileSystemInstruction();
  
  // Get target language skill
  const languageSkill = getLanguageSkill(request.targetLang);
  
  // Get board context
  const boardContext = buildBoardContext(request.targetPlatform);
  
  // Get plugin context for source to target
  const pluginContext = buildPluginContext(request.sourceLang, request.targetLang);
  
  // Build system instruction
  const systemParts = [
    SYSTEM_INSTRUCTION,
    '',
    '## NeuroForge Agent Context',
    agentContext,
    '',
    transpileSystem,
  ];
  
  if (languageSkill) {
    systemParts.push('', '## Target Language Rules', languageSkill);
  }
  
  if (boardContext) {
    systemParts.push('', boardContext);
  }
  
  if (pluginContext) {
    systemParts.push('', '## Translation Plugin', pluginContext);
  }
  
  const system = systemParts.filter(Boolean).join('\n\n');
  
  // Build user prompt
  const user = `
SOURCE_LANGUAGE: ${request.sourceLang}
TARGET_LANGUAGE: ${request.targetLang}
TARGET_PLATFORM: ${request.targetPlatform}

CODE:
\`\`\`
${request.code}
\`\`\`

Transpile the above code following the rules and context provided. Output the result in the specified format with TRANSLATED_CODE, TRANSLATION NOTES, OPTIMIZATION APPLIED, WARNINGS, and VERIFICATION sections.
`.trim();
  
  return { system, user };
}

/**
 * Build a simple prompt without full context
 */
export function buildSimplePrompt(request: TranspileRequest): TranspilePrompt {
  const user = `
Translate the following code from ${request.sourceLang} to ${request.targetLang} for ${request.targetPlatform} platform.

${request.code}

Provide the translated code along with any translation notes and verification.
`;
  
  return {
    system: SYSTEM_INSTRUCTION,
    user,
  };
}

/**
 * Build system prompt for different purposes
 */
export function buildSystemPrompt(purpose: 'transpile' | 'analyze' | 'verify'): string {
  switch (purpose) {
    case 'transpile':
      return SYSTEM_INSTRUCTION;
    case 'analyze':
      return `
You are a code analysis assistant for embedded systems.
Analyze the provided code for:
- Potential bugs
- Hardware issues
- Timing problems
- Memory concerns
`;
    case 'verify':
      return `
You are a verification assistant for embedded systems.
Verify that the translated code:
- Maintains functional equivalence
- Uses correct hardware mappings
- Follows target language best practices
`;
    default:
      return SYSTEM_INSTRUCTION;
  }
}
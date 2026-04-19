/**
 * Orchestration Types
 * 
 * Type definitions for the AI orchestration layer.
 */

/**
 * Built transpilation prompt
 */
export interface TranspilePrompt {
  system: string;
  user: string;
}

/**
 * Tool definition for AI execution
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Tool call result
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

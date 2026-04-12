/**
 * DEPRECATED: Gemini Service
 * 
 * This service has been deprecated in favor of the new AI Provider Integration.
 * Use the orchestrator from '$lib/ai/orchestration' instead.
 * 
 * @deprecated Use TranspilationOrchestrator instead
 */

import { SYSTEM_INSTRUCTION } from "../constants";
import { TranspileRequest, TranspileResult } from "../types";
import { orchestrator } from "$lib/ai/orchestration";

/**
 * Parse AI response into structured result
 */
function parseResponse(text: string): TranspileResult {
  const extractSection = (sectionName: string, nextSections: string[]) => {
    const header = `${sectionName}:`;
    const startIndex = text.indexOf(header);
    if (startIndex === -1) return "";
    
    const contentStart = startIndex + header.length;
    let contentEnd = text.length;
    
    for (const next of nextSections) {
      const nextIndex = text.indexOf(`${next}:`, contentStart);
      if (nextIndex !== -1 && nextIndex < contentEnd) {
        contentEnd = nextIndex;
      }
    }
    
    return text.substring(contentStart, contentEnd).trim();
  };

  const sections = ["TRANSLATION NOTES", "OPTIMIZATION APPLIED", "WARNINGS", "VERIFICATION"];
  
  const code = extractSection("TRANSLATED_CODE", sections);
  const notes = extractSection("TRANSLATION NOTES", ["OPTIMIZATION APPLIED", "WARNINGS", "VERIFICATION"]);
  const optimizations = extractSection("OPTIMIZATION APPLIED", ["WARNINGS", "VERIFICATION"]);
  const warnings = extractSection("WARNINGS", ["VERIFICATION"]);
  const verification = extractSection("VERIFICATION", []);

  let cleanCode = code;
  if (cleanCode.startsWith("```")) {
    const lines = cleanCode.split('\n');
    if (lines.length > 0) lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].trim() === "```") lines.pop();
    cleanCode = lines.join('\n');
  }

  if (!cleanCode && !notes && !verification) {
    return {
      code: text,
      notes: "Parser could not identify sections. Raw response returned.",
      verification: "",
      raw: text
    };
  }

  return {
    code: cleanCode || "",
    notes,
    optimizations,
    warnings,
    verification,
    raw: text
  };
}

/**
 * @deprecated Use orchestrator.transpile() instead
 * 
 * This function now delegates to the AI orchestrator
 * for backward compatibility during migration.
 */
export async function transpileCode(request: TranspileRequest): Promise<TranspileResult> {
  console.warn('gemini.ts transpileCode is deprecated. Use AI Provider Integration instead.');
  
  // Use orchestrator with WASM-only mode since we don't have Gemini API key anymore
  try {
    return await orchestrator.transpile(request, 'wasm');
  } catch (error) {
    // If WASM fails, return a graceful error response
    return {
      code: '',
      notes: `Transpilation temporarily unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      verification: '',
      raw: ''
    };
  }
}

/**
 * @deprecated - Kept for backward compatibility
 */
export { parseResponse };
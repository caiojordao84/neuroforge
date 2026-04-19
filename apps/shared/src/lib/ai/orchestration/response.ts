/**
 * Response Parser
 * 
 * Parses AI transpilation responses into structured results.
 */

import type { TranspileResult } from '@shared/lib/types';

/**
 * Extract section content from response
 */
function extractSection(text: string, sectionName: string, nextSections: string[]): string {
  const header = `${sectionName}:`;
  const startIndex = text.indexOf(header);
  if (startIndex === -1) return '';
  
  const contentStart = startIndex + header.length;
  let contentEnd = text.length;
  
  // Find the earliest occurrence of any next section
  for (const next of nextSections) {
    const nextIndex = text.indexOf(`${next}:`, contentStart);
    if (nextIndex !== -1 && nextIndex < contentEnd) {
      contentEnd = nextIndex;
    }
  }
  
  return text.substring(contentStart, contentEnd).trim();
}

/**
 * Clean code block markers
 */
function cleanCodeBlock(code: string): string {
  if (!code) return code;
  
  let clean = code;
  if (clean.startsWith("```")) {
    const lines = clean.split('\n');
    // Remove first line (```language)
    if (lines.length > 0) lines.shift();
    // Remove last line if it is ```
    if (lines.length > 0 && lines[lines.length - 1].trim() === "```") lines.pop();
    clean = lines.join('\n');
  }
  
  return clean.trim();
}

/**
 * Parse a transpilation response into structured result
 */
export function parseTranspileResponse(text: string): TranspileResult {
  const sections = ["TRANSLATION NOTES", "OPTIMIZATION APPLIED", "WARNINGS", "VERIFICATION"];
  
  const code = extractSection(text, "TRANSLATED_CODE", sections);
  const notes = extractSection(text, "TRANSLATION NOTES", ["OPTIMIZATION APPLIED", "WARNINGS", "VERIFICATION"]);
  const optimizations = extractSection(text, "OPTIMIZATION APPLIED", ["WARNINGS", "VERIFICATION"]);
  const warnings = extractSection(text, "WARNINGS", ["VERIFICATION"]);
  const verification = extractSection(text, "VERIFICATION", []);
  
  // Clean code blocks
  const cleanCode = cleanCodeBlock(code);
  
  // Fallback: if extracting sections failed completely, return raw text
  if (!cleanCode && !notes && !verification) {
    return {
      code: text,
      notes: "Parser could not identify sections. Raw response returned.",
      verification: "",
      raw: text
    };
  }
  
  return {
    code: cleanCode || text,
    notes: notes || "",
    optimizations: optimizations || undefined,
    warnings: warnings || undefined,
    verification: verification || "",
    raw: text
  };
}

/**
 * Parse streaming response chunks
 */
export function parseStreamingResponse(chunks: string[]): TranspileResult {
  const fullText = chunks.join('');
  return parseTranspileResponse(fullText);
}

/**
 * Validate that a response has required sections
 */
export function validateResponse(result: TranspileResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!result.code || result.code.trim() === '') {
    errors.push('Missing TRANSLATED_CODE section');
  }
  
  if (result.warnings && result.warnings.toLowerCase().includes('error')) {
    errors.push('Response contains error in WARNINGS section');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

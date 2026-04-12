import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { TranspileRequest, TranspileResult, SupportedLanguage } from "../types";

const parseResponse = (text: string): TranspileResult => {
  // Helper to extract section content using headers
  const extractSection = (sectionName: string, nextSections: string[]) => {
    const header = `${sectionName}:`;
    const startIndex = text.indexOf(header);
    if (startIndex === -1) return "";
    
    const contentStart = startIndex + header.length;
    let contentEnd = text.length;
    
    // Find the earliest occurrence of any next section to determine where this section ends
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
  const verification = extractSection("VERIFICATION", []); // Last section

  // Clean up code block markers if present (e.g., ```c ... ```)
  let cleanCode = code;
  if (cleanCode.startsWith("```")) {
    const lines = cleanCode.split('\n');
    // Remove first line (```language)
    if (lines.length > 0) lines.shift();
    // Remove last line if it is ```
    if (lines.length > 0 && lines[lines.length - 1].trim() === "```") lines.pop();
    cleanCode = lines.join('\n');
  }

  // Fallback: if extracting sections failed completely (e.g. model didn't follow format exactly),
  // try to return text as code if it looks like code, or put it in notes.
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
    notes: notes,
    optimizations: optimizations,
    warnings: warnings,
    verification: verification,
    raw: text
  };
};

export const transpileCode = async (request: TranspileRequest): Promise<TranspileResult> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set the VITE_GEMINI_API_KEY environment variable.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const userPrompt = `
SOURCE_LANGUAGE: ${request.sourceLang}
TARGET_LANGUAGE: ${request.targetLang}
TARGET_PLATFORM: ${request.targetPlatform}
CODE:
${request.code}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, // Low temperature for deterministic code generation
      }
    });

    const text = response.text || "";
    return parseResponse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

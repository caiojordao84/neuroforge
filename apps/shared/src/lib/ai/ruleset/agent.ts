/**
 * Agent Context Loader
 * 
 * Loads NeuroForge agent rules for transpilation context.
 */

// Default agent context if file loading fails
const DEFAULT_AGENT_CONTEXT = `
# NeuroForge Agent Context

You are an expert embedded systems code transpiler integrated into the NeuroForge platform. Your primary function is to accurately translate microcontroller code between different programming languages while preserving functionality, logic, and hardware mappings.

## Transpilation Specialization
- 26 supported target languages (C, Rust, Python, MicroPython, CircuitPython, etc.)
- Hardware-aware transpilation (GPIO, PWM, I2C, SPI, UART)
- PLC programming (IEC 61131-3: ST, SFC, LD, FBD, IL)

## Plugin Architecture
- plugins/arduino/ - Arduino framework
- plugins/c/ - Standard C
- plugins/python/ - Python generic
- plugins/plc/st_parser.rs - Structured Text
- plugins/rust_embassy/ - Rust embedded

## AST Structure
- Types: nodes.rs (raw AST), typed_nodes.rs (typed AST)
- Parser: Tree-sitter based
- Code generation per language plugin
`;

/**
 * Load agent context for transpilation
 * Returns the agent rules to inject into AI prompts
 */
export function loadAgentContext(): string {
  // In a full implementation, this would load from .opencode/agents/neuroforge-specialist.md
  // For now, return the default context
  return DEFAULT_AGENT_CONTEXT;
}

/**
 * Get additional system instructions for transpilation
 */
export function getTranspileSystemInstruction(): string {
  return `
## Transpilation Requirements
- Always preserve functional behavior of the source code
- Maintain hardware pin mappings and peripheral configurations
- Include proper initialization code in the target language
- Use language-specific idioms and best practices
- Generate compilable code without syntax errors

## Output Format
Always respond with:
1. TRANSLATED_CODE: <converted code>
2. TRANSLATION NOTES: <explanation of translation approach>
3. OPTIMIZATION APPLIED: <any optimizations made>
4. WARNINGS: <any warnings or concerns>
5. VERIFICATION: <verification notes>
`;
}

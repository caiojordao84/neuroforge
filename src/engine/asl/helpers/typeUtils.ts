import type { ASLType } from '../ASLTypes';

export function mapToASLType(cppType: string): ASLType {
  const lower = cppType.toLowerCase();
  if (lower.includes('int') || lower.includes('long') || lower === 'short' || 
      lower === 'byte' || lower === 'char') return 'int';
  if (lower.includes('float') || lower === 'double') return 'float';
  if (lower === 'bool' || lower === 'boolean') return 'bool';
  if (lower === 'string') return 'string';
  if (lower === 'struct') return 'struct';
  return 'int';
}

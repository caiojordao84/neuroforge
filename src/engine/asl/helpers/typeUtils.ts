import type { ASLType } from '../ASLTypes';

export function mapToASLType(cppType: string): ASLType {
  const lower = cppType.trim().toLowerCase();

  // Inteiros
  if (
    lower.includes('int') ||
    lower.includes('long') ||
    lower === 'short' ||
    lower === 'byte' ||
    lower === 'char' ||
    lower.includes('uint') ||
    lower === 'size_t'
  ) return 'int';

  // Floats
  if (lower.includes('float') || lower === 'double') return 'float';

  // Bool
  if (lower === 'bool' || lower === 'boolean') return 'bool';

  // String
  if (lower === 'string' || lower.includes('std::string')) return 'string';

  if (lower === 'struct' || lower === 'class' || lower === 'rgbled') return 'struct';

  return 'int';
}

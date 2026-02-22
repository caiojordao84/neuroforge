import type { BaseNode } from '@/system/types';

export function resolveSize(expr: BaseNode | undefined, globalsMap: Map<string, any>): number {
  if (!expr) return 0;
  if (expr.nodeType === 'Literal') {
    const v = expr.attributes.value;
    return typeof v === 'number' ? Math.floor(v) : 0;
  }
  if (expr.nodeType === 'Identifier') {
    const val = globalsMap.get(expr.attributes.name);
    if (typeof val === 'number') return Math.floor(val);
  }
  return 0;
}

export function buildEmptyArray(
  sizeExpr: BaseNode | undefined,
  size2Expr: BaseNode | undefined,
  globalsMap: Map<string, any>,
): any {
  const n = resolveSize(sizeExpr, globalsMap) || 0;
  if (size2Expr) {
    const m = resolveSize(size2Expr, globalsMap) || 0;
    return Array(n).fill(null).map(() => Array(m).fill(0));
  }
  return Array(n).fill(0);
}

export function deepCopyValue(val: any): any {
  if (Array.isArray(val)) return JSON.parse(JSON.stringify(val));
  return val;
}

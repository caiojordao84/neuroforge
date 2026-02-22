import type { BaseNode } from '@/system/types';
import type { ASLStatement } from '../ASLTypes';
import type { TransformContext } from './context';
import { statementRegistry } from './statementRegistry';

export function transformBlock(nodes: BaseNode[], ctx: TransformContext): ASLStatement[] {
  const stmts: ASLStatement[] = [];

  const ctxWithTransform: TransformContext = {
    ...ctx,
    transformBlock: transformBlock as any
  };

  for (const node of nodes) {
    if (!node) continue;

    if (node.leadingComments) {
      node.leadingComments.forEach((text: string) => {
        stmts.push({ kind: 'comment', text } as ASLStatement);
      });
    }

    const handler = statementRegistry[node.nodeType];
    if (handler) {
      stmts.push(...handler(node, ctxWithTransform));
    }
  }

  return stmts;
}

import type { Language } from '@/types';
import type { BaseNode } from '@/system/types';
import type { ASLStatement } from '../ASLTypes';

export type BlockTransformFn = (nodes: BaseNode[], ctx: TransformContext) => ASLStatement[];

export interface TransformContext {
  globalsMap: Map<string, any>;
  language?: Language;
  transformBlock?: BlockTransformFn;
}

export function createTransformContext(language?: Language): TransformContext {
  return {
    globalsMap: new Map(),
    language,
  };
}

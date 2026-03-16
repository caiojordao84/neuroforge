import type { Language } from '@/types';
import type { BaseNode } from '@/system/types';
import type { ASLStatement, ASLStructDef } from '../ASLTypes';

export type BlockTransformFn = (nodes: BaseNode[], ctx: TransformContext) => ASLStatement[];

export interface TransformContext {
  globalsMap: Map<string, any>;
  language?: Language;
  transformBlock?: BlockTransformFn;
  /**
   * Mapa de definições de structs conhecidas: nome -> ASLStructDef.
   * Populado por codeToASL ao processar StructDeclaration nodes.
   */
  structDefs?: Record<string, ASLStructDef>;
  rgbPins?: Map<string, { r: BaseNode, g: BaseNode, b: BaseNode }>;
  pwmPins?: Map<string, BaseNode>;
}

export function createTransformContext(language?: Language): TransformContext {
  return {
    globalsMap: new Map(),
    rgbPins: new Map(),
    pwmPins: new Map(),
    language,
  };
}

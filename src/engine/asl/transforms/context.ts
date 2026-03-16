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
  /**
   * Conjunto de nomes de variáveis reconhecidas como instâncias servo.
   * Populado pelas 3 camadas de detecção no statementRegistry:
   *   Camada 1 — declaração explícita (type === 'Servo', CallExpression 'Servo')
   *   Camada 2 — inferência por callee (/servo/i, 'servo.Servo', etc.)
   *   Camada 3 — inferência lazy por método (.attach() auto-registo)
   * Também inclui parâmetros de função cujo tipo seja Servo/Servo&/Servo*.
   */
  servoInstances?: Set<string>;
}

export function createTransformContext(language?: Language): TransformContext {
  return {
    globalsMap: new Map(),
    rgbPins: new Map(),
    pwmPins: new Map(),
    language,
    servoInstances: new Set(),
  };
}

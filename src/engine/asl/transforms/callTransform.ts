import type { BaseNode } from '@/system/types';
import type { ASLStatement, ASLExpr } from '../ASLTypes';
import { transformExpr } from './exprTransform';

export function transformCallToStmt(node: BaseNode): ASLStatement | null {
  const callee = node.attributes.callee;

  if (callee === 'pinMode') {
    const modeNode = node.children[1];
    let mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' = 'OUTPUT';

    if (modeNode.nodeType === 'Literal') {
      const v = modeNode.attributes.value;
      if (v === 0) mode = 'INPUT';
      if (v === 2) mode = 'INPUT_PULLUP';
    }

    return {
      kind: 'pinMode',
      pin: transformExpr(node.children[0]),
      mode,
    } as ASLStatement;
  }

  if (callee === 'digitalWrite') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'Serial.print' || callee === 'Serial.println') {
    return {
      kind: 'print',
      args: node.children.map(transformExpr),
      newline: callee === 'Serial.println',
    } as ASLStatement;
  }

  if (callee === 'Pin.value' && node.children.length === 2) {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'Pin.on') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: { kind: 'literal', value: 1 } as ASLExpr,
    } as ASLStatement;
  }

  if (callee === 'Pin.off') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: { kind: 'literal', value: 0 } as ASLExpr,
    } as ASLStatement;
  }

  return {
    kind: 'expr',
    expr: {
      kind: 'call',
      callee,
      args: node.children.map(transformExpr),
    },
  } as ASLStatement;
}

export function tryTransformRead(targetVar: string, valueNode: BaseNode | undefined): ASLStatement | null {
  if (!valueNode) return null;

  if (valueNode.nodeType === 'GpioRead') {
    return {
      kind: 'read',
      mode: 'DIGITAL',
      target: targetVar,
      pin: transformExpr(valueNode.children[0]),
    } as ASLStatement;
  }
  if (valueNode.nodeType === 'AnalogRead') {
    return {
      kind: 'read',
      mode: 'ANALOG',
      target: targetVar,
      pin: transformExpr(valueNode.children[0]),
    } as ASLStatement;
  }
  if (valueNode.nodeType === 'CallExpression') {
    if (valueNode.attributes.callee === 'digitalRead') {
      return {
        kind: 'read',
        mode: 'DIGITAL',
        target: targetVar,
        pin: transformExpr(valueNode.children[0]),
      } as ASLStatement;
    }
    if (valueNode.attributes.callee === 'analogRead') {
      return {
        kind: 'read',
        mode: 'ANALOG',
        target: targetVar,
        pin: transformExpr(valueNode.children[0]),
      } as ASLStatement;
    }
    if (valueNode.attributes.callee === 'Pin.value') {
      return {
        kind: 'read',
        mode: 'DIGITAL',
        target: targetVar,
        pin: transformExpr(valueNode.children[0]),
      } as ASLStatement;
    }
  }
  return null;
}

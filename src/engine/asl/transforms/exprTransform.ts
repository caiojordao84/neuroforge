import type { BaseNode } from '@/system/types';
import type { ASLExpr } from '../ASLTypes';

export function transformExpr(node: BaseNode | undefined): ASLExpr {
  if (!node) return { kind: 'literal', value: 0 };

  if (node.nodeType === 'Literal') {
    return { kind: 'literal', value: node.attributes.value };
  }

  if (node.nodeType === 'Identifier') {
    return { kind: 'var', name: node.attributes.name };
  }

  if (node.nodeType === 'BinaryExpression') {
    return {
      kind: 'binary',
      op: node.attributes.operator,
      left: transformExpr(node.children[0]),
      right: transformExpr(node.children[1]),
    } as ASLExpr;
  }

  if (node.nodeType === 'UnaryExpression') {
    return {
      kind: 'unary',
      op: node.attributes.operator as any,
      expr: transformExpr(node.children[0]),
    } as ASLExpr;
  }

  if (node.nodeType === 'CallExpression') {
    const callee = node.attributes.callee;

    if (callee === 'Pin.value') {
      return {
        kind: 'call',
        callee: 'digitalRead',
        args: [transformExpr(node.children[0])],
      } as ASLExpr;
    }

    return {
      kind: 'call',
      callee,
      args: node.children.map(transformExpr),
    } as ASLExpr;
  }

  if (node.nodeType === 'GpioRead') {
    return {
      kind: 'call',
      callee: 'digitalRead',
      args: [transformExpr(node.children[0])],
    } as ASLExpr;
  }

  if (node.nodeType === 'AnalogRead') {
    return {
      kind: 'call',
      callee: 'analogRead',
      args: [transformExpr(node.children[0])],
    } as ASLExpr;
  }

  if (node.nodeType === 'KeypadRead') {
    return {
      kind: 'call',
      callee: 'KeypadRead',
      args: [],
    } as ASLExpr;
  }

  if (node.nodeType === 'SubscriptExpression') {
    const arrayNode = node.children[0];
    const indexNode = node.children[1];
    if (arrayNode.nodeType === 'SubscriptExpression') {
      return {
        kind: 'index2D',
        array: transformExpr(arrayNode.children[0]),
        rowIndex: transformExpr(arrayNode.children[1]),
        colIndex: transformExpr(indexNode),
      } as ASLExpr;
    }
    return {
      kind: 'index',
      target: transformExpr(arrayNode),
      index: transformExpr(indexNode),
    } as ASLExpr;
  }

  if (node.nodeType === 'MemberExpression') {
    return {
      kind: 'member',
      target: transformExpr(node.children[0]),
      property: node.attributes.property,
    } as ASLExpr;
  }

  if (node.nodeType === 'SizeofExpression') {
    const child = node.children[0];

    if (child) {
      return {
        kind: 'call',
        callee: '__sizeof',
        args: [transformExpr(child)],
      } as ASLExpr;
    }

    return { kind: 'literal', value: 1 } as ASLExpr;
  }

  if (node.nodeType === 'ArrayInitializer') {
    return {
      kind: 'literal',
      value: node.children.map(c => (transformExpr(c) as any).value ?? 0)
    } as ASLExpr;
  }

  return { kind: 'literal', value: 0 };
}

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
    const op = node.attributes.operator as string;

    // ++/-- that reach here (prefix form like ++i, or postfix not caught by
    // normalizer) are converted to binary +/-1 to avoid the -v fallthrough.
    if (op === '++' || op === '--') {
      return {
        kind: 'binary',
        op: op === '++' ? '+' : '-',
        left: transformExpr(node.children[0]),
        right: { kind: 'literal', value: 1 },
      } as ASLExpr;
    }

    return {
      kind: 'unary',
      op: op as any,
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
      const innerArray = arrayNode.children[0];
      const innerIndex = arrayNode.children[1];
      if (innerArray.nodeType === 'SubscriptExpression') {
        return {
          kind: 'index3D',
          array: transformExpr(innerArray.children[0]),
          d1Index: transformExpr(innerArray.children[1]),
          d2Index: transformExpr(innerIndex),
          d3Index: transformExpr(indexNode),
        } as ASLExpr;
      }
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
      kind: 'array',
      elements: node.children.map(transformExpr),
    } as ASLExpr;
  }

  if (node.nodeType === 'ObjectInitializer') {
    const properties: { key: ASLExpr; value: ASLExpr }[] = [];
    for (let i = 0; i < node.children.length; i += 2) {
      properties.push({
        key: transformExpr(node.children[i]),
        value: transformExpr(node.children[i + 1]),
      });
    }
    return { kind: 'object', properties } as ASLExpr;
  }

  if (node.nodeType === 'CastExpression') {
    const targetType = node.attributes.targetType as string;
    const operand = transformExpr(node.children[0]);
    let callee = 'int';
    if (targetType === 'float' || targetType === 'double') callee = 'float';
    if (targetType === 'String') callee = 'String';
    return { kind: 'call', callee, args: [operand] } as ASLExpr;
  }

  if (node.nodeType === 'ConditionalExpression') {
    return {
      kind: 'conditional',
      condition: transformExpr(node.children[0]),
      whenTrue: transformExpr(node.children[1]),
      whenFalse: transformExpr(node.children[2]),
    } as ASLExpr;
  }

  return { kind: 'literal', value: 0 };
}

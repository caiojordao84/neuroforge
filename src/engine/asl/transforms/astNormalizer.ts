import type { BaseNode, ProgramNode } from '../../system/types';

let tempCounter = 0;

function getNextTempId(): string {
  return `__tmp_${tempCounter++}`;
}

export function normalizeAST(node: ProgramNode): ProgramNode {
  tempCounter = 0;
  return normalizeRecursive(node) as ProgramNode;
}

function normalizeRecursive(node: BaseNode): BaseNode {
  if (!node) return node;

  if (node.nodeType === 'ForLoop') {
    return node;
  }

  if (node.children && node.children.length > 0) {
    node.children = normalizeFileList(node.children);
  }

  return node;
}

function normalizeFileList(nodes: BaseNode[]): BaseNode[] {
  return nodes.flatMap(node => {
    if (!node) return [];

    const sideEffects: BaseNode[] = [];
    const transformedNode = processPostfixInExpr(node, sideEffects);

    let expanded: BaseNode[] = [transformedNode];
    if (sideEffects.length > 0) {
      const stmtNodes: BaseNode[] = sideEffects.map((expr, idx) => ({
        nodeType: 'ExpressionStatement',
        id: `pf_stmt_${node.id}_${idx}`,
        attributes: {},
        children: [expr],
      } as BaseNode));

      expanded = [...stmtNodes, transformedNode];
    }

    return expanded.map(n => {
      let finalNode = n;

      if (finalNode.nodeType === 'ExpressionStatement' && finalNode.children?.length === 1) {
        const child = finalNode.children[0];
        const hardwareNodes = [
          'GpioSet', 'GpioRead', 'AnalogRead', 'AnalogWrite',
          'HardwarePwm', 'LcdClear', 'LcdCursor', 'LcdPrint', 'OledText', 'OledShow', 'OledClear',
          'SerialBegin', 'SerialAvailable', 'SerialReadString',
          'CallExpression'
        ];
        if (hardwareNodes.includes(child.nodeType as string)) {
          finalNode = {
            ...child,
            leadingComments: [...(n.leadingComments || []), ...(child.leadingComments || [])],
            metadata: { ...n.metadata, ...child.metadata },
          };
        }
      }

      const hardwareNodesRequiringPinSimplification = ['GpioSet', 'GpioRead', 'AnalogRead', 'AnalogWrite'];
      if (hardwareNodesRequiringPinSimplification.includes(finalNode.nodeType as string)) {
        finalNode.children = finalNode.children?.map(child => {
          if (child.nodeType === 'CallExpression' && child.attributes.callee === 'Pin' && child.children.length > 0) {
            return child.children[0];
          }
          return child;
        });
      }

      return normalizeRecursive(finalNode);
    });
  });
}

function processPostfixInExpr(node: BaseNode, stmts: BaseNode[]): BaseNode {
  if (!node) return node;

  if (
    node.nodeType === 'UnaryExpression' &&
    (node.attributes.operator === '++' || node.attributes.operator === '--') &&
    node.attributes.prefix === false
  ) {
    const operand = node.children[0];
    if (operand?.nodeType === 'Identifier') {
      const varName = operand.attributes.name;
      const tid = getNextTempId();

      stmts.push({
        nodeType: 'BinaryExpression',
        id: `as_${tid}`,
        attributes: { operator: '=' },
        children: [
          { nodeType: 'Identifier', id: `tid_${tid}`, attributes: { name: tid }, children: [] },
          { nodeType: 'Identifier', id: `oid_${tid}`, attributes: { name: varName }, children: [] },
        ],
      } as BaseNode);

      const op = node.attributes.operator === '++' ? '+' : '-';
      stmts.push({
        nodeType: 'BinaryExpression',
        id: `inc_${tid}`,
        attributes: { operator: '=' },
        children: [
          { nodeType: 'Identifier', id: `vid_${tid}`, attributes: { name: varName }, children: [] },
          {
            nodeType: 'BinaryExpression',
            id: `bin_${tid}`,
            attributes: { operator: op },
            children: [
              { nodeType: 'Identifier', id: `vr_${tid}`, attributes: { name: varName }, children: [] },
              { nodeType: 'Literal', id: `lit_${tid}`, attributes: { value: 1 }, children: [] },
            ],
          },
        ],
      } as BaseNode);

      return {
        nodeType: 'Identifier',
        id: `use_${tid}`,
        attributes: { name: tid },
        children: [],
      } as BaseNode;
    }
  }

  const structuralTypes = ['IfStatement', 'WhileLoop', 'ForLoop', 'ReturnStatement', 'ExpressionStatement', 'Assignment', 'Expression'];

  if (structuralTypes.includes(node.nodeType as string)) {
    const newNode = { ...node, children: [...node.children] };
    if (node.nodeType === 'IfStatement' || node.nodeType === 'WhileLoop' || node.nodeType === 'ReturnStatement' || node.nodeType === 'ExpressionStatement' || node.nodeType === 'Expression') {
      if (node.children[0]) newNode.children[0] = processPostfixInExpr(node.children[0], stmts);
    } else if (node.nodeType === 'Assignment') {
      // children[0] is target, children[1] is value
      if (node.children[0]) newNode.children[0] = processPostfixInExpr(node.children[0], stmts);
      if (node.children[1]) newNode.children[1] = processPostfixInExpr(node.children[1], stmts);
    } else if (node.nodeType === 'ForLoop') {
      // Skip processing ForLoop children entirely - let statementRegistry handle it
      return node;
    }
    return newNode;
  }

  if (node.children && node.children.length > 0) {
    return {
      ...node,
      children: node.children.map(child => processPostfixInExpr(child, stmts)),
    };
  }

  return node;
}

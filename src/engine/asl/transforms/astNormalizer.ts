import type { ProgramNode, BaseNode } from '@/system/types';

/**
 * AST Normalizer for Transpilation.
 *
 * Purpose:
 * 1. Unwrap hardware nodes (GpioSet, DelayMs, etc.) from ExpressionStatement.
 * 2. Standardize pinMode and other common calls.
 * 3. Ensure consistent node structure for all generators.
 * 4. Desugar postfix ++/-- used in read positions into explicit temp-var assigns.
 */

// Deterministic counter for temp variable IDs across a single normalizeAST call.
let postfixTempCounter = 0;

function getNextTempId(): string {
  return `__tmp_${postfixTempCounter++}`;
}

export function normalizeAST(ast: ProgramNode): ProgramNode {
  // Reset counter per program so IDs are stable across calls.
  postfixTempCounter = 0;

  const normalizedChildren = ast.children
    .flatMap(node => normalizeNodes(node))
    .filter(node => node && node.nodeType !== 'Empty');

  return {
    ...ast,
    children: standardizeTopLevelStructure(normalizedChildren),
  };
}

function standardizeTopLevelStructure(nodes: BaseNode[]): BaseNode[] {
  if (nodes.some(n => n.nodeType === 'Function' && (n.attributes.name === 'setup' || n.attributes.name === 'loop'))) {
    return nodes;
  }

  const setupNodes: BaseNode[] = [];
  const loopNodes: BaseNode[] = [];
  let foundLoop = false;

  if (nodes.length === 1 && nodes[0].nodeType === 'Function' && nodes[0].attributes.name === 'main') {
    return standardizeTopLevelStructure(nodes[0].children);
  }

  for (const node of nodes) {
    if (node.nodeType === 'WhileLoop') {
      const cond = node.children[0];
      const isTrue = cond && (
        (cond.nodeType === 'Literal' && (cond.attributes.value === true || cond.attributes.value === 1 || cond.attributes.value === '1' || cond.attributes.value === 'true')) ||
        (cond.nodeType === 'Identifier' && (cond.attributes.name === 'True' || cond.attributes.name === 'true'))
      );
      if (isTrue && !foundLoop) {
        loopNodes.push(...node.children.slice(1));
        foundLoop = true;
        continue;
      }
    }
    if (!foundLoop) {
      setupNodes.push(node);
    } else {
      setupNodes.push(node);
    }
  }

  if (!foundLoop && setupNodes.length > 0) {
    return [
      { nodeType: 'Function', id: 'gen-setup', attributes: { name: 'setup' }, children: setupNodes },
      { nodeType: 'Function', id: 'gen-loop', attributes: { name: 'loop' }, children: [] },
    ];
  } else if (foundLoop) {
    return [
      { nodeType: 'Function', id: 'gen-setup', attributes: { name: 'setup' }, children: setupNodes },
      { nodeType: 'Function', id: 'gen-loop', attributes: { name: 'loop' }, children: loopNodes },
    ];
  }

  return nodes;
}

/**
 * Normalizes a single AST node, potentially expanding it into multiple nodes
 * (e.g. when desugaring postfix ++/-- side-effects).
 */
function normalizeNodes(node: BaseNode): BaseNode[] {
  if (!node) return [];

  // 1. Recursively normalize children using flatMap to allow expansion.
  if (node.children && node.children.length > 0) {
    node.children = node.children
      .flatMap(child => normalizeNodes(child))
      .filter(child => child && child.nodeType !== 'Empty');
  }

  // 2. Desugar postfix ++/-- in read positions inside ExpressionStatement.
  if (node.nodeType === 'ExpressionStatement') {
    const expanded = extractPostfixSideEffects(node);
    if (expanded.length > 1) return expanded;
  }

  // 3. Unwrap ExpressionStatement containing a hardware node.
  if (node.nodeType === 'ExpressionStatement' && node.children.length === 1) {
    const child = node.children[0];
    const hardwareNodes = [
      'GpioSet', 'GpioRead', 'AnalogRead', 'AnalogWrite',
      'DelayMs', 'Print', 'HardwarePwm', 'LcdClear',
      'LcdCursor', 'LcdPrint', 'OledText', 'OledShow', 'OledClear',
    ];
    if (hardwareNodes.includes(child.nodeType)) {
      return [{
        ...child,
        leadingComments: [...(node.leadingComments || []), ...(child.leadingComments || [])],
        metadata: { ...node.metadata, ...child.metadata },
      }];
    }
    if (child.nodeType === 'CallExpression' && child.attributes.callee === 'Pin') {
      return [{
        nodeType: 'CallExpression',
        id: `pinmode-${node.id}`,
        attributes: { callee: 'pinMode' },
        children: child.children,
        leadingComments: node.leadingComments,
        metadata: node.metadata,
      }];
    }
  }

  // 4. Simplify Pin(13, mode) inside hardware calls.
  const hardwareNodesRequiringPinSimplification = ['GpioSet', 'GpioRead', 'AnalogRead', 'AnalogWrite'];
  if (hardwareNodesRequiringPinSimplification.includes(node.nodeType)) {
    node.children = node.children.map(child => {
      if (child.nodeType === 'CallExpression' && child.attributes.callee === 'Pin' && child.children.length > 0) {
        return child.children[0];
      }
      return child;
    });
  }

  return [node];
}

// ---------------------------------------------------------------------------
// Postfix ++/-- desugar helpers
// ---------------------------------------------------------------------------

/**
 * Extracts postfix ++/-- side-effects from a single ExpressionStatement.
 *
 * For each `i++` or `i--` found in a read position inside the expression:
 *   1. Emits `ExpressionStatement( temp = i )`
 *   2. Emits `ExpressionStatement( i += 1 )`  (or -= 1)
 *   3. Replaces the postfix node with `Identifier { name: temp }`
 *
 * Returns [node] unchanged when no postfix ops are found.
 */
function extractPostfixSideEffects(node: BaseNode): BaseNode[] {
  const expr = node.children[0];
  if (!expr) return [node];

  const extractedStmts: BaseNode[] = [];
  const transformed = processPostfixInExpr(expr, extractedStmts);

  if (extractedStmts.length === 0) return [node];

  // Wrap each extracted BinaryExpression in an ExpressionStatement.
  const stmtNodes: BaseNode[] = extractedStmts.map((stmt, idx) => ({
    nodeType: 'ExpressionStatement',
    id: `pf_stmt_${idx}`,
    attributes: {},
    children: [stmt],
  } as BaseNode));

  // Original ExpressionStatement with the transformed expression.
  const transformedStmt: BaseNode = { ...node, children: [transformed] };

  return [...stmtNodes, transformedStmt];
}

/**
 * Recursively traverses an expression node, replacing each postfix
 * `UnaryExpression { operator: '++' | '--', prefix: false }` on an
 * `Identifier` with a fresh temp-var `Identifier`, and pushing the
 * corresponding `temp = i` and `i += 1` BinaryExpression nodes into `stmts`.
 */
function processPostfixInExpr(node: BaseNode, stmts: BaseNode[]): BaseNode {
  if (!node) return node;

  // Detect postfix ++/-- before recursing into children.
  if (
    node.nodeType === 'UnaryExpression' &&
    (node.attributes.operator === '++' || node.attributes.operator === '--') &&
    node.attributes.prefix === false
  ) {
    const child = node.children[0];
    if (child?.nodeType === 'Identifier') {
      const varName = child.attributes.name;
      const tempName = getNextTempId();
      const idx = stmts.length;

      // temp = i
      stmts.push({
        nodeType: 'BinaryExpression',
        id: `pf_assign_${idx}`,
        attributes: { operator: '=' },
        children: [
          { nodeType: 'Identifier', id: `pf_tid_${idx}`, attributes: { name: tempName }, children: [] },
          { nodeType: 'Identifier', id: `pf_orig_${idx}`, attributes: { name: varName }, children: [] },
        ],
      } as BaseNode);

      // i += 1  (or i -= 1)
      const incOp = node.attributes.operator === '++' ? '+=' : '-=';
      stmts.push({
        nodeType: 'BinaryExpression',
        id: `pf_inc_${idx + 1}`,
        attributes: { operator: incOp },
        children: [
          { nodeType: 'Identifier', id: `pf_var_${idx + 1}`, attributes: { name: varName }, children: [] },
          { nodeType: 'Literal', id: `pf_lit_${idx + 1}`, attributes: { value: 1 }, children: [] },
        ],
      } as BaseNode);

      // Replace the postfix node with the temp var.
      return {
        nodeType: 'Identifier',
        id: `pf_use_${idx}`,
        attributes: { name: tempName },
        children: [],
      } as BaseNode;
    }
  }

  // Recurse into children.
  return {
    ...node,
    children: node.children.map(child => processPostfixInExpr(child, stmts)),
  };
}

import type { BaseNode } from '@/system/types';
import type { ASLStatement, ASLExpr, ASLType } from '../ASLTypes';
import type { TransformContext } from './context';
import { transformExpr } from './exprTransform';
import { transformCallToStmt, tryTransformRead } from './callTransform';
import { buildEmptyArray, deepCopyValue, resolveSize } from '../helpers/arrayUtils';
import { extractPostfix, resetPostfixTempCounter } from './postfixUtils';

const HARDWARE_CALLEE_MAP: Record<string, string> = {
  'LcdPrint': 'lcd.print',
  'LcdCursor': 'lcd.setCursor',
  'LcdClear': 'lcd.clear',
  'OledText': 'oled.text',
  'OledShow': 'oled.show',
  'OledClear': 'oled.clear',
  'SevSegPrint': 'sevseg.print',
  'KeypadRead': 'KeypadRead',
  'DhtReadTemp': 'dht.readTemp',
  'DhtReadHum': 'dht.readHum',
  'UltrasonicRead': 'ultrasonic.read',
  'LdrRead': 'ldr.read',
  'IrRead': 'ir.read',
  'MotorsMove': 'motors.move',
  'MpuGet': 'mpu.get'
};

const HARDWARE_NODES = Object.keys(HARDWARE_CALLEE_MAP);

/** Callees whose return value is a servo instance (case-insensitive match via regex). */
const SERVO_CALLEE_EXACT = new Set([
  'Servo', 'servo.Servo', 'servo.ContinuousServo',
  'ServoPDMRP2', 'ServoPDMRP2Async',
]);

/** Continuous-rotation servo callees. */
const SERVO_CONTINUOUS_CALLEES = new Set([
  'servo.ContinuousServo',
]);

/** C++ type names that identify a servo variable declaration. */
const SERVO_TYPE_NAMES = new Set(['Servo', 'Servo&', 'Servo*', 'servo']);

/** Methods on a servo instance that write an angle/speed (→ servoWrite). */
const SERVO_WRITE_METHODS = new Set([
  'write', 'set_angle', 'setAngle', 'move',
]);

/** Methods on a servo instance that write raw µs / duty (→ servoWrite rawMicroseconds). */
const SERVO_WRITE_RAW_METHODS = new Set([
  'writeMicroseconds', 'duty_u16', 'duty_ns', 'duty',
]);

/** Methods / properties that mean detach/release. */
const SERVO_DETACH_METHODS = new Set([
  'detach', 'deinit', 'release', 'stop',
]);

/** SetMember property names that mean write-angle (CircuitPython). */
const SERVO_ANGLE_PROPS = new Set(['angle', 'throttle']);

export type StatementHandler = (node: BaseNode, ctx: TransformContext) => ASLStatement[];

export const statementRegistry: Record<string, StatementHandler> = {
  Block: handleBlock,
  Empty: handleEmpty,
  EnumDeclaration: handleEmpty,
  Loop: handleLoop,
  IfStatement: handleIfStatement,
  WhileLoop: handleWhileLoop,
  DoWhileLoop: handleDoWhileLoop,
  ForLoop: handleForLoop,
  ForIn: handleForIn,
  SwitchStatement: handleSwitchStatement,
  StructDeclaration: handleStructDeclaration,
  ReturnStatement: handleReturnStatement,
  BreakStatement: handleBreakStatement,
  ContinueStatement: handleContinueStatement,
  GpioSet: handleGpioSet,
  AnalogWrite: handleAnalogWrite,
  DelayMs: handleDelayMs,
  GpioRead: handleGpioRead,
  AnalogRead: handleAnalogRead,
  HardwarePwm: handleHardwarePwm,
  GpioBatch: handleGpioBatch,
  VariableDeclaration: handleVariableDeclaration,
  ExpressionStatement: handleExpressionStatement,
  CallExpression: handleExpressionStatement,
  Print: handlePrint,
  // --- Service Handlers (S5) ---
  UartWrite: handleUartWrite,
  UartRead: handleUartRead,
  I2CWrite: handleI2CWrite,
  I2CRead: handleI2CRead,
  SpiTransfer: handleSpiTransfer,
  TimerTON: handleTimerTON,
  TimerTOF: handleTimerTOF,
  TimerTP: handleTimerTP,
  CounterCTU: handleCounterCTU,
  CounterCTD: handleCounterCTD,
  LatchSR: handleLatchSR,
  LatchRS: handleLatchRS,
  TrigR: handleTrigR,
  TrigF: handleTrigF,
  SerialBegin: handleSerialBegin,
  // --- Servo Handlers ---
  ServoAttach: handleServoAttach,
  ServoWrite: handleServoWrite,
  ServoDetach: handleServoDetach,

  ...HARDWARE_NODES.reduce((acc, nodeType) => {
    acc[nodeType] = handleHardware;
    return acc;
  }, {} as Record<string, StatementHandler>)
};

// ============================================================================
// Servo helpers
// ============================================================================

/**
 * Registers a variable name as a servo instance in the context.
 * Idempotent — safe to call multiple times for the same name.
 */
function registerServo(ctx: TransformContext, varName: string): void {
  ctx.servoInstances ??= new Set();
  ctx.servoInstances.add(varName);
}

/**
 * Registers function parameters whose type indicates a servo instance.
 * Called at the start of function body transforms.
 * Covers: Servo s, Servo &s, Servo *s (C++) and generic 'pwm' params in Python
 * when the function name itself suggests servo usage.
 */
export function registerServoParams(params: { name: string; type: string }[], ctx: TransformContext): void {
  for (const p of params) {
    const normalised = (p.type ?? '').replace(/\s/g, '').replace(/[&*]/g, '');
    if (SERVO_TYPE_NAMES.has(normalised)) {
      registerServo(ctx, p.name);
    }
  }
}

/**
 * Resolves `varName` from a dotted callee string like "myServo.write" → "myServo".
 * Returns null if there is no dot.
 */
function splitCallee(callee: string): { varName: string; method: string } | null {
  const dot = callee.lastIndexOf('.');
  if (dot === -1) return null;
  return { varName: callee.slice(0, dot), method: callee.slice(dot + 1) };
}

/**
 * Tries to handle a CallExpression as a servo method call.
 * Returns ASLStatement[] if handled, null otherwise.
 *
 * Layer 3 — lazy inference:
 *   .attach()            → servoAttach (+ auto-register)
 *   .write()             → servoWrite
 *   .writeMicroseconds() → servoWrite { rawMicroseconds: true }
 *   .duty_u16()          → servoWrite { rawMicroseconds: true }
 *   .set_angle()         → servoWrite
 *   .detach()/.deinit()/.release() → servoDetach
 */
function tryHandleServoCall(
  expr: BaseNode,
  ctx: TransformContext,
): ASLStatement[] | null {
  const callee: string = expr.attributes?.callee ?? '';
  const parts = splitCallee(callee);
  if (!parts) return null;

  const { varName, method } = parts;
  const isKnown = ctx.servoInstances?.has(varName) ?? false;

  // .attach() → auto-register even if unknown, then emit servoAttach
  if (method === 'attach') {
    registerServo(ctx, varName);
    const pinExpr = transformExpr(expr.children[0]);
    const minPulse = expr.children[1] ? transformExpr(expr.children[1]) : undefined;
    const maxPulse = expr.children[2] ? transformExpr(expr.children[2]) : undefined;
    return [{ kind: 'servoAttach', varName, pin: pinExpr, minPulse, maxPulse } as ASLStatement];
  }

  if (!isKnown) return null;

  if (SERVO_WRITE_METHODS.has(method)) {
    return [{ kind: 'servoWrite', varName, angle: transformExpr(expr.children[0]) } as ASLStatement];
  }

  if (SERVO_WRITE_RAW_METHODS.has(method)) {
    return [{ kind: 'servoWrite', varName, angle: transformExpr(expr.children[0]), rawMicroseconds: true } as ASLStatement];
  }

  if (SERVO_DETACH_METHODS.has(method)) {
    return [{ kind: 'servoDetach', varName } as ASLStatement];
  }

  return null;
}

/**
 * Tries to handle a SetMember as a servo angle/throttle assignment.
 * CircuitPython: my_servo.angle = 90  /  my_servo.throttle = 0.5
 * Returns ASLStatement[] if handled, null otherwise.
 */
function tryHandleServoSetMember(
  expr: BaseNode,
  ctx: TransformContext,
): ASLStatement[] | null {
  if (expr.nodeType !== 'MemberExpression' && expr.nodeType !== 'SetMember') return null;
  const property: string = expr.attributes?.property ?? '';
  if (!SERVO_ANGLE_PROPS.has(property)) return null;

  const targetNode = expr.children[0];
  if (!targetNode || targetNode.nodeType !== 'Identifier') return null;
  const varName: string = targetNode.attributes?.name ?? '';
  if (!ctx.servoInstances?.has(varName)) return null;

  const valueNode = expr.children[1];
  if (!valueNode) return null;

  return [{ kind: 'servoWrite', varName, angle: transformExpr(valueNode) } as ASLStatement];
}

// ============================================================================
// Core registry handlers
// ============================================================================

function handleBlock(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  if (!ctx.transformBlock) return [];
  return ctx.transformBlock(node.children, ctx);
}

function handleEmpty(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [];
}

function handleLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const body = handleBlock(node, ctx);
  return [{ kind: 'for', condition: { kind: 'literal', value: true }, body, update: [] } as ASLStatement];
}

function handleStructDeclaration(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [];
}

function handleSwitchStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const discriminant = transformExpr(node.children[0]);
  const caseNodes = node.children.slice(1);

  const cases = caseNodes.map((caseNode) => {
    const isDefault = !!caseNode.attributes.isDefault;
    let test: ASLExpr | null = null;
    let bodyChildren: BaseNode[] = [];

    if (isDefault) {
      bodyChildren = caseNode.children;
    } else {
      test = transformExpr(caseNode.children[0]);
      bodyChildren = caseNode.children.slice(1);
    }

    const body = ctx.transformBlock ? ctx.transformBlock(bodyChildren, ctx) : [];
    return { test, body };
  });

  return [{ kind: 'switch', discriminant, cases } as ASLStatement];
}

function handleIfStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const condition = transformExpr(node.children[0]);
  const thenNode = node.children[1];
  const elseNode = node.children[2];

  const thenBranch = thenNode
    ? (thenNode.nodeType === 'Block'
      ? handleBlock(thenNode, ctx)
      : statementRegistry[thenNode.nodeType]?.(thenNode, ctx) || [])
    : [];

  let elseBranch: ASLStatement[] | undefined;
  if (elseNode) {
    if (elseNode.nodeType === 'Block') {
      elseBranch = handleBlock(elseNode, ctx);
    } else if (elseNode.nodeType === 'IfStatement') {
      elseBranch = handleIfStatement(elseNode, ctx);
    } else {
      elseBranch = statementRegistry[elseNode.nodeType]?.(elseNode, ctx);
    }
  }

  return [{ kind: 'if', condition, thenBranch, elseBranch } as ASLStatement];
}

function handleWhileLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const condition = transformExpr(node.children[0]);
  const bodyNode = node.children[1];
  const body = bodyNode
    ? (bodyNode.nodeType === 'Block'
      ? handleBlock(bodyNode, ctx)
      : statementRegistry[bodyNode.nodeType]?.(bodyNode, ctx) || [])
    : [];
  return [{ kind: 'while', condition, body } as ASLStatement];
}

function handleDoWhileLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const bodyNode = node.children[1];
  const body = bodyNode
    ? (bodyNode.nodeType === 'Block'
      ? handleBlock(bodyNode, ctx)
      : statementRegistry[bodyNode.nodeType]?.(bodyNode, ctx) || [])
    : [];
  const condition = transformExpr(node.children[0]);
  return [{ kind: 'doWhile', condition, body } as ASLStatement];
}

function handleForLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const result: ASLStatement[] = [];
  if (node.attributes.hasInit && node.children.length > 0 && ctx.transformBlock) {
    result.push(...ctx.transformBlock([node.children[0]], ctx));
  }

  let idx = node.attributes.hasInit ? 1 : 0;
  const cond = node.children[idx];
  idx++;
  const update = node.attributes.hasUpdate ? node.children[idx] : null;
  if (node.attributes.hasUpdate) idx++;

  const bodyNodes = node.children.slice(idx);
  const condSideEffects: BaseNode[] = [];
  resetPostfixTempCounter();
  const desugaredCond = cond ? extractPostfix(cond, condSideEffects) : null;

  const bodyStmts = ctx.transformBlock ? ctx.transformBlock(bodyNodes, ctx) : [];
  if (condSideEffects.length > 0) {
    condSideEffects.forEach(se => { bodyStmts.unshift(...handleAssignment(se)); });
  }

  const updateStmts: ASLStatement[] = [];
  if (update && ctx.transformBlock) {
    if (update.nodeType === 'UnaryExpression' && ['++', '--'].includes(update.attributes.operator)) {
      const child = update.children[0];
      if (child.nodeType === 'Identifier') {
        const varName = child.attributes.name;
        const op = update.attributes.operator === '++' ? '+' : '-';
        updateStmts.push({
          kind: 'assign', target: varName,
          value: { kind: 'binary', op, left: { kind: 'var', name: varName }, right: { kind: 'literal', value: 1 } }
        } as ASLStatement);
      }
    }

    if (updateStmts.length === 0) {
      const updateSideEffects: BaseNode[] = [];
      resetPostfixTempCounter();
      const desugaredUpdate = extractPostfix(update, updateSideEffects);

      updateStmts.push(...ctx.transformBlock([
        desugaredUpdate.nodeType === 'ExpressionStatement' ? desugaredUpdate : {
          nodeType: 'ExpressionStatement', id: 'u', attributes: {}, children: [desugaredUpdate],
        } as BaseNode,
      ], ctx));

      if (updateSideEffects.length > 0) {
        updateSideEffects.forEach(se => { updateStmts.push(...handleAssignment(se)); });
      }
    }
  }

  result.push({
    kind: 'for',
    condition: desugaredCond ? transformExpr(desugaredCond) : { kind: 'literal', value: true },
    body: bodyStmts,
    update: updateStmts,
  } as ASLStatement);
  return result;
}

function handleForIn(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const varName = node.attributes.varName || 'item';
  const iterable = transformExpr(node.children[0]);
  const bodyNode = node.children[1];
  const body = bodyNode
    ? (bodyNode.nodeType === 'Block'
      ? handleBlock(bodyNode, ctx)
      : statementRegistry[bodyNode.nodeType]?.(bodyNode, ctx) || [])
    : [];
  return [{ kind: 'forIn', varName, iterable, body } as any];
}

function handleGpioSet(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'digitalWrite', pin: transformExpr(node.children[0]), value: transformExpr(node.children[1]) } as ASLStatement];
}

function handleAnalogWrite(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'analogWrite', pin: transformExpr(node.children[0]), value: transformExpr(node.children[1]) } as ASLStatement];
}

function handleDelayMs(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'delay', milliseconds: transformExpr(node.children[0]) } as ASLStatement];
}

function handleReturnStatement(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const expr = node.children[0];
  if (!expr) return [{ kind: 'return' } as ASLStatement];
  const sideEffects: BaseNode[] = [];
  const desugaredExpr = extractPostfix(expr, sideEffects);
  const stmts: ASLStatement[] = [];
  sideEffects.forEach(se => { stmts.push(...handleAssignment(se)); });
  stmts.push({ kind: 'return', value: transformExpr(desugaredExpr) } as ASLStatement);
  return stmts;
}

function handleBreakStatement(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'break' } as ASLStatement];
}

function handleContinueStatement(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'continue' } as ASLStatement];
}

function handleGpioRead(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const target = node.attributes.target || '__tmp_read';
  return [{ kind: 'read', pin: transformExpr(node.children[0]), target, mode: 'DIGITAL' } as ASLStatement];
}

function handleAnalogRead(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const target = node.attributes.target || '__tmp_read';
  return [{ kind: 'read', pin: transformExpr(node.children[0]), target, mode: 'ANALOG' } as ASLStatement];
}

function handleHardwarePwm(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{
    kind: 'pwmInit',
    pin: { kind: 'literal', value: node.attributes.pin },
    freq: { kind: 'literal', value: node.attributes.freq || 1000 },
    duty: { kind: 'literal', value: node.attributes.duty }
  } as ASLStatement];
}

function handleGpioBatch(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const ops = node.attributes.operations || [];
  return ops.map((op: any) => ({
    kind: 'digitalWrite',
    pin: { kind: 'literal', value: op.pin },
    value: { kind: 'literal', value: op.val }
  } as ASLStatement));
}

// ============================================================================
// Service Handlers (S5)
// ============================================================================

function handleUartWrite(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'uartWrite', port: transformExpr(node.children[0]), data: transformExpr(node.children[1]) } as ASLStatement];
}

function handleUartRead(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'uartRead', port: transformExpr(node.children[0]), target: node.attributes.target, length: transformExpr(node.children[1]) } as ASLStatement];
}

function handleI2CWrite(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'i2cWrite', bus: transformExpr(node.children[0]), address: transformExpr(node.children[1]), data: transformExpr(node.children[2]) } as ASLStatement];
}

function handleI2CRead(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'i2cRead', bus: transformExpr(node.children[0]), address: transformExpr(node.children[1]), length: transformExpr(node.children[2]), target: node.attributes.target } as ASLStatement];
}

function handleSpiTransfer(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'spiTransfer', bus: transformExpr(node.children[0]), csPin: transformExpr(node.children[1]), txData: transformExpr(node.children[2]), target: node.attributes.target } as ASLStatement];
}

function handleTimerTON(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'timerTON', instance: node.attributes.instance, in: transformExpr(node.children[0]), pt: transformExpr(node.children[1]) } as ASLStatement];
}

function handleTimerTOF(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'timerTOF', instance: node.attributes.instance, in: transformExpr(node.children[0]), pt: transformExpr(node.children[1]) } as ASLStatement];
}

function handleTimerTP(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'timerTP', instance: node.attributes.instance, in: transformExpr(node.children[0]), pt: transformExpr(node.children[1]) } as ASLStatement];
}

function handleCounterCTU(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'counterCTU', instance: node.attributes.instance, cu: transformExpr(node.children[0]), r: transformExpr(node.children[1]), pv: transformExpr(node.children[2]) } as ASLStatement];
}

function handleCounterCTD(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'counterCTD', instance: node.attributes.instance, cd: transformExpr(node.children[0]), ld: transformExpr(node.children[1]), pv: transformExpr(node.children[2]) } as ASLStatement];
}

function handleLatchSR(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'latchSR', instance: node.attributes.instance, s: transformExpr(node.children[0]), r: transformExpr(node.children[1]) } as ASLStatement];
}

function handleLatchRS(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'latchRS', instance: node.attributes.instance, r: transformExpr(node.children[0]), s: transformExpr(node.children[1]) } as ASLStatement];
}

function handleTrigR(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'trigR', instance: node.attributes.instance, in: transformExpr(node.children[0]) } as ASLStatement];
}

function handleTrigF(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'trigF', instance: node.attributes.instance, in: transformExpr(node.children[0]) } as ASLStatement];
}

function handleSerialBegin(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'serialBegin', baud: transformExpr(node.children[0]) } as ASLStatement];
}

// ============================================================================
// Dedicated Servo node handlers (Camada 1 — explicit Blockly nodes)
// ============================================================================

function handleServoAttach(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const varName: string = node.attributes.varName;
  registerServo(ctx, varName);
  const pinExpr = transformExpr(node.children[0]);
  const minPulse = node.children[1] ? transformExpr(node.children[1]) : undefined;
  const maxPulse = node.children[2] ? transformExpr(node.children[2]) : undefined;
  return [{ kind: 'servoAttach', varName, pin: pinExpr, minPulse, maxPulse } as ASLStatement];
}

function handleServoWrite(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'servoWrite', varName: node.attributes.varName, angle: transformExpr(node.children[0]) } as ASLStatement];
}

function handleServoDetach(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'servoDetach', varName: node.attributes.varName } as ASLStatement];
}

// ============================================================================
// VariableDeclaration — includes Camada 1 & 2 servo detection
// ============================================================================

function handleVariableDeclaration(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const name = node.attributes.name;
  const type = (node.attributes.type || 'int') as ASLType;
  const valNode = node.children[0];
  const isArray = node.attributes.isArray;
  const isArray2D = node.attributes.isArray2D;
  const structType = node.attributes.structType;
  const structDef = structType ? ctx.structDefs?.[structType] : null;

  // ── Camada 1a: C++ bare Servo declaration — Servo dragon; / Servo servos[5];
  const normType = (node.attributes.type ?? '').replace(/\s/g, '').replace(/[&*]/g, '');
  if (SERVO_TYPE_NAMES.has(normType)) {
    registerServo(ctx, name);
    return []; // no initialiser, attach comes later
  }

  // ── Camada 1b: explicit Servo() / servo.Servo() / servo.ContinuousServo() call
  if (valNode?.nodeType === 'CallExpression') {
    const callee: string = valNode.attributes.callee ?? '';
    if (SERVO_CALLEE_EXACT.has(callee)) {
      registerServo(ctx, name);
      const isContinuous = SERVO_CONTINUOUS_CALLEES.has(callee);
      // Emit assign so executor can hold the instance reference; attach is implicit
      return [{ kind: 'assign', target: name, value: transformExpr(valNode) } as ASLStatement];
    }

    // ── Camada 2: infer from callee name matching /servo/i
    if (/servo/i.test(callee)) {
      registerServo(ctx, name);
      // Still emit the assign — the helper function call stays in the ASL
      return [{ kind: 'assign', target: name, value: transformExpr(valNode) } as ASLStatement];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Standard variable declaration logic (unchanged from original)
  // ─────────────────────────────────────────────────────────────────────────

  if (valNode && valNode.nodeType === 'CallExpression' && valNode.attributes.callee === 'Pin') {
    const pinExpr = transformExpr(valNode.children[0]);
    const modeNode = valNode.children[1];
    const pullNode = valNode.children[2];
    let mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' = 'INPUT';

    if (modeNode && modeNode.nodeType === 'Literal') {
      const v = modeNode.attributes.value;
      if (v === 1) mode = 'OUTPUT';
    }

    if (pullNode && pullNode.nodeType === 'Literal') {
      const v = pullNode.attributes.value;
      if (v === 2) mode = 'INPUT_PULLUP';
    }

    return [
      { kind: 'pinMode', pin: pinExpr, mode } as ASLStatement,
      { kind: 'assign', target: name, value: pinExpr } as ASLStatement
    ];
  }

  const readStmt = tryTransformRead(name, valNode);
  if (readStmt) return [readStmt];

  const stmts: ASLStatement[] = [];

  if (isArray && valNode?.nodeType === 'Literal' && Array.isArray(valNode.attributes.value) && valNode.attributes.value.length === 0) {
    const emptyArr = buildEmptyArray(node.attributes.arraySizeExpr, node.attributes.arraySize2Expr, ctx.globalsMap);
    return [{ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } }];
  }

  if (isArray && !valNode) {
    const emptyArr = buildEmptyArray(node.attributes.arraySizeExpr, node.attributes.arraySize2Expr, ctx.globalsMap);
    return [{ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } }];
  }

  if (valNode && valNode.nodeType === 'ArrayInitializer') {
    if (structDef && !isArray) {
      const baseObj: Record<string, any> = {};
      structDef.fields.forEach(f => { baseObj[f.name] = 0; });
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: baseObj } });
      valNode.children.forEach((c, i) => {
        if (i < structDef.fields.length) {
          stmts.push({ kind: 'setMember', target: { kind: 'var', name }, property: structDef.fields[i].name, value: transformExpr(c) });
        }
      });
      return stmts;
    }

    if (structDef && isArray) {
      const size = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
      const emptyArr: any[] = [];
      for (let i = 0; i < size; i++) {
        const baseObj: Record<string, any> = {};
        structDef.fields.forEach(f => { baseObj[f.name] = 0; });
        emptyArr.push(baseObj);
      }
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } });

      valNode.children.forEach((rowNode, i) => {
        if (i < size && rowNode.nodeType === 'ArrayInitializer') {
          rowNode.children.forEach((c, j) => {
            if (j < structDef.fields.length) {
              stmts.push({
                kind: 'setMember',
                target: { kind: 'index', target: { kind: 'var', name }, index: { kind: 'literal', value: i } },
                property: structDef.fields[j].name,
                value: transformExpr(c)
              });
            }
          });
        }
      });
      return stmts;
    }

    if (isArray2D && valNode.attributes.isArray2D) {
      const rows = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
      const cols = resolveSize(node.attributes.arraySize2Expr, ctx.globalsMap) || 0;
      const emptyMatrix = Array(rows).fill(null).map(() => Array(cols).fill(0));
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyMatrix } });
      valNode.children.forEach((rowNode, i) => {
        if (i < rows && rowNode.nodeType === 'ArrayInitializer' && rowNode.attributes.isRow) {
          rowNode.children.forEach((c, j) => {
            if (j < cols) {
              stmts.push({ kind: 'setIndex2D', target: name, rowIndex: { kind: 'literal', value: i }, colIndex: { kind: 'literal', value: j }, value: transformExpr(c) });
            }
          });
        }
      });
      return stmts;
    }

    const size = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
    const hasDesignated = valNode.children.some(c => c.nodeType === 'DesignatedInitializer');

    if (hasDesignated) {
      const emptyArr = Array(size).fill(0);
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } });
      valNode.children.forEach((c) => {
        if (c.nodeType === 'DesignatedInitializer') {
          const idxExpr = transformExpr(c.attributes.index as BaseNode);
          const valExpr = transformExpr(c.children[0]);
          stmts.push({ kind: 'setIndex', target: name, index: idxExpr, value: valExpr });
        }
      });
    } else {
      const emptyArr = Array(size).fill(0);
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } });
      valNode.children.forEach((c, i) => {
        if (i < size) {
          stmts.push({ kind: 'setIndex', target: name, index: { kind: 'literal', value: i }, value: transformExpr(c) });
        }
      });
    }
    return stmts;
  }

  if (valNode) {
    const sideEffects: BaseNode[] = [];
    resetPostfixTempCounter();
    const desugaredVal = extractPostfix(valNode, sideEffects);
    const resultStmts: ASLStatement[] = [];
    sideEffects.forEach(se => {
      resultStmts.push(...handleAssignment(se));
    });
    resultStmts.push({ kind: 'assign', target: name, value: transformExpr(desugaredVal) });
    return resultStmts;
  }

  return [{ kind: 'assign', target: name, value: { kind: 'literal', value: 0 } }];
}

// ============================================================================
// ExpressionStatement — includes Camada 3 servo detection
// ============================================================================

function handleExpressionStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const expr = node.nodeType === 'ExpressionStatement' ? node.children[0] : node;
  if (!expr) return [];

  if (expr.nodeType === 'GpioSet') {
    return [{ kind: 'digitalWrite', pin: transformExpr(expr.children[0]), value: transformExpr(expr.children[1]) } as ASLStatement];
  }

  if (expr.nodeType === 'AnalogWrite') {
    return [{ kind: 'analogWrite', pin: transformExpr(expr.children[0]), value: transformExpr(expr.children[1]) } as ASLStatement];
  }

  if (expr.nodeType === 'DelayMs') {
    return [{ kind: 'delay', milliseconds: transformExpr(expr.children[0]) } as ASLStatement];
  }

  if (expr.nodeType === 'BinaryExpression' && ['=', '+=', '-=', '*=', '/='].includes(expr.attributes.operator)) {
    // ── Camada 3: SetMember servo angle/throttle (CircuitPython)
    if (expr.attributes.operator === '=') {
      const servoSetMember = tryHandleServoSetMember(expr.children[0], ctx);
      if (servoSetMember) return servoSetMember;
    }
    return handleAssignment(expr);
  }

  if (expr.nodeType === 'UnaryExpression' && ['++', '--'].includes(expr.attributes.operator)) {
    const child = expr.children[0];
    if (child.nodeType === 'Identifier') {
      const varName = child.attributes.name;
      return [{
        kind: 'assign',
        target: varName,
        value: {
          kind: 'binary',
          op: expr.attributes.operator === '++' ? '+' : '-',
          left: { kind: 'var', name: varName },
          right: { kind: 'literal', value: 1 },
        },
      } as ASLStatement];
    }
  }

  // ── Camada 3: servo method call detection
  if (expr.nodeType === 'CallExpression') {
    const servoStmts = tryHandleServoCall(expr, ctx);
    if (servoStmts) return servoStmts;

    const stmt = transformCallToStmt(expr);
    if (stmt) return [stmt];
  }

  if (expr.nodeType === 'Print') {
    return [{ kind: 'print', args: expr.children.map(transformExpr), newline: !!expr.attributes.newline } as ASLStatement];
  }

  if (HARDWARE_NODES.includes(expr.nodeType)) {
    return handleHardware(expr);
  }

  const sideEffects: BaseNode[] = [];
  resetPostfixTempCounter();
  extractPostfix(expr, sideEffects);
  const resultStmts: ASLStatement[] = [];
  sideEffects.forEach(se => { resultStmts.push(...handleAssignment(se)); });
  return resultStmts;
}

function handleAssignment(expr: BaseNode): ASLStatement[] {
  const op = expr.attributes.operator as string;
  const left = expr.children[0];
  const right = expr.children[1];

  if (left.nodeType === 'Identifier') {
    const target = left.attributes.name;
    if (op === '=') {
      const sideEffects: BaseNode[] = [];
      resetPostfixTempCounter();
      const desugaredRight = extractPostfix(right, sideEffects);
      const resStmts: ASLStatement[] = [];
      sideEffects.forEach(se => { resStmts.push(...handleAssignment(se)); });
      const readStmt = tryTransformRead(target, desugaredRight);
      if (readStmt) {
        resStmts.push(readStmt);
        return resStmts;
      }
      resStmts.push({ kind: 'assign', target, value: transformExpr(desugaredRight) } as ASLStatement);
      return resStmts;
    } else {
      const binOp = op.charAt(0) as any;
      return [{ kind: 'assign', target, value: { kind: 'binary', op: binOp, left: { kind: 'var', name: target }, right: transformExpr(right) } } as ASLStatement];
    }
  }

  if (left.nodeType === 'UnaryExpression' && left.attributes.operator === '*') {
    const ptrExpr = transformExpr(left.children[0]);
    if (op === '=') return [{ kind: 'setPointer', target: ptrExpr, value: transformExpr(right) } as any];
    const binOp = op.charAt(0) as any;
    return [{ kind: 'setPointer', target: ptrExpr, value: { kind: 'binary', op: binOp, left: { kind: 'unary', op: '*', expr: ptrExpr }, right: transformExpr(right) } } as any];
  }

  if (left.nodeType === 'SubscriptExpression') {
    const targetArr = left.children[0];
    const index = left.children[1];

    if (targetArr.nodeType === 'SubscriptExpression' && targetArr.children[0].nodeType === 'SubscriptExpression') {
      const arrName = targetArr.children[0].children[0].attributes.name;
      const d1Index = transformExpr(targetArr.children[0].children[1]);
      const d2Index = transformExpr(targetArr.children[1]);
      const d3Index = transformExpr(index);
      return [{ kind: 'setIndex3D', target: arrName, d1Index, d2Index, d3Index, value: transformExpr(right) } as ASLStatement];
    }
    if (targetArr.nodeType === 'SubscriptExpression' && targetArr.children[0].nodeType === 'Identifier') {
      const arrName = (targetArr.children[0] as any).attributes.name;
      const rowIndex = transformExpr(targetArr.children[1]);
      const colIndex = transformExpr(index);
      return [{ kind: 'setIndex2D', target: arrName, rowIndex, colIndex, value: transformExpr(right) } as ASLStatement];
    }
    if (targetArr.nodeType === 'Identifier') {
      const targetName = targetArr.attributes.name;
      if (op === '=') return [{ kind: 'setIndex', target: targetName, index: transformExpr(index), value: transformExpr(right) } as ASLStatement];
      const binOp = op.charAt(0) as any;
      return [{ kind: 'setIndex', target: targetName, index: transformExpr(index), value: { kind: 'binary', op: binOp, left: { kind: 'index', target: transformExpr(targetArr), index: transformExpr(index) }, right: transformExpr(right) } } as ASLStatement];
    }
  }

  if (left.nodeType === 'MemberExpression') {
    const target = transformExpr(left.children[0]);
    const property = left.attributes.property;
    if (op === '=') {
      return [{ kind: 'setMember', target, property, value: transformExpr(right) } as ASLStatement];
    } else {
      const binOp = op.charAt(0) as any;
      const currentVal: ASLExpr = { kind: 'member', target, property };
      return [{ kind: 'setMember', target, property, value: { kind: 'binary', op: binOp, left: currentVal, right: transformExpr(right) } } as ASLStatement];
    }
  }

  return [];
}

function handlePrint(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'print', args: node.children.map(transformExpr), newline: !!node.attributes.newline } as ASLStatement];
}

function handleHardware(node: BaseNode): ASLStatement[] {
  const callee = HARDWARE_CALLEE_MAP[node.nodeType];
  if (!callee) return [];
  return [{ kind: 'expr', expr: { kind: 'call', callee, args: node.children.map(transformExpr) } } as ASLStatement];
}

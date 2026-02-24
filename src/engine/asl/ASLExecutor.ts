// src/engine/asl/ASLExecutor.ts
// Executor assíncrono da ASL v1 sobre o SimulationEngine (modo fake).
// Suporta: funções, chamadas, arrays/objetos, structs, break/continue/return,
// print/log, abortSignal para controle de loops e delays.

import type { SimulationEngine } from '@/engine/SimulationEngine';
import { simulationEngine } from '@/engine/SimulationEngine';
import type { ASLProgram, ASLStatement, ASLExpr, ASLFunction, ASLStructDef } from './ASLTypes';

export interface ASLRuntime {
  setup: () => Promise<void>;
  loop: () => Promise<void>;
}

export interface ASLRuntimeOptions {
  /**
   * Permite injetar uma instância custom de SimulationEngine
   * (útil para testes). Por padrão usa o singleton global.
   */
  engine?: SimulationEngine;
  /**
   * Sinal opcional para abortar loops/delays longos.
   */
  abortSignal?: AbortSignal;
}

// Sinais de controle internos
class ReturnSignal {
  constructor(public value: any) { }
}
class BreakSignal { }
class ContinueSignal { }

export function createASLRuntime(
  program: ASLProgram,
  options: ASLRuntimeOptions = {},
): ASLRuntime {
  const engine = options.engine ?? simulationEngine;
  const globalEnv = new Map<string, any>();
  const functionMap = new Map<string, ASLFunction>();

  // Mapa de structs para inicialização correcta de instâncias
  const structsMap = new Map<string, ASLStructDef>(
    Object.entries(program.structs ?? {})
  );

  // 1. Inicializa globais com deep copy para arrays/objetos
  for (const g of program.globals) {
    const rawInitial =
      g.initialValue !== undefined
        ? g.initialValue
        : defaultValueForType(g.type, structsMap);
    const initial =
      Array.isArray(rawInitial) || (rawInitial && typeof rawInitial === 'object')
        ? JSON.parse(JSON.stringify(rawInitial))
        : rawInitial;
    globalEnv.set(g.name, initial);
  }

  // 2. Indexa funções
  for (const f of program.functions) {
    functionMap.set(f.name, f);
  }

  const setupFuncDef = program.functions.find((f) => f.name === 'setup');
  const mainTask = program.tasks[0]; // loop (ou mainLoop)

  const runContext: RunContext = {
    engine,
    functions: functionMap,
    globals: globalEnv,
    structs: structsMap,
    abortSignal: options.abortSignal,
    printBuffer: '',
  };

  const setup = async () => {
    if (setupFuncDef) {
      try {
        await executeStatements(setupFuncDef.body, globalEnv, runContext);
      } catch (e) {
        if (!(e instanceof ReturnSignal)) throw e;
      }
    }
  };

  const loop = async () => {
    if (mainTask) {
      try {
        await executeStatements(mainTask.body, globalEnv, runContext);
      } catch (e) {
        if (!(e instanceof ReturnSignal)) throw e;
      }
    }
  };

  return { setup, loop };
}

interface RunContext {
  engine: SimulationEngine;
  functions: Map<string, ASLFunction>;
  globals: Map<string, any>;
  structs: Map<string, ASLStructDef>;
  abortSignal?: AbortSignal;
  /** Buffer para Serial.print() sem newline — flush em Serial.println() */
  printBuffer: string;
}

/**
 * Devolve o valor zero para um tipo dado.
 * Se o tipo for o nome de uma struct conhecida, devolve um objecto
 * com todos os campos inicializados a zero.
 */
function defaultValueForType(type: string, structs?: Map<string, ASLStructDef>): any {
  switch (type) {
    case 'int':
    case 'float':
      return 0;
    case 'bool':
    case 'boolean':
      return false;
    case 'string':
    case 'String':
      return '';
    case 'void':
      return undefined;
    default: {
      // Verificar se é uma struct conhecida
      if (structs) {
        const def = structs.get(type);
        if (def) {
          const obj: Record<string, any> = {};
          for (const m of def.members) {
            obj[m.name] = defaultValueForType(m.type.trim(), structs);
          }
          return obj;
        }
      }
      return 0;
    }
  }
}

// Executa um bloco de statements.
async function executeStatements(
  stmts: ASLStatement[],
  localEnv: Map<string, any>,
  ctx: RunContext,
): Promise<void> {
  if (ctx.abortSignal?.aborted) return;

  for (const s of stmts) {
    if (ctx.abortSignal?.aborted) return;

    switch (s.kind) {
      case 'comment':
        break;

      case 'pinMode': {
        const pin = await evalExpr(s.pin, localEnv, ctx);
        ctx.engine.pinMode(pin, s.mode);
        break;
      }

      case 'digitalWrite': {
        const pin = await evalExpr(s.pin, localEnv, ctx);
        const valRaw =
          typeof s.value === 'string' ? s.value : await evalExpr(s.value, localEnv, ctx);
        const value =
          valRaw === 'HIGH' || valRaw === 1 || valRaw === true ? 'HIGH' : 'LOW';
        ctx.engine.digitalWrite(pin, value);
        break;
      }

      case 'analogWrite': {
        const pin = await evalExpr(s.pin, localEnv, ctx);
        const value = await evalExpr(s.value, localEnv, ctx);
        ctx.engine.analogWrite(pin, value);
        break;
      }

      case 'read': {
        const pin = await evalExpr(s.pin, localEnv, ctx);
        let v: number;
        if (s.mode === 'DIGITAL') {
          const dr = ctx.engine.digitalRead(pin);
          v = dr === 'HIGH' ? 1 : 0;
        } else {
          v = ctx.engine.analogRead(pin);
        }
        setVar(s.target, v, localEnv, ctx.globals);
        break;
      }

      case 'if': {
        const cond = await evalExpr(s.condition, localEnv, ctx);
        if (cond) {
          await executeStatements(s.thenBranch, localEnv, ctx);
        } else if (s.elseBranch) {
          await executeStatements(s.elseBranch, localEnv, ctx);
        }
        break;
      }

      case 'while': {
        let cycles = 0;
        while (await evalExpr(s.condition, localEnv, ctx)) {
          if (ctx.abortSignal?.aborted) return;
          try {
            await executeStatements(s.body, localEnv, ctx);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
          cycles++;
          if (cycles % 10 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        break;
      }

      case 'delay': {
        const ms = await evalExpr(s.milliseconds, localEnv, ctx);
        const total = Math.max(0, Number(ms) || 0);
        const chunk = 50;
        const chunks = Math.ceil(total / chunk);
        for (let i = 0; i < chunks; i++) {
          if (ctx.abortSignal?.aborted) return;
          const remaining = total - i * chunk;
          await ctx.engine.delay(Math.min(chunk, remaining));
        }
        break;
      }

      case 'assign': {
        const val = await evalExpr(s.value, localEnv, ctx);
        // Se o valor atribuído é um objecto/struct, garantir deep copy
        const safeVal =
          val !== null && typeof val === 'object' && !val.__isPtr
            ? JSON.parse(JSON.stringify(val))
            : val;
        setVar(s.target, safeVal, localEnv, ctx.globals);
        break;
      }

      case 'setIndex': {
        const idx = await evalExpr(s.index, localEnv, ctx);
        const val = await evalExpr(s.value, localEnv, ctx);
        const arr = getVar(s.target, localEnv, ctx.globals);
        if (Array.isArray(arr)) {
          arr[idx] = val;
        }
        break;
      }

      case 'setIndex2D': {
        const row = await evalExpr(s.rowIndex, localEnv, ctx);
        const col = await evalExpr(s.colIndex, localEnv, ctx);
        const val = await evalExpr(s.value, localEnv, ctx);
        const arr = getVar(s.target, localEnv, ctx.globals);
        if (Array.isArray(arr) && Array.isArray(arr[row])) {
          arr[row][col] = val;
        }
        break;
      }

      case 'setIndex3D': {
        const d1 = await evalExpr(s.d1Index, localEnv, ctx);
        const d2 = await evalExpr(s.d2Index, localEnv, ctx);
        const d3 = await evalExpr(s.d3Index, localEnv, ctx);
        const val = await evalExpr(s.value, localEnv, ctx);
        const arr = getVar(s.target, localEnv, ctx.globals);
        if (Array.isArray(arr) && Array.isArray(arr[d1]) && Array.isArray(arr[d1][d2])) {
          arr[d1][d2][d3] = val;
        }
        break;
      }

      case 'setMember': {
        const targetObj = await evalExpr(s.target, localEnv, ctx);
        const val = await evalExpr(s.value, localEnv, ctx);
        if (targetObj && typeof targetObj === 'object') {
          (targetObj as any)[s.property] = val;
        }
        break;
      }

      case 'setDeref': {
        const ptr = await evalExpr(s.target, localEnv, ctx);
        const val = await evalExpr(s.value, localEnv, ctx);
        if (ptr && typeof ptr === 'object' && ptr.__isPtr) {
          if (ptr.index !== undefined) {
            const arr = getVar(ptr.target, localEnv, ctx.globals);
            if (Array.isArray(arr)) {
              arr[ptr.index] = val;
            }
          } else {
            setVar(ptr.target, val, localEnv, ctx.globals);
          }
        }
        break;
      }

      case 'expr': {
        await evalExpr(s.expr, localEnv, ctx);
        break;
      }

      case 'return': {
        const val = s.value ? await evalExpr(s.value, localEnv, ctx) : undefined;
        throw new ReturnSignal(val);
      }

      case 'break':
        throw new BreakSignal();

      case 'continue':
        throw new ContinueSignal();

      case 'print': {
        const parts: string[] = [];
        for (const a of s.args) {
          parts.push(asString(await evalExpr(a, localEnv, ctx)));
        }
        const msg = parts.join('');

        if (s.newline !== false) {
          ctx.engine.log(ctx.printBuffer + msg);
          ctx.printBuffer = '';
        } else {
          ctx.printBuffer += msg;
        }
        break;
      }
    }
  }
}

function asString(val: any): string {
  if (val && typeof val === 'object' && val.__isPtr) {
    const addr = getPointerAddress(val);
    return `0x${addr.toString(16).toUpperCase()}`;
  }
  if (Array.isArray(val)) {
    if (val.length > 0 && typeof val[0] === 'number') {
      let s = '';
      for (const b of val) {
        if (b === 0) break;
        s += String.fromCharCode(b);
      }
      return s;
    }
    return JSON.stringify(val);
  }
  return String(val ?? '');
}

// Helpers de ambiente
function setVar(name: string, val: any, local: Map<string, any>, global: Map<string, any>) {
  if (local.has(name)) local.set(name, val);
  else global.set(name, val);
}

function getVar(name: string, local: Map<string, any>, global: Map<string, any>) {
  if (local.has(name)) return local.get(name);
  return global.get(name);
}

// Avaliação de expressões
async function evalExpr(expr: ASLExpr, env: Map<string, any>, ctx: RunContext): Promise<any> {
  switch (expr.kind) {
    case 'literal':
      return expr.value;

    case 'var':
      return getVar(expr.name, env, ctx.globals);

    case 'index': {
      const arr = await evalExpr(expr.target, env, ctx);
      const idx = await evalExpr(expr.index, env, ctx);
      if (arr && (arr as any).__isPtr) {
        const base = getVar((arr as any).target, env, ctx.globals);
        const baseIdx = (arr as any).index || 0;
        return base[baseIdx + idx];
      }
      if (Array.isArray(arr)) return arr[idx];
      return 0;
    }

    case 'index2D': {
      const arr = await evalExpr(expr.array, env, ctx);
      const row = await evalExpr(expr.rowIndex, env, ctx);
      const col = await evalExpr(expr.colIndex, env, ctx);
      if (Array.isArray(arr) && Array.isArray(arr[row])) return arr[row][col];
      return 0;
    }

    case 'index3D': {
      const arr = await evalExpr(expr.array, env, ctx);
      const d1 = await evalExpr(expr.d1Index, env, ctx);
      const d2 = await evalExpr(expr.d2Index, env, ctx);
      const d3 = await evalExpr(expr.d3Index, env, ctx);
      if (Array.isArray(arr) && Array.isArray(arr[d1]) && Array.isArray(arr[d1][d2])) return arr[d1][d2][d3];
      return 0;
    }

    case 'member': {
      const obj = await evalExpr(expr.target, env, ctx);
      if (obj && typeof obj === 'object') return (obj as any)[expr.property];
      // Se o objecto ainda não foi inicializado mas é uma struct conhecida,
      // tentar obter o valor zero do campo
      if (expr.target.kind === 'var') {
        const structVal = getVar(expr.target.name, env, ctx.globals);
        if (structVal && typeof structVal === 'object') {
          return (structVal as any)[expr.property] ?? 0;
        }
      }
      return 0;
    }

    case 'unary': {
      if (expr.op === '&') {
        const sub = expr.expr;
        if (sub.kind === 'var') return { __isPtr: true, target: sub.name };
        if (sub.kind === 'index') {
          const idx = await evalExpr(sub.index, env, ctx);
          const target = (sub.target as any).name;
          return { __isPtr: true, target, index: idx };
        }
      }
      const v = await evalExpr(expr.expr, env, ctx);
      if (expr.op === '!') return !v;
      if (expr.op === '~') return ~v;
      if (expr.op === '+') return +v;
      if (expr.op === '-') return -v;
      if (expr.op === '*') {
        if (v && (v as any).__isPtr) {
          const base = getVar((v as any).target, env, ctx.globals);
          if ((v as any).index !== undefined && Array.isArray(base)) {
            return base[(v as any).index];
          }
          return base;
        }
        return v;
      }
      return v;
    }

    case 'binary': {
      const l = await evalExpr(expr.left, env, ctx);
      const r = await evalExpr(expr.right, env, ctx);
      switch (expr.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '%': return l % r;
        case '==': return l == r;
        case '!=': return l != r;
        case '<': return l < r;
        case '<=': return l <= r;
        case '>': return l > r;
        case '>=': return l >= r;
        case '&&': return l && r;
        case '||': return l || r;
        case '&': return l & r;
        case '|': return l | r;
        case '^': return l ^ r;
        case '<<': return l << r;
        case '>>': return l >> r;
        default: return 0;
      }
    }

    case 'call': {
      if (expr.callee === 'Pin') {
        const pinNum = await evalExpr(expr.args[0], env, ctx);
        const modeRaw = expr.args[1] ? await evalExpr(expr.args[1], env, ctx) : 1;
        const mode = modeRaw === 0 ? 'INPUT' : 'OUTPUT';
        ctx.engine.pinMode(pinNum, mode);
        return pinNum;
      }
      if (expr.callee === 'Pin.on') {
        const pin = await evalExpr(expr.args[0], env, ctx);
        ctx.engine.digitalWrite(pin, 'HIGH');
        return 0;
      }
      if (expr.callee === 'Pin.off') {
        const pin = await evalExpr(expr.args[0], env, ctx);
        ctx.engine.digitalWrite(pin, 'LOW');
        return 0;
      }
      if (expr.callee === 'Pin.value') {
        const pin = await evalExpr(expr.args[0], env, ctx);
        if (expr.args.length > 1) {
          const valRaw = await evalExpr(expr.args[1], env, ctx);
          const value = (valRaw === 'HIGH' || valRaw === 1 || valRaw === true) ? 'HIGH' : 'LOW';
          ctx.engine.digitalWrite(pin, value);
          return 0;
        } else {
          return ctx.engine.digitalRead(pin) === 'HIGH' ? 1 : 0;
        }
      }

      if (expr.callee === 'Serial.begin') return 0;

      // random(max) — 1 arg; random(min, max) — 2 args
      if (expr.callee === 'random') {
        if (expr.args.length === 1) {
          const max = await evalExpr(expr.args[0], env, ctx);
          return Math.floor(Math.random() * max);
        }
        const min = expr.args[0] ? await evalExpr(expr.args[0], env, ctx) : 0;
        const max = expr.args[1] ? await evalExpr(expr.args[1], env, ctx) : 100;
        return Math.floor(Math.random() * (max - min)) + min;
      }

      if (expr.callee === 'digitalRead') {
        const pin = await evalExpr(expr.args[0], env, ctx);
        return ctx.engine.digitalRead(pin) === 'HIGH' ? 1 : 0;
      }
      if (expr.callee === 'analogRead') {
        const pin = await evalExpr(expr.args[0], env, ctx);
        return ctx.engine.analogRead(pin);
      }
      if (expr.callee === 'millis') {
        return ctx.engine.millis();
      }
      if (expr.callee === 'micros') {
        return ctx.engine.micros();
      }
      if (expr.callee === 'tone' || expr.callee === 'noTone' || expr.callee === 'servo') {
        const args = [];
        for (const a of expr.args) args.push(await evalExpr(a, env, ctx));
        if (expr.callee === 'tone') ctx.engine.tone(args[0], args[1], args[2]);
        if (expr.callee === 'noTone') ctx.engine.noTone(args[0]);
        if (expr.callee === 'servo') ctx.engine.emit('tone', { pin: args[0], frequency: 1000, angle: args[1] });
        return 0;
      }
      if (expr.callee === 'map') {
        const args = [];
        for (const a of expr.args) args.push(await evalExpr(a, env, ctx));
        return ctx.engine.map(args[0], args[1], args[2], args[3], args[4]);
      }
      if (expr.callee === 'constrain') {
        const args = [];
        for (const a of expr.args) args.push(await evalExpr(a, env, ctx));
        return ctx.engine.constrain(args[0], args[1], args[2]);
      }

      if (expr.callee === '__sizeof') {
        const arr = await evalExpr(expr.args[0], env, ctx);
        if (Array.isArray(arr)) {
          const firstRow = arr[0];
          if (Array.isArray(firstRow)) {
            return firstRow.length;
          }
          return arr.length;
        }
        return 1;
      }

      // Conversores de tipo
      if (expr.callee === 'String') return String(await evalExpr(expr.args[0] || { kind: 'literal', value: '' }, env, ctx));
      if (expr.callee === 'int') {
        const val = await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx);
        if (val && typeof val === 'object' && (val as any).__isPtr) {
          return getPointerAddress(val);
        }
        return Math.floor(Number(val) || 0);
      }
      if (expr.callee === 'float') return Number(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx)) || 0;

      // --- Math builtins ---
      if (expr.callee === 'abs') return Math.abs(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'sqrt') return Math.sqrt(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'pow') {
        const base = await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx);
        const exp  = await evalExpr(expr.args[1] || { kind: 'literal', value: 1 }, env, ctx);
        return Math.pow(base, exp);
      }
      if (expr.callee === 'sin')   return Math.sin(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'cos')   return Math.cos(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'tan')   return Math.tan(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'log')   return Math.log(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'min') {
        const a = await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx);
        const b = await evalExpr(expr.args[1] || { kind: 'literal', value: 0 }, env, ctx);
        return Math.min(a, b);
      }
      if (expr.callee === 'max') {
        const a = await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx);
        const b = await evalExpr(expr.args[1] || { kind: 'literal', value: 0 }, env, ctx);
        return Math.max(a, b);
      }
      if (expr.callee === 'round') return Math.round(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'floor') return Math.floor(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'ceil')  return Math.ceil(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx));
      if (expr.callee === 'isnan') return isNaN(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx)) ? 1 : 0;
      if (expr.callee === 'isinf') return !isFinite(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx)) ? 1 : 0;

      // --- C stdlib string functions ---
      if (expr.callee === 'strlen') {
        const s = String(await evalExpr(expr.args[0] || { kind: 'literal', value: '' }, env, ctx));
        return s.length;
      }
      if (expr.callee === 'strcmp') {
        const sa = String(await evalExpr(expr.args[0] || { kind: 'literal', value: '' }, env, ctx));
        const sb = String(await evalExpr(expr.args[1] || { kind: 'literal', value: '' }, env, ctx));
        return sa === sb ? 0 : (sa < sb ? -1 : 1);
      }
      if (expr.callee === 'atoi') {
        const s = String(await evalExpr(expr.args[0] || { kind: 'literal', value: '0' }, env, ctx));
        return parseInt(s, 10) || 0;
      }
      if (expr.callee === 'atof') {
        const s = String(await evalExpr(expr.args[0] || { kind: 'literal', value: '0' }, env, ctx));
        return parseFloat(s) || 0;
      }
      if (expr.callee === 'dtostrf') {
        const val  = await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx);
        const prec = expr.args[2] ? await evalExpr(expr.args[2], env, ctx) : 2;
        return Number(val).toFixed(Number(prec) || 2);
      }

      // Hardware / Library Calls (Event-based)
      if (expr.callee.includes('.') || expr.callee === 'KeypadRead') {
        const args = [];
        for (const a of expr.args) args.push(await evalExpr(a, env, ctx));
        ctx.engine.emit('hardwareCall', { callee: expr.callee, args });
        return 0;
      }

      // Funções de usuário
      const funcDef = ctx.functions.get(expr.callee);
      if (funcDef) {
        const callEnv = new Map<string, any>();
        for (let i = 0; i < funcDef.params.length; i++) {
          const val = expr.args[i] ? await evalExpr(expr.args[i], env, ctx) : 0;
          // Se o parâmetro for do tipo struct, passar deep copy (pass-by-value)
          const safeVal =
            val !== null && typeof val === 'object' && !val.__isPtr
              ? JSON.parse(JSON.stringify(val))
              : val;
          callEnv.set(funcDef.params[i].name, safeVal);
        }
        try {
          await executeStatements(funcDef.body, callEnv, ctx);
        } catch (e) {
          if (e instanceof ReturnSignal) return e.value;
          throw e;
        }
        return 0;
      }

      return 0;
    }
    default:
      return 0;
  }
}

function getPointerAddress(ptr: any): number {
  if (!ptr) return 0;
  if (!ptr.__addr) {
    const name = ptr.target || '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const base = 0x1000 + (Math.abs(hash) % 0x7000);
    ptr.__addr = base + (ptr.index || 0);
  }
  return ptr.__addr;
}

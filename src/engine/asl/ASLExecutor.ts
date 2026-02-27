// src/engine/asl/ASLExecutor.ts
// Executor assíncrono da ASL v1 sobre o SimulationEngine (modo fake).
// Suporta: funções, chamadas, arrays/objetos, break/continue/return, print/log,
// abortSignal para controle de loops e delays, structs, pointer arrays.

import type { SimulationEngine } from '@/engine/SimulationEngine';
import { simulationEngine } from '@/engine/SimulationEngine';
import type { ASLProgram, ASLStatement, ASLExpr, ASLFunction } from './ASLTypes';

export interface ASLRuntime {
  setup: () => Promise<void>;
  loop: () => Promise<void>;
}

export interface ASLRuntimeOptions {
  engine?: SimulationEngine;
  abortSignal?: AbortSignal;
}

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

  for (const g of program.globals) {
    const rawInitial =
      g.initialValue !== undefined ? g.initialValue : defaultValueForType(g.type);
    const initial =
      Array.isArray(rawInitial) || (rawInitial && typeof rawInitial === 'object')
        ? JSON.parse(JSON.stringify(rawInitial))
        : rawInitial;
    globalEnv.set(g.name, initial);
  }

  for (const f of program.functions) {
    functionMap.set(f.name, f);
  }

  const setupFuncDef = program.functions.find((f) => f.name === 'setup');
  const mainTask = program.tasks[0];

  const runContext: RunContext = {
    engine,
    functions: functionMap,
    globals: globalEnv,
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
  abortSignal?: AbortSignal;
  printBuffer: string;
}

function defaultValueForType(type: string): any {
  switch (type) {
    case 'int':
    case 'float':
      return 0;
    case 'bool':
      return false;
    case 'string':
      return '';
    case 'struct':
      return {};
    default:
      return 0;
  }
}

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

      case 'doWhile': {
        let cycles = 0;
        do {
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
        } while (await evalExpr(s.condition, localEnv, ctx));
        break;
      }

      case 'for': {
        let cycles = 0;
        while (await evalExpr(s.condition, localEnv, ctx)) {
          if (ctx.abortSignal?.aborted) return;
          let broken = false;
          try {
            await executeStatements(s.body, localEnv, ctx);
          } catch (e) {
            if (e instanceof BreakSignal) {
              broken = true;
            } else if (e instanceof ContinueSignal) {
              /* fall through to update */
            } else throw e;
          }
          if (broken) break;
          // Update always runs (even on continue), matching C/C++ for-loop semantics
          await executeStatements(s.update, localEnv, ctx);
          cycles++;
          if (cycles % 10 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        break;
      }

      case 'switch': {
        const discVal = await evalExpr(s.discriminant, localEnv, ctx);
        let matched = false;
        let defaultIdx = -1;

        try {
          for (let i = 0; i < s.cases.length; i++) {
            const c = s.cases[i];

            if (c.test === null) {
              defaultIdx = i;
              continue; // não executar default agora; só se nenhum case casar
            }

            if (!matched) {
              const testVal = await evalExpr(c.test, localEnv, ctx);
              if (discVal == testVal) matched = true; // == para semântica C (int/enum)
            }

            if (matched) {
              await executeStatements(c.body, localEnv, ctx);
              // fall-through: não sair — continuar para case seguinte
            }
          }

          // Se nenhum case casou, executar default e subsequentes (fall-through do default)
          if (!matched && defaultIdx >= 0) {
            for (let i = defaultIdx; i < s.cases.length; i++) {
              await executeStatements(s.cases[i].body, localEnv, ctx);
            }
          }
        } catch (e) {
          if (!(e instanceof BreakSignal)) throw e;
          // BreakSignal consumido aqui — NÃO propaga para loops externos
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
        const safeVal = (val && typeof val === 'object')
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

      case 'setMember': {
        const targetObj = await evalExpr(s.target, localEnv, ctx);
        const val = await evalExpr(s.value, localEnv, ctx);
        if (targetObj && typeof targetObj === 'object') {
          (targetObj as any)[s.property] = val;
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
          parts.push(String(await evalExpr(a, localEnv, ctx) ?? ''));
        }
        const msg = parts.join(' ');
        if (s.newline !== false) {
          ctx.engine.log(ctx.printBuffer + msg);
          ctx.printBuffer = '';
        } else {
          ctx.printBuffer += msg;
        }
        break;
      }

      case 'setPointer': {
        const ptrObj = await evalExpr(s.target, localEnv, ctx);
        const val = await evalExpr(s.value, localEnv, ctx);
        if (ptrObj && typeof ptrObj === 'object' && ptrObj.__isPtr) {
          setVar(ptrObj.target, val, localEnv, ctx.globals);
        }
        break;
      }
    }
  }
}

function setVar(name: string, val: any, local: Map<string, any>, global: Map<string, any>) {
  if (local.has(name)) local.set(name, val);
  else global.set(name, val);
}

function getVar(name: string, local: Map<string, any>, global: Map<string, any>) {
  if (local.has(name)) return local.get(name);
  return global.get(name);
}

async function evalExpr(expr: ASLExpr, env: Map<string, any>, ctx: RunContext): Promise<any> {
  switch (expr.kind) {
    case 'literal':
      return expr.value;

    case 'var':
      return getVar(expr.name, env, ctx.globals);

    case 'index': {
      const arr = await evalExpr(expr.target, env, ctx);
      const idx = await evalExpr(expr.index, env, ctx);
      if (Array.isArray(arr)) {
        return arr[idx];
      }
      if (arr && typeof arr === 'object') {
        return arr[idx];
      }
      return 0;
    }

    case 'index2D': {
      const arr = await evalExpr(expr.array, env, ctx);
      const row = await evalExpr(expr.rowIndex, env, ctx);
      const col = await evalExpr(expr.colIndex, env, ctx);
      if (Array.isArray(arr) && Array.isArray(arr[row])) return arr[row][col];
      return 0;
    }

    case 'member': {
      const obj = await evalExpr(expr.target, env, ctx);
      if (obj && typeof obj === 'object') return (obj as any)[expr.property];
      return 0;
    }

    case 'unary': {
      if (expr.op === '&') {
        const target = expr.expr;
        if (target.kind === 'var') {
          return { __isPtr: true, target: target.name };
        }
        // Fallback or complex & handled elsewhere
        return 0;
      }

      const v = await evalExpr(expr.expr, env, ctx);
      if (expr.op === '*') {
        if (v && typeof v === 'object' && v.__isPtr) {
          return getVar(v.target, env, ctx.globals);
        }
        return 0;
      }
      if (expr.op === '!') return !v;
      if (expr.op === '~') return ~v;
      if (expr.op === '+') return +v;
      return -v;
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
      if (expr.callee === 'Pin.id') {
        return await evalExpr(expr.args[0], env, ctx);
      }

      if (expr.callee === 'Serial.begin') return 0;
      if (expr.callee === 'Serial.available') {
        return ctx.engine.serialAvailable();
      }
      if (expr.callee === 'Serial.read') {
        return ctx.engine.serialRead();
      }
      if (expr.callee === 'Serial.write') {
        const val = await evalExpr(expr.args[0], env, ctx);
        return ctx.engine.serialWrite(val);
      }
      if (expr.callee === 'Serial.readString') {
        let str = '';
        let byte = ctx.engine.serialRead();
        while (byte !== -1) {
          str += String.fromCharCode(byte);
          byte = ctx.engine.serialRead();
        }
        return str;
      }
      if (expr.callee === 'Serial.parseInt') {
        return ctx.engine.serialParseInt();
      }
      if (expr.callee === 'random') {
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
      if (expr.callee === 'millis') return ctx.engine.millis();
      if (expr.callee === 'micros') return ctx.engine.micros();
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

      if (expr.callee === 'abs') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.abs(arg);
      }
      if (expr.callee === 'sqrt') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.sqrt(arg);
      }
      if (expr.callee === 'pow') {
        const arg0 = await evalExpr(expr.args[0], env, ctx);
        const arg1 = await evalExpr(expr.args[1], env, ctx);
        return Math.pow(arg0, arg1);
      }
      if (expr.callee === 'sin') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.sin(arg);
      }
      if (expr.callee === 'cos') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.cos(arg);
      }
      if (expr.callee === 'tan') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.tan(arg);
      }
      if (expr.callee === 'log') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.log(arg);
      }
      if (expr.callee === 'min') {
        const arg0 = await evalExpr(expr.args[0], env, ctx);
        const arg1 = await evalExpr(expr.args[1], env, ctx);
        return Math.min(arg0, arg1);
      }
      if (expr.callee === 'max') {
        const arg0 = await evalExpr(expr.args[0], env, ctx);
        const arg1 = await evalExpr(expr.args[1], env, ctx);
        return Math.max(arg0, arg1);
      }
      if (expr.callee === 'round') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.round(arg);
      }
      if (expr.callee === 'floor') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.floor(arg);
      }
      if (expr.callee === 'ceil') {
        const arg = await evalExpr(expr.args[0], env, ctx);
        return Math.ceil(arg);
      }

      if (expr.callee === 'String') return String(await evalExpr(expr.args[0] || { kind: 'literal', value: '' }, env, ctx));
      if (expr.callee === 'int') return Math.floor(Number(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx)) || 0);
      if (expr.callee === 'float') return Number(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx)) || 0;
      if (expr.callee === '__len' || expr.callee === 'len') {
        const arr = await evalExpr(expr.args[0], env, ctx);
        if (Array.isArray(arr)) return arr.length;
        if (typeof arr === 'string') return arr.length;
        return 0;
      }
      if (expr.callee === 'reversed') {
        const arr = await evalExpr(expr.args[0], env, ctx);
        if (Array.isArray(arr)) return [...arr].reverse();
        if (typeof arr === 'string') return arr.split('').reverse().join('');
        return arr;
      }
      if (expr.callee === 'format') {
        let str = await evalExpr(expr.args[0], env, ctx);
        if (typeof str !== 'string') str = String(str);
        const args = [];
        for (let i = 1; i < expr.args.length; i++) args.push(await evalExpr(expr.args[i], env, ctx));
        for (const arg of args) {
          str = str.replace('{}', String(arg));
        }
        return str;
      }
      if (expr.callee === 'enumerate') {
        const arr = await evalExpr(expr.args[0], env, ctx);
        if (Array.isArray(arr)) {
          return arr.map((val, idx) => [idx, val]);
        }
        return [];
      }

      if (expr.callee.includes('.') || expr.callee === 'KeypadRead') {
        const args = [];
        for (const a of expr.args) args.push(await evalExpr(a, env, ctx));
        ctx.engine.emit('hardwareCall', { callee: expr.callee, args });
        return 0;
      }

      const funcDef = ctx.functions.get(expr.callee);
      if (funcDef) {
        const callEnv = new Map<string, any>();
        for (let i = 0; i < funcDef.params.length; i++) {
          const val = expr.args[i] ? await evalExpr(expr.args[i], env, ctx) : 0;
          const safeVal = (val && typeof val === 'object')
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

    case 'array': {
      const arr = [];
      for (const el of expr.elements) {
        arr.push(await evalExpr(el, env, ctx));
      }
      return arr;
    }

    case 'conditional': {
      const cond = await evalExpr(expr.condition, env, ctx);
      return cond ? evalExpr(expr.whenTrue, env, ctx) : evalExpr(expr.whenFalse, env, ctx);
    }

    case 'object': {
      const obj: Record<any, any> = {};
      for (const prop of expr.properties) {
        const k = await evalExpr(prop.key, env, ctx);
        const v = await evalExpr(prop.value, env, ctx);
        obj[k] = v;
      }
      return obj;
    }
  }
}

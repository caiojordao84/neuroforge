// src/engine/asl/ASLExecutor.ts
// Executor assíncrono da ASL v1 sobre o SimulationEngine (modo fake).
// Suporta: funções, chamadas, arrays/objetos, break/continue/return, print/log,
// abortSignal para controle de loops e delays.

import type { SimulationEngine } from '@/engine/SimulationEngine';
import { simulationEngine } from '@/engine/SimulationEngine';
import type { ASLProgram, ASLStatement, ASLExpr, ASLFunction } from './ASLTypes';

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

  // 1. Inicializa globais com deep copy para arrays/objetos
  for (const g of program.globals) {
    const rawInitial =
      g.initialValue !== undefined ? g.initialValue : defaultValueForType(g.type);
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
    abortSignal: options.abortSignal,
    printBuffer: '',
  };

  const setup = async () => {
    if (setupFuncDef) {
      await executeStatements(setupFuncDef.body, globalEnv, runContext);
    }
  };

  const loop = async () => {
    if (mainTask) {
      await executeStatements(mainTask.body, globalEnv, runContext);
    }
  };

  return { setup, loop };
}

interface RunContext {
  engine: SimulationEngine;
  functions: Map<string, ASLFunction>;
  globals: Map<string, any>;
  abortSignal?: AbortSignal;
  /** Buffer para Serial.print() sem newline — flush em Serial.println() */
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
    default:
      return 0;
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
        setVar(s.target, val, localEnv, ctx.globals);
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
        // Avalia argumentos (pode ser 0 para Serial.println() sem args)
        const parts: string[] = [];
        for (const a of s.args) {
          parts.push(String(await evalExpr(a, localEnv, ctx) ?? ''));
        }
        const msg = parts.join('');

        if (s.newline !== false) {
          // println (ou print legado sem atributo) — flush do buffer
          ctx.engine.log(ctx.printBuffer + msg);
          ctx.printBuffer = '';
        } else {
          // print sem newline — acumula no buffer
          ctx.printBuffer += msg;
        }
        break;
      }
    }
  }
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
      if (Array.isArray(arr)) return arr[idx];
      return 0;
    }

    case 'member': {
      const obj = await evalExpr(expr.target, env, ctx);
      if (obj && typeof obj === 'object') return (obj as any)[expr.property];
      return 0;
    }

    case 'unary': {
      const v = await evalExpr(expr.expr, env, ctx);
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

      if (expr.callee === 'Serial.begin') return 0;
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
        if (expr.callee === 'servo') ctx.engine.emit('tone', { pin: args[0], frequency: 1000, angle: args[1] }); // Servo placeholder or specific emit
        return 0;
      }
      if (expr.callee === 'random') {
        const args = [];
        for (const a of expr.args) args.push(await evalExpr(a, env, ctx));
        return ctx.engine.random(args[0], args[1]);
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

      // Conversores de tipo e utilitários padrão
      if (expr.callee === 'String') return String(await evalExpr(expr.args[0] || { kind: 'literal', value: '' }, env, ctx));
      if (expr.callee === 'int') return Math.floor(Number(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx)) || 0);
      if (expr.callee === 'float') return Number(await evalExpr(expr.args[0] || { kind: 'literal', value: 0 }, env, ctx)) || 0;

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
          callEnv.set(funcDef.params[i].name, val);
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
  }
}

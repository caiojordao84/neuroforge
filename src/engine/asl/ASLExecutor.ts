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
  constructor(public value: any) {}
}
class BreakSignal {}
class ContinueSignal {}

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
  if (ctx.abortSignal?.aborted) return; // check rápido

  for (const s of stmts) {
    if (ctx.abortSignal?.aborted) return; // check granular

    switch (s.kind) {
      case 'comment':
        // No-op em runtime, mas preservado no AST/ASL
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
          if (ctx.abortSignal?.aborted) return; // interrompe loops infinitos
          try {
            await executeStatements(s.body, localEnv, ctx);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
          cycles++;
          if (cycles % 10 === 0) {
            // yield para UI não travar
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        break;
      }

      case 'delay': {
        const ms = await evalExpr(s.milliseconds, localEnv, ctx);
        // Quebra o delay em pedaços para poder abortar
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
        const args: any[] = [];
        for (const a of s.args) {
          args.push(await evalExpr(a, localEnv, ctx));
        }
        const msg = args.join(' ');
        ctx.engine.log(msg);
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
      return expr.op === '!' ? !v : -v;
    }

    case 'binary': {
      const l = await evalExpr(expr.left, env, ctx);
      const r = await evalExpr(expr.right, env, ctx);
      switch (expr.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return l / r;
        case '%':
          return l % r;
        case '==':
          return l == r;
        case '!=':
          return l != r;
        case '<':
          return l < r;
        case '<=':
          return l <= r;
        case '>':
          return l > r;
        case '>=':
          return l >= r;
        case '&&':
          return l && r;
        case '||':
          return l || r;
        default:
          return 0;
      }
    }

    case 'call': {
      // Builtins específicos
      if (expr.callee === 'Serial.begin') return 0; // ignorar
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

      // Função desconhecida → 0
      return 0;
    }
  }
}

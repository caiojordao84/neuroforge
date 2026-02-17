// src/engine/asl/ASLExecutor.ts
// Executor da ASL v0 sobre o SimulationEngine JS (modo fake).

import type { SimulationEngine } from '@/engine/SimulationEngine';
import { simulationEngine } from '@/engine/SimulationEngine';
import type { ASLProgram, ASLStatement, ASLExpr } from './ASLTypes';

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
}

/**
 * Cria funções setup/loop a partir de um ASLProgram,
 * prontas para serem usadas com SimulationEngine.start.
 */
export function createASLRuntime(
  program: ASLProgram,
  options: ASLRuntimeOptions = {}
): ASLRuntime {
  const engine = options.engine ?? simulationEngine;

  // Ambiente simples de variáveis (globais, por enquanto).
  const env: Map<string, any> = new Map();

  // Inicializa variáveis globais
  for (const g of program.globals) {
    const initial =
      g.initialValue !== undefined
        ? g.initialValue
        : defaultValueForType(g.type);
    env.set(g.name, initial);
  }

  const setupFuncDef = program.functions.find((f) => f.name === 'setup');
  const mainTask = program.tasks[0];

  const setup = async () => {
    if (!setupFuncDef) return;
    await executeStatements(setupFuncDef.body, env, engine);
  };

  const loop = async () => {
    if (!mainTask) return;
    await executeStatements(mainTask.body, env, engine);
  };

  return { setup, loop };
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
      return undefined;
  }
}

async function executeStatements(
  stmts: ASLStatement[],
  env: Map<string, any>,
  engine: SimulationEngine
): Promise<void> {
  for (const s of stmts) {
    switch (s.kind) {
      case 'pinMode': {
        const pin = evalExpr(s.pin, env);
        engine.pinMode(pin, s.mode);
        break;
      }

      case 'digitalWrite': {
        const pin = evalExpr(s.pin, env);
        const value =
          typeof s.value === 'string'
            ? s.value
            : evalExpr(s.value, env) === 0
              ? 'LOW'
              : 'HIGH';
        engine.digitalWrite(pin, value as 'HIGH' | 'LOW');
        break;
      }

      case 'analogWrite': {
        const pin = evalExpr(s.pin, env);
        const value = evalExpr(s.value, env);
        engine.analogWrite(pin, value);
        break;
      }

      case 'read': {
        const pin = evalExpr(s.pin, env);
        let v: number;
        if (s.mode === 'DIGITAL') {
          const dr = engine.digitalRead(pin);
          v = dr === 'HIGH' ? 1 : 0;
        } else {
          v = engine.analogRead(pin);
        }
        env.set(s.target, v);
        break;
      }

      case 'if': {
        const cond = evalExpr(s.condition, env);
        if (cond) {
          await executeStatements(s.thenBranch, env, engine);
        } else if (s.elseBranch) {
          await executeStatements(s.elseBranch, env, engine);
        }
        break;
      }

      case 'while': {
        while (evalExpr(s.condition, env)) {
          await executeStatements(s.body, env, engine);
        }
        break;
      }

      case 'delay': {
        const ms = evalExpr(s.milliseconds, env);
        await engine.delay(ms);
        break;
      }

      case 'assign': {
        const val = evalExpr(s.value, env);
        env.set(s.target, val);
        break;
      }

      case 'expr': {
        evalExpr(s.expr, env);
        break;
      }
    }
  }
}

function evalExpr(expr: ASLExpr, env: Map<string, any>): any {
  switch (expr.kind) {
    case 'literal':
      return expr.value;

    case 'var':
      return env.get(expr.name);

    case 'unary': {
      const v = evalExpr(expr.expr, env);
      switch (expr.op) {
        case '-':
          return -v;
        case '!':
          return !v;
        default:
          return v;
      }
    }

    case 'binary': {
      const l = evalExpr(expr.left, env);
      const r = evalExpr(expr.right, env);

      switch (expr.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return l / r;
        case '==':
          return l === r;
        case '!=':
          return l !== r;
        case '<':
          return l < r;
        case '<=':
          return l <= r;
        case '>':
          return l > r;
        case '>=':
          return l >= r;
        case '&&':
          return !!l && !!r;
        case '||':
          return !!l || !!r;
        default:
          return undefined;
      }
    }
  }
}

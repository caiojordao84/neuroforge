// src/engine/asl/ASLTypes.ts
// Núcleo de tipos da ASL v0 (perfil LED + botão + controle básico de fluxo)

/**
 * Tipos escalares suportados na ASL v0.
 */
export type ASLType = 'int' | 'float' | 'bool' | 'string';

/**
 * Programa ASL completo.
 */
export interface ASLProgram {
  metadata: {
    name?: string;
    description?: string;
    version?: string;
    targetBoard?: string;
  };
  globals: ASLGlobalVar[];
  functions: ASLFunction[];
  tasks: ASLTask[];
}

/**
 * Variável global simples.
 */
export interface ASLGlobalVar {
  name: string;
  type: ASLType;
  initialValue?: number | boolean | string;
}

/**
 * Função ASL (ex.: setup).
 */
export interface ASLFunction {
  name: string;
  params: ASLParam[];
  body: ASLStatement[];
}

export interface ASLParam {
  name: string;
  type: ASLType;
}

/**
 * Task representa um "loop" cooperativo de alto nível.
 * Na v0 normalmente teremos uma task principal (ex.: mainLoop).
 */
export interface ASLTask {
  name: string;
  body: ASLStatement[];
}

/**
 * Statements suportados na ASL v0.
 * Perfil mínimo já compatível com SimulationEngine + LED + Button.
 */
export type ASLStatement =
  | ASLPinMode
  | ASLDigitalWrite
  | ASLAnalogWrite
  | ASLRead
  | ASLIf
  | ASLWhile
  | ASLDelay
  | ASLAssign
  | ASLExpressionStmt;

export interface ASLPinMode {
  kind: 'pinMode';
  pin: ASLExpr;
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';
}

export interface ASLDigitalWrite {
  kind: 'digitalWrite';
  pin: ASLExpr;
  /**
   * Pode ser literal 'HIGH'/'LOW' ou expressão que resulte em 0/1.
   */
  value: 'HIGH' | 'LOW' | ASLExpr;
}

export interface ASLAnalogWrite {
  kind: 'analogWrite';
  pin: ASLExpr;
  value: ASLExpr; // 0–255
}

export interface ASLRead {
  kind: 'read';
  pin: ASLExpr;
  /**
   * Nome da variável que receberá o valor lido.
   */
  target: string;
  mode: 'DIGITAL' | 'ANALOG';
}

export interface ASLIf {
  kind: 'if';
  condition: ASLExpr;
  thenBranch: ASLStatement[];
  elseBranch?: ASLStatement[];
}

export interface ASLWhile {
  kind: 'while';
  condition: ASLExpr;
  body: ASLStatement[];
}

export interface ASLDelay {
  kind: 'delay';
  milliseconds: ASLExpr;
}

/**
 * Atribuição simples: target = value;
 */
export interface ASLAssign {
  kind: 'assign';
  target: string;
  value: ASLExpr;
}

/**
 * Expressão usada como statement (efeitos colaterais simples).
 */
export interface ASLExpressionStmt {
  kind: 'expr';
  expr: ASLExpr;
}

/**
 * Expressões suportadas na ASL v0.
 * Suficiente para comparações, aritmética leve e booleanos.
 */
export type ASLExpr =
  | ASLLiteral
  | ASLVarRef
  | ASLUnary
  | ASLBinary;

export interface ASLLiteral {
  kind: 'literal';
  value: number | boolean | string;
}

export interface ASLVarRef {
  kind: 'var';
  name: string;
}

export interface ASLUnary {
  kind: 'unary';
  op: '-' | '!';
  expr: ASLExpr;
}

export interface ASLBinary {
  kind: 'binary';
  op:
    | '+'
    | '-'
    | '*'
    | '/'
    | '=='
    | '!='
    | '<'
    | '<='
    | '>'
    | '>='
    | '&&'
    | '||';
  left: ASLExpr;
  right: ASLExpr;
}

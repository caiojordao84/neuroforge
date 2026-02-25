// src/engine/asl/ASLTypes.ts
// ASL v1: núcleo de tipos unificado (funções, calls, returns, Serial/print,
// arrays, break/continue, index/member, comentários, structs, etc.)

/**
 * Tipos escalares suportados na ASL v1.
 */
export type ASLType = 'int' | 'float' | 'bool' | 'string' | 'void' | 'struct';

/**
 * Definição de campo de struct.
 */
export interface ASLStructField {
  name: string;
  type: string;
}

/**
 * Definição de struct.
 */
export interface ASLStructDef {
  name: string;
  fields: ASLStructField[];
}

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
  structs: ASLStructDef[];
  globals: ASLGlobalVar[];
  functions: ASLFunction[];
  tasks: ASLTask[];
}

/**
 * Variável global.
 * Suporta escalares, arrays e estruturas via initialValue:any.
 */
export interface ASLGlobalVar {
  name: string;
  type: ASLType;
  initialValue?: any;
  /**
   * Nome da struct (quando type === 'struct'), ex: 'Point'.
   */
  structType?: string;
  /**
   * Comentários associados à declaração global (por ex. docs extraídas do código fonte).
   */
  comments?: string[];
}

/**
 * Função ASL (ex.: setup, funções de usuário, main, etc.).
 */
export interface ASLFunction {
  name: string;
  params: ASLParam[];
  body: ASLStatement[];
  /**
   * Tipo de retorno opcional (void por padrão).
   */
  returnType?: ASLType;
}

export interface ASLParam {
  name: string;
  type: string;
}

/**
 * Task representa um "loop" cooperativo de alto nível.
 * Ex.: mainLoop derivado de loop() ou main().
 */
export interface ASLTask {
  name: string;
  body: ASLStatement[];
}

/**
 * Statements suportados na ASL v1.
 */
export type ASLStatement =
  | ASLPinMode
  | ASLDigitalWrite
  | ASLAnalogWrite
  | ASLRead
  | ASLIf
  | ASLWhile
  | ASLFor
  | ASLDelay
  | ASLAssign
  | ASLSetIndex
  | ASLSetIndex2D
  | ASLSetIndex3D
  | ASLSetMember
  | ASLSetPointer
  | ASLExpressionStmt
  | ASLReturn
  | ASLPrint
  | ASLBreak
  | ASLContinue
  | ASLSwitch
  | ASLComment;

/**
 * Statement de comentário (não afeta execução, mas preserva contexto).
 */
export interface ASLComment {
  kind: 'comment';
  text: string;
}

/**
 * Configuração de modo de pino.
 */
export interface ASLPinMode {
  kind: 'pinMode';
  pin: ASLExpr;
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';
}

/**
 * Escrita digital em pino.
 */
export interface ASLDigitalWrite {
  kind: 'digitalWrite';
  pin: ASLExpr;
  /**
   * Pode ser literal 'HIGH'/'LOW' ou expressão que resulte em 0/1.
   */
  value: 'HIGH' | 'LOW' | ASLExpr;
}

/**
 * Escrita analógica / PWM em pino.
 */
export interface ASLAnalogWrite {
  kind: 'analogWrite';
  pin: ASLExpr;
  value: ASLExpr; // normalmente 0–255
}

/**
 * Leitura de pino digital/analógico para variável alvo.
 */
export interface ASLRead {
  kind: 'read';
  pin: ASLExpr;
  /**
   * Nome da variável que receberá o valor lido.
   */
  target: string;
  mode: 'DIGITAL' | 'ANALOG';
}

/**
 * If/else.
 */
export interface ASLIf {
  kind: 'if';
  condition: ASLExpr;
  thenBranch: ASLStatement[];
  elseBranch?: ASLStatement[];
}

/**
 * While com corpo de statements.
 */
export interface ASLWhile {
  kind: 'while';
  condition: ASLExpr;
  body: ASLStatement[];
}

/**
 * For loop with separate update that runs even on continue.
 */
export interface ASLFor {
  kind: 'for';
  condition: ASLExpr;
  body: ASLStatement[];
  update: ASLStatement[];
}

/**
 * Delay/blocking wait (simulado pelo SimulationEngine).
 */
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
 * Escrita em índice de array 1D: target[index] = value;
 */
export interface ASLSetIndex {
  kind: 'setIndex';
  target: string;
  index: ASLExpr;
  value: ASLExpr;
}

/**
 * Escrita em índice de array 2D: target[rowIndex][colIndex] = value;
 */
export interface ASLSetIndex2D {
  kind: 'setIndex2D';
  target: string;
  rowIndex: ASLExpr;
  colIndex: ASLExpr;
  value: ASLExpr;
}

/**
 * Escrita em índice de array 3D: target[d1][d2][d3] = value;
 */
export interface ASLSetIndex3D {
  kind: 'setIndex3D';
  target: string;
  d1Index: ASLExpr;
  d2Index: ASLExpr;
  d3Index: ASLExpr;
  value: ASLExpr;
}

/**
 * Escrita em membro de objeto: target.property = value;
 */
export interface ASLSetMember {
  kind: 'setMember';
  target: ASLExpr;
  property: string;
  value: ASLExpr;
}

/**
 * Escrita via ponteiro: *target = value;
 */
export interface ASLSetPointer {
  kind: 'setPointer';
  target: ASLExpr;
  value: ASLExpr;
}

/**
 * Expressão usada como statement (efeitos colaterais).
 */
export interface ASLExpressionStmt {
  kind: 'expr';
  expr: ASLExpr;
}

/**
 * Retorno de função (valor opcional).
 */
export interface ASLReturn {
  kind: 'return';
  value?: ASLExpr;
}

/**
 * Print/log genérico (Serial.print/println, logs do engine, etc.).
 */
export interface ASLPrint {
  kind: 'print';
  args: ASLExpr[];
  newline: boolean;
}

/**
 * Interrompe o loop mais interno.
 */
export interface ASLBreak {
  kind: 'break';
}

/**
 * Pula para a próxima iteração do loop mais interno.
 */
export interface ASLContinue {
  kind: 'continue';
}

/**
 * Caso individual de switch/case.
 * test === null → cláusula 'default'
 */
export interface ASLSwitchCase {
  test: ASLExpr | null;
  body: ASLStatement[];
}

/**
 * Switch/case nativo ASL.
 * Preserva semântica de fall-through do C.
 */
export interface ASLSwitch {
  kind: 'switch';
  discriminant: ASLExpr;
  cases: ASLSwitchCase[];
}

/**
 * Expressões suportadas na ASL v1.
 */
export type ASLExpr =
  | ASLLiteral
  | ASLVarRef
  | ASLIndex
  | ASLIndex2D
  | ASLIndex3D
  | ASLMember
  | ASLUnary
  | ASLBinary
  | ASLCall
  | ASLConditional;

/**
 * Literal genérico (número, booleano, string, array, objeto, etc.).
 */
export interface ASLLiteral {
  kind: 'literal';
  value: any;
}

/**
 * Referência a variável.
 */
export interface ASLVarRef {
  kind: 'var';
  name: string;
}

/**
 * Indexação de array 1D: target[index].
 */
export interface ASLIndex {
  kind: 'index';
  target: ASLExpr;
  index: ASLExpr;
}

/**
 * Indexação de array 2D: array[rowIndex][colIndex].
 */
export interface ASLIndex2D {
  kind: 'index2D';
  array: ASLExpr;
  rowIndex: ASLExpr;
  colIndex: ASLExpr;
}

/**
 * Indexação de array 3D: array[d1][d2][d3].
 */
export interface ASLIndex3D {
  kind: 'index3D';
  array: ASLExpr;
  d1Index: ASLExpr;
  d2Index: ASLExpr;
  d3Index: ASLExpr;
}

/**
 * Acesso a membro de objeto: target.property.
 */
export interface ASLMember {
  kind: 'member';
  target: ASLExpr;
  property: string;
}

/**
 * Operador unário.
 */
export interface ASLUnary {
  kind: 'unary';
  op: '-' | '!' | '~' | '+' | '&' | '*';
  expr: ASLExpr;
}

/**
 * Operador binário com conjunto fechado de operadores suportados.
 */
export interface ASLBinary {
  kind: 'binary';
  op:
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '&&'
  | '||'
  | '&'
  | '|'
  | '^'
  | '<<'
  | '>>';
  left: ASLExpr;
  right: ASLExpr;
}

/**
 * Chamada de função/builtin.
 */
export interface ASLCall {
  kind: 'call';
  callee: string;
  args: ASLExpr[];
}

/**
 * Expressão condicional (ternária): condition ? whenTrue : whenFalse.
 */
export interface ASLConditional {
  kind: 'conditional';
  condition: ASLExpr;
  whenTrue: ASLExpr;
  whenFalse: ASLExpr;
}

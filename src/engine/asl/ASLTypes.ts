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
 * Statements supported in ASL v1.
 */
export type ASLStatement =
  | ASLPinMode
  | ASLDigitalWrite
  | ASLAnalogWrite
  | ASLRead
  | ASLIf
  | ASLWhile
  | ASLFor
  | ASLDoWhile
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
  | ASLDeclare
  | ASLForIn
  | ASLSwitch
  | ASLComment
  | ASLSerialBegin
  // --- S5 NEW NODES (Bus/PWM/IEC) ---
  | ASLUartWrite
  | ASLUartRead
  | ASLI2CWrite
  | ASLI2CRead
  | ASLSpiTransfer
  | ASLPwmInit
  | ASLPwmSetDuty
  | ASLPwmSetFreq
  | ASLPwmStop
  | ASLTimerTON
  | ASLTimerTOF
  | ASLTimerTP
  | ASLCounterCTU
  | ASLCounterCTD
  | ASLLatchSR
  | ASLLatchRS
  | ASLTrigR
  | ASLTrigF
  // --- Servo ---
  | ASLServoAttach
  | ASLServoWrite
  | ASLServoDetach;

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
 * For-in loop over an iterable.
 */
export interface ASLForIn {
  kind: 'forIn';
  varName: string;
  iterable: ASLExpr;
  body: ASLStatement[];
}

/**
 * Do-while loop: executes body at least once, then checks condition.
 */
export interface ASLDoWhile {
  kind: 'doWhile';
  condition: ASLExpr;
  body: ASLStatement[];
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
 * Declaração de variável (local ou global no body): type name [= value];
 */
export interface ASLDeclare {
  kind: 'declare';
  name: string;
  type: ASLType;
  value?: ASLExpr;
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
  | ASLArray
  | ASLObject
  | ASLConditional
  | ASLSerialAvailable
  | ASLSerialReadString;

/**
 * Literal genérico (número, booleano, string, array, objeto, etc.).
 */
export interface ASLLiteral {
  kind: 'literal';
  value: any;
}

/**
 * Array literal (coleção de expressões).
 */
export interface ASLArray {
  kind: 'array';
  elements: ASLExpr[];
}

/**
 * Object literal (collection of key-expression pairs).
 */
export interface ASLObject {
  kind: 'object';
  properties: { key: ASLExpr; value: ASLExpr }[];
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
  | '>>'
  | '//';
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
 * Conditional expression (ternary): condition ? whenTrue : whenFalse.
 */
export interface ASLConditional {
  kind: 'conditional';
  condition: ASLExpr;
  whenTrue: ASLExpr;
  whenFalse: ASLExpr;
}

// ============================================================================
// S5 NEW NODES: UART/I2C/SPI, PWM, IEC (Timers, Counters, Latches, Triggers)
// ============================================================================

// ---------------------------------------------------------------------------
// Serial (UART) Built-in Statements/Expressions
// ---------------------------------------------------------------------------

/**
 * Initializes the Serial port with a given baud rate.
 */
export interface ASLSerialBegin {
  kind: 'serialBegin';
  baud: ASLExpr;
}

/**
 * Checks if there are bytes available to read from the Serial port.
 */
export interface ASLSerialAvailable {
  kind: 'serialAvailable';
}

/**
 * Reads a string from the Serial port until a timeout or newline.
 */
export interface ASLSerialReadString {
  kind: 'serialReadString';
}

// ---------------------------------------------------------------------------
// UART/I2C/SPI Bus Statements
// ---------------------------------------------------------------------------

/**
 * UART write operation.
 */
export interface ASLUartWrite {
  kind: 'uartWrite';
  port: ASLExpr;
  data: ASLExpr;
}

/**
 * UART read operation.
 */
export interface ASLUartRead {
  kind: 'uartRead';
  port: ASLExpr;
  target: string;
  length: ASLExpr;
}

/**
 * I2C write operation.
 */
export interface ASLI2CWrite {
  kind: 'i2cWrite';
  bus: ASLExpr;
  address: ASLExpr;
  data: ASLExpr;
}

/**
 * I2C read operation.
 */
export interface ASLI2CRead {
  kind: 'i2cRead';
  bus: ASLExpr;
  address: ASLExpr;
  length: ASLExpr;
  target: string;
}

/**
 * SPI transfer operation.
 */
export interface ASLSpiTransfer {
  kind: 'spiTransfer';
  bus: ASLExpr;
  csPin: ASLExpr;
  txData: ASLExpr;
  target?: string;
}

// ---------------------------------------------------------------------------
// PWM Statements
// ---------------------------------------------------------------------------

/**
 * PWM initialization.
 */
export interface ASLPwmInit {
  kind: 'pwmInit';
  pin: ASLExpr;
  freq: ASLExpr;
  duty: ASLExpr;
}

/**
 * PWM duty cycle set.
 */
export interface ASLPwmSetDuty {
  kind: 'pwmSetDuty';
  pin: ASLExpr;
  duty: ASLExpr;
}

/**
 * PWM frequency set.
 */
export interface ASLPwmSetFreq {
  kind: 'pwmSetFreq';
  pin: ASLExpr;
  freq: ASLExpr;
}

/**
 * PWM stop.
 */
export interface ASLPwmStop {
  kind: 'pwmStop';
  pin: ASLExpr;
}

// ---------------------------------------------------------------------------
// IEC Timer Statements (TON, TOF, TP)
// ---------------------------------------------------------------------------

/**
 * Timer TON (Turn-On Delay): output true after PT delay when input is true.
 */
export interface ASLTimerTON {
  kind: 'timerTON';
  instance: string;
  in: ASLExpr;
  pt: ASLExpr;
}

/**
 * Timer TOF (Turn-Off Delay): output stays true for PT after input goes false.
 */
export interface ASLTimerTOF {
  kind: 'timerTOF';
  instance: string;
  in: ASLExpr;
  pt: ASLExpr;
}

/**
 * Timer TP (Pulse): output true for PT duration when input triggers.
 */
export interface ASLTimerTP {
  kind: 'timerTP';
  instance: string;
  in: ASLExpr;
  pt: ASLExpr;
}

// ---------------------------------------------------------------------------
// IEC Counter Statements (CTU, CTD)
// ---------------------------------------------------------------------------

/**
 * Counter CTU (Count Up): increments on rising edge of CU input.
 */
export interface ASLCounterCTU {
  kind: 'counterCTU';
  instance: string;
  cu: ASLExpr;
  r: ASLExpr;
  pv: ASLExpr;
}

/**
 * Counter CTD (Count Down): decrements on rising edge of CD input.
 */
export interface ASLCounterCTD {
  kind: 'counterCTD';
  instance: string;
  cd: ASLExpr;
  ld: ASLExpr;
  pv: ASLExpr;
}

// ---------------------------------------------------------------------------
// IEC Latch Statements (SR, RS)
// ---------------------------------------------------------------------------

/**
 * Latch SR (Set-Reset): set dominates, output true when S is true.
 */
export interface ASLLatchSR {
  kind: 'latchSR';
  instance: string;
  s: ASLExpr;
  r: ASLExpr;
}

/**
 * Latch RS (Reset-Set): reset dominates, output false when R is true.
 */
export interface ASLLatchRS {
  kind: 'latchRS';
  instance: string;
  r: ASLExpr;
  s: ASLExpr;
}

// ---------------------------------------------------------------------------
// IEC Trigger Statements (R_TRIG, F_TRIG)
// ---------------------------------------------------------------------------

/**
 * Rising edge trigger: output true for one cycle on rising edge of input.
 */
export interface ASLTrigR {
  kind: 'trigR';
  instance: string;
  in: ASLExpr;
}

/**
 * Falling edge trigger: output true for one cycle on falling edge of input.
 */
export interface ASLTrigF {
  kind: 'trigF';
  instance: string;
  in: ASLExpr;
}

// ---------------------------------------------------------------------------
// Servo Statements
// ---------------------------------------------------------------------------

/**
 * Attach a servo to a PWM-capable pin.
 * Corresponds to: Servo myServo; myServo.attach(pin);           (C++)
 *                 Servo myServo; myServo.attach(pin, min, max); (C++ with pulse range)
 *                 pwm = PWM(Pin(pin)); pwm.freq(50);            (MicroPython)
 *                 servo.Servo(pwm) / servo.ContinuousServo(pwm) (CircuitPython/Adafruit)
 */
export interface ASLServoAttach {
  kind: 'servoAttach';
  /** Variable name used to reference this servo instance (e.g. "myServo", "dragon"). */
  varName: string;
  pin: ASLExpr;
  /** Optional pulse range in microseconds (default 544–2400 µs). */
  minPulse?: ASLExpr;
  maxPulse?: ASLExpr;
  /** True if this is a continuous-rotation servo (360°). */
  continuous?: boolean;
}

/**
 * Write an angle (or speed for continuous) to a servo.
 * Corresponds to: myServo.write(angle);            (C++ — degrees 0–180)
 *                 myServo.writeMicroseconds(us);   (C++ — raw µs)
 *                 pwm.duty_u16(val);               (MicroPython — raw 0–65535)
 *                 my_servo.angle = 90;             (CircuitPython — SetMember)
 *                 my_servo.throttle = 0.5;         (CircuitPython ContinuousServo)
 *                 srv.set_angle(90);               (micropython_servo_pdm library)
 */
export interface ASLServoWrite {
  kind: 'servoWrite';
  /** Variable name of the attached servo instance. */
  varName: string;
  /** Target angle in degrees (0–180) or speed (-100..100 for continuous). */
  angle: ASLExpr;
  /**
   * If true, 'angle' is already in microseconds (writeMicroseconds) or
   * raw PWM units (duty_u16) — generators must NOT apply angle→duty conversion.
   */
  rawMicroseconds?: boolean;
}

/**
 * Detach a servo, releasing the PWM pin.
 * Corresponds to: myServo.detach();  (C++)
 *                 pwm.deinit();      (MicroPython)
 *                 srv.release();     (micropython_servo_pdm)
 *                 srv.deinit();      (generic)
 */
export interface ASLServoDetach {
  kind: 'servoDetach';
  varName: string;
}


import { RecursiveDescentCParser } from './src/engine/asl/plugins/c/CParser';
import { astToASL } from './src/engine/asl/codeToASL';
import { createASLRuntime } from './src/engine/asl/ASLExecutor';
import { CGenerator } from './src/engine/asl/plugins/c/CGenerator';
import { PythonGenerator } from './src/engine/asl/plugins/python/PythonGenerator';
import { RustGenerator } from './src/engine/asl/plugins/rust/RustGenerator';

// Mock SimulationEngine para testes standalone
const mockEngine: any = {
    pins: {} as any,
    pinMode(pin: number, mode: string) {
        // console.log(`[TEST] pinMode(${pin}, ${mode})`);
    },
    digitalWrite(pin: number, value: string) {
        console.log(`[SERIAL] digitalWrite(${pin}, ${value})`);
        this.pins[pin] = value;
    },
    digitalRead(pin: number) {
        return this.pins[pin] || 'LOW';
    },
    analogWrite(pin: number, val: number) {
        console.log(`[SERIAL] analogWrite(${pin}, ${val})`);
    },
    analogRead(pin: number) { return 0; },
    serialPrintln(text: string) {
        console.log(`[SERIAL] ${text}`);
    },
    log(text: string) {
        console.log(`[SERIAL] ${text}`);
    },
    delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, 0)); // Delay instantâneo no teste
    },
    millis() { return Date.now(); }
};

const fixtures = [
    {
        name: 'T-SW1 — switch básico + default',
        code: `
int state = 2;
void setup() { Serial.begin(9600); }
void loop() {
  switch (state) {
    case 1: Serial.println("ONE");     break;
    case 2: Serial.println("TWO");     break;
    case 3: Serial.println("THREE");   break;
    default: Serial.println("UNKNOWN"); break;
  }
}
`
    },
    {
        name: 'T-SW2 — switch dentro de for (validação do bug fix)',
        code: `
void setup() { Serial.begin(9600); }
void loop() {
  for (int i = 0; i < 3; i++) {
    switch (i) {
      case 0: digitalWrite(10, HIGH); break;
      case 1: digitalWrite(11, HIGH); break;
      default: digitalWrite(12, HIGH); break;
    }
  }
}
`
    },
    {
        name: 'T-SW3 — switch com enum',
        code: `
enum Phase { IDLE, RUNNING, STOPPED };
Phase phase = RUNNING;
void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}
void loop() {
  switch (phase) {
    case IDLE:    digitalWrite(9, LOW);  Serial.println("IDLE");    break;
    case RUNNING: digitalWrite(9, HIGH); Serial.println("RUNNING"); break;
    case STOPPED: digitalWrite(9, LOW);  Serial.println("STOPPED"); break;
  }
}
`
    },
    {
        name: 'T-SW4 — fall-through intencional (case vazio)',
        code: `
void setup() { Serial.begin(9600); }
void loop() {
  int x = 1;
  switch (x) {
    case 1:
    case 2:
      Serial.println("ONE or TWO");
      break;
    default:
      Serial.println("OTHER");
  }
}
`
    }
];

async function runTest(f: { name: string, code: string }) {
    console.log(`\n\n[TEST] === ${f.name} ===`);

    // 1. Parsing
    console.log(`[TEST] Parsing C++...`);
    const parser = new RecursiveDescentCParser();
    const { ast } = parser.parse(f.code);

    // 2. ASL Transformation
    console.log(`[TEST] Transformando para ASL...`);
    const program = astToASL(ast, 'cpp');

    // 3. Execution (Simulação)
    console.log(`[TEST] Executando simulação...`);
    const runtime = createASLRuntime(program, { engine: mockEngine });
    await runtime.setup();
    await runtime.loop();

    // 4. Generation (C++)
    console.log(`[TEST] Gerando C++...`);
    const cGen = new CGenerator();
    const cResult = cGen.generate(ast);
    if (cResult.code.includes('switch')) {
        console.log(`[TEST] OK: C++ contém 'switch'`);
    } else {
        console.log(`[TEST] ERRO: C++ NÃO contém 'switch'`);
    }

    // 5. Generation (Python)
    console.log(`[TEST] Gerando Python (MicroPython)...`);
    const pyGen = new PythonGenerator();
    const pyResult = pyGen.generate(ast, 'MICROPYTHON');
    if (pyResult.code.toLowerCase().includes('__sw_disc_')) {
        console.log(`[TEST] OK: Python contém emulação de switch`);
    } else {
        console.log(`[TEST] ERRO: Python NÃO contém emulação de switch`);
        console.log(pyResult.code);
    }

    // 6. Generation (Rust)
    console.log(`[TEST] Gerando Rust...`);
    const rustGen = new RustGenerator();
    const rustResult = rustGen.generate(ast);
    if (rustResult.code.toLowerCase().includes('match ')) {
        console.log(`[TEST] OK: Rust contém 'match'`);
    } else {
        console.log(`[TEST] ERRO: Rust NÃO contém 'match'`);
        console.log(rustResult.code);
    }
}

async function main() {
    for (const f of fixtures) {
        await runTest(f);
    }
    console.log('\n[TEST] Todos os testes concluídos.');
}

main().catch(console.error);


import { CppParser } from '../plugins/cpp/CppParser';
import { RustParser } from '../plugins/rust/RustParser';
import { PythonParser } from '../plugins/python/PythonParser';
import { PythonGenerator } from '../plugins/python/PythonGenerator';
import { CGenerator } from '../plugins/c/CGenerator';
import { RustGenerator } from '../plugins/rust/RustGenerator';
import { Optimizer } from '../plugins/optimizer/Optimizer';
import { PatternDetector } from '../plugins/analysis/PatternDetector';
import { FlowValidator } from '../system/flow/FlowValidator';

export interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL';
    details?: string;
}

export class IntegrationSuite {
    results: TestResult[] = [];
    
    // We reuse instances to simulate app environment
    cppParser = new CppParser();
    rustParser = new RustParser();
    pythonParser = new PythonParser();

    async init() {
        await Promise.all([
            this.cppParser.init(),
            this.rustParser.init(),
            this.pythonParser.init()
        ]);
    }

    async runAll(): Promise<TestResult[]> {
        this.results = [];
        try {
            await this.testCppFlow();
            await this.testRustFlow();
            await this.testPythonFlow();
            await this.testCrossLanguage();
            await this.testFlowValidation();
        } catch (e) {
            this.assert("Suite Execution", false, String(e));
        }
        return this.results;
    }

    private assert(name: string, condition: boolean, details?: string) {
        this.results.push({ name, status: condition ? 'PASS' : 'FAIL', details });
    }

    private hasNode(node: any, type: string): boolean {
        if (node.nodeType === type) return true;
        if (node.children) return node.children.some((c: any) => this.hasNode(c, type));
        return false;
    }

    async testCppFlow() {
        const code = `
        void loop() {
            // PWM Pattern
            digitalWrite(2, HIGH); delay(5);
            digitalWrite(2, LOW); delay(5);
        }
        `;
        const { ast } = this.cppParser.parse(code);
        this.assert("C++ Parse", ast.children.length > 0);
        
        const patterns = new PatternDetector().detect(ast);
        this.assert("C++ Analysis (PWM Detect)", patterns.some(p => p.type === 'PWM_BITBANG'), "Failed to detect PWM pattern");
        
        const optAst = new Optimizer().optimize(ast);
        this.assert("C++ Optimizer (HardwarePwm)", this.hasNode(optAst, 'HardwarePwm'));
        
        const pyGen = new PythonGenerator().generate(optAst);
        this.assert("C++ -> MicroPython Gen", pyGen.code.includes('PWM('), pyGen.code);
    }

    async testRustFlow() {
        const code = `
        fn loop() {
            // PWM Pattern
            gpio_set(2, 1); delay(5);
            gpio_set(2, 0); delay(5);
        }
        `;
        const { ast } = this.rustParser.parse(code);
        this.assert("Rust Parse", ast.children.length > 0);
        
        const patterns = new PatternDetector().detect(ast);
        this.assert("Rust Analysis (PWM Detect)", patterns.some(p => p.type === 'PWM_BITBANG'));

        const optAst = new Optimizer().optimize(ast);
        this.assert("Rust Optimizer (HardwarePwm)", this.hasNode(optAst, 'HardwarePwm'));
        
        const pyGen = new PythonGenerator().generate(optAst);
        this.assert("Rust -> MicroPython Gen", pyGen.code.includes('PWM('));
    }

    async testPythonFlow() {
        const code = `
        while True:
            # PWM Pattern
            p2.value(1)
            time.sleep_ms(5)
            p2.value(0)
            time.sleep_ms(5)
        `;
        
        const { ast } = this.pythonParser.parse(code);
        this.assert("Python Parse", ast.children.length > 0);
        
        const patterns = new PatternDetector().detect(ast);
        this.assert("Python Analysis (PWM Detect)", patterns.some(p => p.type === 'PWM_BITBANG'), "Failed to detect PWM pattern in Python");

        const pyGen = new PythonGenerator().generate(ast);
        this.assert("Python -> MicroPython Gen", pyGen.code.includes('while True:'));
    }

    async testCrossLanguage() {
        // Rust AST -> C++ Code
        const code = `fn main() { gpio_set(13, 1); delay(1000); }`;
        const { ast } = this.rustParser.parse(code);
        
        const cGen = new CGenerator().generate(ast);
        this.assert("Rust -> C++ Gen", cGen.code.includes("digitalWrite(13, 1)"), cGen.code);
        
        // C++ AST -> Rust Code
        const cppCode = `void loop() { digitalWrite(2, HIGH); delay(500); }`;
        const res = this.cppParser.parse(cppCode);
        const rustGen = new RustGenerator().generate(res.ast);
        this.assert("C++ -> Rust Gen", rustGen.code.includes("gpio_set(2, 1)"), rustGen.code);
        
        // Python -> C++ (New)
        const pyCode = `
        setup():
            print("Init")
        while True:
            p2.value(1)
        `;
        const pyRes = this.pythonParser.parse(pyCode);
        const cppFromPy = new CGenerator().generate(pyRes.ast);
        this.assert("Python -> C++ Gen (Structure)", cppFromPy.code.includes("void loop()"), cppFromPy.code);
        this.assert("Python -> C++ Gen (Logic)", cppFromPy.code.includes("digitalWrite(2, 1)"), cppFromPy.code);

        // C++ Roundtrip (C++ -> AST -> C++)
        const cppSrc = `void loop() { digitalWrite(5, 1); }`;
        const cppAst = this.cppParser.parse(cppSrc).ast;
        const cppOut = new CGenerator().generate(cppAst);
        this.assert("C++ Roundtrip", cppOut.code.includes("digitalWrite(5, 1)"), cppOut.code);

        // CircuitPython Generation
        const cpGen = new PythonGenerator().generate(ast, 'CIRCUITPYTHON');
        this.assert("CircuitPython Gen", cpGen.code.includes("import board") && cpGen.code.includes("digitalio.DigitalInOut"), "Missing CP imports or setup");
    }

    async testFlowValidation() {
        // Create mock nodes with duplicate timer IDs to test validator
        const nodes: any[] = [
            { id: '1', type: 'start', data: { label: 'Start' } },
            { id: '2', type: 'ladder_timer', data: { id: 'T1' } },
            { id: '3', type: 'ladder_timer', data: { id: 'T1' } }, // Duplicate ID
            { id: '4', type: 'end', data: { label: 'End' } }
        ];
        // Minimal edges to form a valid graph structure for analysis
        const edges: any[] = [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '3', target: '4' }
        ];

        const issues = FlowValidator.validate(nodes, edges);
        const hasCritical = issues.some(i => i.severity === 'CRITICAL' && i.message.includes("Duplicate Tag ID"));
        this.assert("Flow Validation (Duplicate ID)", hasCritical, "Validator failed to flag duplicate Timer IDs");

        // Test valid case
        nodes[2].data.id = 'T2'; // Fix duplicate
        const validIssues = FlowValidator.validate(nodes, edges);
        const noCritical = !validIssues.some(i => i.severity === 'CRITICAL');
        this.assert("Flow Validation (Valid Flow)", noCritical, "Validator flagged valid flow as critical");
    }
}

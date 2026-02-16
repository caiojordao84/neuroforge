
import { ProgramNode, BaseNode } from '../types';

export class SimulatorInterpreter {
    private vars = new Map<string, any>();
    private pins = new Map<number, number>(); 
    private tones = new Map<number, number>(); 
    private lcd = { lines: ["                ", "                "], cx: 0, cy: 0 };
    private dht = { temp: 25, hum: 50 };
    private ultrasonicDist = 100;
    private ldrValue = 500;
    private irCode = 0;
    private rgb = { r:0, g:0, b:0 };
    private neopixels = Array(8).fill({r:0, g:0, b:0});
    private neopixelBuffer = Array(8).fill({r:0, g:0, b:0});
    private motors = { left: 0, right: 0 };
    private mpu = { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 };
    private sevSegValue = "    ";
    private keypadBuffer: string | null = null;
    private oledBuffer: Uint8Array = new Uint8Array(128 * 64 / 8).fill(0); // 1 bit per pixel
    private oledPending: Uint8Array | null = null; // Staged buffer for commit
    private wifi = { status: 0, ssid: '', ip: '0.0.0.0', connectStart: 0 };
    private serialBuffer: string[] = [];
    private files: Record<string, string> = {};

    private genStack: Generator<any>[] = [];
    private onUpdate: (vars: any, pins: any, logs: string[], tones: any, lcd: any, dht: any, dist: number, ldr: number, ir: number, rgb: any, sevseg: string, np: any, motors: any, mpu: any, oled: Uint8Array | null, wifi: any, files: any) => void;
    private logs: string[] = [];
    private tick = 0;

    constructor(private ast: ProgramNode, onUpdate: (v: any, p: any, l: string[], t: any, lcd: any, dht: any, dist: number, ldr: number, ir: number, rgb: any, sevseg: string, np: any, motors: any, mpu: any, oled: Uint8Array | null, wifi: any, files: any) => void) {
        this.onUpdate = onUpdate;
        this.reset();
    }

    reset() {
        this.vars.clear(); this.pins.clear(); this.tones.clear(); this.genStack = []; this.logs = [];
        this.lcd = { lines: ["                ", "                "], cx: 0, cy: 0 };
        this.rgb = { r:0, g:0, b:0 };
        this.neopixels = Array(8).fill({r:0, g:0, b:0});
        this.neopixelBuffer = Array(8).fill({r:0, g:0, b:0});
        this.motors = { left: 0, right: 0 };
        this.sevSegValue = "----";
        this.keypadBuffer = null;
        this.irCode = 0;
        this.oledBuffer.fill(0);
        this.oledPending = null;
        this.wifi = { status: 0, ssid: '', ip: '0.0.0.0', connectStart: 0 };
        this.serialBuffer = [];
        this.files = {};
        this.tick = 0;
        for(let i=0; i<40; i++) this.pins.set(i, 0);
        // Default Joystick center
        this.pins.set(34, 2048); // X
        this.pins.set(35, 2048); // Y
        const setup = this.ast.children.find(c => c.attributes.name === 'setup');
        if(setup) this.runBlockSync(setup.children); 
        const loop = this.ast.children.find(c => c.attributes.name === 'loop');
        if (loop) this.genStack.push(this.runBlock(loop.children));
    }

    step() {
        this.tick++;
        // Simulate WiFi connection delay
        if(this.wifi.status === 1 && this.tick > this.wifi.connectStart + 40) { // ~2 sec
             this.wifi.status = 3; // Connected
             this.wifi.ip = "192.168.1." + Math.floor(Math.random() * 255);
             this.logs.push(`WiFi Connected! IP: ${this.wifi.ip}`);
        }

        if (this.genStack.length === 0) return;
        const res = this.genStack[this.genStack.length - 1].next();
        if (res.done) {
            this.genStack.pop();
            if (this.genStack.length === 0) {
                 const loop = this.ast.children.find(c => c.attributes.name === 'loop');
                 if(loop) this.genStack.push(this.runBlock(loop.children));
            }
        }
        this.onUpdate(Object.fromEntries(this.vars), Object.fromEntries(this.pins), [...this.logs], Object.fromEntries(this.tones), {...this.lcd}, this.dht, this.ultrasonicDist, this.ldrValue, this.irCode, {...this.rgb}, this.sevSegValue, [...this.neopixels], {...this.motors}, {...this.mpu}, this.oledPending, {...this.wifi}, {...this.files});
    }
    
    setDht(temp: number, hum: number) { this.dht = { temp, hum }; }
    setUltrasonic(cm: number) { this.ultrasonicDist = cm; }
    setLdr(val: number) { this.ldrValue = val; }
    setIr(code: number) { this.irCode = code; }
    setMpu(mpu: any) { this.mpu = mpu; }
    pressKey(key: string) { this.keypadBuffer = key; }
    pushSerial(text: string) { this.serialBuffer.push(text); }
    
    private runBlockSync(nodes: BaseNode[]) {
        for(const s of nodes) {
            if(s.nodeType === 'Print') this.logs.push(this.evalExpr(s.children[0]));
            if(s.nodeType === 'GpioSet') this.pins.set(this.evalExpr(s.children[0]), this.evalExpr(s.children[1]));
            if(s.nodeType === 'ExpressionStatement') this.evalExpr(s.children[0]);
        }
    }

    private *runBlock(nodes: BaseNode[]): Generator<any> { for (const s of nodes) yield* this.runStmt(s); }

    private *runStmt(node: BaseNode): Generator<any> {
        if (node.nodeType === 'Assignment') this.vars.set(node.attributes.name, this.evalExpr(node.children[0]));
        else if (node.nodeType === 'VariableDeclaration') {
            const val = node.children.length > 0 ? this.evalExpr(node.children[0]) : 0;
            this.vars.set(node.attributes.name, val);
        }
        else if (node.nodeType === 'ExpressionStatement') {
            if (node.children[0].nodeType === 'DelayMs') {
                 const steps = Math.ceil(this.evalExpr(node.children[0].children[0]) / 20);
                 for(let i=0; i<steps; i++) yield;
            } else this.evalExpr(node.children[0]);
        }
        else if (node.nodeType === 'GpioSet') this.pins.set(this.evalExpr(node.children[0]), this.evalExpr(node.children[1]));
        else if (node.nodeType === 'HardwarePwm') {
            // Emulate PWM by setting pin to ~50% logic or mapping duty
            // For sim visual purposes, let's treat duty > 512 as HIGH (1), else LOW (0), or store analog?
            // The simulator board uses 'pins' for digital/analog.
            const duty = node.attributes.duty;
            const val = duty > 512 ? 1 : 0;
            this.pins.set(node.attributes.pin, val);
        }
        else if (node.nodeType === 'GpioBatch') {
            const ops = node.attributes.operations;
            ops.forEach((op: any) => this.pins.set(op.pin, op.val));
        }
        else if (node.nodeType === 'LcdClear') this.lcd = { lines: ["                ", "                "], cx: 0, cy: 0 };
        else if (node.nodeType === 'LcdCursor') { this.lcd.cx = Math.min(15, this.evalExpr(node.children[0])); this.lcd.cy = Math.min(1, this.evalExpr(node.children[1])); }
        else if (node.nodeType === 'LcdPrint') {
            const str = String(this.evalExpr(node.children[0]));
            const line = this.lcd.lines[this.lcd.cy].split('');
            for(let i=0; i<str.length; i++) {
                if(this.lcd.cx < 16) line[this.lcd.cx++] = str[i];
            }
            this.lcd.lines[this.lcd.cy] = line.join('');
        }
        else if (node.nodeType === 'OledClear') {
             this.oledBuffer.fill(0);
        }
        else if (node.nodeType === 'OledText') {
             (this.oledBuffer as any).lastText = {
                 text: this.evalExpr(node.children[0]),
                 x: this.evalExpr(node.children[1]),
                 y: this.evalExpr(node.children[2]),
                 c: this.evalExpr(node.children[3])
             };
        }
        else if (node.nodeType === 'OledShow') {
             this.oledPending = new Uint8Array(this.oledBuffer);
             (this.oledPending as any).lastText = (this.oledBuffer as any).lastText;
        }
        else if (node.nodeType === 'SevSegPrint') {
            const val = this.evalExpr(node.children[0]);
            this.sevSegValue = String(val).substring(0, 4).padStart(4, ' ');
        }
        else if (node.nodeType === 'Print') this.logs.push(this.evalExpr(node.children[0]).toString());
        else if (node.nodeType === 'IfStatement') {
            if (this.evalExpr(node.children[0])) yield* this.runBlock(node.children.slice(1));
        }
        else if (node.nodeType === 'WhileLoop') {
            let limit = 0;
            while (this.evalExpr(node.children[0]) && limit++ < 2000) {
                yield* this.runBlock(node.children.slice(1));
                yield; 
            }
        }
    }

    private evalExpr(node: BaseNode): any {
        if (node.nodeType === 'Literal') return node.attributes.value;
        if (node.nodeType === 'Identifier') return this.vars.get(node.attributes.name) ?? 0;
        
        if (node.nodeType === 'UnaryExpression') {
             const op = node.attributes.operator;
             const child = node.children[0];
             if (op === '++' || op === '--') {
                 if (child.nodeType !== 'Identifier') return 0; 
                 const current = this.vars.get(child.attributes.name) ?? 0;
                 const newValue = op === '++' ? current + 1 : current - 1;
                 this.vars.set(child.attributes.name, newValue);
                 return node.attributes.prefix ? newValue : current; 
             }
             const v = this.evalExpr(child);
             return op === '!' ? (!v ? 1 : 0) : -v;
        }

        if (node.nodeType === 'BinaryExpression') {
            const op = node.attributes.operator;
            if (op === '=' || op === '+=' || op === '-=') {
                const rhs = this.evalExpr(node.children[1]);
                if (node.children[0].nodeType === 'Identifier') {
                    const name = node.children[0].attributes.name;
                    let val = rhs;
                    if (op === '+=') val = (this.vars.get(name) ?? 0) + rhs;
                    if (op === '-=') val = (this.vars.get(name) ?? 0) - rhs;
                    this.vars.set(name, val);
                    return val;
                }
                return rhs;
            }
            const l = this.evalExpr(node.children[0]), r = this.evalExpr(node.children[1]);
            if(op==='+') return l+r; if(op==='-') return l-r; if(op==='*') return l*r; if(op==='>') return l>r?1:0; if(op==='<') return l<r?1:0; if(op==='==') return l==r?1:0;
            return 0;
        }
        
        if (node.nodeType === 'CallExpression') {
             if (node.attributes.callee === 'servo') {
                 const pin = this.evalExpr(node.children[0]);
                 const angle = this.evalExpr(node.children[1]);
                 this.pins.set(pin, angle);
                 return 0;
             }
             if (node.attributes.callee === 'tone') {
                 const pin = this.evalExpr(node.children[0]);
                 const freq = this.evalExpr(node.children[1]);
                 this.tones.set(pin, freq);
                 return 0;
             }
             if (node.attributes.callee === 'noTone') {
                 const pin = this.evalExpr(node.children[0]);
                 this.tones.delete(pin);
                 return 0;
             }
             if (node.attributes.callee === 'dht.readTemp') return this.dht.temp;
             if (node.attributes.callee === 'dht.readHum') return this.dht.hum;
             if (node.attributes.callee === 'ultrasonic.read') return this.ultrasonicDist;
             if (node.attributes.callee === 'ldr.read') return this.ldrValue;
             if (node.attributes.callee === 'ir.read') {
                 const code = this.irCode;
                 this.irCode = 0; // Clear after read
                 return code;
             }
             if (node.attributes.callee === 'rgb.setColor') {
                 this.rgb = {
                     r: this.evalExpr(node.children[0]),
                     g: this.evalExpr(node.children[1]),
                     b: this.evalExpr(node.children[2])
                 };
                 return 0;
             }
             if (node.attributes.callee === 'neopixel.set') {
                 const idx = this.evalExpr(node.children[0]);
                 if (idx >= 0 && idx < 8) {
                     this.neopixelBuffer[idx] = {
                         r: this.evalExpr(node.children[1]),
                         g: this.evalExpr(node.children[2]),
                         b: this.evalExpr(node.children[3])
                     };
                 }
                 return 0;
             }
             if (node.attributes.callee === 'neopixel.show') {
                 this.neopixels = [...this.neopixelBuffer];
                 return 0;
             }
             if (node.attributes.callee === 'neopixel.clear') {
                 this.neopixelBuffer = Array(8).fill({r:0,g:0,b:0});
                 this.neopixels = [...this.neopixelBuffer];
                 return 0;
             }
             if (node.attributes.callee === 'motors.move') {
                 this.motors = { left: this.evalExpr(node.children[0]), right: this.evalExpr(node.children[1]) };
                 return 0;
             }
             if (node.attributes.callee === 'mpu.get') {
                 const a = node.attributes.axis;
                 if(a === 'AccelX') return this.mpu.ax;
                 if(a === 'AccelY') return this.mpu.ay;
                 if(a === 'AccelZ') return this.mpu.az;
                 if(a === 'GyroX') return this.mpu.gx;
                 if(a === 'GyroY') return this.mpu.gy;
                 if(a === 'GyroZ') return this.mpu.gz;
                 return 0;
             }
             if (node.attributes.callee === 'WiFi.begin') {
                 this.wifi.status = 1; // Connecting
                 this.wifi.ssid = this.evalExpr(node.children[0]);
                 this.wifi.connectStart = this.tick;
                 return 0;
             }
             if (node.attributes.callee === 'WiFi.status') {
                 return this.wifi.status; // 0=Idle, 1=Connecting, 3=Connected
             }
             if (node.attributes.callee === 'HTTP.get') {
                 const url = this.evalExpr(node.children[0]);
                 // Return fake data based on URL or random
                 if (url.includes("time")) return "12:00 PM";
                 if (url.includes("weather")) return "Sunny 25C";
                 return "{\"status\": \"ok\", \"data\": 42}";
             }
             if (node.attributes.callee === 'Serial.available') {
                 return this.serialBuffer.length;
             }
             if (node.attributes.callee === 'Serial.readString') {
                 if (this.serialBuffer.length > 0) return this.serialBuffer.shift();
                 return "";
             }
             if (node.attributes.callee === 'SPIFFS.open' || node.attributes.callee === 'INTERNAL_WRITE_FILE') {
                 const path = this.evalExpr(node.children[0]);
                 const mode = this.evalExpr(node.children[1]);
                 const content = this.evalExpr(node.children[2]);
                 if (mode === 'w') this.files[path] = String(content);
                 else if (mode === 'a') this.files[path] = (this.files[path] || "") + String(content);
                 return 0;
             }
             if (node.attributes.callee === 'SPIFFS.remove') {
                 delete this.files[this.evalExpr(node.children[0])];
                 return 0;
             }
             if (node.attributes.callee === 'file.write') {
                 const content = this.evalExpr(node.children[0]);
                 const varName = node.attributes.varName; // Not properly tracked, skipping file object logic for simplicity or would require scope lookup
                 // Simplified: we only support direct SPIFFS calls or assume one file for MVP
                 return 0;
             }
        }
        
        if (node.nodeType === 'KeypadRead') {
            const k = this.keypadBuffer;
            this.keypadBuffer = null;
            if(k) return k.charCodeAt(0); 
            return 0;
        }

        if (node.nodeType === 'AnalogRead') return this.pins.get(this.evalExpr(node.children[0])) || 0;
        if (node.nodeType === 'GpioRead') return this.pins.get(this.evalExpr(node.children[0])) || 0;
        return 0;
    }
    setPinInput(pin: number, val: number) { this.pins.set(pin, val); }
}

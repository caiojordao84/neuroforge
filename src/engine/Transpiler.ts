import type { Language } from '@/types';

// Transpiler - Converts between C++, MicroPython, and CircuitPython
export class Transpiler {
  transpile(code: string, fromLang: Language, toLang: Language): string {
    if (fromLang === toLang) {
      return code;
    }

    // Handle Python variants
    const isFromPython = fromLang === 'micropython' || fromLang === 'circuitpython';
    const isToPython = toLang === 'micropython' || toLang === 'circuitpython';

    // Assembly doesn't transpile - return original with comment
    if (fromLang === 'assembly' || toLang === 'assembly') {
      return `// Note: Assembly code cannot be automatically transpiled\n// Original ${fromLang} code:\n\n${code}`;
    }

    if (isFromPython && toLang === 'cpp') {
      return this.pythonToCpp(code);
    }

    if (fromLang === 'cpp' && isToPython) {
      const pythonCode = this.cppToPython(code);
      // Convert to CircuitPython if needed
      if (toLang === 'circuitpython') {
        return this.microPythonToCircuitPython(pythonCode);
      }
      return pythonCode;
    }

    // Between MicroPython and CircuitPython
    if (isFromPython && isToPython) {
      if (fromLang === 'micropython' && toLang === 'circuitpython') {
        return this.microPythonToCircuitPython(code);
      }
      if (fromLang === 'circuitpython' && toLang === 'micropython') {
        return this.circuitPythonToMicroPython(code);
      }
    }

    return code;
  }

  private pythonToCpp(code: string): string {
    let result = code;

    if (result.includes('from machine import Pin')) {
      result = result.replace(/from machine import Pin.*/g, '#include <Arduino.h>');
    }
    if (result.includes('import time')) {
      result = result.replace(/import time.*/g, '');
    }

    const pinInitRegex = /(\w+)\s*=\s*Pin\s*\(\s*(\d+)\s*,\s*Pin\.(\w+)\s*\)/g;
    const pinInits: string[] = [];
    let match;

    while ((match = pinInitRegex.exec(code)) !== null) {
      const pinNum = match[2];
      const mode = match[3] === 'OUT' ? 'OUTPUT' : match[3] === 'IN' ? 'INPUT' : 'INPUT_PULLUP';
      pinInits.push(`  pinMode(${pinNum}, ${mode});`);
    }

    result = result.replace(pinInitRegex, '');

    const pinValueMap = new Map<string, string>();
    const pinInitRegex2 = /(\w+)\s*=\s*Pin\s*\(\s*(\d+)\s*,/g;
    while ((match = pinInitRegex2.exec(code)) !== null) {
      pinValueMap.set(match[1], match[2]);
    }

    result = result.replace(/(\w+)\.value\s*\(\s*(\d+)\s*\)/g, (_, varName, value) => {
      const pinNum = pinValueMap.get(varName);
      if (pinNum) {
        const cppValue = value === '1' ? 'HIGH' : 'LOW';
        return `digitalWrite(${pinNum}, ${cppValue})`;
      }
      return _;
    });

    result = result.replace(/time\.sleep\s*\(\s*([\d.]+)\s*\)/g, (_, seconds) => {
      const ms = Math.round(parseFloat(seconds) * 1000);
      return `delay(${ms})`;
    });

    result = result.replace(/time\.sleep_ms\s*\(\s*(\d+)\s*\)/g, 'delay($1)');
    result = result.replace(/time\.sleep_us\s*\(\s*(\d+)\s*\)/g, 'delayMicroseconds($1)');

    result = result.replace(/print\s*\(\s*"([^"]*)"\s*\)/g, 'Serial.println("$1")');

    result = result.replace(/\n\s*\n/g, '\n');

    const lines = result.split('\n').filter((line) => line.trim());
    const setupLines: string[] = [];
    const loopLines: string[] = [];
    let inLoop = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('while True:')) {
        inLoop = true;
        continue;
      }
      if (inLoop) {
        loopLines.push(trimmed);
      } else {
        setupLines.push(trimmed);
      }
    }

    let cppCode = '';
    cppCode += '#include <Arduino.h>\n\n';
    cppCode += 'void setup() {\n';
    cppCode += '  Serial.begin(9600);\n';
    if (pinInits.length > 0) {
      cppCode += pinInits.join('\n') + '\n';
    }
    if (setupLines.length > 0) {
      cppCode += setupLines.map((l) => '  ' + l).join('\n') + '\n';
    }
    cppCode += '}\n\n';
    cppCode += 'void loop() {\n';
    if (loopLines.length > 0) {
      cppCode += loopLines.map((l) => '  ' + l).join('\n') + '\n';
    }
    cppCode += '}\n';

    return cppCode;
  }

  private cppToPython(code: string): string {
    let result = code;

    result = result.replace(/#include.*\n/g, '');

    const pinModeRegex = /pinMode\s*\(\s*(\d+)\s*,\s*(\w+)\s*\)/g;
    const pinInits: string[] = [];
    let match;

    while ((match = pinModeRegex.exec(code)) !== null) {
      const pinNum = match[1];
      const mode = match[2] === 'OUTPUT' ? 'Pin.OUT' : 
                   match[2] === 'INPUT' ? 'Pin.IN' : 'Pin.IN_PULLUP';
      pinInits.push(`led${pinNum} = Pin(${pinNum}, ${mode})`);
    }

    result = result.replace(/.*pinMode.*\n/g, '');

    result = result.replace(/digitalWrite\s*\(\s*(\d+)\s*,\s*(\w+)\s*\)/g, (_, pinNum, value) => {
      const pyValue = value === 'HIGH' ? '1' : '0';
      return `led${pinNum}.value(${pyValue})`;
    });

    result = result.replace(/analogWrite\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_, pinNum, value) => {
      return `# PWM on pin ${pinNum}: ${value}`;
    });

    result = result.replace(/delay\s*\(\s*(\d+)\s*\)/g, (_, ms) => {
      const seconds = parseInt(ms, 10) / 1000;
      if (seconds >= 1) {
        return `time.sleep(${seconds})`;
      }
      return `time.sleep_ms(${ms})`;
    });

    result = result.replace(/delayMicroseconds\s*\(\s*(\d+)\s*\)/g, 'time.sleep_us($1)');

    result = result.replace(/Serial\.println\s*\(\s*"([^"]*)"\s*\)/g, 'print("$1")');
    result = result.replace(/Serial\.print\s*\(\s*"([^"]*)"\s*\)/g, 'print("$1", end="")');

    result = result.replace(/.*Serial\.begin.*\n/g, '');

    result = result.replace(/\n\s*\n/g, '\n');

    const setupMatch = result.match(/void\s+setup\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
    const loopMatch = result.match(/void\s+loop\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);

    const setupBody = setupMatch ? setupMatch[1] : '';
    const loopBody = loopMatch ? loopMatch[1] : '';

    let pythonCode = '';
    pythonCode += 'from machine import Pin\n';
    pythonCode += 'import time\n\n';

    if (pinInits.length > 0) {
      pythonCode += pinInits.join('\n') + '\n\n';
    }

    if (setupBody.trim()) {
      const setupLines = setupBody.split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//'));
      pythonCode += setupLines.join('\n') + '\n\n';
    }

    pythonCode += 'while True:\n';
    if (loopBody.trim()) {
      const loopLines = loopBody.split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//'));
      if (loopLines.length > 0) {
        pythonCode += loopLines.map((l) => '    ' + l).join('\n') + '\n';
      } else {
        pythonCode += '    pass\n';
      }
    } else {
      pythonCode += '    pass\n';
    }

    return pythonCode;
  }

  private microPythonToCircuitPython(code: string): string {
    let result = code;
    
    // Replace machine import with board/digitalio
    result = result.replace(/from machine import Pin.*/g, 'import board\nimport digitalio');
    
    // Replace Pin initialization with DigitalInOut
    result = result.replace(/(\w+)\s*=\s*Pin\s*\(\s*(\d+)\s*,\s*Pin\.(\w+)\s*\)/g, 
      '$1 = digitalio.DigitalInOut(board.D$2)\n$1.direction = digitalio.Direction.$3');
    
    // Replace .value(1) with .value = True
    result = result.replace(/(\w+)\.value\s*\(\s*1\s*\)/g, '$1.value = True');
    result = result.replace(/(\w+)\.value\s*\(\s*0\s*\)/g, '$1.value = False');
    
    return result;
  }

  private circuitPythonToMicroPython(code: string): string {
    let result = code;
    
    // Replace board/digitalio with machine
    result = result.replace(/import board.*/g, 'from machine import Pin');
    result = result.replace(/import digitalio.*/g, '');
    
    // Replace DigitalInOut with Pin
    result = result.replace(/(\w+)\s*=\s*digitalio\.DigitalInOut\(board\.D(\d+)\).*/g, 
      '$1 = Pin($2, Pin.OUT)');
    
    // Remove direction lines
    result = result.replace(/.*direction\s*=\s*digitalio\.Direction\..*\n/g, '');
    
    // Replace .value = True with .value(1)
    result = result.replace(/(\w+)\.value\s*=\s*True/g, '$1.value(1)');
    result = result.replace(/(\w+)\.value\s*=\s*False/g, '$1.value(0)');
    
    return result;
  }

  detectLanguage(code: string): Language {
    if (code.includes('#include') || code.includes('void setup()')) {
      return 'cpp';
    }
    if (code.includes('.include') || code.includes('m328pdef.inc')) {
      return 'assembly';
    }
    if (code.includes('import board') || code.includes('digitalio')) {
      return 'circuitpython';
    }
    if (code.includes('from machine import') || code.includes('while True:')) {
      return 'micropython';
    }
    return 'cpp';
  }

  validateTranspilation(code: string, language: Language): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (language === 'cpp') {
      if (!code.includes('void setup()')) {
        errors.push('Transpiled C++ code missing setup() function');
      }
      if (!code.includes('void loop()')) {
        errors.push('Transpiled C++ code missing loop() function');
      }
    } else {
      if (!code.includes('while True:')) {
        errors.push('Transpiled Python code missing while True: loop');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

// Singleton instance
export const transpiler = new Transpiler();

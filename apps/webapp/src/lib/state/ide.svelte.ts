import { asl } from '@neuroforge/shared/state/asl.svelte.ts';

class IDEState {
  code = $state('// NeuroForge — RP2040\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}');
  
  language = $state('cpp'); // 'cpp', 'python', 'rust'
  isAslView = $state(false);
  transpiledAsl = $state('');
  
  terminalLogs = $state<Array<{ time: string, msg: string, type: 'info' | 'error' | 'success' }>>([
    { time: new Date().toLocaleTimeString(), msg: 'IDE Initialized.', type: 'info' }
  ]);

  addLog(msg: string, type: 'info' | 'error' | 'success' = 'info') {
    this.terminalLogs = [...this.terminalLogs, { 
      time: new Date().toLocaleTimeString(), 
      msg, 
      type 
    }];
  }

  async toggleAslView() {
    if (!this.isAslView) {
      if (!asl.ready) {
        this.addLog('WASM Engine not ready yet...', 'error');
        return;
      }
      try {
        this.transpiledAsl = asl.transpile(this.code, this.language, 'asl');
        this.isAslView = true;
        this.addLog('Transpilation to ASL successful.', 'success');
      } catch (e) {
        this.addLog('Transpilation failed: ' + String(e), 'error');
      }
    } else {
      this.isAslView = false;
    }
  }

  async runSimulation() {
    this.addLog(`Starting simulation (${this.language})...`, 'info');
    if (!asl.ready) {
      this.addLog('Wait for engine initialization...', 'error');
      return;
    }
    
    try {
      // Por agora, apenas transpilamos para validar o código como "Simulação"
      const result = asl.transpile(this.code, this.language, 'rust');
      this.addLog('Simulation build successful.', 'success');
      this.addLog('Running on virtual target...', 'info');
    } catch (e) {
      this.addLog('Simulation error: ' + String(e), 'error');
    }
  }
}

export const ideState = new IDEState();

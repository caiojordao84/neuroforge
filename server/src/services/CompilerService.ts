import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type BoardType = 'arduino-uno' | 'esp32' | 'esp32-devkit' | 'raspberry-pi-pico';
export type SimulationMode = 'interpreter' | 'qemu';

export interface CompileResult {
  success: boolean;
  firmwarePath?: string;
  efusePath?: string;  // ⭐ NOVO: Caminho do eFuse para ESP32
  error?: string;
  stdout?: string;
  stderr?: string;
}

/**
 * Service for compiling Arduino sketches using arduino-cli
 */
export class CompilerService {
  private arduinoCliPath: string;
  private tempDir: string;

  constructor() {
    // Try to find arduino-cli in PATH
    this.arduinoCliPath = process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
    this.tempDir = path.join(os.tmpdir(), 'neuroforge-compile');

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Get FQBN (Fully Qualified Board Name) for a board type
   * @param board - Board type (arduino-uno, esp32, etc)
   * @param mode - Simulation mode (qemu uses custom core with NeuroForge Time)
   */
  private getFQBN(board: BoardType, mode: SimulationMode = 'interpreter'): string {
    // NeuroForge Time: Use unoqemu board (registered in arduino:avr platform)
    if (mode === 'qemu' && board === 'arduino-uno') {
      return 'arduino:avr:unoqemu';  // ✅ Board unoqemu dentro da plataforma arduino:avr
    }

    // Default boards for interpreter mode
    const fqbnMap: Record<BoardType, string> = {
      'arduino-uno': 'arduino:avr:uno',
      'esp32': 'esp32:esp32:esp32',
      'esp32-devkit': 'esp32:esp32:esp32',
      'raspberry-pi-pico': 'rp2040:rp2040:rpipico'
    };
    return fqbnMap[board] || fqbnMap['arduino-uno'];
  }

  /**
   * Compile Arduino sketch to firmware
   * @param code - Arduino sketch code
   * @param board - Target board type
   * @param mode - Simulation mode (interpreter or qemu)
   */
  async compile(
    code: string,
    board: BoardType = 'arduino-uno',
    mode: SimulationMode = 'interpreter'
  ): Promise<CompileResult> {
    // ✅ NOVA LÓGICA: ESP32 usa firmware pré-compilado (por enquanto)
    if (board === 'esp32' || board === 'esp32-devkit') {
      return this.compileESP32(code, board);
    }

    // Compilação padrão para AVR/Arduino
    const sketchName = `sketch_${Date.now()}`;
    const sketchDir = path.join(this.tempDir, sketchName);
    // IMPORTANT: .ino file MUST have same name as folder (arduino-cli requirement)
    const sketchFile = path.join(sketchDir, `${sketchName}.ino`);

    try {
      // Create sketch directory
      fs.mkdirSync(sketchDir, { recursive: true });

      // Write sketch file
      fs.writeFileSync(sketchFile, code, 'utf-8');
      console.log(`✅ Created sketch: ${sketchFile}`);

      // Get FQBN for the board and mode
      const fqbn = this.getFQBN(board, mode);
      console.log(`🔧 Compiling with arduino-cli: ${fqbn} (mode: ${mode})`);

      // Compile using arduino-cli
      const result = await this.runArduinoCli([
        'compile',
        '--fqbn', fqbn,
        '--output-dir', sketchDir,
        sketchDir
      ]);

      if (result.exitCode !== 0) {
        console.error('❌ Compilation failed with status:', result.exitCode);
        console.error('STDOUT:', result.stdout);
        console.error('STDERR:', result.stderr);
        return {
          success: false,
          error: result.stderr || 'Compilation failed',
          stdout: result.stdout,
          stderr: result.stderr
        };
      }

      // Find the hex/elf file (arduino-cli names it after the sketch)
      const hexFile = path.join(sketchDir, `${sketchName}.ino.hex`);
      const elfFile = path.join(sketchDir, `${sketchName}.ino.elf`);

      // Prefer .elf for QEMU, fallback to .hex
      let firmwarePath: string;
      if (fs.existsSync(elfFile)) {
        firmwarePath = elfFile;
        console.log(`✅ ELF firmware created: ${elfFile}`);
      } else if (fs.existsSync(hexFile)) {
        firmwarePath = hexFile;
        console.log(`✅ HEX firmware created: ${hexFile}`);
      } else {
        return {
          success: false,
          error: 'Firmware file not found after compilation',
          stdout: result.stdout,
          stderr: result.stderr
        };
      }

      return {
        success: true,
        firmwarePath,
        stdout: result.stdout,
        stderr: result.stderr
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ESP32 Compilation Logic
   */
  private async compileESP32(code: string, board: BoardType): Promise<CompileResult> {
    console.log('🔧 ESP32 compilation requested');

    const sketchName = `sketch_${Date.now()}`;
    const sketchDir = path.join(this.tempDir, sketchName);
    const sketchFile = path.join(sketchDir, `${sketchName}.ino`);

    try {
      // 1. Create sketch directory
      fs.mkdirSync(sketchDir, { recursive: true });

      // 2. Write User Code
      fs.writeFileSync(sketchFile, code, 'utf-8');

      // 3. Inject Shim for GPIO Reporting
      // Matches the "weak symbol override" strategy
      const shimSource = path.join(__dirname, '..', 'shims', 'esp32-shim.cpp');
      if (fs.existsSync(shimSource)) {
        const shimDest = path.join(sketchDir, 'neuroforge_shim.cpp');
        fs.copyFileSync(shimSource, shimDest);
        console.log(`✅ Injected ESP32 Shim: ${shimDest}`);
      } else {
        console.warn(`⚠️ ESP32 Shim not found at ${shimSource}`);
      }

      // 4. Get FQBN
      // TODO: Make this configurable per board variant. For now using generic DevKit V1
      const fqbn = 'esp32:esp32:esp32doit-devkit-v1';
      console.log(`🔧 Compiling ESP32 with arduino-cli: ${fqbn}`);

      // 5. Compile with --export-binaries to get the merged bin
      const result = await this.runArduinoCli([
        'compile',
        '--fqbn', fqbn,
        '--export-binaries', // Important for QEMU: generates merged bin
        '--output-dir', sketchDir,
        sketchDir
      ]);

      if (result.exitCode !== 0) {
        console.error('❌ ESP32 Compilation failed:', result.exitCode);
        return {
          success: false,
          error: result.stderr || 'ESP32 Compilation failed',
          stdout: result.stdout,
          stderr: result.stderr
        };
      }

      // 6. Locate the merged binary
      // arduino-cli with --export-binaries usually produces sketchName.ino.merged.bin
      const mergedBin = path.join(sketchDir, `${sketchName}.ino.merged.bin`);

      if (!fs.existsSync(mergedBin)) {
        return {
          success: false,
          error: 'Merged firmware binary not found. Compilation might have succeeded but binary export failed.',
          stdout: result.stdout,
          stderr: result.stderr
        };
      }

      console.log(`✅ ESP32 Firmware created: ${mergedBin}`);

      // 7. Locate eFuse (reuse static one for now)
      const serverRoot = path.resolve(__dirname, '..', '..');
      const efusePath = path.join(serverRoot, 'test-firmware', 'esp32', 'qemu_efuse.bin');

      return {
        success: true,
        firmwarePath: mergedBin,
        efusePath: fs.existsSync(efusePath) ? efusePath : undefined,
        stdout: result.stdout,
        stderr: result.stderr
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compilation error'
      };
    }
  }

  /**
   * Run arduino-cli command
   */
  private runArduinoCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(this.arduinoCliPath, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (exitCode) => {
        resolve({
          exitCode: exitCode || 0,
          stdout,
          stderr
        });
      });

      proc.on('error', (error) => {
        resolve({
          exitCode: 1,
          stdout,
          stderr: error.message
        });
      });
    });
  }

  /**
   * Clean up old compilation directories
   */
  cleanup(olderThanMs: number = 3600000): void {
    if (!fs.existsSync(this.tempDir)) return;

    const now = Date.now();
    const entries = fs.readdirSync(this.tempDir);

    for (const entry of entries) {
      const entryPath = path.join(this.tempDir, entry);
      const stats = fs.statSync(entryPath);

      if (now - stats.mtimeMs > olderThanMs) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    }
  }
}

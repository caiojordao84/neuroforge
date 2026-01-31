import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type BoardType = 'arduino-uno' | 'esp32' | 'raspberry-pi-pico';

export interface CompileResult {
  success: boolean;
  firmwarePath?: string;
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
   */
  private getFQBN(board: BoardType): string {
    const fqbnMap: Record<BoardType, string> = {
      'arduino-uno': 'arduino:avr:uno',
      'esp32': 'esp32:esp32:esp32',
      'raspberry-pi-pico': 'rp2040:rp2040:rpipico'
    };
    return fqbnMap[board] || fqbnMap['arduino-uno'];
  }

  /**
   * Compile Arduino sketch to firmware
   */
  async compile(code: string, board: BoardType = 'arduino-uno'): Promise<CompileResult> {
    const sketchDir = path.join(this.tempDir, `sketch_${Date.now()}`);
    const sketchFile = path.join(sketchDir, 'sketch.ino');

    try {
      // Create sketch directory
      fs.mkdirSync(sketchDir, { recursive: true });

      // Write sketch file
      fs.writeFileSync(sketchFile, code, 'utf-8');

      // Get FQBN for the board
      const fqbn = this.getFQBN(board);

      // Compile using arduino-cli
      const result = await this.runArduinoCli([
        'compile',
        '--fqbn', fqbn,
        '--output-dir', sketchDir,
        sketchDir
      ]);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Compilation failed',
          stdout: result.stdout,
          stderr: result.stderr
        };
      }

      // Find the hex file
      const hexFile = path.join(sketchDir, 'sketch.ino.hex');
      if (!fs.existsSync(hexFile)) {
        return {
          success: false,
          error: 'Hex file not found after compilation',
          stdout: result.stdout,
          stderr: result.stderr
        };
      }

      return {
        success: true,
        firmwarePath: hexFile,
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

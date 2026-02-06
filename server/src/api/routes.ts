import { Router, Request, Response } from 'express';
import { CompilerService, SimulationMode } from '../services/CompilerService';
import { QEMUSimulationEngine } from '../services/QEMUSimulationEngine';
import { BoardType } from '../services/CompilerService';
import type { Esp32BackendConfig } from '../types/esp32.types';

const router = Router();
const compiler = new CompilerService();
const engine = new QEMUSimulationEngine();

/**
 * POST /api/compile
 * Compile Arduino code to firmware
 * Body: { code: string, board?: BoardType, mode?: SimulationMode }
 */
router.post('/compile', async (req: Request, res: Response) => {
  try {
    const { code, board, mode } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required'
      });
    }

    const boardType = (board as BoardType) || 'arduino-uno';
    const simulationMode = (mode as SimulationMode) || 'interpreter';
    
    console.log(`📝 Compiling for board: ${boardType}, mode: ${simulationMode}`);
    const result = await compiler.compile(code, boardType, simulationMode);

    if (result.success) {
      res.json({
        success: true,
        firmwarePath: result.firmwarePath,
        efusePath: result.efusePath,
        stdout: result.stdout
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        stderr: result.stderr
      });
    }
  } catch (error) {
    console.error('Compile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/simulate/start
 * Start QEMU simulation with firmware
 */
router.post('/simulate/start', async (req: Request, res: Response) => {
  try {
    const { firmwarePath, efusePath, board } = req.body;

    if (!firmwarePath) {
      return res.status(400).json({
        success: false,
        error: 'Firmware path is required'
      });
    }

    const boardType = (board as BoardType) || 'arduino-uno';
    
    // Stop existing simulation if running
    if (engine.isRunning()) {
      console.log('⚠️ QEMU already running, stopping previous simulation...');
      engine.stop();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await engine.loadFirmware(firmwarePath, boardType);

    // ✅ NOVA LÓGICA: Detectar ESP32 e passar config apropriado
    if (boardType === 'esp32' || boardType.includes('esp32')) {
      console.log('🔧 Starting ESP32 backend with QEMU config...');
      
      // ⭐ CORREÇÃO: Usar efusePath do parâmetro ou fallback inteligente
      let efuseImagePath: string;
      
      if (efusePath) {
        // Se efusePath foi fornecido, usar ele
        efuseImagePath = efusePath;
        console.log(`✅ Using provided eFuse path: ${efuseImagePath}`);
      } else {
        // Fallback: tentar qemu_efuse.bin na mesma pasta
        const path = require('path');
        const firmwareDir = path.dirname(firmwarePath);
        efuseImagePath = path.join(firmwareDir, 'qemu_efuse.bin');
        console.log(`⚠️ No efusePath provided, trying fallback: ${efuseImagePath}`);
      }
      
      // Build ESP32 config
      const esp32Config: Esp32BackendConfig = {
        flash: {
          flashImagePath: firmwarePath,
          efuseImagePath: efuseImagePath,
          serialPort: parseInt(process.env.ESP32_SERIAL_PORT || '5555')
        },
        qemuOptions: {
          memory: process.env.ESP32_DEFAULT_MEMORY || '4M',
          networkMode: 'none', // Workaround for SLIRP not available
          wdtDisable: true
        }
      };

      await engine.start(esp32Config);
    } else {
      // AVR (Arduino Uno, etc)
      await engine.start();
    }

    res.json({
      success: true,
      message: 'Simulation started'
    });
  } catch (error) {
    console.error('Start simulation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start simulation'
    });
  }
});

/**
 * POST /api/simulate/stop
 * Stop QEMU simulation
 */
router.post('/simulate/stop', (req: Request, res: Response) => {
  try {
    engine.stop();
    res.json({
      success: true,
      message: 'Simulation stopped'
    });
  } catch (error) {
    console.error('Stop simulation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop simulation'
    });
  }
});

/**
 * GET /api/simulate/status
 * Get simulation status
 */
router.get('/simulate/status', (req: Request, res: Response) => {
  try {
    const isRunning = engine.isRunning();
    const isPaused = engine.isPaused();
    const backendType = engine.getBackendType();

    res.json({
      success: true,
      running: isRunning,
      paused: isPaused,
      backend: backendType
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

/**
 * GET /api/simulate/pins/:pin
 * Read pin state from QEMU
 */
router.get('/simulate/pins/:pin', (req: Request, res: Response) => {
  try {
    const pin = parseInt(req.params.pin, 10);

    if (isNaN(pin)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pin number'
      });
    }

    const state = engine.getPinState(pin);

    res.json({
      success: true,
      pin,
      ...state
    });
  } catch (error) {
    console.error('Read pin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read pin'
    });
  }
});

/**
 * POST /api/simulate/pins/:pin
 * Write pin state to QEMU (simulate button press, etc)
 */
router.post('/simulate/pins/:pin', async (req: Request, res: Response) => {
  try {
    const pin = parseInt(req.params.pin, 10);
    const { value } = req.body;

    if (isNaN(pin)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pin number'
      });
    }

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Value is required'
      });
    }

    await engine.setPinState(pin, value);

    res.json({
      success: true,
      pin,
      value
    });
  } catch (error) {
    console.error('Write pin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to write pin'
    });
  }
});

/**
 * GET /api/simulate/serial
 * Get serial buffer
 */
router.get('/simulate/serial', (req: Request, res: Response) => {
  try {
    const buffer = engine.getSerialBuffer();

    res.json({
      success: true,
      lines: buffer
    });
  } catch (error) {
    console.error('Get serial error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get serial buffer'
    });
  }
});

/**
 * DELETE /api/simulate/serial
 * Clear serial buffer
 */
router.delete('/simulate/serial', (req: Request, res: Response) => {
  try {
    engine.clearSerial();

    res.json({
      success: true,
      message: 'Serial buffer cleared'
    });
  } catch (error) {
    console.error('Clear serial error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear serial buffer'
    });
  }
});

export { router, engine };

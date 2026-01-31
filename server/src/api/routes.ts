import { Router, Request, Response } from 'express';
import { CompilerService } from '../services/CompilerService';
import { QEMUSimulationEngine } from '../services/QEMUSimulationEngine';
import { BoardType } from '../services/CompilerService';

const router = Router();
const compiler = new CompilerService();
const engine = new QEMUSimulationEngine();

/**
 * POST /api/compile
 * Compile Arduino code to firmware
 */
router.post('/compile', async (req: Request, res: Response) => {
  try {
    const { code, board } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required'
      });
    }

    const boardType = (board as BoardType) || 'arduino-uno';
    const result = await compiler.compile(code, boardType);

    if (result.success) {
      res.json({
        success: true,
        firmwarePath: result.firmwarePath,
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
    const { firmwarePath, board } = req.body;

    if (!firmwarePath) {
      return res.status(400).json({
        success: false,
        error: 'Firmware path is required'
      });
    }

    const boardType = (board as BoardType) || 'arduino-uno';
    
    await engine.loadFirmware(firmwarePath, boardType);
    await engine.start();

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

    res.json({
      success: true,
      running: isRunning,
      paused: isPaused
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

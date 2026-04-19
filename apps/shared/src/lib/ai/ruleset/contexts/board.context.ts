/**
 * Board Context Loader
 * 
 * Loads board-specific configuration for transpilation context.
 */

// Board configurations for common platforms
interface BoardConfig {
  pins: number[];
  pwmPins: number[];
  avoidPins: number[];
  i2c?: { sda: number; scl: number };
  spi?: { mosi: number; miso: number; sck: number };
  uart?: { tx: number; rx: number };
  warnings?: string[];
}

const BOARD_CONFIGS: Record<string, BoardConfig> = {
  'ESP32': {
    pins: [2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39],
    pwmPins: [2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33],
    avoidPins: [6,7,8,9,10,11], // SPI Flash
    i2c: { sda: 21, scl: 22 },
    spi: { mosi: 23, miso: 19, sck: 18 },
    uart: { tx: 1, rx: 3 },
    warnings: [
      'GPIO 6-11 are connected to SPI flash (DO NOT USE)',
      'GPIO 34-39 are input only (no pull-up/down)',
      'GPIO 1 and 3 are used for Serial',
    ],
  },
  'ESP8266': {
    pins: [0,1,2,3,4,5,12,13,14,15,16],
    pwmPins: [0,2,4,5,12,13,14,15,16],
    avoidPins: [1,3], // UART
    i2c: { sda: 4, scl: 5 },
    uart: { tx: 1, rx: 3 },
    warnings: [
      'GPIO 1 and 3 are used for Serial',
      'Limited GPIO available',
    ],
  },
  'Arduino Uno': {
    pins: [0,1,2,3,4,5,6,7,8,9,10,11,12,13],
    pwmPins: [3,5,6,9,10,11],
    avoidPins: [0,1], // UART
    uart: { tx: 1, rx: 0 },
    warnings: [
      'PWM available on pins 3, 5, 6, 9, 10, 11 only',
      'A0-A5 can be used as digital pins',
    ],
  },
  'Arduino Mega': {
    pins: Array.from({ length: 54 }, (_, i) => i),
    pwmPins: [2,3,4,5,6,7,8,9,10,11,12,13,44,45,46],
    avoidPins: [0,1,14,15,16,17], // UART
    i2c: { sda: 20, scl: 21 },
    uart: { tx: 1, rx: 0 },
    warnings: [
      'Many GPIO available',
      'Multiple UARTs available',
    ],
  },
  'RP2040': {
    pins: Array.from({ length: 28 }, (_, i) => i),
    pwmPins: Array.from({ length: 28 }, (_, i) => i), // All GPIO support PWM
    avoidPins: [], // No special restrictions
    i2c: { sda: 4, scl: 5 },
    spi: { mosi: 7, miso: 4, sck: 6 }, // Corrected
    uart: { tx: 0, rx: 1 },
    warnings: [
      'All 28 GPIO support PWM',
    ],
  },
  'STM32F4': {
    pins: Array.from({ length: 16 }, (_, i) => i),
    pwmPins: Array.from({ length: 16 }, (_, i) => i),
    avoidPins: [],
    i2c: { sda: 7, scl: 6 },
    spi: { mosi: 11, miso: 10, sck: 9 },
    uart: { tx: 2, rx: 3 },
  },
  'nRF52840': {
    pins: Array.from({ length: 32 }, (_, i) => i),
    pwmPins: Array.from({ length: 32 }, (_, i) => i),
    avoidPins: [],
    i2c: { sda: 26, scl: 27 },
    spi: { mosi: 13, miso: 14, sck: 15 },
    uart: { tx: 6, rx: 8 },
  },
  'Teensy 4.0': {
    pins: Array.from({ length: 40 }, (_, i) => i),
    pwmPins: Array.from({ length: 40 }, (_, i) => i),
    avoidPins: [],
    i2c: { sda: 18, scl: 19 },
    uart: { tx: 1, rx: 0 },
  },
};

/**
 * Build board context for a specific platform
 */
export function buildBoardContext(platform: string): string {
  const board = BOARD_CONFIGS[platform];
  
  if (!board) {
    return `
# Target Platform: ${platform}
(Generic board context - no specific board rules available)
`;
  }
  
  const sections: string[] = [
    `# Target Board: ${platform}`,
    '',
    '## Pin Configuration',
    `- Available GPIO: ${board.pins.join(', ')}`,
    `- PWM-capable: ${board.pwmPins.join(', ')}`,
  ];
  
  if (board.avoidPins.length > 0) {
    sections.push(`- Avoid: ${board.avoidPins.join(', ')}`);
  }
  
  if (board.i2c) {
    sections.push(`- I2C: SDA=${board.i2c.sda}, SCL=${board.i2c.scl}`);
  }
  
  if (board.spi) {
    sections.push(`- SPI: MOSI=${board.spi.mosi}, MISO=${board.spi.miso}, SCK=${board.spi.sck}`);
  }
  
  if (board.uart) {
    sections.push(`- UART: TX=${board.uart.tx}, RX=${board.uart.rx}`);
  }
  
  if (board.warnings && board.warnings.length > 0) {
    sections.push('', '## Warnings');
    board.warnings.forEach(w => sections.push(`- ${w}`));
  }
  
  return sections.join('\n');
}

/**
 * Get board configuration
 */
export function getBoardConfig(platform: string): BoardConfig | null {
  return BOARD_CONFIGS[platform] || null;
}

/**
 * Get available platforms
 */
export function getAvailablePlatforms(): string[] {
  return Object.keys(BOARD_CONFIGS);
}

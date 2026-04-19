/**
 * Plugin Context Loader
 * 
 * Loads plugin-specific context for transpilation.
 */

// Plugin context for source/target language combinations
const PLUGIN_CONTEXT: Record<string, string> = {
  'arduino-to-rust': `
## Arduino to Rust Plugin
- Use embassy-rp for RP2040, embassy-esp for ESP32
- Translate pinMode() to gpio::Output::new()
- Translate digitalWrite() to set_high()/set_low()
- Replace delay() with embassy::time::Timer
`,
  'rust-to-arduino': `
## Rust to Arduino Plugin
- Translate gpio::Output to pinMode() and digitalWrite()
- Replace embassy::time::Timer with delay()
- Use digitalWrite() for output
- Use delayMicroseconds() for precise timing
`,
  'c-to-python': `
## C to Python Plugin
- Translate HAL functions to RPi/machine library calls
- Replace delay() with time.sleep()
- Translate pin config to Pin(n, Pin.OUT)
`,
  'python-to-c': `
## Python to C Plugin
- Translate machine.Pin to HAL_GPIO
- Translate time.sleep to HAL_Delay
- Use digitalio for GPIO in CircuitPython
`,
  'arduino-to-python': `
## Arduino to Python Plugin
- Arduino setup() maps to main() or init
- Arduino loop() maps to while True: with time.sleep
- pinMode() maps to Pin.OUT/IN
- digitalWrite() maps to value(1)/value(0)
`,
  'micropython-to-circuitpython': `
## MicroPython to CircuitPython Plugin
- Very similar - minor differences
- machine.PWM → pwmio.PWMOut
- machine.I2C → busio.I2C
- time.sleep_ms → time.sleep
`,
};

// Special patterns for certain translations
const TRANSLATION_PATTERNS: Record<string, string> = {
  'pwm-servo': `
## PWM Servo Pattern
- Typical servo: 1000-2000µs pulse (1-2ms)
- Period: 20ms (50Hz)
- Use hardware PWM when available
- Avoid bit-banging for precision
`,
  'i2c-device': `
## I2C Device Pattern
- Standard I2C: 100kHz (standard) or 400kHz (fast)
- 7-bit addressing
- SDA/SCL with pull-ups
- Master/slave relationship
`,
  'spi-device': `
## SPI Device Pattern
- Full duplex communication
- CPOL/CPHA clock configuration
- MSB first typically
- CS line management needed
`,
  'uart-bitbang': `
## UART Bit-banging Pattern
- Software UART when hardware unavailable
- Precise timing critical
- Baud rate generator needed
`,
};

/**
 * Build plugin context for source to target language
 */
export function buildPluginContext(sourceLang: string, targetLang: string): string {
  const key = `${sourceLang.toLowerCase()}-to-${targetLang.toLowerCase()}`;
  
  if (PLUGIN_CONTEXT[key]) {
    return PLUGIN_CONTEXT[key];
  }
  
  // Also try normalized names
  const sourceNormalized = normalizeLang(sourceLang);
  const targetNormalized = normalizeLang(targetLang);
  const normalizedKey = `${sourceNormalized}-to-${targetNormalized}`;
  
  if (PLUGIN_CONTEXT[normalizedKey]) {
    return PLUGIN_CONTEXT[normalizedKey];
  }
  
  return '';
}

/**
 * Get translation pattern for specific feature
 */
export function getTranslationPattern(pattern: string): string {
  return TRANSLATION_PATTERNS[pattern] || '';
}

/**
 * Normalize language name for matching
 */
function normalizeLang(lang: string): string {
  const lower = lang.toLowerCase();
  
  if (lower.includes('arduino')) return 'arduino';
  if (lower.includes('rust')) return 'rust';
  if (lower.includes('c++') || lower.includes('cpp')) return 'cpp';
  if (lower.includes('python') && !lower.includes('micro') && !lower.includes('circuit')) return 'python';
  if (lower.includes('micropython')) return 'micropython';
  if (lower.includes('circuitpython')) return 'circuitpython';
  if (lower.includes('c (embedded') || lower.includes('embedded c')) return 'c';
  
  return lower;
}

/**
 * Get all available plugin contexts
 */
export function getAvailablePlugins(): string[] {
  return Object.keys(PLUGIN_CONTEXT);
}

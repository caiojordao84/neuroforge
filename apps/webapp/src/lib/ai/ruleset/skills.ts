/**
 * Language Skills Loader
 * 
 * Loads language-specific skill rules for transpilation.
 */

// Language mapping to skill files
const LANGUAGE_SKILL_MAP: Record<string, string> = {
  'arduino c/c++': 'arduino-cpp-generic.md',
  'arduino': 'arduino-cpp-generic.md',
  'c (embedded/hal)': 'c-cpp-generic.md',
  'c++ (embedded)': 'c-cpp-generic.md',
  'rust (embedded-hal)': 'rust-embassy-generic.md',
  'rust': 'rust-embassy-generic.md',
  'micropython': 'micropython-esp32.md',
  'circuitpython': 'circuitpython-esp32.md',
  'python': 'python-generic.md',
  'structured text (iec 61131-3)': 'iec-st.md',
  'iec 61131-3': 'iec-st.md',
};

// Default skills when file not found
const DEFAULT_SKILLS: Record<string, string> = {
  'arduino-cpp-generic.md': `
## Arduino C/C++ Rules
- Use pinMode() for GPIO configuration
- Use digitalWrite() for output
- Use digitalRead() for input
- Use analogWrite() for PWM (limited pins)
- delay() for timing
`,
  'c-cpp-generic.md': `
## C/C++ Embedded Rules
- Use HAL functions for hardware access
- Configure GPIO with HAL_GPIO_Init()
- Use HAL_Delay() for timing
- Configure peripherals with *_Init() functions
`,
  'rust-embassy-generic.md': `
## Rust Embedded-HAL Rules
- Use embassy for async execution
- Configure pins with gpio::Output::new()
- Use embassy::time::Timer for delays
- Use embassy::futures::block_on for sync
`,
  'python-generic.md': `
## Python Rules
- Use RPi.GPIO or machine library
- Configure with GPIO.setup()
- Use GPIO.output() for digital
- Use GPIO.input() for reading
`,
  'micropython-esp32.md': `
## MicroPython ESP32 Rules
- Use machine Pin for GPIO
- Use machine.PWM for PWM
- Use machine.I2C for I2C
- Use machine.SPI for SPI
- Use time.sleep_ms() for delays
`,
  'circuitpython-esp32.md': `
## CircuitPython ESP32 Rules
- Use digitalio for GPIO
- Use pwmio for PWM
- Use busio for I2C/SPI
- Use time.sleep() for delays
`,
  'iec-st.md': `
## Structured Text (IEC 61131-3) Rules
- Use VAR ... END_VAR for declarations
- Use := for assignment
- IF ... THEN ... END_IF for conditionals
- FOR ... TO ... DO ... END_FOR for loops
- TON, TOF for timers
`,
};

 /**
  * Get language skill for a specific target language
  */
 export function getLanguageSkill(targetLang: string): string {
   const normalized = targetLang.toLowerCase();
   const skillFile = LANGUAGE_SKILL_MAP[normalized];
   
   if (skillFile && DEFAULT_SKILLS[skillFile]) {
     return DEFAULT_SKILLS[skillFile];
   }
   
   // Check if we have a direct match
   if (DEFAULT_SKILLS[normalized + '.md']) {
     return DEFAULT_SKILLS[normalized + '.md'];
   }
   
   console.warn(`No skill file for language: ${targetLang}`);
   return '';
 }

 /**
  * Get all available language skills
  */
 export function getAvailableSkills(): string[] {
   return Object.keys(DEFAULT_SKILLS);
 }
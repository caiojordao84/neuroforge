import type { PinDefinition, ValidationIssue } from './types';

/**
 * Validate a single pin configuration
 */
export function validatePin(pin: PinDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Validate logical pin number
  if (pin.logical_pin > 255) {
    issues.push({
      severity: 'error',
      message: 'Pin number must be <= 255',
      field: 'logical_pin'
    });
  }
  
  // Validate label
  if (!pin.label || pin.label.trim() === '') {
    issues.push({
      severity: 'error',
      message: 'Pin label is required',
      field: 'label'
    });
  }
  
  // ADC and DAC conflict check
  if (pin.adc && pin.dac) {
    issues.push({
      severity: 'error',
      message: 'Pin cannot be both ADC and DAC',
      field: 'adc/dac'
    });
  }
  
  // Input only checks
  if (pin.input_only && pin.pwm) {
    issues.push({
      severity: 'warning',
      message: 'PWM may not work on input-only pins',
      field: 'pwm'
    });
  }
  
  // Check pin number is unique
  if (pin.logical_pin < 0) {
    issues.push({
      severity: 'error',
      message: 'Pin number must be non-negative',
      field: 'logical_pin'
    });
  }
  
  return issues;
}

/**
 * Validate the entire board configuration
 */
export function validateBoard(
  pins: PinDefinition[],
  boardId: string,
  mcu: string,
  frequency: number,
  languages: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Validate board ID
  if (!boardId || boardId.trim() === '') {
    issues.push({
      severity: 'error',
      message: 'Board ID is required',
      field: 'board.id'
    });
  } else if (!/^[a-z0-9-]+$/.test(boardId)) {
    issues.push({
      severity: 'error',
      message: 'Board ID must be lowercase kebab-case',
      field: 'board.id'
    });
  }
  
  // Validate MCU
  if (!mcu || mcu.trim() === '') {
    issues.push({
      severity: 'error',
      message: 'MCU is required',
      field: 'board.mcu'
    });
  }
  
  // Validate pins
  if (pins.length === 0) {
    issues.push({
      severity: 'error',
      message: 'At least one pin is required',
      field: 'pins'
    });
  }
  
  // Check for duplicate pin numbers
  const pinNumbers = pins.map(p => p.logical_pin);
  const duplicates = pinNumbers.filter((num, idx) => pinNumbers.indexOf(num) !== idx);
  if (duplicates.length > 0) {
    issues.push({
      severity: 'error',
      message: `Duplicate pin numbers: ${Array.from(new Set(duplicates)).join(', ')}`,
      field: 'pins.logical_pin'
    });
  }
  
  // Validate languages
  if (!languages || languages.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No languages specified',
      field: 'board.languages'
    });
  }
  
  // Validate frequency
  if (!frequency || frequency <= 0) {
    issues.push({
      severity: 'error',
      message: 'Frequency must be greater than 0',
      field: 'board.frequency'
    });
  }
  
  // Validate each pin
  for (const pin of pins) {
    const pinIssues = validatePin(pin);
    issues.push(...pinIssues.map(issue => ({
      ...issue,
      message: `Pin ${pin.logical_pin}: ${issue.message}`
    })));
  }
  
  // Check for strapping pins without warning
  for (const pin of pins) {
    if (pin.strapping && !pin.warning) {
      issues.push({
        severity: 'warning',
        message: `Strapping pin ${pin.logical_pin} should have a warning`,
        field: 'pins.warning'
      });
    }
  }
  
  return issues;
}

/**
 * Check if board is valid (no errors)
 */
export function isBoardValid(issues: ValidationIssue[]): boolean {
  return !issues.some(issue => issue.severity === 'error');
}

/**
 * Get count of issues by severity
 */
export function countIssues(issues: ValidationIssue[]): { errors: number; warnings: number; info: number } {
  return {
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length
  };
}

// ============================================
// Connection Validation
// ============================================

export interface ConnectionValidation {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate a connection between a component signal and a board pin
 */
export function validateConnection(
  signalType: string,
  pinLabel: string,
  boardPins: PinDefinition[]
): ConnectionValidation {
  const issues: ValidationIssue[] = [];
  
  // Find the board pin
  const pin = boardPins.find(p => p.label === pinLabel);
  
  if (!pin) {
    issues.push({
      severity: 'error',
      message: `Pin "${pinLabel}" not found on board`,
      field: 'boardPin'
    });
    return { valid: false, issues };
  }
  
  // Check for reserved/strapping pins
  if (pin.strapping) {
    issues.push({
      severity: 'error',
      message: `Pin ${pin.logical_pin} (${pinLabel}) is a strapping pin and cannot be used for custom connections`,
      field: 'strapping'
    });
  }
  
  if (pin.warning) {
    issues.push({
      severity: 'warning',
      message: `Pin ${pin.logical_pin} (${pinLabel}) has a warning: ${pin.warning}`,
      field: 'warning'
    });
  }
  
  // Validate signal type compatibility
  switch (signalType) {
    case 'pwm':
      if (!pin.pwm) {
        issues.push({
          severity: 'error',
          message: `Pin ${pin.logical_pin} (${pinLabel}) does not support PWM`,
          field: 'pwm'
        });
      }
      break;
      
    case 'analog':
      if (!pin.adc && !pin.dac) {
        issues.push({
          severity: 'error',
          message: `Pin ${pin.logical_pin} (${pinLabel}) does not support analog (ADC/DAC)`,
          field: 'adc'
        });
      }
      break;
      
    case 'i2c':
      // I2C typically uses specific pins, check for SDA/SCL labels
      const lowerLabel = pinLabel.toLowerCase();
      if (!lowerLabel.includes('sda') && !lowerLabel.includes('scl')) {
        issues.push({
          severity: 'warning',
          message: `Pin ${pin.logical_pin} (${pinLabel}) is not a standard I2C pin (SDA/SCL). I2C may not work correctly.`,
          field: 'i2c'
        });
      }
      break;
      
    case 'spi':
      const lowerLabelSpi = pinLabel.toLowerCase();
      if (!lowerLabelSpi.includes('mosi') && !lowerLabelSpi.includes('miso') && 
          !lowerLabelSpi.includes('sck') && !lowerLabelSpi.includes('ss')) {
        issues.push({
          severity: 'warning',
          message: `Pin ${pin.logical_pin} (${pinLabel}) is not a standard SPI pin (MOSI/MISO/SCK/SS). SPI may not work correctly.`,
          field: 'spi'
        });
      }
      break;
      
    case 'uart':
      const lowerLabelUart = pinLabel.toLowerCase();
      if (!lowerLabelUart.includes('tx') && !lowerLabelUart.includes('rx')) {
        issues.push({
          severity: 'warning',
          message: `Pin ${pin.logical_pin} (${pinLabel}) is not a standard UART pin (TX/RX). Serial communication may not work correctly.`,
          field: 'uart'
        });
      }
      break;
      
    case 'digital':
      // Digital is compatible with most pins
      if (pin.input_only) {
        issues.push({
          severity: 'warning',
          message: `Pin ${pin.logical_pin} (${pinLabel}) is input-only. Output may not work.`,
          field: 'input_only'
        });
      }
      break;
      
    case 'power':
      // Power connections need VCC pins
      const lowerLabelPower = pinLabel.toLowerCase();
      if (!lowerLabelPower.includes('vcc') && !lowerLabelPower.includes('5v') && 
          !lowerLabelPower.includes('3v3') && !lowerLabelPower.includes('3v')) {
        issues.push({
          severity: 'error',
          message: `Pin ${pin.logical_pin} (${pinLabel}) is not a power pin (VCC). Cannot connect power signal here.`,
          field: 'power'
        });
      }
      break;
      
    case 'gnd':
      // Ground connections need GND pins
      const lowerLabelGnd = pinLabel.toLowerCase();
      if (!lowerLabelGnd.includes('gnd')) {
        issues.push({
          severity: 'error',
          message: `Pin ${pin.logical_pin} (${pinLabel}) is not a ground pin (GND). Cannot connect ground signal here.`,
          field: 'gnd'
        });
      }
      break;
  }
  
  const valid = !issues.some(i => i.severity === 'error');
  return { valid, issues };
}

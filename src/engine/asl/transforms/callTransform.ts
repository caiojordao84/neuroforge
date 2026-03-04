import type { BaseNode } from '@/system/types';
import type { ASLStatement, ASLExpr } from '../ASLTypes';
import { transformExpr } from './exprTransform';

export function transformCallToStmt(node: BaseNode): ASLStatement | null {
  const callee = node.attributes.callee;

  if (callee === 'pinMode') {
    const modeNode = node.children[1];
    let mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' = 'OUTPUT';

    if (modeNode.nodeType === 'Literal') {
      const v = modeNode.attributes.value;
      if (v === 0) mode = 'INPUT';
      if (v === 2) mode = 'INPUT_PULLUP';
    }

    return {
      kind: 'pinMode',
      pin: transformExpr(node.children[0]),
      mode,
    } as ASLStatement;
  }

  if (callee === 'digitalWrite') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'Serial.print' || callee === 'Serial.println') {
    return {
      kind: 'print',
      args: node.children.map(transformExpr),
      newline: callee === 'Serial.println',
    } as ASLStatement;
  }

  if (callee === 'Pin.value' && node.children.length === 2) {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'Pin.on') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: { kind: 'literal', value: 1 } as ASLExpr,
    } as ASLStatement;
  }

  if (callee === 'Pin.off') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: { kind: 'literal', value: 0 } as ASLExpr,
    } as ASLStatement;
  }

  // --- S5: UART high-level helpers ---
  if (callee === 'UARTWrite') {
    return {
      kind: 'uartWrite',
      port: transformExpr(node.children[0]),
      data: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'UARTRead') {
    return {
      kind: 'uartRead',
      port: transformExpr(node.children[0]),
      length: transformExpr(node.children[1]),
      target: node.attributes.target || '__uartBuf',
    } as ASLStatement;
  }

  // --- S5: I2C helpers ---
  if (callee === 'I2CWrite') {
    return {
      kind: 'i2cWrite',
      bus: transformExpr(node.children[0]),
      address: transformExpr(node.children[1]),
      data: transformExpr(node.children[2]),
    } as ASLStatement;
  }

  if (callee === 'I2CRead') {
    return {
      kind: 'i2cRead',
      bus: transformExpr(node.children[0]),
      address: transformExpr(node.children[1]),
      length: transformExpr(node.children[2]),
      target: node.attributes.target || '__i2cBuf',
    } as ASLStatement;
  }

  // --- S5: SPI helper ---
  if (callee === 'SPITransfer') {
    return {
      kind: 'spiTransfer',
      bus: transformExpr(node.children[0]),
      csPin: transformExpr(node.children[1]),
      txData: transformExpr(node.children[2]),
      target: node.attributes.target,
    } as ASLStatement;
  }

  // --- S5: PWM ---
  if (callee === 'PWMInit') {
    return {
      kind: 'pwmInit',
      pin: transformExpr(node.children[0]),
      freq: transformExpr(node.children[1]),
      duty: transformExpr(node.children[2]),
    } as ASLStatement;
  }
  if (callee === 'PWMSetDuty') {
    return {
      kind: 'pwmSetDuty',
      pin: transformExpr(node.children[0]),
      duty: transformExpr(node.children[1]),
    } as ASLStatement;
  }
  if (callee === 'PWMSetFreq') {
    return {
      kind: 'pwmSetFreq',
      pin: transformExpr(node.children[0]),
      freq: transformExpr(node.children[1]),
    } as ASLStatement;
  }
  if (callee === 'PWMStop') {
    return {
      kind: 'pwmStop',
      pin: transformExpr(node.children[0]),
    } as ASLStatement;
  }

  // --- S5: IEC blocks as function-like calls ---
  if (callee === 'TON') {
    return {
      kind: 'timerTON',
      instance: node.attributes.instance,
      in: transformExpr(node.children[0]),
      pt: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'TOF') {
    return {
      kind: 'timerTOF',
      instance: node.attributes.instance,
      in: transformExpr(node.children[0]),
      pt: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'TP') {
    return {
      kind: 'timerTP',
      instance: node.attributes.instance,
      in: transformExpr(node.children[0]),
      pt: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'CTU') {
    return {
      kind: 'counterCTU',
      instance: node.attributes.instance,
      cu: transformExpr(node.children[0]),
      r: transformExpr(node.children[1]),
      pv: transformExpr(node.children[2]),
    } as ASLStatement;
  }

  if (callee === 'CTD') {
    return {
      kind: 'counterCTD',
      instance: node.attributes.instance,
      cd: transformExpr(node.children[0]),
      ld: transformExpr(node.children[1]),
      pv: transformExpr(node.children[2]),
    } as ASLStatement;
  }

  if (callee === 'SR') {
    return {
      kind: 'latchSR',
      instance: node.attributes.instance,
      s: transformExpr(node.children[0]),
      r: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'RS') {
    return {
      kind: 'latchRS',
      instance: node.attributes.instance,
      r: transformExpr(node.children[0]),
      s: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  if (callee === 'R_TRIG') {
    return {
      kind: 'trigR',
      instance: node.attributes.instance,
      in: transformExpr(node.children[0]),
    } as ASLStatement;
  }

  if (callee === 'F_TRIG') {
    return {
      kind: 'trigF',
      instance: node.attributes.instance,
      in: transformExpr(node.children[0]),
    } as ASLStatement;
  }

  return {
    kind: 'expr',
    expr: {
      kind: 'call',
      callee,
      args: node.children.map(transformExpr),
    },
  } as ASLStatement;
}

export function tryTransformRead(targetVar: string, valueNode: BaseNode | undefined): ASLStatement | null {
  if (!valueNode) return null;

  if (valueNode.nodeType === 'GpioRead') {
    return {
      kind: 'read',
      mode: 'DIGITAL',
      target: targetVar,
      pin: transformExpr(valueNode.children[0]),
    } as ASLStatement;
  }
  if (valueNode.nodeType === 'AnalogRead') {
    return {
      kind: 'read',
      mode: 'ANALOG',
      target: targetVar,
      pin: transformExpr(valueNode.children[0]),
    } as ASLStatement;
  }
  if (valueNode.nodeType === 'CallExpression') {
    if (valueNode.attributes.callee === 'digitalRead') {
      return {
        kind: 'read',
        mode: 'DIGITAL',
        target: targetVar,
        pin: transformExpr(valueNode.children[0]),
      } as ASLStatement;
    }
    if (valueNode.attributes.callee === 'analogRead') {
      return {
        kind: 'read',
        mode: 'ANALOG',
        target: targetVar,
        pin: transformExpr(valueNode.children[0]),
      } as ASLStatement;
    }
    if (valueNode.attributes.callee === 'Pin.value') {
      return {
        kind: 'read',
        mode: 'DIGITAL',
        target: targetVar,
        pin: transformExpr(valueNode.children[0]),
      } as ASLStatement;
    }
  }
  return null;
}

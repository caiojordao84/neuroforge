import { LEDNode } from './LEDNode';
import { RGBLEDNode } from './RGBLEDNode';
import { ButtonNode } from './ButtonNode';
import { ServoNode } from './ServoNode';
import { PotentiometerNode } from './PotentiometerNode';
import { MCUNode } from './MCUNode';

// Node type mapping for React Flow
export const nodeTypes = {
  led: LEDNode,
  rgbLed: RGBLEDNode,
  button: ButtonNode,
  servo: ServoNode,
  potentiometer: PotentiometerNode,
  mcu: MCUNode,
} as const;

export type NodeType = keyof typeof nodeTypes;

export { LEDNode, RGBLEDNode, ButtonNode, ServoNode, PotentiometerNode, MCUNode };

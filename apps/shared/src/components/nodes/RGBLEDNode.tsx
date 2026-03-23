import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface RGBLEDNodeData {
  label?: string;
  isCommonAnode?: boolean;
  r?: number;
  g?: number;
  b?: number;
  brightness?: number;
}

export const RGBLEDNode: React.FC<{ data: RGBLEDNodeData; selected?: boolean }> = ({
  data, selected
}) => {
  const { r = 255, g = 255, b = 255, brightness = 1, isCommonAnode = false } = data;

  // No node real, as cores Red, Green, Blue seriam controladas por PWM vindo do engine.
  // Para o template, mostramos a cor configurada ou um estado "demo".
  const [demoColor, setDemoColor] = useState({ r, g, b });

  // Inversão se for Common Anode:
  // Se Common Anode (+), o pino LOW liga o LED. Se pino é HIGH, LED apaga.
  // Aqui apenas simulamos a cor resultante:
  const dispR = isCommonAnode ? 255 - demoColor.r : demoColor.r;
  const dispG = isCommonAnode ? 255 - demoColor.g : demoColor.g;
  const dispB = isCommonAnode ? 255 - demoColor.b : demoColor.b;

  const rgbColor = `rgb(${Math.round(dispR * brightness)}, ${Math.round(dispG * brightness)}, ${Math.round(dispB * brightness)})`;

  return (
    <div className={cn(
      'relative bg-[#0f172a] border-2 rounded-full w-24 h-24 flex flex-col items-center justify-center p-2 shadow-2xl transition-all',
      selected ? 'border-[#00d9ff] ring-4 ring-[#00d9ff]/20' : 'border-[#1e293b]'
    )}>
      {/* Glow effect */}
      <div 
        className="absolute inset-2 rounded-full blur-xl opacity-50 transition-colors duration-500"
        style={{ backgroundColor: rgbColor }}
      />

      {/* LED Lens */}
      <div 
        className="relative w-12 h-12 rounded-full border border-white/20 shadow-inner flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: rgbColor }}
      >
        <div className="absolute top-1 left-2 w-4 h-2 bg-white/30 rounded-full rotate-[-20deg]" />
      </div>

      <div className="text-[9px] font-bold text-[#9ca3af] uppercase mt-2 z-10">
        {data.label ?? 'RGB LED'}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Top} id="red" 
        style={{ top: -8, left: '25%', background: '#ff4444', border: '2px solid #0a0e14' }} 
        title="Red Channel" />
      <Handle type="target" position={Position.Top} id="green" 
        style={{ top: -8, left: '50%', background: '#44ff44', border: '2px solid #0a0e14' }} 
        title="Green Channel" />
      <Handle type="target" position={Position.Top} id="blue" 
        style={{ top: -8, left: '75%', background: '#4444ff', border: '2px solid #0a0e14' }} 
        title="Blue Channel" />
      <Handle type="target" position={Position.Right} id="common" 
        style={{ right: -8, top: '50%', background: isCommonAnode ? '#00d9ff' : '#555', border: '2px solid #0a0e14' }} 
        title={isCommonAnode ? 'Common Anode (+)' : 'Common Cathode (-)'} />
    </div>
  );
};

export default RGBLEDNode;

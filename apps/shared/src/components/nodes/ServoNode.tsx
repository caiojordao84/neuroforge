import React, { useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

// --- TIPOS ---

type ServoType = 'standard_90' | 'standard_180' | 'standard_270' | 'continuous_360';

interface ServoNodeData {
  label?: string;
  modelName?: string;
  servoType?: ServoType;
  minAngle?: number;
  maxAngle?: number;
  initialAngle?: number;
  initialSpeed?: number;
  smoothing?: number;
}

const PWM_PINS = new Set([3, 5, 6, 9, 10, 11]);

// --- COMPONENTE ---

export const ServoNode: React.FC<{ data: ServoNodeData; id: string; selected?: boolean }> = ({
  data, id, selected
}) => {
  const isContinuous = data.servoType === 'continuous_360';
  
  // No node real, isto viria de subscrição ao engine, mas para o template React:
  const [currentVal, setCurrentVal] = useState(isContinuous ? (data.initialSpeed ?? 0) : (data.initialAngle ?? 90));

  // Visualização do arm
  const angleRad = (((isContinuous ? 90 : currentVal) - 90) * Math.PI) / 180;
  const armX2   = 40 + 28 * Math.sin(angleRad);
  const armY2   = 40 - 28 * Math.cos(angleRad);

  return (
    <div className={cn(
      'relative bg-[#151b24] border-2 rounded-xl transition-all w-32 h-32 flex flex-col items-center justify-between p-2 shadow-xl',
      selected ? 'border-[#00d9ff] ring-4 ring-[#00d9ff]/20' : 'border-[#2d3748]'
    )}>
      {/* Etiqueta superior */}
      <div className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
        {data.label ?? 'Servo'}
      </div>

      {/* SVG do Servo */}
      <svg width="64" height="64" viewBox="0 0 80 80" className="drop-shadow-md">
        {/* Corpo do Servo */}
        <rect x="10" y="25" width="60" height="30" rx="4" fill="#2d3748" />
        <circle cx="40" cy="40" r="18" fill="#1a202c" stroke="#4a5568" strokeWidth="1" />
        
        {/* Braço (Horn) */}
        {!isContinuous ? (
           <line x1="40" y1="40" x2={armX2} y2={armY2} 
                 stroke="#00d9ff" strokeWidth="4" strokeLinecap="round" />
        ) : (
           <circle cx="40" cy="40" r="14" fill="none" stroke="#ff9900" strokeWidth="3" 
                   strokeDasharray="4 2" />
        )}
        
        {/* Centro */}
        <circle cx="40" cy="40" r="5" fill="#e2e8f0" />
      </svg>

      {/* Readout */}
      <div className="mt-1 flex flex-col items-center">
        <span className={cn('text-xs font-mono font-bold', isContinuous ? 'text-[#ff9900]' : 'text-[#00d9ff]')}>
          {isContinuous ? `${currentVal}%` : `${currentVal}°`}
        </span>
        <span className="text-[9px] text-[#4a5568]">{data.modelName ?? 'SG90'}</span>
      </div>

      {/* Handles com labels internos simulados */}
      <Handle type="target" position={Position.Left} id="signal" 
        style={{ left: -8, background: '#00d9ff', border: '2px solid #0a0e14' }} 
        title="Signal (PWM)" />
      <Handle type="target" position={Position.Bottom} id="vcc" 
        style={{ bottom: -8, left: '35%', background: '#ef4444', border: '2px solid #0a0e14' }} 
        title="VCC (+5V)" />
      <Handle type="target" position={Position.Bottom} id="gnd" 
        style={{ bottom: -8, left: '65%', background: '#1a202c', border: '2px solid #0a0e14' }} 
        title="GND" />
    </div>
  );
};

export default ServoNode;

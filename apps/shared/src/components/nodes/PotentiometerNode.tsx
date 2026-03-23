import React, { useCallback, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { taperMap } from '@/lib/potentiometerCalculations';

interface PotentiometerNodeData {
  label?: string;
  resistance?: number;
  taper?: 'linear' | 'log' | 'antilog';
  initialValue?: number;
}

export const PotentiometerNode: React.FC<{ data: PotentiometerNodeData; selected?: boolean }> = ({
  data, selected
}) => {
  const [value, setValue] = useState(data.initialValue ?? 50);
  const dragRef = useRef(false);

  // Mapeamento visual para o dial
  const actualPct = taperMap(value, data.taper ?? 'linear');
  const dialRotation = (actualPct * 270) - 135; // de -135deg a 135deg

  const handleMouseDown = () => { dragRef.current = true; };
  const handleMouseUp   = () => { dragRef.current = false; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    // Lógica simplificada de drag circular/linear para o template
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(100, Math.max(0, (x / rect.width) * 100));
    setValue(Math.round(pct));
  };

  return (
    <div 
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={cn(
        'relative bg-[#151b24] border-2 rounded-2xl w-28 h-28 flex flex-col items-center justify-between p-2 shadow-xl select-none',
        selected ? 'border-[#00d9ff] ring-4 ring-[#00d9ff]/20' : 'border-[#2d3748]'
      )}
    >
      <div className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">
        {data.label ?? 'Potentiometer'}
      </div>

      {/* Dial Visual */}
      <div 
        onMouseDown={handleMouseDown}
        className="relative w-16 h-16 flex items-center justify-center cursor-pointer group"
      >
        {/* Anel Externo */}
        <div className="absolute inset-0 rounded-full bg-[#2d3748] border-2 border-[#4a5568] shadow-inner" />
        
        {/* Indicador de Escala */}
        <div className="absolute inset-0 rounded-full border-t-2 border-[#00d9ff]/30 -rotate-45 m-1" />

        {/* Knob */}
        <div 
          className="w-10 h-10 rounded-full bg-[#1a202c] border border-[#718096] shadow-lg flex items-center justify-center transition-transform duration-75"
          style={{ transform: `rotate(${dialRotation}deg)` }}
        >
          <div className="w-1 h-4 bg-[#00d9ff] rounded-full absolute top-1 shadow-[0_0_8px_#00d9ff]" />
        </div>
      </div>

      {/* Readout */}
      <div className="flex flex-col items-center leading-none mb-1">
        <span className="text-xs font-mono font-bold text-[#00d9ff]">{value}%</span>
        <span className="text-[9px] text-[#4a5568] uppercase">{data.taper ?? 'linear'}</span>
      </div>

      {/* Handles */}
      <Handle type="source" position={Position.Left} id="vcc" 
        style={{ left: -8, bottom: '25%', background: '#ef4444', border: '2px solid #0a0e14' }} />
      <Handle type="source" position={Position.Right} id="signal" 
        style={{ right: -8, top: '50%', background: '#00d9ff', border: '2px solid #0a0e14' }} />
      <Handle type="source" position={Position.Left} id="gnd" 
        style={{ left: -8, top: '25%', background: '#1a202c', border: '2px solid #0a0e14' }} />
    </div>
  );
};

export default PotentiometerNode;

import React, { useEffect, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

interface PotentiometerNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const PotentiometerNode: React.FC<PotentiometerNodeProps> = ({ data, selected, id }) => {
  const [value, setValue] = useState((data.value as number) ?? 512);
  const [percentage, setPercentage] = useState((data.percentage as number) ?? 50);
  const [isDragging, setIsDragging] = useState(false);
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  const [connectedPin, setConnectedPin] = useState<number | undefined>(data.connectedPin as number);

  const { connections } = useConnectionStore();
  const { openWindow } = useUIStore();
  const label = (data.label as string) || 'Pot';

  const handleDoubleClick = useCallback(() => {
    openWindow('properties');
  }, [openWindow]);

  useEffect(() => {
    const checkWiring = () => {
      const signalConnection = connections.find(
        (c) => c.source === `${id}:signal` || c.target === `${id}:signal`
      );

      const hasSignalConnection = !!signalConnection;

      setIsProperlyWired(hasSignalConnection);

      if (signalConnection) {
        const otherEnd = signalConnection.source.startsWith(id)
          ? signalConnection.target
          : signalConnection.source;
        const pinMatch = otherEnd.match(/[AD](\d+)/);
        if (pinMatch) {
          let pinNum = parseInt(pinMatch[1], 10);
          if (otherEnd.includes('A')) {
            pinNum += 14;
          }
          setConnectedPin(pinNum);
        }
      }
    };

    checkWiring();
  }, [connections, id]);

  useEffect(() => {
    if (connectedPin !== undefined && isProperlyWired) {
      simulationEngine.emit('analogChange', {
        pin: connectedPin,
        value,
        percentage,
      });
    }
  }, [value, percentage, connectedPin, isProperlyWired]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    e.preventDefault();
    setIsDragging(true);
    updateValueFromMouse(e);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (isDragging) {
      updateValueFromMouse(e);
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const updateValueFromMouse = useCallback((e: React.MouseEvent) => {
    const svg = e.currentTarget.closest('svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const newPercentage = Math.max(0, Math.min(100, 100 - (y / 70) * 100));
    const newValue = Math.round((newPercentage / 100) * 1023);

    setPercentage(Math.round(newPercentage));
    setValue(newValue);
  }, []);

  const wiperY = 60 - (percentage / 100) * 50;

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg',
        'bg-[#151b24] border-2',
        selected ? 'border-[#00d9ff]' : 'border-[rgba(0,217,255,0.3)]',
        'shadow-lg transition-all duration-200'
      )}
      onDoubleClick={handleDoubleClick}
      title="Double-click to open properties"
    >
      <svg
        width="50"
        height="70"
        viewBox="0 0 50 70"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      >
        <defs>
          <linearGradient id={`potTrack-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00d9ff" />
            <stop offset="100%" stopColor="#0088cc" />
          </linearGradient>

          <linearGradient id={`potWiper-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#666" />
            <stop offset="50%" stopColor="#888" />
            <stop offset="100%" stopColor="#666" />
          </linearGradient>
        </defs>

        <rect
          x="15"
          y="5"
          width="20"
          height="60"
          rx="3"
          fill="#222"
          stroke="#444"
          strokeWidth="2"
        />

        <rect
          x="22"
          y="10"
          width="6"
          height="50"
          rx="1"
          fill={`url(#potTrack-${id})`}
          opacity={0.6}
        />

        {Array.from({ length: 11 }, (_, i) => (
          <line
            key={i}
            x1="18"
            y1={12 + i * 4.5}
            x2="32"
            y2={12 + i * 4.5}
            stroke="#333"
            strokeWidth="1"
          />
        ))}

        <rect
          x="15"
          y="5"
          width="20"
          height="60"
          fill="transparent"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        />

        <g transform={`translate(0, ${wiperY - 30})`}>
          <rect
            x="18"
            y="25"
            width="14"
            height="10"
            rx="2"
            fill={`url(#potWiper-${id})`}
            stroke="#aaa"
            strokeWidth="1"
          />

          <circle
            cx="25"
            cy="30"
            r="3"
            fill="#00d9ff"
          />

          {isDragging && (
            <circle
              cx="25"
              cy="30"
              r="8"
              fill="none"
              stroke="#00d9ff"
              strokeWidth="2"
              opacity={0.5}
            >
              <animate attributeName="r" values="8;12;8" dur="0.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0.2;0.5" dur="0.5s" repeatCount="indefinite" />
            </circle>
          )}
        </g>

        <rect
          x="38"
          y={60 - (percentage / 100) * 50}
          width="4"
          height={(percentage / 100) * 50}
          fill="#00d9ff"
          opacity={0.5}
          rx="1"
        />
      </svg>

      <div className="text-center mt-1">
        <div className="text-[9px] text-[#00d9ff] font-mono">
          {value}
        </div>
        <div className="text-[8px] text-[#9ca3af]">
          {percentage}%
        </div>
      </div>

      {!isProperlyWired && (
        <div
          className={cn(
            'absolute -top-2 -right-2',
            'w-5 h-5 rounded-full bg-yellow-500',
            'flex items-center justify-center',
            'text-[10px] font-bold text-black'
          )}
          title="Potentiometer not properly wired. Connect signal pin to an analog pin."
        >
          !
        </div>
      )}

      <div className="text-center">
        <span className="text-[10px] text-[#9ca3af]">{label}</span>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="signal"
        style={{
          left: -8,
          top: '50%',
          width: 12,
          height: 12,
          background: '#00d9ff',
          border: '2px solid #0a0e14',
        }}
        title="Signal (Wiper)"
      />

      <Handle
        type="target"
        position={Position.Top}
        id="vcc"
        style={{
          top: -8,
          left: '30%',
          width: 12,
          height: 12,
          background: '#ff0000',
          border: '2px solid #0a0e14',
        }}
        title="VCC (+)"
      />

      <Handle
        type="target"
        position={Position.Top}
        id="gnd"
        style={{
          top: -8,
          left: '70%',
          width: 12,
          height: 12,
          background: '#444',
          border: '2px solid #0a0e14',
        }}
        title="GND (-)"
      />
    </div>
  );
};

export default PotentiometerNode;

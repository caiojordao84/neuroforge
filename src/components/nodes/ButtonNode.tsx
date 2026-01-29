import React, { useEffect, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { cn } from '@/lib/utils';

interface ButtonNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const ButtonNode: React.FC<ButtonNodeProps> = ({ data, selected, id }) => {
  const [isPressed, setIsPressed] = useState((data.isPressed as boolean) ?? false);
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  const [connectedPin, setConnectedPin] = useState<number | undefined>(data.connectedPin as number);
  
  const { connections } = useConnectionStore();
  const isPullUp = (data.isPullUp as boolean) ?? false;
  const label = (data.label as string) || 'Button';

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
        const pinMatch = otherEnd.match(/D(\d+)/);
        if (pinMatch) {
          setConnectedPin(parseInt(pinMatch[1], 10));
        }
      }
    };

    checkWiring();
  }, [connections, id]);

  const handleMouseDown = useCallback(() => {
    setIsPressed(true);
    
    if (connectedPin !== undefined) {
      const value = isPullUp ? 'LOW' : 'HIGH';
      
      simulationEngine.emit('buttonPress', { 
        pin: connectedPin, 
        pressed: true,
        value 
      });
    }
  }, [connectedPin, isPullUp]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
    
    if (connectedPin !== undefined) {
      const value = isPullUp ? 'HIGH' : 'LOW';
      
      simulationEngine.emit('buttonPress', { 
        pin: connectedPin, 
        pressed: false,
        value 
      });
    }
  }, [connectedPin, isPullUp]);

  const handleMouseLeave = useCallback(() => {
    if (isPressed) {
      handleMouseUp();
    }
  }, [isPressed, handleMouseUp]);

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg',
        'bg-[#151b24] border-2',
        selected ? 'border-[#00d9ff]' : 'border-[rgba(0,217,255,0.3)]',
        'shadow-lg transition-all duration-200'
      )}
    >
      <svg 
        width="60" 
        height="60" 
        viewBox="0 0 60 60"
        className="cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        <defs>
          <linearGradient id={`buttonGradient-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isPressed ? '#333' : '#555'} />
            <stop offset="100%" stopColor={isPressed ? '#222' : '#444'} />
          </linearGradient>

          <filter id={`buttonShadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy={isPressed ? '1' : '3'} stdDeviation="2" floodOpacity="0.5" />
          </filter>
        </defs>

        <rect
          x="5"
          y={isPressed ? '8' : '5'}
          width="50"
          height="50"
          rx="8"
          fill="#333"
          stroke="#555"
          strokeWidth="2"
        />

        <rect
          x="8"
          y={isPressed ? '10' : '5'}
          width="44"
          height="44"
          rx="6"
          fill={`url(#buttonGradient-${id})`}
          filter={`url(#buttonShadow-${id})`}
          style={{ transition: 'all 0.05s ease-out' }}
        />

        <rect
          x="12"
          y={isPressed ? '12' : '8'}
          width="36"
          height="18"
          rx="4"
          fill="white"
          opacity={isPressed ? 0.05 : 0.15}
          style={{ transition: 'all 0.05s ease-out' }}
        />

        {isPressed && (
          <circle cx="30" cy="30" r="8" fill="#00d9ff" opacity={0.5}>
            <animate attributeName="opacity" values="0.5;0.8;0.5" dur="0.2s" repeatCount="indefinite" />
          </circle>
        )}

        <text
          x="30"
          y={isPressed ? '36' : '35'}
          textAnchor="middle"
          fill={isPressed ? '#00d9ff' : '#888'}
          fontSize="12"
          fontFamily="monospace"
          fontWeight="bold"
          style={{ transition: 'all 0.05s ease-out' }}
        >
          {isPressed ? 'ON' : 'OFF'}
        </text>
      </svg>

      <div
        className={cn(
          'absolute top-1 right-1 w-2 h-2 rounded-full',
          isPressed ? 'bg-green-400' : 'bg-gray-600',
          'transition-colors duration-75'
        )}
      />

      {!isProperlyWired && (
        <div
          className={cn(
            'absolute -top-2 -right-2',
            'w-5 h-5 rounded-full bg-yellow-500',
            'flex items-center justify-center',
            'text-[10px] font-bold text-black'
          )}
          title="Button not properly wired. Connect signal pin to a digital pin."
        >
          !
        </div>
      )}

      <div className="text-center mt-1">
        <span className="text-[10px] text-[#9ca3af]">{label}</span>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        id="signal"
        style={{
          top: -8,
          width: 12,
          height: 12,
          background: '#00d9ff',
          border: '2px solid #0a0e14',
        }}
        title="Signal"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="ground"
        style={{
          bottom: -8,
          width: 12,
          height: 12,
          background: '#444',
          border: '2px solid #0a0e14',
        }}
        title="Ground"
      />
    </div>
  );
};

export default ButtonNode;

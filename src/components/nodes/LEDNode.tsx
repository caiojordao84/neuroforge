import React, { useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { cn } from '@/lib/utils';

interface LEDNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const LEDNode: React.FC<LEDNodeProps> = ({ data, selected, id }) => {
  const [isOn, setIsOn] = useState((data.isOn as boolean) ?? false);
  const [brightness, setBrightness] = useState((data.brightness as number) ?? 255);
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  const color = (data.color as string) || '#ff0000';
  const connectedPins = (data.connectedPins as Record<string, number | undefined>) || {};
  const label = (data.label as string) || 'LED';
  
  const { connections } = useConnectionStore();

  useEffect(() => {
    const checkWiring = () => {
      const anodeConnection = connections.find(
        (c) => c.source === `${id}:anode` || c.target === `${id}:anode`
      );
      const cathodeConnection = connections.find(
        (c) => c.source === `${id}:cathode` || c.target === `${id}:cathode`
      );

      const hasAnodeConnection = !!anodeConnection;
      const hasCathodeConnection = !!cathodeConnection;

      setIsProperlyWired(hasAnodeConnection && hasCathodeConnection);

      if (anodeConnection) {
        const otherEnd = anodeConnection.source.startsWith(id)
          ? anodeConnection.target
          : anodeConnection.source;
        const pinMatch = otherEnd.match(/D(\d+)/);
        if (pinMatch) {
          data.connectedPins = { 
            ...connectedPins, 
            anode: parseInt(pinMatch[1], 10) 
          };
        }
      }
    };

    checkWiring();
  }, [connections, data, id, connectedPins]);

  useEffect(() => {
    const unsubscribe = simulationEngine.on('pinChange', (event) => {
      const pinEvent = event as { pin: number; value: 'HIGH' | 'LOW' | number };
      
      if (connectedPins?.anode === pinEvent.pin) {
        if (typeof pinEvent.value === 'number') {
          setIsOn(pinEvent.value > 0);
          setBrightness(pinEvent.value);
        } else {
          setIsOn(pinEvent.value === 'HIGH');
          setBrightness(pinEvent.value === 'HIGH' ? 255 : 0);
        }
      }
    });

    return unsubscribe;
  }, [connectedPins]);

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg',
        'bg-[#151b24] border-2',
        selected ? 'border-[#00d9ff]' : 'border-[rgba(0,217,255,0.3)]',
        'shadow-lg transition-all duration-200'
      )}
    >
      <svg width="60" height="60" viewBox="0 0 60 60">
        <defs>
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={isOn ? 6 : 2} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <radialGradient id={`ledGradient-${id}`} cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.8} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </radialGradient>
        </defs>

        <circle
          cx="30"
          cy="30"
          r="20"
          fill={`url(#ledGradient-${id})`}
          stroke={isOn ? color : '#444'}
          strokeWidth={2}
          filter={isOn ? `url(#glow-${id})` : 'none'}
          style={{
            opacity: isOn ? 0.3 + (brightness / 255) * 0.7 : 0.4,
            transition: 'all 0.1s ease-out',
          }}
        />

        <ellipse
          cx="25"
          cy="20"
          rx="8"
          ry="5"
          fill="white"
          opacity={isOn ? 0.6 : 0.2}
          style={{ transition: 'opacity 0.1s ease-out' }}
        />

        <line x1="22" y1="50" x2="22" y2="60" stroke="#888" strokeWidth="2" />
        <line x1="38" y1="50" x2="38" y2="60" stroke="#888" strokeWidth="2" />
      </svg>

      <div
        className={cn(
          'absolute top-1 right-1 w-2 h-2 rounded-full',
          isOn ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
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
          title="LED not properly wired. Connect anode to pin and cathode to GND."
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
        id="anode"
        style={{
          top: -8,
          width: 12,
          height: 12,
          background: '#00d9ff',
          border: '2px solid #0a0e14',
        }}
        title="Anode (+)"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="cathode"
        style={{
          bottom: -8,
          width: 12,
          height: 12,
          background: '#444',
          border: '2px solid #0a0e14',
        }}
        title="Cathode (-)"
      />
    </div>
  );
};

export default LEDNode;

import React, { useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { cn } from '@/lib/utils';

interface RGBLEDNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const RGBLEDNode: React.FC<RGBLEDNodeProps> = ({ data, selected, id }) => {
  const [rgbColor, setRgbColor] = useState((data.rgbColor as { r: number; g: number; b: number }) ?? { r: 0, g: 0, b: 0 });
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  
  const { connections } = useConnectionStore();
  const isCommonAnode = (data.isCommonAnode as boolean) ?? false;
  const connectedPins = (data.connectedPins as Record<string, number | undefined>) || {};
  const label = (data.label as string) || 'RGB LED';

  useEffect(() => {
    const checkWiring = () => {
      const redConnection = connections.find(
        (c) => c.source === `${id}:red` || c.target === `${id}:red`
      );
      const greenConnection = connections.find(
        (c) => c.source === `${id}:green` || c.target === `${id}:green`
      );
      const blueConnection = connections.find(
        (c) => c.source === `${id}:blue` || c.target === `${id}:blue`
      );
      const commonConnection = connections.find(
        (c) => c.source === `${id}:common` || c.target === `${id}:common`
      );

      const hasColorConnection = redConnection || greenConnection || blueConnection;
      const hasCommonConnection = !!commonConnection;

      setIsProperlyWired(!!hasColorConnection && hasCommonConnection);

      const extractPin = (conn: typeof redConnection) => {
        if (!conn) return undefined;
        const otherEnd = conn.source.startsWith(id) ? conn.target : conn.source;
        const pinMatch = otherEnd.match(/D(\d+)/);
        return pinMatch ? parseInt(pinMatch[1], 10) : undefined;
      };

      data.connectedPins = {
        red: extractPin(redConnection),
        green: extractPin(greenConnection),
        blue: extractPin(blueConnection),
        common: extractPin(commonConnection),
      };
    };

    checkWiring();
  }, [connections, data, id]);

  useEffect(() => {
    const unsubscribe = simulationEngine.on('pinChange', (event) => {
      const pinEvent = event as { pin: number; value: 'HIGH' | 'LOW' | number };
      
      setRgbColor((prev: { r: number; g: number; b: number }) => {
        const newColor = { ...prev };
        
        if (connectedPins?.red === pinEvent.pin) {
          if (typeof pinEvent.value === 'number') {
            newColor.r = pinEvent.value;
          } else {
            newColor.r = pinEvent.value === 'HIGH' ? 255 : 0;
          }
        }
        if (connectedPins?.green === pinEvent.pin) {
          if (typeof pinEvent.value === 'number') {
            newColor.g = pinEvent.value;
          } else {
            newColor.g = pinEvent.value === 'HIGH' ? 255 : 0;
          }
        }
        if (connectedPins?.blue === pinEvent.pin) {
          if (typeof pinEvent.value === 'number') {
            newColor.b = pinEvent.value;
          } else {
            newColor.b = pinEvent.value === 'HIGH' ? 255 : 0;
          }
        }
        
        return newColor;
      });
    });

    return unsubscribe;
  }, [connectedPins]);

  const displayColor = `rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`;
  const isOn = rgbColor.r > 0 || rgbColor.g > 0 || rgbColor.b > 0;

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg',
        'bg-[#151b24] border-2',
        selected ? 'border-[#00d9ff]' : 'border-[rgba(0,217,255,0.3)]',
        'shadow-lg transition-all duration-200'
      )}
    >
      <svg width="70" height="70" viewBox="0 0 70 70">
        <defs>
          <filter id={`rgbGlow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={isOn ? 8 : 3} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id={`rgbGradient-${id}`} cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
            <stop offset="100%" stopColor={displayColor} stopOpacity={1} />
          </radialGradient>
        </defs>

        <circle
          cx="35"
          cy="35"
          r="25"
          fill={`url(#rgbGradient-${id})`}
          stroke={displayColor}
          strokeWidth={2}
          filter={isOn ? `url(#rgbGlow-${id})` : 'none'}
          style={{
            opacity: isOn ? 0.8 : 0.4,
            transition: 'all 0.1s ease-out',
          }}
        />

        <ellipse
          cx="28"
          cy="22"
          rx="10"
          ry="6"
          fill="white"
          opacity={isOn ? 0.5 : 0.2}
          style={{ transition: 'opacity 0.1s ease-out' }}
        />

        <circle cx="35" cy="35" r="28" fill="none" stroke="#ff0000" strokeWidth="1" opacity={0.3} />
        <circle cx="35" cy="35" r="29" fill="none" stroke="#00ff00" strokeWidth="1" opacity={0.3} />
        <circle cx="35" cy="35" r="30" fill="none" stroke="#0000ff" strokeWidth="1" opacity={0.3} />
      </svg>

      <div className="text-center mt-1">
        <div className="text-[9px] text-[#00d9ff] font-mono">
          R:{rgbColor.r} G:{rgbColor.g} B:{rgbColor.b}
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
          title="RGB LED not properly wired. Connect color pins and common pin."
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
        id="red"
        style={{
          left: -8,
          top: '25%',
          width: 12,
          height: 12,
          background: '#ff4444',
          border: '2px solid #0a0e14',
        }}
        title="Red"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="green"
        style={{
          left: -8,
          top: '50%',
          width: 12,
          height: 12,
          background: '#44ff44',
          border: '2px solid #0a0e14',
        }}
        title="Green"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="blue"
        style={{
          left: -8,
          top: '75%',
          width: 12,
          height: 12,
          background: '#4444ff',
          border: '2px solid #0a0e14',
        }}
        title="Blue"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="common"
        style={{
          right: -8,
          top: '50%',
          width: 12,
          height: 12,
          background: isCommonAnode ? '#00d9ff' : '#444',
          border: '2px solid #0a0e14',
        }}
        title={isCommonAnode ? 'Common Anode (+)' : 'Common Cathode (-)'}
      />
    </div>
  );
};

export default RGBLEDNode;

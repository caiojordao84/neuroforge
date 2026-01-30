import React, { useEffect, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

interface ServoNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const ServoNode: React.FC<ServoNodeProps> = ({ data, selected, id }) => {
  const [angle, setAngle] = useState((data.angle as number) ?? 90);
  const [targetAngle, setTargetAngle] = useState((data.angle as number) ?? 90);
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  const [connectedPin, setConnectedPin] = useState<number | undefined>(data.connectedPin as number);

  const { connections } = useConnectionStore();
  const { openWindow } = useUIStore();
  const minAngle = (data.minAngle as number) ?? 0;
  const maxAngle = (data.maxAngle as number) ?? 180;
  const label = (data.label as string) || 'Servo';

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
        const pinMatch = otherEnd.match(/D(\d+)/);
        if (pinMatch) {
          setConnectedPin(parseInt(pinMatch[1], 10));
        }
      }
    };

    checkWiring();
  }, [connections, id]);

  useEffect(() => {
    const unsubscribe = simulationEngine.on('pinChange', (event) => {
      const pinEvent = event as { pin: number; value: 'HIGH' | 'LOW' | number };

      if (connectedPin === pinEvent.pin) {
        if (typeof pinEvent.value === 'number') {
          const newAngle = Math.round((pinEvent.value / 255) * (maxAngle - minAngle) + minAngle);
          setTargetAngle(newAngle);
        }
      }
    });

    return unsubscribe;
  }, [connectedPin, minAngle, maxAngle]);

  useEffect(() => {
    if (angle === targetAngle) return;

    const step = targetAngle > angle ? 2 : -2;
    const interval = setInterval(() => {
      setAngle((prev: number) => {
        const newAngle = prev + step;
        if ((step > 0 && newAngle >= targetAngle) || (step < 0 && newAngle <= targetAngle)) {
          clearInterval(interval);
          return targetAngle;
        }
        return newAngle;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [angle, targetAngle]);

  const armLength = 20;
  const armAngleRad = ((angle - 90) * Math.PI) / 180;
  const armEndX = 35 + armLength * Math.sin(armAngleRad);
  const armEndY = 35 - armLength * Math.cos(armAngleRad);

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
      <svg width="70" height="70" viewBox="0 0 70 70">
        <defs>
          <linearGradient id={`servoBody-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#444" />
            <stop offset="100%" stopColor="#222" />
          </linearGradient>

          <radialGradient id={`servoHorn-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#666" />
            <stop offset="100%" stopColor="#333" />
          </radialGradient>
        </defs>

        <rect
          x="10"
          y="20"
          width="50"
          height="35"
          rx="3"
          fill={`url(#servoBody-${id})`}
          stroke="#555"
          strokeWidth="2"
        />

        <circle cx="15" cy="37" r="2" fill="#111" />
        <circle cx="55" cy="37" r="2" fill="#111" />

        <g transform={`rotate(${angle - 90}, 35, 25)`}>
          <circle
            cx="35"
            cy="25"
            r="12"
            fill={`url(#servoHorn-${id})`}
            stroke="#777"
            strokeWidth="1"
          />

          <rect
            x="33"
            y="13"
            width="4"
            height="20"
            rx="1"
            fill="#555"
          />

          <circle cx="35" cy="25" r="3" fill="#888" />
          <circle cx="35" cy="25" r="1.5" fill="#333" />
        </g>

        <circle
          cx="35"
          cy="25"
          r="14"
          fill="none"
          stroke="#00d9ff"
          strokeWidth="1"
          strokeDasharray="4 2"
          opacity={0.3}
        />

        <line
          x1="35"
          y1="25"
          x2={armEndX}
          y2={armEndY}
          stroke="#00d9ff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.6}
        />

        <path
          d={`M 25 35 A 10 10 0 0 1 ${25 + 10 * Math.cos((angle - 90) * Math.PI / 180)} ${35 + 10 * Math.sin((angle - 90) * Math.PI / 180)}`}
          fill="none"
          stroke="#00d9ff"
          strokeWidth="1"
          opacity={0.5}
        />
      </svg>

      <div className="text-center mt-1">
        <div className="text-[10px] text-[#00d9ff] font-mono font-bold">
          {angle}°
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
          title="Servo not properly wired. Connect signal pin to a PWM-capable pin."
        >
          !
        </div>
      )}

      <div className="text-center">
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
          background: '#ff9900',
          border: '2px solid #0a0e14',
        }}
        title="Signal (PWM)"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="power"
        style={{
          right: -8,
          top: '40%',
          width: 12,
          height: 12,
          background: '#ff0000',
          border: '2px solid #0a0e14',
        }}
        title="Power (VCC)"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="ground"
        style={{
          right: -8,
          top: '70%',
          width: 12,
          height: 12,
          background: '#444',
          border: '2px solid #0a0e14',
        }}
        title="Ground (GND)"
      />
    </div>
  );
};

export default ServoNode;

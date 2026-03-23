Tenho os 3 originais . Vou produzir os 3 nodes actualizados de seguida.

***

## Node 5 — `src/components/nodes/ServoNode.tsx`

```tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

// Pinos PWM standard Arduino
const PWM_PINS = new Set([3, 5, 6, 9, 10, 11]);

interface ServoNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const ServoNode: React.FC<ServoNodeProps> = ({ data, selected, id }) => {
  const servoType     = (data.servoType as string)      ?? 'standard_180';
  const isContinuous  = servoType === 'continuous_360';
  const minAngle      = (data.minAngle as number)       ?? 0;
  const maxAngle      = (data.maxAngle as number)       ?? 180;
  const minPulse      = (data.minPulseWidth as number)  ?? 500;
  const maxPulse      = (data.maxPulseWidth as number)  ?? 2500;
  const smoothing     = (data.smoothing as number)      ?? 0.5;
  const label         = (data.label as string)          || 'Servo';

  // Passo de damping: smoothing 0 → 5.0°/frame, smoothing 1 → 0.5°/frame
  const dampStep = 0.5 + (1 - smoothing) * 4.5;

  // Estado standard
  const initialAngle  = isContinuous ? 90 : ((data.initialAngle as number) ?? 90);
  const [angle, setAngle]             = useState(initialAngle);
  const [targetAngle, setTargetAngle] = useState(initialAngle);

  // Estado continuous
  const initialSpeed  = (data.initialSpeed as number)   ?? 0; // -100 a +100
  const [speed, setSpeed]   = useState(isContinuous ? initialSpeed : 0);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinAngleRef  = useRef(0);

  // Wiring
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  const [connectedPin, setConnectedPin]       = useState<number | undefined>(data.connectedPin as number);
  const [isPwmPin, setIsPwmPin]               = useState(false);
  const [isVccWired, setIsVccWired]           = useState(false);
  const [isGndWired, setIsGndWired]           = useState(false);

  const { connections } = useConnectionStore();
  const { openWindow }  = useUIStore();

  const handleDoubleClick = useCallback(() => openWindow('properties'), [openWindow]);

  // ── Wiring detection ──────────────────────────────────────────────
  useEffect(() => {
    const signalConn = connections.find(
      (c) => c.source === `${id}:signal` || c.target === `${id}:signal`
    );
    const powerConn = connections.find(
      (c) => c.source === `${id}:power` || c.target === `${id}:power`
    );
    const gndConn = connections.find(
      (c) => c.source === `${id}:ground` || c.target === `${id}:ground`
    );

    setIsVccWired(!!powerConn);
    setIsGndWired(!!gndConn);
    setIsProperlyWired(!!signalConn && !!powerConn && !!gndConn);

    if (signalConn) {
      const otherEnd = signalConn.source.startsWith(id)
        ? signalConn.target
        : signalConn.source;
      const match = otherEnd.match(/D(\d+)/);
      if (match) {
        const pin = parseInt(match[1], 10);
        setConnectedPin(pin);
        setIsPwmPin(PWM_PINS.has(pin));
      }
    } else {
      setConnectedPin(undefined);
      setIsPwmPin(false);
    }
  }, [connections, id]);

  // ── pinChange → ângulo / velocidade ───────────────────────────────
  useEffect(() => {
    const unsub = simulationEngine.on('pinChange', (event) => {
      const { pin, value } = event as { pin: number; value: 'HIGH' | 'LOW' | number };
      if (connectedPin !== pin) return;
      if (typeof value !== 'number') return;

      // PWM 0–255 → pulse µs → ângulo / velocidade
      const pulseUs = minPulse + (value / 255) * (maxPulse - minPulse);

      if (isContinuous) {
        // neutral = midPulse → 0; < neutral → negativo (CCW); > → positivo (CW)
        const midPulse = (minPulse + maxPulse) / 2;
        const deadband = 20; // µs de dead-band em volta do neutro
        if (Math.abs(pulseUs - midPulse) < deadband) {
          setSpeed(0);
          setIsSpinning(false);
        } else {
          const spd = ((pulseUs - midPulse) / (maxPulse - midPulse)) * 100;
          setSpeed(Math.round(Math.max(-100, Math.min(100, spd))));
          setIsSpinning(true);
        }
      } else {
        const newAngle = Math.round(
          minAngle + ((pulseUs - minPulse) / (maxPulse - minPulse)) * (maxAngle - minAngle)
        );
        setTargetAngle(Math.max(minAngle, Math.min(maxAngle, newAngle)));
      }
    });
    return unsub;
  }, [connectedPin, isContinuous, minAngle, maxAngle, minPulse, maxPulse]);

  // ── Damping (standard) ────────────────────────────────────────────
  useEffect(() => {
    if (isContinuous || angle === targetAngle) return;
    const step = targetAngle > angle ? dampStep : -dampStep;
    const id_ = setInterval(() => {
      setAngle((prev) => {
        const next = prev + step;
        if ((step > 0 && next >= targetAngle) || (step < 0 && next <= targetAngle)) {
          clearInterval(id_);
          return targetAngle;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(id_);
  }, [angle, targetAngle, dampStep, isContinuous]);

  // ── Animação continuous ───────────────────────────────────────────
  useEffect(() => {
    if (!isContinuous || !isSpinning || speed === 0) return;
    const degreesPerFrame = (speed / 100) * 6; // max ~360°/s @ 60fps
    const id_ = setInterval(() => {
      spinAngleRef.current = (spinAngleRef.current + degreesPerFrame + 360) % 360;
      setAngle(spinAngleRef.current);
    }, 16);
    return () => clearInterval(id_);
  }, [isContinuous, isSpinning, speed]);

  // ── SVG helpers ───────────────────────────────────────────────────
  const armRad     = ((angle - 90) * Math.PI) / 180;
  const armLength  = 20;
  const armEndX    = 35 + armLength * Math.sin(armRad);
  const armEndY    = 35 - armLength * Math.cos(armRad);

  // Arco de range visual (standard)
  const arcStartRad = ((minAngle - 90) * Math.PI) / 180;
  const arcEndRad   = ((maxAngle - 90) * Math.PI) / 180;
  const arcR = 22;
  const arcSx = 35 + arcR * Math.sin(arcStartRad);
  const arcSy = 35 - arcR * Math.cos(arcStartRad);
  const arcEx = 35 + arcR * Math.sin(arcEndRad);
  const arcEy = 35 - arcR * Math.cos(arcEndRad);
  const largeArc = (maxAngle - minAngle) > 180 ? 1 : 0;

  // Cor da badge de velocidade
  const speedColor = speed > 0 ? '#00d9ff' : speed < 0 ? '#ff9900' : '#9ca3af';

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg bg-[#151b24] border-2 shadow-lg transition-all duration-200',
        selected ? 'border-[#00d9ff]' : 'border-[rgba(0,217,255,0.3)]'
      )}
      onDoubleClick={handleDoubleClick}
      title="Double-click to open properties"
    >
      <svg width="70" height="70" viewBox="0 0 70 70">
        <defs>
          <linearGradient id={`servoBody-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#444" />
            <stop offset="100%" stopColor="#222" />
          </linearGradient>
          <radialGradient id={`servoHorn-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#666" />
            <stop offset="100%" stopColor="#333" />
          </radialGradient>
        </defs>

        {/* Corpo */}
        <rect x="10" y="20" width="50" height="35" rx="3"
          fill={`url(#servoBody-${id})`} stroke="#555" strokeWidth="2" />
        <circle cx="15" cy="37" r="2" fill="#111" />
        <circle cx="55" cy="37" r="2" fill="#111" />

        {/* Arco de range (standard) */}
        {!isContinuous && (
          <path
            d={`M ${arcSx} ${arcSy} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEx} ${arcEy}`}
            fill="none" stroke="#00d9ff" strokeWidth="1"
            strokeDasharray="3 2" opacity={0.25}
          />
        )}

        {/* Arco continuous */}
        {isContinuous && (
          <circle cx="35" cy="35" r={arcR}
            fill="none" stroke="#ff9900" strokeWidth="1"
            strokeDasharray="4 2" opacity={0.25}
          />
        )}

        {/* Horn + braço */}
        <g transform={`rotate(${angle - 90}, 35, 35)`}>
          <circle cx="35" cy="35" r="12"
            fill={`url(#servoHorn-${id})`} stroke="#777" strokeWidth="1" />
          <rect x="33" y="18" width="4" height="20" rx="1" fill="#555" />
          <circle cx="35" cy="35" r="3" fill="#888" />
          <circle cx="35" cy="35" r="1.5" fill="#333" />
        </g>

        {/* Linha do braço */}
        <line x1="35" y1="35" x2={armEndX} y2={armEndY}
          stroke="#00d9ff" strokeWidth="2" strokeLinecap="round" opacity={0.7} />

        {/* Anel de guia */}
        <circle cx="35" cy="35" r="14"
          fill="none" stroke="#00d9ff" strokeWidth="1"
          strokeDasharray="4 2" opacity={0.2} />
      </svg>

      {/* Readout */}
      <div className="text-center mt-1">
        {isContinuous ? (
          <div style={{ color: speedColor }}
            className="text-[10px] font-mono font-bold">
            {speed > 0 ? `CW ${speed}%` : speed < 0 ? `CCW ${Math.abs(speed)}%` : 'STOP'}
          </div>
        ) : (
          <div className="text-[10px] text-[#00d9ff] font-mono font-bold">
            {Math.round(angle)}° / {maxAngle}°
          </div>
        )}
      </div>

      {/* Warning badges */}
      {!isProperlyWired && (
        <div className={cn(
          'absolute -top-2 -right-2 w-5 h-5 rounded-full bg-yellow-500',
          'flex items-center justify-center text-[10px] font-bold text-black'
        )}
          title="Servo not fully wired. Connect signal (PWM), VCC and GND."
        >!</div>
      )}
      {isProperlyWired && !isPwmPin && (
        <div className={cn(
          'absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500',
          'flex items-center justify-center text-[10px] font-bold text-white'
        )}
          title={`D${connectedPin} is not PWM-capable. Use D3/D5/D6/D9/D10/D11.`}
        >~</div>
      )}

      <div className="text-center">
        <span className="text-[10px] text-[#9ca3af]">{label}</span>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Top} id="signal"
        style={{ top: -8, width: 12, height: 12,
          background: isPwmPin ? '#ff9900' : '#cc4400',
          border: '2px solid #0a0e14' }}
        title="Signal (PWM)" />
      <Handle type="target" position={Position.Right} id="power"
        style={{ right: -8, top: '40%', width: 12, height: 12,
          background: isVccWired ? '#ff4444' : '#662222',
          border: '2px solid #0a0e14' }}
        title="Power (VCC)" />
      <Handle type="target" position={Position.Right} id="ground"
        style={{ right: -8, top: '70%', width: 12, height: 12,
          background: isGndWired ? '#888' : '#333',
          border: '2px solid #0a0e14' }}
        title="Ground (GND)" />
    </div>
  );
};

export default ServoNode;
```

***

## Node 6 — `src/components/nodes/PotentiometerNode.tsx`

```tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';
import { taperMap } from '@/lib/potentiometerCalculations';

interface PotentiometerNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const PotentiometerNode: React.FC<PotentiometerNodeProps> = ({ data, selected, id }) => {
  const taper    = (data.taper as 'linear' | 'log' | 'antilog') ?? 'linear';
  const label    = (data.label as string) || 'Pot';
  const initPct  = (data.initialValue as number) ?? 50;

  const [percentage,    setPercentage]    = useState(initPct);
  const [adcValue,      setAdcValue]      = useState(Math.round(taperMap(initPct, taper) * 1023));
  const [voltage,       setVoltage]       = useState(taperMap(initPct, taper) * 5.0);
  const [isDragging,    setIsDragging]    = useState(false);
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  const [connectedPin,  setConnectedPin]  = useState<number | undefined>(undefined);
  const [isAnalogPin,   setIsAnalogPin]   = useState(false);
  const [isVccWired,    setIsVccWired]    = useState(false);
  const [isGndWired,    setIsGndWired]    = useState(false);

  const { connections } = useConnectionStore();
  const { openWindow }  = useUIStore();
  const dragRef = useRef(false);

  const handleDoubleClick = useCallback(() => openWindow('properties'), [openWindow]);

  // ── Wiring detection ──────────────────────────────────────────────
  useEffect(() => {
    const signalConn = connections.find(
      (c) => c.source === `${id}:signal` || c.target === `${id}:signal`
    );
    const vccConn = connections.find(
      (c) => c.source === `${id}:vcc` || c.target === `${id}:vcc`
    );
    const gndConn = connections.find(
      (c) => c.source === `${id}:gnd` || c.target === `${id}:gnd`
    );

    setIsVccWired(!!vccConn);
    setIsGndWired(!!gndConn);
    setIsProperlyWired(!!signalConn && !!vccConn && !!gndConn);

    if (signalConn) {
      const otherEnd = signalConn.source.startsWith(id)
        ? signalConn.target
        : signalConn.source;
      const matchA = otherEnd.match(/A(\d+)/);
      const matchD = otherEnd.match(/D(\d+)/);
      if (matchA) {
        const pin = parseInt(matchA[1], 10) + 14;
        setConnectedPin(pin);
        setIsAnalogPin(true);
      } else if (matchD) {
        setConnectedPin(parseInt(matchD[1], 10));
        setIsAnalogPin(false);
      }
    } else {
      setConnectedPin(undefined);
      setIsAnalogPin(false);
    }
  }, [connections, id]);

  // ── Emit analógico quando wiper muda ─────────────────────────────
  const emitAnalog = useCallback((pct: number) => {
    const mapped = Math.round(taperMap(pct, taper) * 1023);
    const v      = taperMap(pct, taper) * 5.0;
    setAdcValue(mapped);
    setVoltage(v);
    if (connectedPin !== undefined && isProperlyWired) {
      simulationEngine.externalAnalogWrite(connectedPin, mapped);
    }
  }, [connectedPin, isProperlyWired, taper]);

  // Actualiza emissão quando conexão muda
  useEffect(() => {
    emitAnalog(percentage);
  }, [connectedPin, isProperlyWired]);

  // ── Drag no SVG ───────────────────────────────────────────────────
  const updateFromMouse = useCallback((e: React.MouseEvent) => {
    const svg = (e.currentTarget as Element).closest('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const y    = e.clientY - rect.top;
    const pct  = Math.max(0, Math.min(100, 100 - (y / 70) * 100));
    setPercentage(Math.round(pct));
    emitAnalog(pct);
  }, [emitAnalog]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    e.preventDefault();
    dragRef.current = true;
    setIsDragging(true);
    updateFromMouse(e);
  }, [updateFromMouse]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (!dragRef.current) return;
    updateFromMouse(e);
  }, [updateFromMouse]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = false;
    setIsDragging(false);
  }, []);

  // ── Posição visual do wiper ───────────────────────────────────────
  const wiperY      = 60 - (percentage / 100) * 50;
  const fillHeight  = (percentage / 100) * 50;

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg bg-[#151b24] border-2 shadow-lg transition-all duration-200',
        selected ? 'border-[#00d9ff]' : 'border-[rgba(0,217,255,0.3)]'
      )}
      onDoubleClick={handleDoubleClick}
      title="Double-click to open properties"
    >
      <svg
        width="50" height="70" viewBox="0 0 50 70"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn('nodrag', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
      >
        <defs>
          <linearGradient id={`potTrack-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#00d9ff" />
            <stop offset="100%" stopColor="#0088cc" />
          </linearGradient>
          <linearGradient id={`potWiper-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#666" />
            <stop offset="50%"  stopColor="#888" />
            <stop offset="100%" stopColor="#666" />
          </linearGradient>
        </defs>

        {/* Corpo */}
        <rect x="15" y="5" width="20" height="60" rx="3"
          fill="#222" stroke="#444" strokeWidth="2" />

        {/* Track */}
        <rect x="22" y="10" width="6" height="50" rx="1"
          fill={`url(#potTrack-${id})`} opacity={0.6} />

        {/* Marcas */}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1="18" y1={12 + i * 4.5}
            x2="32" y2={12 + i * 4.5}
            stroke="#333" strokeWidth="1" />
        ))}

        {/* Hitbox drag */}
        <rect x="15" y="5" width="20" height="60" fill="transparent"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove} />

        {/* Wiper */}
        <g transform={`translate(0, ${wiperY - 30})`}>
          <rect x="18" y="25" width="14" height="10" rx="2"
            fill={`url(#potWiper-${id})`} stroke="#aaa" strokeWidth="1" />
          <circle cx="25" cy="30" r="3" fill="#00d9ff" />
          {isDragging && (
            <circle cx="25" cy="30" r="8"
              fill="none" stroke="#00d9ff" strokeWidth="2" opacity={0.5}>
              <animate attributeName="r" values="8;12;8" dur="0.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0.2;0.5" dur="0.5s" repeatCount="indefinite" />
            </circle>
          )}
        </g>

        {/* Barra de nível (taper-aware) */}
        <rect
          x="38"
          y={60 - Math.round(taperMap(percentage, taper) * 50)}
          width="4"
          height={Math.round(taperMap(percentage, taper) * 50)}
          fill="#00d9ff" opacity={0.5} rx="1"
        />
      </svg>

      {/* Readout */}
      <div className="text-center mt-1">
        <div className="text-[9px] text-[#00d9ff] font-mono">{adcValue}</div>
        <div className="text-[8px] text-[#9ca3af]">{percentage}% · {voltage.toFixed(2)}V</div>
      </div>

      {/* Warnings */}
      {!isProperlyWired && (
        <div className={cn(
          'absolute -top-2 -right-2 w-5 h-5 rounded-full bg-yellow-500',
          'flex items-center justify-center text-[10px] font-bold text-black'
        )}
          title="Potentiometer not fully wired. Connect signal, VCC and GND."
        >!</div>
      )}
      {isProperlyWired && !isAnalogPin && (
        <div className={cn(
          'absolute -top-2 -right-2 w-5 h-5 rounded-full bg-orange-500',
          'flex items-center justify-center text-[10px] font-bold text-black'
        )}
          title={`D${connectedPin} is digital — use A0–A5 for analogRead().`}
        >A</div>
      )}

      <div className="text-center">
        <span className="text-[10px] text-[#9ca3af]">{label}</span>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="signal"
        style={{ left: -8, top: '50%', width: 12, height: 12,
          background: isAnalogPin ? '#00d9ff' : '#cc8800',
          border: '2px solid #0a0e14' }}
        title="Signal (Wiper)" />
      <Handle type="target" position={Position.Top} id="vcc"
        style={{ top: -8, left: '30%', width: 12, height: 12,
          background: isVccWired ? '#ff4444' : '#662222',
          border: '2px solid #0a0e14' }}
        title="VCC (+)" />
      <Handle type="target" position={Position.Top} id="gnd"
        style={{ top: -8, left: '70%', width: 12, height: 12,
          background: isGndWired ? '#888' : '#333',
          border: '2px solid #0a0e14' }}
        title="GND (−)" />
    </div>
  );
};

export default PotentiometerNode;
```

***

## Node 7 — `src/components/nodes/RGBLEDNode.tsx`

```tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';
import { hslToRgb } from '@/lib/colorUtils';

interface RGBLEDNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

type RGB = { r: number; g: number; b: number };

export const RGBLEDNode: React.FC<RGBLEDNodeProps> = ({ data, selected, id }) => {
  const isCommonAnode  = (data.isCommonAnode as boolean) ?? false;
  const initialState   = (data.initialState as string)   ?? 'off';
  const pulseSpeed     = (data.pulseSpeed as number)     ?? 1;
  const rainbowSpeed   = (data.rainbowSpeed as number)   ?? 1;
  const brightness     = (data.brightness as number)     ?? 1;
  const dataR          = (data.r as number) ?? 255;
  const dataG          = (data.g as number) ?? 255;
  const dataB          = (data.b as number) ?? 255;
  const label          = (data.label as string) || 'RGB LED';

  // Estado de cor — runtime (pinChange) e demo (parado)
  const [rgbColor,   setRgbColor]   = useState<RGB>({ r: 0, g: 0, b: 0 });
  const [demoColor,  setDemoColor]  = useState<RGB>({ r: 0, g: 0, b: 0 });
  const [isRunning,  setIsRunning]  = useState(false);

  // Wiring
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  const [connectedPins, setConnectedPins] = useState<{
    red?: number; green?: number; blue?: number; common?: number;
  }>({});

  // flag para interromper pulse/rainbow quando pinChange toma controlo
  const pinControlledRef = useRef(false);

  const { connections } = useConnectionStore();
  const { openWindow }  = useUIStore();

  const handleDoubleClick = useCallback(() => openWindow('properties'), [openWindow]);

  // ── Wiring detection ──────────────────────────────────────────────
  useEffect(() => {
    const extractPin = (handle: string) => {
      const conn = connections.find(
        (c) => c.source === `${id}:${handle}` || c.target === `${id}:${handle}`
      );
      if (!conn) return undefined;
      const other = conn.source.startsWith(id) ? conn.target : conn.source;
      const m = other.match(/D(\d+)/);
      return m ? parseInt(m[1], 10) : undefined;
    };

    const commonConn = connections.find(
      (c) => c.source === `${id}:common` || c.target === `${id}:common`
    );

    const pins = {
      red:    extractPin('red'),
      green:  extractPin('green'),
      blue:   extractPin('blue'),
      common: (() => {
        if (!commonConn) return undefined;
        const other = commonConn.source.startsWith(id)
          ? commonConn.target
          : commonConn.source;
        const m = other.match(/D(\d+)/);
        return m ? parseInt(m[1], 10) : undefined;
      })(),
    };

    setConnectedPins(pins);
    setIsProperlyWired(
      (!!pins.red || !!pins.green || !!pins.blue) && !!commonConn
    );
  }, [connections, id]);

  // ── simulationEngine running/stopped ─────────────────────────────
  useEffect(() => {
    const onStart = () => { setIsRunning(true);  pinControlledRef.current = false; };
    const onStop  = () => { setIsRunning(false); pinControlledRef.current = false; setRgbColor({ r: 0, g: 0, b: 0 }); };
    simulationEngine.on('start', onStart);
    simulationEngine.on('stop',  onStop);
    return () => {
      simulationEngine.off('start', onStart);
      simulationEngine.off('stop',  onStop);
    };
  }, []);

  // ── pinChange (runtime, prioridade máxima) ────────────────────────
  useEffect(() => {
    const unsub = simulationEngine.on('pinChange', (event) => {
      const { pin, value } = event as { pin: number; value: 'HIGH' | 'LOW' | number };

      const isMyPin = pin === connectedPins.red
        || pin === connectedPins.green
        || pin === connectedPins.blue;
      if (!isMyPin) return;

      // Primeira vez que pin-change chega → cancela efeitos demo
      pinControlledRef.current = true;

      setRgbColor((prev) => {
        const next = { ...prev };
        const toVal = (v: 'HIGH' | 'LOW' | number) =>
          typeof v === 'number' ? v : v === 'HIGH' ? 255 : 0;

        if (pin === connectedPins.red)   next.r = toVal(value);
        if (pin === connectedPins.green) next.g = toVal(value);
        if (pin === connectedPins.blue)  next.b = toVal(value);

        // Common Anode: inverter canais
        if (isCommonAnode) {
          return { r: 255 - next.r, g: 255 - next.g, b: 255 - next.b };
        }
        return next;
      });
    });
    return unsub;
  }, [connectedPins, isCommonAnode]);

  // ── Demo effects (parado ou sem pin-control) ──────────────────────
  useEffect(() => {
    if (isRunning) return; // quando a correr, só pinChange manda

    if (initialState === 'off') {
      setDemoColor({ r: 0, g: 0, b: 0 });
      return;
    }

    if (initialState === 'solid') {
      const brt = brightness;
      setDemoColor({
        r: Math.round(dataR * brt),
        g: Math.round(dataG * brt),
        b: Math.round(dataB * brt),
      });
      return;
    }

    if (initialState === 'pulse') {
      let phase = 0;
      const cycleMs = 2000 / pulseSpeed;
      const id_ = setInterval(() => {
        phase = (phase + 16 / cycleMs) % 1;
        const brt = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
        setDemoColor({
          r: Math.round(dataR * brt),
          g: Math.round(dataG * brt),
          b: Math.round(dataB * brt),
        });
      }, 16);
      return () => clearInterval(id_);
    }

    if (initialState === 'rainbow') {
      let hue = 0;
      const degPerMs = (360 * rainbowSpeed) / 5000;
      const id_ = setInterval(() => {
        hue = (hue + degPerMs * 16) % 360;
        const [r, g, b] = hslToRgb(hue, 1.0, 0.5);
        setDemoColor({ r, g, b });
      }, 16);
      return () => clearInterval(id_);
    }
  }, [isRunning, initialState, pulseSpeed, rainbowSpeed, brightness, dataR, dataG, dataB]);

  // ── Cor activa: runtime se a correr, demo se parado ───────────────
  const activeColor = isRunning ? rgbColor : demoColor;
  const displayCss  = `rgb(${activeColor.r}, ${activeColor.g}, ${activeColor.b})`;
  const isOn        = activeColor.r > 0 || activeColor.g > 0 || activeColor.b > 0;

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg bg-[#151b24] border-2 shadow-lg transition-all duration-200',
        selected ? 'border-[#00d9ff]' : 'border-[rgba(0,217,255,0.3)]'
      )}
      onDoubleClick={handleDoubleClick}
      title="Double-click to open properties"
    >
      <svg width="70" height="70" viewBox="0 0 70 70">
        <defs>
          <filter id={`rgbGlow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={isOn ? 8 : 2} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`rgbGrad-${id}`} cx="40%" cy="30%" r="60%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.9} />
            <stop offset="100%" stopColor={displayCss} stopOpacity={1} />
          </radialGradient>
        </defs>

        {/* Corpo LED */}
        <circle cx="35" cy="35" r="25"
          fill={`url(#rgbGrad-${id})`}
          stroke={isOn ? displayCss : 'rgba(0,217,255,0.2)'}
          strokeWidth={isOn ? 2 : 1}
          filter={isOn ? `url(#rgbGlow-${id})` : 'none'}
          style={{ opacity: isOn ? 0.85 : 0.35, transition: 'all 0.1s ease-out' }}
        />

        {/* Glint */}
        <ellipse cx="27" cy="22" rx="10" ry="6"
          fill="white" opacity={isOn ? 0.45 : 0.15}
          style={{ transition: 'opacity 0.1s ease-out' }}
        />

        {/* Anéis RGB indicativos */}
        <circle cx="35" cy="35" r="28" fill="none" stroke="#ff0000" strokeWidth="1" opacity={0.25} />
        <circle cx="35" cy="35" r="29" fill="none" stroke="#00ff00" strokeWidth="1" opacity={0.25} />
        <circle cx="35" cy="35" r="30" fill="none" stroke="#0000ff" strokeWidth="1" opacity={0.25} />
      </svg>

      {/* Readout */}
      <div className="text-center mt-1">
        <div className="text-[9px] text-[#00d9ff] font-mono">
          {isOn
            ? `${activeColor.r} ${activeColor.g} ${activeColor.b}`
            : '— — —'}
        </div>
      </div>

      {/* Warnings */}
      {!isProperlyWired && (
        <div className={cn(
          'absolute -top-2 -right-2 w-5 h-5 rounded-full bg-yellow-500',
          'flex items-center justify-center text-[10px] font-bold text-black'
        )}
          title="RGB LED not properly wired. Connect color pins and common pin."
        >!</div>
      )}

      <div className="text-center">
        <span className="text-[10px] text-[#9ca3af]">{label}</span>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="red"
        style={{ left: -8, top: '25%', width: 12, height: 12,
          background: '#ff4444', border: '2px solid #0a0e14' }}
        title="Red" />
      <Handle type="target" position={Position.Left} id="green"
        style={{ left: -8, top: '50%', width: 12, height: 12,
          background: '#44ff44', border: '2px solid #0a0e14' }}
        title="Green" />
      <Handle type="target" position={Position.Left} id="blue"
        style={{ left: -8, top: '75%', width: 12, height: 12,
          background: '#4444ff', border: '2px solid #0a0e14' }}
        title="Blue" />
      <Handle type="target" position={Position.Right} id="common"
        style={{ right: -8, top: '50%', width: 12, height: 12,
          background: isCommonAnode ? '#00d9ff' : '#555',
          border: '2px solid #0a0e14' }}
        title={isCommonAnode ? 'Common Anode (+)' : 'Common Cathode (−)'} />
    </div>
  );
};

export default RGBLEDNode;
```

***

**O que mudou em cada node** vs originais :

| Node | Mudanças principais |
|---|---|
| **ServoNode** | `servoType` + `continuous_360` com speed/spin; `dampStep` de `smoothing`; arco SVG de range dinâmico; badges VCC/GND; badge `~` se pin não-PWM; handles mudam cor conforme wiring |
| **PotentiometerNode** | `taperMap` aplicado ao emit + barra lateral taper-aware; readout com tensão; `isAnalogPin` + badge laranja `A` se pino digital; `dragRef` para mouse leave fiável; `emitAnalog` centralizado |
| **RGBLEDNode** | `demoColor` vs `rgbColor`; efeitos `pulse`/`rainbow` com `setInterval` + `hslToRgb`; `pinControlledRef` cancela efeitos quando pinChange chega; `start`/`stop` do engine subscritos; Common Anode inverção correcta |

Tenho todos os 5 originais . Vou produzir os painéis um por um.

***

## Painel 8 — `src/components/ServoPropertiesPanel.tsx`

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Cog, RotateCcw, Save } from 'lucide-react';
import { useConnectionStore } from '@/stores/useConnectionStore';

const PWM_PINS = new Set([3, 5, 6, 9, 10, 11]);

type ServoType = 'standard_90' | 'standard_180' | 'standard_270' | 'continuous_360';

interface ServoModel {
  name: string;
  servoType: ServoType;
  minAngle: number;
  maxAngle: number;
  minPulse: number;
  maxPulse: number;
  voltage: string;
  torque: string;
  current_stall: string;
  notes: string;
}

const servoModels: ServoModel[] = [
  {
    name: 'SG50', servoType: 'standard_90',
    minAngle: 0, maxAngle: 90, minPulse: 500, maxPulse: 2400,
    voltage: '4.8–5V', torque: '1.5 kg·cm @ 4.8V', current_stall: '650mA',
    notes: 'Compact 90° servo. Good for tight space applications.',
  },
  {
    name: 'SG90', servoType: 'standard_180',
    minAngle: 0, maxAngle: 180, minPulse: 500, maxPulse: 2400,
    voltage: '4.8–5V', torque: '1.8 kg·cm @ 4.8V', current_stall: '700mA',
    notes: 'Standard micro servo. Ideal for small robotics.',
  },
  {
    name: 'MG996R', servoType: 'standard_180',
    minAngle: 0, maxAngle: 180, minPulse: 500, maxPulse: 2500,
    voltage: '4.8–7.2V', torque: '9.4 kg·cm @ 4.8V', current_stall: '2500mA',
    notes: 'High-torque metal gear servo.',
  },
  {
    name: 'DS3218', servoType: 'standard_270',
    minAngle: 0, maxAngle: 270, minPulse: 500, maxPulse: 2500,
    voltage: '4.8–6.8V', torque: '21 kg·cm @ 4.8V', current_stall: '1500mA',
    notes: 'Wide-angle servo. 270° travel range.',
  },
  {
    name: 'FS90R', servoType: 'continuous_360',
    minAngle: 0, maxAngle: 360, minPulse: 500, maxPulse: 2500,
    voltage: '4.8–6V', torque: '1.3 kg·cm @ 4.8V', current_stall: '800mA',
    notes: 'Continuous rotation. PWM ~1500µs = stop; <1500µs = CCW; >1500µs = CW.',
  },
];

interface ServoNodeData {
  id?: string;
  label?: string;
  modelName?: string;
  servoType?: ServoType;
  minAngle?: number;
  maxAngle?: number;
  initialAngle?: number;
  initialSpeed?: number;
  minPulseWidth?: number;
  maxPulseWidth?: number;
  pwmFrequency?: number;
  smoothing?: number;
  connectedPin?: number | null;
  isPwmPin?: boolean;
}

export const ServoPropertiesPanel: React.FC = () => {
  const { setNodes }  = useReactFlow();
  const nodes         = useNodes();
  const { connections } = useConnectionStore();
  const selectedNode  = nodes.find((n) => n.selected && n.type === 'servo');

  const [localData, setLocalData] = useState<ServoNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  // ── Inicialização ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as ServoNodeData;

    const signalConn = connections.find(
      (c) => c.source === `${selectedNode.id}:signal` || c.target === `${selectedNode.id}:signal`
    );
    let connectedPin: number | null = d.connectedPin ?? null;
    let isPwmPin = false;
    if (signalConn) {
      const other = signalConn.source.startsWith(selectedNode.id)
        ? signalConn.target : signalConn.source;
      const m = other.match(/D(\d+)/);
      if (m) { connectedPin = parseInt(m[1], 10); isPwmPin = PWM_PINS.has(connectedPin); }
    }

    const modelName = d.modelName ?? 'SG90';
    const model = servoModels.find((m) => m.name === modelName) ?? servoModels[1];

    setLocalData({
      id:            selectedNode.id,
      label:         d.label         ?? 'Servo',
      modelName,
      servoType:     d.servoType     ?? model.servoType,
      minAngle:      d.minAngle      ?? model.minAngle,
      maxAngle:      d.maxAngle      ?? model.maxAngle,
      initialAngle:  d.initialAngle  ?? 90,
      initialSpeed:  d.initialSpeed  ?? 0,
      minPulseWidth: d.minPulseWidth ?? model.minPulse,
      maxPulseWidth: d.maxPulseWidth ?? model.maxPulse,
      pwmFrequency:  d.pwmFrequency  ?? 50,
      smoothing:     d.smoothing     ?? 0.5,
      connectedPin,
      isPwmPin,
    });
    setHasChanges(false);
  }, [selectedNode?.id, connections]);

  const handleChange = useCallback(
    <K extends keyof ServoNodeData>(key: K, value: ServoNodeData[K]) => {
      setLocalData((p) => ({ ...p, [key]: value }));
      setHasChanges(true);
    }, []
  );

  const handleModelChange = useCallback((name: string) => {
    const model = servoModels.find((m) => m.name === name);
    if (!model) return;
    setLocalData((p) => ({
      ...p,
      modelName:     model.name,
      servoType:     model.servoType,
      minAngle:      model.minAngle,
      maxAngle:      model.maxAngle,
      minPulseWidth: model.minPulse,
      maxPulseWidth: model.maxPulse,
    }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    const { isPwmPin, ...persist } = localData;
    setNodes((nds) => nds.map((n) => n.id !== selectedNode.id ? n : {
      ...n,
      data: {
        ...n.data,
        label:         persist.label         ?? 'Servo',
        modelName:     persist.modelName     ?? 'SG90',
        servoType:     persist.servoType     ?? 'standard_180',
        minAngle:      persist.minAngle      ?? 0,
        maxAngle:      persist.maxAngle      ?? 180,
        initialAngle:  persist.initialAngle  ?? 90,
        initialSpeed:  persist.initialSpeed  ?? 0,
        minPulseWidth: persist.minPulseWidth ?? 500,
        maxPulseWidth: persist.maxPulseWidth ?? 2400,
        pwmFrequency:  persist.pwmFrequency  ?? 50,
        smoothing:     persist.smoothing     ?? 0.5,
      },
    }));
    setHasChanges(false);
  }, [selectedNode, localData, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as ServoNodeData;
    const model = servoModels.find((m) => m.name === (d.modelName ?? 'SG90')) ?? servoModels[1];
    setLocalData((p) => ({
      ...p,
      label:         d.label         ?? 'Servo',
      modelName:     d.modelName     ?? 'SG90',
      servoType:     d.servoType     ?? model.servoType,
      minAngle:      d.minAngle      ?? model.minAngle,
      maxAngle:      d.maxAngle      ?? model.maxAngle,
      initialAngle:  d.initialAngle  ?? 90,
      initialSpeed:  d.initialSpeed  ?? 0,
      minPulseWidth: d.minPulseWidth ?? model.minPulse,
      maxPulseWidth: d.maxPulseWidth ?? model.maxPulse,
      pwmFrequency:  d.pwmFrequency  ?? 50,
      smoothing:     d.smoothing     ?? 0.5,
    }));
    setHasChanges(false);
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <Cog className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select a Servo component to edit its properties</p>
      </div>
    );
  }

  const isContinuous = localData.servoType === 'continuous_360';
  const modelInfo    = servoModels.find((m) => m.name === localData.modelName);
  const midPulse     = Math.round(((localData.minPulseWidth ?? 500) + (localData.maxPulseWidth ?? 2500)) / 2);

  // SVG Preview
  const previewAngle    = isContinuous ? 90 : (localData.initialAngle ?? 90);
  const previewArmRad   = ((previewAngle - 90) * Math.PI) / 180;
  const previewArmEndX  = 40 + 28 * Math.sin(previewArmRad);
  const previewArmEndY  = 40 - 28 * Math.cos(previewArmRad);
  const arcStartRad     = (((localData.minAngle ?? 0) - 90) * Math.PI) / 180;
  const arcEndRad       = (((localData.maxAngle ?? 180) - 90) * Math.PI) / 180;
  const arcR            = 32;
  const arcSx = 40 + arcR * Math.sin(arcStartRad);
  const arcSy = 40 - arcR * Math.cos(arcStartRad);
  const arcEx = 40 + arcR * Math.sin(arcEndRad);
  const arcEy = 40 - arcR * Math.cos(arcEndRad);
  const largeArc = ((localData.maxAngle ?? 180) - (localData.minAngle ?? 0)) > 180 ? 1 : 0;

  const speedColor = (localData.initialSpeed ?? 0) > 0
    ? '#00d9ff' : (localData.initialSpeed ?? 0) < 0 ? '#ff9900' : '#9ca3af';

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Cog className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">Servo Properties</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}
            className={cn('h-7 px-3', hasChanges
              ? 'bg-[#00d9ff] text-[#0a0e14]'
              : 'bg-[#1a3a5c] text-[#9ca3af] cursor-not-allowed')}>
            <Save className="w-3.5 h-3.5 mr-1" />Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Identification ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Identification</h3>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">ID</Label>
            <Input value={localData.id ?? selectedNode.id} readOnly
              className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Display Name</Label>
            <Input value={localData.label ?? ''} onChange={(e) => handleChange('label', e.target.value)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Model</Label>
            <Select value={localData.modelName ?? 'SG90'} onValueChange={handleModelChange}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                {servoModels.map((m) => (
                  <SelectItem key={m.name} value={m.name} className="text-[#e6e6e6]">
                    {m.name} ({m.maxAngle === 360 ? '360° cont.' : `${m.maxAngle}°`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Info card do modelo — lookup-only, não persiste */}
            {modelInfo && (
              <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[11px] space-y-1 text-[#9ca3af]">
                <div className="flex justify-between"><span>Voltage</span><span className="text-[#e6e6e6]">{modelInfo.voltage}</span></div>
                <div className="flex justify-between"><span>Torque</span><span className="text-[#e6e6e6]">{modelInfo.torque}</span></div>
                <div className="flex justify-between"><span>Stall current</span><span className="text-[#e6e6e6]">{modelInfo.current_stall}</span></div>
                <p className="text-[10px] pt-1 border-t border-[rgba(0,217,255,0.1)]">{modelInfo.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Wiring (read-only) ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Wiring</h3>
          <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Signal Pin</span>
              {localData.connectedPin != null ? (
                <span className={localData.isPwmPin ? 'text-green-400' : 'text-red-400'}>
                  D{localData.connectedPin} {localData.isPwmPin ? '(PWM) ✓' : '⚠ not PWM'}
                </span>
              ) : (
                <span className="text-yellow-400">Not connected ⚠</span>
              )}
            </div>
          </div>
          {localData.connectedPin != null && !localData.isPwmPin && (
            <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/40 text-[11px] text-red-300">
              ⚠ Pin D{localData.connectedPin} is not PWM-capable. Use D3/D5/D6/D9/D10/D11.
            </div>
          )}
        </div>

        {/* ── Motion Configuration ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Motion Configuration</h3>
          {!isContinuous ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[#9ca3af] text-xs">Min Angle (°)</Label>
                  <Input type="number" value={localData.minAngle ?? ''} readOnly
                    className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-sm h-8" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#9ca3af] text-xs">Max Angle (°)</Label>
                  <Input type="number" value={localData.maxAngle ?? ''} readOnly
                    className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-sm h-8" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-[#9ca3af] text-xs">Initial Angle (°)</Label>
                  <span className="text-[#00d9ff] text-xs">{localData.initialAngle ?? 90}°</span>
                </div>
                <input type="range"
                  min={localData.minAngle ?? 0} max={localData.maxAngle ?? 180} step={1}
                  value={localData.initialAngle ?? 90}
                  onChange={(e) => handleChange('initialAngle', parseInt(e.target.value))}
                  className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-[#9ca3af] text-xs">PWM Neutral (µs)</Label>
                <Input value={`${midPulse} µs`} readOnly
                  className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-sm h-8" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-[#9ca3af] text-xs">Initial Speed (%)</Label>
                  <span style={{ color: speedColor }} className="text-xs font-mono">
                    {(localData.initialSpeed ?? 0) > 0
                      ? `CW +${localData.initialSpeed}%`
                      : (localData.initialSpeed ?? 0) < 0
                      ? `CCW ${localData.initialSpeed}%`
                      : 'STOP'}
                  </span>
                </div>
                <input type="range" min="-100" max="100" step="5"
                  value={localData.initialSpeed ?? 0}
                  onChange={(e) => handleChange('initialSpeed', parseInt(e.target.value))}
                  className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
                <div className="flex justify-between text-[10px] text-[#9ca3af]">
                  <span>−100% CCW ({localData.minPulseWidth}µs)</span>
                  <span>STOP</span>
                  <span>+100% CW ({localData.maxPulseWidth}µs)</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── PWM Configuration ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">PWM Configuration</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[#9ca3af] text-xs">Min Pulse (µs)</Label>
              <Input type="number" value={localData.minPulseWidth ?? ''}
                onChange={(e) => handleChange('minPulseWidth', parseInt(e.target.value))}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#9ca3af] text-xs">Max Pulse (µs)</Label>
              <Input type="number" value={localData.maxPulseWidth ?? ''}
                onChange={(e) => handleChange('maxPulseWidth', parseInt(e.target.value))}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">PWM Frequency (Hz)</Label>
            <Input type="number" value={localData.pwmFrequency ?? 50}
              onChange={(e) => handleChange('pwmFrequency', parseInt(e.target.value))}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
          {/* PWM Mapping read-only */}
          <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[10px] text-[#9ca3af] space-y-1">
            <div className="flex justify-between">
              <span>PWM 0/255</span>
              <span>{localData.minAngle ?? 0}° ({localData.minPulseWidth}µs)</span>
            </div>
            <div className="flex justify-between">
              <span>PWM 127/255</span>
              <span>{Math.round(((localData.minAngle ?? 0) + (localData.maxAngle ?? 180)) / 2)}° ({midPulse}µs)</span>
            </div>
            <div className="flex justify-between">
              <span>PWM 255/255</span>
              <span>{localData.maxAngle ?? 180}° ({localData.maxPulseWidth}µs)</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-[#9ca3af] text-xs">Movement Damping</Label>
              <span className="text-[#00d9ff] text-xs">{Math.round((localData.smoothing ?? 0.5) * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05"
              value={localData.smoothing ?? 0.5}
              onChange={(e) => handleChange('smoothing', parseFloat(e.target.value))}
              className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
            <p className="text-[10px] text-[#9ca3af]">0% = instant snap, 100% = slow & smooth</p>
          </div>
        </div>

        {/* ── Preview ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Preview</h3>
          <div className="flex flex-col items-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
            <svg width="80" height="80" viewBox="0 0 80 80">
              {/* Arco de range */}
              {!isContinuous ? (
                <path
                  d={`M ${arcSx} ${arcSy} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEx} ${arcEy}`}
                  fill="none" stroke="#00d9ff" strokeWidth="1.5"
                  strokeDasharray="3 2" opacity={0.35}
                />
              ) : (
                <circle cx="40" cy="40" r={arcR}
                  fill="none" stroke="#ff9900" strokeWidth="1.5"
                  strokeDasharray="4 2" opacity={0.35} />
              )}
              {/* Anel guia */}
              <circle cx="40" cy="40" r="18"
                fill="none" stroke="#00d9ff" strokeWidth="1" opacity={0.2} />
              {/* Centro */}
              <circle cx="40" cy="40" r="5" fill="#333" stroke="#555" strokeWidth="1" />
              {/* Braço */}
              {!isContinuous && (
                <line x1="40" y1="40" x2={previewArmEndX} y2={previewArmEndY}
                  stroke="#00d9ff" strokeWidth="2.5" strokeLinecap="round" />
              )}
              {/* Indicador continuous */}
              {isContinuous && (
                <>
                  <path d="M 40 12 Q 62 18 62 40" fill="none" stroke="#ff9900" strokeWidth="2"
                    markerEnd="url(#arrow)" opacity={0.7} />
                  <text x="40" y="44" textAnchor="middle" fontSize="9"
                    fill={(localData.initialSpeed ?? 0) === 0 ? '#9ca3af' : '#ff9900'}>
                    {(localData.initialSpeed ?? 0) > 0 ? 'CW'
                      : (localData.initialSpeed ?? 0) < 0 ? 'CCW' : 'STOP'}
                  </text>
                </>
              )}
            </svg>
            <div className="text-xs text-[#9ca3af] mt-1">
              {isContinuous
                ? `Speed: ${localData.initialSpeed ?? 0}%`
                : `${localData.initialAngle ?? 90}° / ${localData.maxAngle ?? 180}°`}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ServoPropertiesPanel;
```

***

## Painel 9 — `src/components/RGBLEDPropertiesPanel.tsx`

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Palette, RotateCcw, Save } from 'lucide-react';
import {
  resistorOptions, calculateRealCurrent, getSafetyStatus,
  getActiveMicrocontrollerProfile, type ResistorOption,
} from '@/lib/ledCalculations';
import { useConnectionStore } from '@/stores/useConnectionStore';

interface RGBLEDNodeData {
  id?: string;
  label?: string;
  isCommonAnode?: boolean;
  r?: number; g?: number; b?: number;
  brightness?: number;
  initialState?: 'off' | 'solid' | 'rainbow' | 'pulse';
  pulseSpeed?: number;
  rainbowSpeed?: number;
  rForwardVoltage?: number;
  gForwardVoltage?: number;
  bForwardVoltage?: number;
  rResistor?: ResistorOption;
  gResistor?: ResistorOption;
  bResistor?: ResistorOption;
  rCustomResistance?: number;
  gCustomResistance?: number;
  bCustomResistance?: number;
  nominalCurrent?: number;
}

function calcChannel(
  vf: number,
  resistor: ResistorOption,
  custom: number | undefined,
  iNom: number
): { current_ma: number; status: string } {
  const mcu = getActiveMicrocontrollerProfile();
  const R   = resistor === 'USER' ? (custom ?? 220) : resistor;
  const I   = calculateRealCurrent(mcu.v_out, vf, R);
  return {
    current_ma: parseFloat((I * 1000).toFixed(1)),
    status:     getSafetyStatus(I, iNom, mcu.max_ma),
  };
}

const statusColors: Record<string, string> = {
  safe:    'text-green-400',
  warning: 'text-yellow-400',
  error:   'text-orange-400',
  burned:  'text-red-400',
};

export const RGBLEDPropertiesPanel: React.FC = () => {
  const { setNodes }    = useReactFlow();
  const nodes           = useNodes();
  const { connections } = useConnectionStore();
  const selectedNode    = nodes.find((n) => n.selected && n.type === 'rgbLed');

  const [localData, setLocalData] = useState<RGBLEDNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  // ── Pin mapping (read-only) ───────────────────────────────────────
  const extractPin = (handle: string) => {
    const conn = connections.find(
      (c) => c.source === `${selectedNode?.id}:${handle}`
            || c.target === `${selectedNode?.id}:${handle}`
    );
    if (!conn || !selectedNode) return null;
    const other = conn.source.startsWith(selectedNode.id) ? conn.target : conn.source;
    const m = other.match(/D(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };
  const pinR      = extractPin('red');
  const pinG      = extractPin('green');
  const pinB      = extractPin('blue');
  const commonConn = connections.find(
    (c) => c.source === `${selectedNode?.id}:common`
          || c.target === `${selectedNode?.id}:common`
  );

  // ── Inicialização ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as RGBLEDNodeData;
    setLocalData({
      id:               selectedNode.id,
      label:            d.label            ?? 'RGB LED',
      isCommonAnode:    d.isCommonAnode     ?? false,
      r:                d.r                ?? 255,
      g:                d.g                ?? 255,
      b:                d.b                ?? 255,
      brightness:       d.brightness       ?? 1,
      initialState:     d.initialState     ?? 'off',
      pulseSpeed:       d.pulseSpeed       ?? 1,
      rainbowSpeed:     d.rainbowSpeed     ?? 1,
      rForwardVoltage:  d.rForwardVoltage  ?? 2.0,
      gForwardVoltage:  d.gForwardVoltage  ?? 3.2,
      bForwardVoltage:  d.bForwardVoltage  ?? 3.2,
      rResistor:        d.rResistor        ?? 220,
      gResistor:        d.gResistor        ?? 220,
      bResistor:        d.bResistor        ?? 220,
      rCustomResistance: d.rCustomResistance,
      gCustomResistance: d.gCustomResistance,
      bCustomResistance: d.bCustomResistance,
      nominalCurrent:   d.nominalCurrent   ?? 0.020,
    });
    setHasChanges(false);
  }, [selectedNode?.id, connections]);

  const handleChange = useCallback(
    <K extends keyof RGBLEDNodeData>(key: K, value: RGBLEDNodeData[K]) => {
      setLocalData((p) => ({ ...p, [key]: value }));
      setHasChanges(true);
    }, []
  );

  // Sync color picker ↔ R/G/B
  const handleColorPicker = useCallback((hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setLocalData((p) => ({ ...p, r, g, b }));
    setHasChanges(true);
  }, []);

  const hexFromRGB = () => {
    const r = (localData.r ?? 255).toString(16).padStart(2, '0');
    const g = (localData.g ?? 255).toString(16).padStart(2, '0');
    const b = (localData.b ?? 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  const handleResistor = useCallback((ch: 'r' | 'g' | 'b', v: string) => {
    const key = `${ch}Resistor` as keyof RGBLEDNodeData;
    const val: ResistorOption = v === 'USER' ? 'USER' : parseInt(v, 10);
    setLocalData((p) => ({ ...p, [key]: val }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((n) => n.id !== selectedNode.id ? n : {
      ...n,
      data: {
        ...n.data,
        label:             localData.label            ?? 'RGB LED',
        isCommonAnode:     localData.isCommonAnode     ?? false,
        r:                 localData.r                ?? 255,
        g:                 localData.g                ?? 255,
        b:                 localData.b                ?? 255,
        brightness:        localData.brightness       ?? 1,
        initialState:      localData.initialState     ?? 'off',
        pulseSpeed:        localData.pulseSpeed       ?? 1,
        rainbowSpeed:      localData.rainbowSpeed     ?? 1,
        rForwardVoltage:   localData.rForwardVoltage  ?? 2.0,
        gForwardVoltage:   localData.gForwardVoltage  ?? 3.2,
        bForwardVoltage:   localData.bForwardVoltage  ?? 3.2,
        rResistor:         localData.rResistor        ?? 220,
        gResistor:         localData.gResistor        ?? 220,
        bResistor:         localData.bResistor        ?? 220,
        rCustomResistance: localData.rResistor === 'USER' ? localData.rCustomResistance : undefined,
        gCustomResistance: localData.gResistor === 'USER' ? localData.gCustomResistance : undefined,
        bCustomResistance: localData.bResistor === 'USER' ? localData.bCustomResistance : undefined,
        nominalCurrent:    localData.nominalCurrent   ?? 0.020,
      },
    }));
    setHasChanges(false);
  }, [selectedNode, localData, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as RGBLEDNodeData;
    setLocalData((p) => ({
      ...p,
      label:             d.label            ?? 'RGB LED',
      isCommonAnode:     d.isCommonAnode     ?? false,
      r: d.r ?? 255, g: d.g ?? 255, b: d.b ?? 255,
      brightness:        d.brightness       ?? 1,
      initialState:      d.initialState     ?? 'off',
      pulseSpeed:        d.pulseSpeed       ?? 1,
      rainbowSpeed:      d.rainbowSpeed     ?? 1,
      rForwardVoltage:   d.rForwardVoltage  ?? 2.0,
      gForwardVoltage:   d.gForwardVoltage  ?? 3.2,
      bForwardVoltage:   d.bForwardVoltage  ?? 3.2,
      rResistor:         d.rResistor        ?? 220,
      gResistor:         d.gResistor        ?? 220,
      bResistor:         d.bResistor        ?? 220,
      rCustomResistance: d.rCustomResistance,
      gCustomResistance: d.gCustomResistance,
      bCustomResistance: d.bCustomResistance,
      nominalCurrent:    d.nominalCurrent   ?? 0.020,
    }));
    setHasChanges(false);
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <Palette className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select an RGB LED component to edit its properties</p>
      </div>
    );
  }

  const iNom   = localData.nominalCurrent ?? 0.020;
  const liveR  = calcChannel(localData.rForwardVoltage ?? 2.0, localData.rResistor ?? 220, localData.rCustomResistance, iNom);
  const liveG  = calcChannel(localData.gForwardVoltage ?? 3.2, localData.gResistor ?? 220, localData.gCustomResistance, iNom);
  const liveB  = calcChannel(localData.bForwardVoltage ?? 3.2, localData.bResistor ?? 220, localData.bCustomResistance, iNom);

  const brt         = localData.brightness ?? 1;
  const dispR       = localData.isCommonAnode ? 255 - (localData.r ?? 255) : (localData.r ?? 255);
  const dispG       = localData.isCommonAnode ? 255 - (localData.g ?? 255) : (localData.g ?? 255);
  const dispB       = localData.isCommonAnode ? 255 - (localData.b ?? 255) : (localData.b ?? 255);
  const previewCss  = `rgb(${Math.round(dispR * brt)},${Math.round(dispG * brt)},${Math.round(dispB * brt)})`;
  const isOn        = localData.initialState !== 'off';

  const pinStatus = (pin: number | null, label: string) => (
    <div className="flex justify-between">
      <span className="text-[#9ca3af]">{label}</span>
      {pin != null
        ? <span className="text-green-400">D{pin} ✓</span>
        : <span className="text-yellow-400">Not connected ⚠</span>}
    </div>
  );

  const ResistorSelect = ({
    ch, label, vf, res, custom,
  }: {
    ch: 'r' | 'g' | 'b';
    label: string;
    vf: number;
    res: ResistorOption;
    custom?: number;
  }) => (
    <div className="space-y-1">
      <Label className={cn('text-xs', ch === 'r' ? 'text-red-400' : ch === 'g' ? 'text-green-400' : 'text-blue-400')}>
        {label} Vf {vf}V
      </Label>
      <Select value={res === 'USER' ? 'USER' : String(res)}
        onValueChange={(v) => handleResistor(ch, v)}>
        <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-xs h-7">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
          {resistorOptions.map((r) => (
            <SelectItem key={String(r)} value={String(r)} className="text-[#e6e6e6] text-xs">
              {r === 'USER' ? 'Custom' : `${r} Ω`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {res === 'USER' && (
        <Input type="number" placeholder="Ω" value={custom ?? ''}
          onChange={(e) => handleChange(`${ch}CustomResistance` as keyof RGBLEDNodeData, parseFloat(e.target.value) || 0)}
          className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-xs h-7 mt-1" />
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">RGB LED Properties</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}
            className={cn('h-7 px-3', hasChanges
              ? 'bg-[#00d9ff] text-[#0a0e14]'
              : 'bg-[#1a3a5c] text-[#9ca3af] cursor-not-allowed')}>
            <Save className="w-3.5 h-3.5 mr-1" />Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Identification ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Identification</h3>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">ID</Label>
            <Input value={localData.id ?? selectedNode.id} readOnly
              className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Display Name</Label>
            <Input value={localData.label ?? ''} onChange={(e) => handleChange('label', e.target.value)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
          <div className="flex items-center justify-between py-1">
            <Label className="text-[#9ca3af] text-xs cursor-pointer">Common Anode</Label>
            <Switch checked={localData.isCommonAnode ?? false}
              onCheckedChange={(v) => handleChange('isCommonAnode', v)}
              className="data-[state=checked]:bg-[#00d9ff]" />
          </div>
          <p className="text-[10px] text-[#9ca3af]">
            {localData.isCommonAnode
              ? 'Common pin → VCC (+). Each channel is LOW to activate.'
              : 'Common pin → GND (−). Each channel is HIGH to activate.'}
          </p>
        </div>

        {/* ── Pin Mapping ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Pin Mapping</h3>
          <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[11px] space-y-1">
            {pinStatus(pinR, 'Red')}
            {pinStatus(pinG, 'Green')}
            {pinStatus(pinB, 'Blue')}
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Common</span>
              {commonConn
                ? <span className="text-green-400">Connected ✓</span>
                : <span className="text-yellow-400">Not connected ⚠</span>}
            </div>
          </div>
        </div>

        {/* ── Color ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Color (RGB)</h3>
          <div className="flex items-center gap-3">
            <input type="color" value={hexFromRGB()}
              onChange={(e) => handleColorPicker(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-[rgba(0,217,255,0.3)] bg-transparent" />
            <span className="text-[#9ca3af] text-xs">{hexFromRGB().toUpperCase()}</span>
          </div>
          <div className="space-y-2">
            {(['r', 'g', 'b'] as const).map((ch) => {
              const color = ch === 'r' ? 'text-red-400' : ch === 'g' ? 'text-green-400' : 'text-blue-400';
              const border = ch === 'r' ? 'border-red-500/30' : ch === 'g' ? 'border-green-500/30' : 'border-blue-500/30';
              return (
                <div key={ch} className="flex items-center gap-2">
                  <Label className={cn('text-xs w-4', color)}>{ch.toUpperCase()}</Label>
                  <input type="range" min="0" max="255"
                    value={localData[ch] ?? 255}
                    onChange={(e) => handleChange(ch as keyof RGBLEDNodeData, parseInt(e.target.value))}
                    className="flex-1 h-2 rounded-lg cursor-pointer accent-current" />
                  <Input type="number" min="0" max="255"
                    value={localData[ch] ?? 255}
                    onChange={(e) => handleChange(ch as keyof RGBLEDNodeData, parseInt(e.target.value) || 0)}
                    className={cn('w-16 text-xs h-7 bg-[#151b24]', border, color)} />
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-[#9ca3af] text-xs">Brightness</Label>
              <span className="text-[#00d9ff] text-xs">{Math.round((localData.brightness ?? 1) * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05"
              value={localData.brightness ?? 1}
              onChange={(e) => handleChange('brightness', parseFloat(e.target.value))}
              className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
          </div>
        </div>

        {/* ── Electrical per channel ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Electrical (per channel)</h3>
          <div className="grid grid-cols-3 gap-2">
            <ResistorSelect ch="r" label="R" vf={localData.rForwardVoltage ?? 2.0}
              res={localData.rResistor ?? 220} custom={localData.rCustomResistance} />
            <ResistorSelect ch="g" label="G" vf={localData.gForwardVoltage ?? 3.2}
              res={localData.gResistor ?? 220} custom={localData.gCustomResistance} />
            <ResistorSelect ch="b" label="B" vf={localData.bForwardVoltage ?? 3.2}
              res={localData.bResistor ?? 220} custom={localData.bCustomResistance} />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Nominal Current (shared, mA)</Label>
            <Input type="number" step="1"
              value={Math.round((localData.nominalCurrent ?? 0.020) * 1000)}
              onChange={(e) => handleChange('nominalCurrent', (parseInt(e.target.value) || 20) / 1000)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
        </div>

        {/* ── Live Calculations ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Live Calculations</h3>
          <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[11px]">
            {([
              { label: 'R', live: liveR },
              { label: 'G', live: liveG },
              { label: 'B', live: liveB },
            ] as const).map(({ label, live }) => (
              <div key={label} className="flex justify-between py-0.5">
                <span className="text-[#9ca3af]">Channel {label}</span>
                <span className={statusColors[live.status] ?? 'text-[#e6e6e6]'}>
                  {live.current_ma} mA — {live.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Simulation ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Simulation</h3>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Initial State</Label>
            <Select value={localData.initialState ?? 'off'}
              onValueChange={(v) => handleChange('initialState', v as RGBLEDNodeData['initialState'])}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="off"     className="text-[#e6e6e6]">Off</SelectItem>
                <SelectItem value="solid"   className="text-[#e6e6e6]">Solid Color</SelectItem>
                <SelectItem value="rainbow" className="text-[#e6e6e6]">Rainbow Cycle</SelectItem>
                <SelectItem value="pulse"   className="text-[#e6e6e6]">Pulse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {localData.initialState === 'pulse' && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-[#9ca3af] text-xs">Pulse Speed</Label>
                <span className="text-[#00d9ff] text-xs">{localData.pulseSpeed}x</span>
              </div>
              <input type="range" min="0.5" max="5" step="0.5"
                value={localData.pulseSpeed ?? 1}
                onChange={(e) => handleChange('pulseSpeed', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
            </div>
          )}
          {localData.initialState === 'rainbow' && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-[#9ca3af] text-xs">Rainbow Speed</Label>
                <span className="text-[#00d9ff] text-xs">{localData.rainbowSpeed}x</span>
              </div>
              <input type="range" min="0.5" max="5" step="0.5"
                value={localData.rainbowSpeed ?? 1}
                onChange={(e) => handleChange('rainbowSpeed', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
              <p className="text-[10px] text-[#9ca3af]">1x ≈ full cycle in 5s</p>
            </div>
          )}
        </div>

        {/* ── Preview ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Preview</h3>
          <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
            <div className="relative w-14 h-14 rounded-full transition-all duration-300"
              style={{
                backgroundColor: previewCss,
                opacity: isOn ? 0.85 : 0.25,
                boxShadow: isOn ? `0 0 24px 8px ${previewCss}80` : 'none',
              }}>
              <div className="absolute top-1.5 left-2 w-5 h-3 rounded-full bg-white opacity-40" />
            </div>
          </div>
          <p className="text-center text-[10px] text-[#9ca3af]">
            {previewCss} · {Math.round(brt * 100)}% brightness
          </p>
        </div>

      </div>
    </div>
  );
};

export default RGBLEDPropertiesPanel;
```

***

## Painel 10 — `src/components/PotentiometerPropertiesPanel.tsx`

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, RotateCcw, Save } from 'lucide-react';
import {
  taperMap, getWiperResistance, getWiperVoltage,
} from '@/lib/potentiometerCalculations';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';

type TaperType = 'linear' | 'log' | 'antilog';

interface PotentiometerNodeData {
  id?: string;
  label?: string;
  resistance?: number;
  tolerance?: number;
  taper?: TaperType;
  powerRating?: number;
  initialValue?: number;
  connectedPin?: number | null;
  connectedPinType?: 'A' | 'D';
}

// Mini curva SVG para o taper (30px)
function TaperCurve({ taper }: { taper: TaperType }) {
  const pts = [0, 25, 50, 75, 100].map((p) => ({
    x: (p / 100) * 28 + 1,
    y: 29 - taperMap(p, taper) * 28,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" className="inline-block ml-2 opacity-70">
      <path d={d} fill="none" stroke="#00d9ff" strokeWidth="1.5" />
    </svg>
  );
}

export const PotentiometerPropertiesPanel: React.FC = () => {
  const { setNodes }    = useReactFlow();
  const nodes           = useNodes();
  const { connections } = useConnectionStore();
  const selectedNode    = nodes.find((n) => n.selected && n.type === 'potentiometer');

  const [localData,     setLocalData]     = useState<PotentiometerNodeData>({});
  const [wiperPosition, setWiperPosition] = useState(50); // estado local, não persistido
  const [hasChanges,    setHasChanges]    = useState(false);

  // ── Inicialização ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as PotentiometerNodeData;

    const signalConn = connections.find(
      (c) => c.source === `${selectedNode.id}:signal` || c.target === `${selectedNode.id}:signal`
    );
    let connectedPin: number | null = null;
    let connectedPinType: 'A' | 'D' | undefined;
    if (signalConn) {
      const other = signalConn.source.startsWith(selectedNode.id)
        ? signalConn.target : signalConn.source;
      const mA = other.match(/A(\d+)/);
      const mD = other.match(/D(\d+)/);
      if (mA) { connectedPin = parseInt(mA[1], 10) + 14; connectedPinType = 'A'; }
      else if (mD) { connectedPin = parseInt(mD[1], 10); connectedPinType = 'D'; }
    }

    const initVal = d.initialValue ?? 50;
    setLocalData({
      id:              selectedNode.id,
      label:           d.label        ?? 'Potentiometer',
      resistance:      d.resistance   ?? 10000,
      tolerance:       d.tolerance    ?? 20,
      taper:           d.taper        ?? 'linear',
      powerRating:     d.powerRating  ?? 0.5,
      initialValue:    initVal,
      connectedPin,
      connectedPinType,
    });
    setWiperPosition(initVal);
    setHasChanges(false);
  }, [selectedNode?.id, connections]);

  const handleChange = useCallback(
    <K extends keyof PotentiometerNodeData>(key: K, value: PotentiometerNodeData[K]) => {
      setLocalData((p) => ({ ...p, [key]: value }));
      setHasChanges(true);
    }, []
  );

  // Slider do wiper — emite analogChange em tempo real, não faz Save
  const handleWiperSlide = useCallback((pct: number) => {
    setWiperPosition(pct);
    const taper = localData.taper ?? 'linear';
    const mapped = Math.round(taperMap(pct, taper) * 1023);
    if (localData.connectedPin != null) {
      simulationEngine.externalAnalogWrite(localData.connectedPin, mapped);
    }
  }, [localData.taper, localData.connectedPin]);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((n) => n.id !== selectedNode.id ? n : {
      ...n,
      data: {
        ...n.data,
        label:        localData.label       ?? 'Potentiometer',
        resistance:   localData.resistance  ?? 10000,
        tolerance:    localData.tolerance   ?? 20,
        taper:        localData.taper       ?? 'linear',
        powerRating:  localData.powerRating ?? 0.5,
        initialValue: wiperPosition, // persiste posição actual do slider
      },
    }));
    setHasChanges(false);
  }, [selectedNode, localData, wiperPosition, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    // Reset para defaults genéricos (não os valores do nó guardados)
    setLocalData((p) => ({
      ...p,
      label:        (selectedNode.data.label as string) ?? 'Potentiometer',
      resistance:   10000,
      tolerance:    20,
      taper:        'linear',
      powerRating:  0.5,
      initialValue: 50,
    }));
    setWiperPosition(50);
    setHasChanges(false);
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <SlidersHorizontal className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select a Potentiometer component to edit its properties</p>
      </div>
    );
  }

  const taper        = localData.taper ?? 'linear';
  const resistance   = localData.resistance ?? 10000;
  const wiperR       = getWiperResistance(resistance, wiperPosition, taper);
  const wiperV       = getWiperVoltage(wiperPosition, taper);
  const adcValue     = Math.round(taperMap(wiperPosition, taper) * 1023);

  const taperLabels: Record<TaperType, string> = {
    linear:  'Linear (B)',
    log:     'Logarithmic (A)',
    antilog: 'Anti-Log (C)',
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">Potentiometer Properties</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}
            className={cn('h-7 px-3', hasChanges
              ? 'bg-[#00d9ff] text-[#0a0e14]'
              : 'bg-[#1a3a5c] text-[#9ca3af] cursor-not-allowed')}>
            <Save className="w-3.5 h-3.5 mr-1" />Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Identification ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Identification</h3>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">ID</Label>
            <Input value={localData.id ?? selectedNode.id} readOnly
              className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Display Name</Label>
            <Input value={localData.label ?? ''} onChange={(e) => handleChange('label', e.target.value)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
        </div>

        {/* ── Wiring ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Wiring</h3>
          <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Signal (Wiper)</span>
              {localData.connectedPin != null
                ? <span className={localData.connectedPinType === 'A' ? 'text-green-400' : 'text-orange-400'}>
                    {localData.connectedPinType === 'A'
                      ? `A${localData.connectedPin - 14} ✓`
                      : `D${localData.connectedPin} ⚠`}
                  </span>
                : <span className="text-yellow-400">Not connected ⚠</span>}
            </div>
          </div>
          {localData.connectedPinType === 'D' && (
            <div className="p-2 rounded bg-yellow-500/10 border border-yellow-400/40 text-[11px] text-yellow-300">
              ⚠ Signal connected to digital pin D{localData.connectedPin}. Use an analog pin (A0–A5) for correct ADC readings.
            </div>
          )}
        </div>

        {/* ── Electrical Specifications ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Electrical Specifications</h3>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Total Resistance (Ω)</Label>
            <Input type="number" step="100" value={localData.resistance ?? ''}
              onChange={(e) => handleChange('resistance', parseInt(e.target.value) || 10000)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Tolerance (±%)</Label>
            <Input type="number" value={localData.tolerance ?? ''}
              onChange={(e) => handleChange('tolerance', parseFloat(e.target.value) || 20)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center">
              <Label className="text-[#9ca3af] text-xs">Taper Type</Label>
              <TaperCurve taper={taper} />
            </div>
            <Select value={taper} onValueChange={(v) => handleChange('taper', v as TaperType)}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="linear"  className="text-[#e6e6e6]">Linear (B)</SelectItem>
                <SelectItem value="log"     className="text-[#e6e6e6]">Logarithmic (A)</SelectItem>
                <SelectItem value="antilog" className="text-[#e6e6e6]">Anti-Log (C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Power Rating (W)</Label>
            <Input type="number" step="0.1" value={localData.powerRating ?? ''}
              onChange={(e) => handleChange('powerRating', parseFloat(e.target.value) || 0.5)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
        </div>

        {/* ── Simulation ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Simulation</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-[#9ca3af] text-xs">Position</Label>
              <span className="text-[#00d9ff] text-xs font-mono">
                {wiperPosition}% → {wiperR >= 1000
                  ? `${(wiperR / 1000).toFixed(2)}kΩ`
                  : `${wiperR.toFixed(0)}Ω`} → {wiperV.toFixed(2)}V
              </span>
            </div>
            <input type="range" min="0" max="100" step="1"
              value={wiperPosition}
              onChange={(e) => handleWiperSlide(parseInt(e.target.value))}
              className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
          </div>
        </div>

        {/* ── Live Value ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Live Value</h3>
          <div className="p-3 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#9ca3af]">ADC</span>
              <span className="text-[#00d9ff] font-mono">{adcValue}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#9ca3af]">Voltage</span>
              <span className="text-[#e6e6e6] font-mono">{wiperV.toFixed(2)} V</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#9ca3af]">Wiper R</span>
              <span className="text-[#e6e6e6] font-mono">
                {wiperR >= 1000 ? `${(wiperR / 1000).toFixed(2)} kΩ` : `${wiperR.toFixed(0)} Ω`}
              </span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full h-1.5 bg-[#1a2a3a] rounded-full overflow-hidden mt-1">
              <div className="h-full bg-[#00d9ff] rounded-full transition-all"
                style={{ width: `${taperMap(wiperPosition, taper) * 100}%` }} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PotentiometerPropertiesPanel;
```

***

## Painel 11 — `src/components/ButtonPropertiesPanel.tsx`

Aqui usas o teu `_jsx_temp` já modificado como base. O ajuste central é garantir que no `handleSave` o campo é gravado como `type` (não `buttonType`) e adicionar as novas secções do guia:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Square, RotateCcw, Save } from 'lucide-react';
import { useConnectionStore } from '@/stores/useConnectionStore';

type PullResistor = 'NONE' | 'PULLUP' | 'PULLDOWN';
type ButtonType   = 'momentary' | 'toggle';

interface ButtonNodeData {
  id?: string;
  name?: string;
  label?: string;
  type?: ButtonType;
  connectedPin?: number | null;
  pullResistor?: PullResistor;
  debounceTime?: number;
  isPressed?: boolean;
}

export const ButtonPropertiesPanel: React.FC = () => {
  const { setNodes }    = useReactFlow();
  const nodes           = useNodes();
  const { connections } = useConnectionStore();
  const selectedNode    = nodes.find((n) => n.selected && n.type === 'button');

  const [localData,   setLocalData]   = useState<ButtonNodeData>({});
  const [hasChanges,  setHasChanges]  = useState(false);
  const [previewOn,   setPreviewOn]   = useState(false); // preview interactivo

  const resolvePin = useCallback((nodeId: string) => {
    const conn = connections.find(
      (c) => c.source === `${nodeId}:signal` || c.target === `${nodeId}:signal`
    );
    if (!conn) return null;
    const other = conn.source === `${nodeId}:signal` ? conn.target : conn.source;
    const m = other.match(/D(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }, [connections]);

  // ── Inicialização ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as ButtonNodeData;
    setLocalData({
      id:           selectedNode.id,
      name:         d.name         ?? d.label ?? 'BTN',
      type:         d.type         ?? 'momentary',
      connectedPin: resolvePin(selectedNode.id),
      pullResistor: d.pullResistor ?? 'NONE',
      debounceTime: d.debounceTime ?? 50,
      isPressed:    d.isPressed    ?? false,
    });
    setHasChanges(false);
  }, [selectedNode?.id, connections, resolvePin]);

  const handleChange = useCallback(
    <K extends keyof ButtonNodeData>(key: K, value: ButtonNodeData[K]) => {
      setLocalData((p) => ({ ...p, [key]: value }));
      setHasChanges(true);
    }, []
  );

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((n) => n.id !== selectedNode.id ? n : {
      ...n,
      data: {
        ...n.data,
        id:           localData.id           ?? selectedNode.id,
        name:         localData.name         ?? 'BTN',
        label:        localData.name         ?? 'BTN',
        type:         localData.type         ?? 'momentary', // ← 'type', não 'buttonType'
        connectedPin: localData.connectedPin ?? null,
        pullResistor: localData.pullResistor ?? 'NONE',
        debounceTime: localData.debounceTime ?? 50,
        isPressed:    localData.isPressed    ?? false,
      },
    }));
    setHasChanges(false);
  }, [selectedNode, localData, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as ButtonNodeData;
    setLocalData({
      id:           selectedNode.id,
      name:         d.name         ?? d.label ?? 'BTN',
      type:         d.type         ?? 'momentary',
      connectedPin: resolvePin(selectedNode.id),
      pullResistor: d.pullResistor ?? 'NONE',
      debounceTime: d.debounceTime ?? 50,
      isPressed:    d.isPressed    ?? false,
    });
    setHasChanges(false);
  }, [selectedNode, connections, resolvePin]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <Square className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select a Button component to edit its properties</p>
      </div>
    );
  }

  const pullDesc: Record<PullResistor, string> = {
    NONE:     'No pull — behavior depends on wiring or MCU INPUT_PULLUP',
    PULLUP:   'Default HIGH → Press sends LOW (Active-Low)',
    PULLDOWN: 'Default LOW → Press sends HIGH (Active-High)',
  };

  const isFloating = localData.pullResistor === 'NONE';

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Square className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">Button Properties</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}
            className={cn('h-7 px-3', hasChanges
              ? 'bg-[#00d9ff] text-[#0a0e14]'
              : 'bg-[#1a3a5c] text-[#9ca3af] cursor-not-allowed')}>
            <Save className="w-3.5 h-3.5 mr-1" />Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Identification ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Identification</h3>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">ID</Label>
            <Input value={localData.id ?? selectedNode.id} readOnly
              className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Display Name</Label>
            <Input value={localData.name ?? ''} onChange={(e) => handleChange('name', e.target.value)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Button Type</Label>
            <Select value={localData.type ?? 'momentary'}
              onValueChange={(v) => handleChange('type', v as ButtonType)}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="momentary" className="text-[#e6e6e6]">Momentary</SelectItem>
                <SelectItem value="toggle"    className="text-[#e6e6e6]">Toggle</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-[#9ca3af]">
              {localData.type === 'toggle'
                ? 'Each press inverts state. Stays ON until pressed again.'
                : 'Active only while held. Releases on mouse-up.'}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Signal Pin</Label>
            <Input value={localData.connectedPin != null ? `D${localData.connectedPin}` : 'Not connected'} readOnly
              className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8" />
          </div>
        </div>

        {/* ── Electrical ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Electrical</h3>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Pull Resistor</Label>
            <Select value={localData.pullResistor ?? 'NONE'}
              onValueChange={(v) => handleChange('pullResistor', v as PullResistor)}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="NONE"     className="text-[#e6e6e6]">None</SelectItem>
                <SelectItem value="PULLUP"   className="text-[#e6e6e6]">Pull-up</SelectItem>
                <SelectItem value="PULLDOWN" className="text-[#e6e6e6]">Pull-down</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-[#9ca3af]">{pullDesc[localData.pullResistor ?? 'NONE']}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Debounce Time (ms)</Label>
            <Input type="number" value={localData.debounceTime ?? 50}
              onChange={(e) => handleChange('debounceTime', parseInt(e.target.value) || 0)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
            <p className="text-[10px] text-[#9ca3af]">Typical: 5–50ms hardware, 50–200ms software</p>
          </div>
        </div>

        {/* ── Logic Behaviour ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Logic Behaviour</h3>
          <div className="p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.2)] text-[11px] text-[#9ca3af] space-y-1">
            <div className="flex justify-between">
              <span>PULLUP</span>
              <span>Released = <span className="text-green-400">HIGH</span> · Pressed = <span className="text-red-400">LOW</span></span>
            </div>
            <div className="flex justify-between">
              <span>PULLDOWN</span>
              <span>Released = <span className="text-red-400">LOW</span> · Pressed = <span className="text-green-400">HIGH</span></span>
            </div>
            <div className="flex justify-between">
              <span>NONE</span>
              <span>Auto-detect MCU pull-up mode</span>
            </div>
          </div>
          {/* Floating Input Risk */}
          {isFloating && (
            <div className="p-2 rounded bg-yellow-500/10 border border-yellow-400/40 text-[11px] text-yellow-300 space-y-1">
              <div className="font-semibold">⚠️ Floating Input Risk</div>
              <p>Without a pull resistor the pin may read random values when the button is released.</p>
              <p className="text-yellow-200">→ Use PULLUP / PULLDOWN, or wire to VCC/GND externally.</p>
            </div>
          )}
        </div>

        {/* ── Simulation ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Simulation</h3>
          <div className="flex items-center justify-between py-2">
            <Label className="text-[#9ca3af] text-xs cursor-pointer">Initially Pressed</Label>
            <Switch checked={localData.isPressed ?? false}
              onCheckedChange={(v) => handleChange('isPressed', v)}
              className="data-[state=checked]:bg-[#00d9ff]" />
          </div>
        </div>

        {/* ── Preview ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Preview</h3>
          <div className="flex flex-col items-center gap-2 p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
            <button
              className={cn(
                'w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all select-none',
                previewOn
                  ? 'bg-[#00d9ff] border-[#00d9ff] scale-95'
                  : 'bg-[#1a3a5c] border-[rgba(0,217,255,0.3)]'
              )}
              onMouseDown={() => setPreviewOn(true)}
              onMouseUp={() => {
                if (localData.type === 'toggle') setPreviewOn((v) => !v);
                else setPreviewOn(false);
              }}
              onMouseLeave={() => { if (localData.type !== 'toggle') setPreviewOn(false); }}
            >
              <Square className={cn('w-8 h-8', previewOn ? 'text-[#0a0e14]' : 'text-[#00d9ff]')} />
            </button>
            <p className="text-[10px] text-[#9ca3af]">
              {localData.type === 'toggle' ? 'Click to toggle' : 'Hold to test'}
            </p>
            <div className={cn(
              'text-xs font-mono px-2 py-0.5 rounded',
              previewOn ? 'bg-green-500/20 text-green-400' : 'bg-[#1a2a3a] text-[#9ca3af]'
            )}>
              {previewOn ? 'ON' : 'OFF'}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ButtonPropertiesPanel;
```

***


### src/components/LEDPropertiesPanel.tsx — versão final completa
```
tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Lightbulb, RotateCcw, Save, AlertTriangle, Flame } from 'lucide-react';
import {
    ledProfiles,
    resistorOptions,
    getActiveMicrocontrollerProfile,
    calculateRealCurrent,
    calculateLuminousIntensity,
    getSafetyStatus,
    type LedColorProfile,
    type ResistorOption,
} from '@/lib/ledCalculations';
import { useConnectionStore } from '@/stores/useConnectionStore';

const ALL_PROFILES: LedColorProfile[] = [
    'RED', 'GREEN', 'BLUE', 'YELLOW', 'WHITE', 'ORANGE', 'UV', 'USER',
];

interface LEDNodeData {
    id?: string;
    name?: string;
    label?: string;
    connectedPin?: number | null;
    colorProfile?: LedColorProfile;
    customColorHex?: string;
    forwardVoltage?: number;
    nominalCurrent?: number;
    maxCurrent?: number;
    internalResistance?: ResistorOption;
    customResistance?: number;
    brightness?: number;
    brightnessOverride?: number;
    realCurrent?: number;
    luminousIntensity?: number;
    isBurned?: boolean;
    polarityEnforced?: boolean;
    initialState?: 'on' | 'off';
    connectedPinAnode?: number | null;
    connectedPinCathode?: string | null;
}

export const LEDPropertiesPanel: React.FC = () => {
    const { setNodes } = useReactFlow();
    const nodes = useNodes();
    const { connections } = useConnectionStore();

    const selectedNode = nodes.find((n) => n.selected && n.type === 'led');

    const [localData, setLocalData] = useState<LEDNodeData>({});
    const [hasChanges, setHasChanges] = useState(false);

    // ── Wiring resolver ─────────────────────────────────────────────
    const resolveWiring = useCallback(
        (nodeId: string): { anodePin: number | null; cathodeLabel: string | null } => {
            const anodeConn = connections.find(
                (c) => c.source === `${nodeId}:anode` || c.target === `${nodeId}:anode`
            );
            const cathodeConn = connections.find(
                (c) => c.source === `${nodeId}:cathode` || c.target === `${nodeId}:cathode`
            );

            let anodePin: number | null = null;
            let cathodeLabel: string | null = null;

            if (anodeConn) {
                const other =
                    anodeConn.source === `${nodeId}:anode`
                        ? anodeConn.target
                        : anodeConn.source;
                const m = other.match(/D(\d+)/);
                if (m) anodePin = parseInt(m[1], 10);
            }

            if (cathodeConn) {
                const other =
                    cathodeConn.source === `${nodeId}:cathode`
                        ? cathodeConn.target
                        : cathodeConn.source;
                if (other.includes('GND')) {
                    cathodeLabel = 'GND';
                } else {
                    const m = other.match(/D(\d+)/);
                    if (m) cathodeLabel = `D${m[1]}`;
                }
            }

            return { anodePin, cathodeLabel };
        },
        [connections]
    );

    // ── Inicialização ────────────────────────────────────────────────
    useEffect(() => {
        if (!selectedNode) return;
        const d = selectedNode.data as LEDNodeData;
        const profileKey: LedColorProfile = d.colorProfile ?? 'RED';
        const profile = ledProfiles[profileKey];
        const { anodePin, cathodeLabel } = resolveWiring(selectedNode.id);

        setLocalData({
            id:                  selectedNode.id,
            name:                d.name               ?? d.label ?? 'LED',
            colorProfile:        profileKey,
            customColorHex:      d.customColorHex      ?? profile.hex,
            forwardVoltage:      d.forwardVoltage      ?? profile.vf,
            nominalCurrent:      d.nominalCurrent      ?? profile.if_nom,
            maxCurrent:          d.maxCurrent          ?? profile.if_max,
            internalResistance:  d.internalResistance  ?? 220,
            customResistance:    d.customResistance,
            brightness:          d.brightness          ?? 1.0,
            brightnessOverride:  d.brightnessOverride,
            realCurrent:         d.realCurrent         ?? 0,
            luminousIntensity:   d.luminousIntensity   ?? 0,
            isBurned:            d.isBurned            ?? false,
            polarityEnforced:    d.polarityEnforced    ?? true,
            initialState:        d.initialState        ?? 'off',
            connectedPinAnode:   anodePin,
            connectedPinCathode: cathodeLabel,
        });
        setHasChanges(false);
    }, [selectedNode?.id, connections, resolveWiring]);

    // ── Handlers ─────────────────────────────────────────────────────
    const handleChange = useCallback(
        <K extends keyof LEDNodeData>(key: K, value: LEDNodeData[K]) => {
            setLocalData((prev) => ({ ...prev, [key]: value }));
            setHasChanges(true);
        },
        []
    );

    const handleColorChange = useCallback(
        (value: LedColorProfile) => {
            const profile = ledProfiles[value];
            setLocalData((prev) => ({
                ...prev,
                colorProfile:   value,
                forwardVoltage: profile.vf     || prev.forwardVoltage,
                nominalCurrent: profile.if_nom || prev.nominalCurrent,
                maxCurrent:     profile.if_max || prev.maxCurrent,
                customColorHex:
                    value === 'USER'
                        ? (prev.customColorHex ?? profile.hex)
                        : profile.hex,
            }));
            setHasChanges(true);
        },
        []
    );

    const handleResistorChange = useCallback((value: string) => {
        const parsed: ResistorOption = value === 'USER' ? 'USER' : parseInt(value, 10);
        setLocalData((prev) => ({ ...prev, internalResistance: parsed }));
        setHasChanges(true);
    }, []);

    const handleSave = useCallback(() => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id !== selectedNode.id) return n;
                return {
                    ...n,
                    data: {
                        ...n.data,
                        id:                 localData.id            ?? selectedNode.id,
                        name:               localData.name          ?? 'LED',
                        label:              localData.name          ?? 'LED',
                        colorProfile:       localData.colorProfile  ?? 'RED',
                        customColorHex:     localData.customColorHex,
                        forwardVoltage:     localData.forwardVoltage,
                        nominalCurrent:     localData.nominalCurrent,
                        maxCurrent:         localData.maxCurrent,
                        internalResistance: localData.internalResistance ?? 220,
                        customResistance:
                            localData.internalResistance === 'USER'
                                ? localData.customResistance
                                : undefined,
                        brightness:          localData.brightness,
                        brightnessOverride:  localData.brightnessOverride,
                        polarityEnforced:    localData.polarityEnforced,
                        initialState:        localData.initialState,
                        // realCurrent / luminousIntensity / isBurned → runtime, não persistidos
                    },
                };
            })
        );
        setHasChanges(false);
    }, [selectedNode, localData, setNodes]);

    const handleReset = useCallback(() => {
        if (!selectedNode) return;
        const d = selectedNode.data as LEDNodeData;
        const profileKey: LedColorProfile = d.colorProfile ?? 'RED';
        const profile = ledProfiles[profileKey];
        const { anodePin, cathodeLabel } = resolveWiring(selectedNode.id);

        setLocalData({
            id:                  selectedNode.id,
            name:                d.name               ?? d.label ?? 'LED',
            colorProfile:        profileKey,
            customColorHex:      d.customColorHex      ?? profile.hex,
            forwardVoltage:      d.forwardVoltage      ?? profile.vf,
            nominalCurrent:      d.nominalCurrent      ?? profile.if_nom,
            maxCurrent:          d.maxCurrent          ?? profile.if_max,
            internalResistance:  d.internalResistance  ?? 220,
            customResistance:    d.customResistance,
            brightness:          d.brightness          ?? 1.0,
            brightnessOverride:  d.brightnessOverride,
            realCurrent:         d.realCurrent         ?? 0,
            luminousIntensity:   d.luminousIntensity   ?? 0,
            isBurned:            d.isBurned            ?? false,
            polarityEnforced:    d.polarityEnforced    ?? true,
            initialState:        d.initialState        ?? 'off',
            connectedPinAnode:   anodePin,
            connectedPinCathode: cathodeLabel,
        });
        setHasChanges(false);
    }, [selectedNode, resolveWiring]);

    // ── Empty state ──────────────────────────────────────────────────
    if (!selectedNode) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
                <Lightbulb className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Select an LED component to edit its properties</p>
            </div>
        );
    }

    // ── Derived values ───────────────────────────────────────────────
    const profileKey = localData.colorProfile ?? 'RED';
    const profile    = ledProfiles[profileKey];
    const mcu        = getActiveMicrocontrollerProfile();
    const internalR  =
        localData.internalResistance === 'USER'
            ? (localData.customResistance || 220)
            : (localData.internalResistance || 220);
    const vf         = localData.forwardVoltage ?? profile.vf;
    const iNom       = localData.nominalCurrent ?? profile.if_nom;
    const iReal      = calculateRealCurrent(mcu.v_out, vf, internalR);
    const intensity  = calculateLuminousIntensity(profile.mcd, iReal, iNom);
    const safety     = getSafetyStatus(iReal, iNom, mcu.max_ma);
    const intPct     = iNom > 0
        ? Math.round(Math.min(1, Math.max(0, iReal / iNom)) * 100)
        : 0;

    // Preview
    const displayColor  = profileKey === 'USER'
        ? (localData.customColorHex || profile.hex)
        : profile.hex;
    const brtOverride   = localData.brightnessOverride;
    const isOnPreview   = localData.initialState === 'on';
    const previewOpacity =
        localData.isBurned ? 0.1
        : isOnPreview      ? 0.25 + (brtOverride != null ? brtOverride : intPct / 100) * 0.75
        :                    0.18;

    const glowSize = isOnPreview && !localData.isBurned
        ? Math.round(10 + (brtOverride != null ? brtOverride : intPct / 100) * 20)
        : 0;

    const safetyBannerClass: Record<string, string> = {
        safe:    'border-green-500/40  bg-green-500/10  text-green-300',
        warning: 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200',
        error:   'border-orange-400/40 bg-orange-500/10 text-orange-200',
        burned:  'border-red-500/40    bg-red-500/10    text-red-300',
    };

    const safetyLabel: Record<string, string> = {
        safe:    'Within safe range',
        warning: 'Over nominal current',
        error:   'MCU pin overload',
        burned:  'LED burned (I > 1.5× nominal)',
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0e14]">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-[#00d9ff]" />
                    <span className="text-[#e6e6e6] font-medium text-sm">LED Properties</span>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-[#00d9ff]"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={cn(
                            'h-7 px-3',
                            hasChanges
                                ? 'bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00a8cc]'
                                : 'bg-[#1a3a5c] text-[#9ca3af] cursor-not-allowed'
                        )}
                    >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Save
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* ── Identification ── */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Identification
                    </h3>
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">ID</Label>
                        <Input
                            value={localData.id ?? selectedNode.id}
                            readOnly
                            className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Name</Label>
                        <Input
                            value={localData.name ?? ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            placeholder="LED"
                        />
                    </div>
                    {/* Connection Status */}
                    <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[11px] space-y-1">
                        <div className="flex justify-between">
                            <span className="text-[#9ca3af]">Anode (＋)</span>
                            {localData.connectedPinAnode != null ? (
                                <span className="text-green-400">D{localData.connectedPinAnode} ✓</span>
                            ) : (
                                <span className="text-yellow-400">Not connected ⚠</span>
                            )}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#9ca3af]">Cathode (−)</span>
                            {localData.connectedPinCathode ? (
                                <span className="text-green-400">{localData.connectedPinCathode} ✓</span>
                            ) : (
                                <span className="text-yellow-400">Not connected ⚠</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Electrical Characteristics ── */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Electrical Characteristics
                    </h3>

                    {/* Color profile */}
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">LED Color</Label>
                        <Select
                            value={profileKey}
                            onValueChange={(v) => handleColorChange(v as LedColorProfile)}
                        >
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                {ALL_PROFILES.map((key) => (
                                    <SelectItem
                                        key={key}
                                        value={key}
                                        className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0"
                                                style={{ backgroundColor: ledProfiles[key].hex }}
                                            />
                                            {key}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Custom color */}
                    {profileKey === 'USER' && (
                        <div className="space-y-2">
                            <Label className="text-[#9ca3af] text-xs">Custom Color (HEX)</Label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={localData.customColorHex ?? '#cccccc'}
                                    onChange={(e) => handleChange('customColorHex', e.target.value)}
                                    className="w-8 h-8 rounded border border-[rgba(0,217,255,0.3)] bg-transparent cursor-pointer p-0"
                                />
                                <Input
                                    value={localData.customColorHex ?? ''}
                                    placeholder="#ff0000"
                                    onChange={(e) => handleChange('customColorHex', e.target.value)}
                                    className="flex-1 bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                                />
                            </div>
                        </div>
                    )}

                    {/* Vf / If_nom */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-[#9ca3af] text-xs">Forward Voltage (V)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={localData.forwardVoltage ?? ''}
                                onChange={(e) =>
                                    handleChange('forwardVoltage', parseFloat(e.target.value) || 0)
                                }
                                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[#9ca3af] text-xs">Nominal Current (A)</Label>
                            <Input
                                type="number"
                                step="0.001"
                                value={localData.nominalCurrent ?? ''}
                                onChange={(e) =>
                                    handleChange('nominalCurrent', parseFloat(e.target.value) || 0)
                                }
                                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            />
                        </div>
                    </div>

                    {/* Series Resistance */}
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Series Resistance (Ω)</Label>
                        <Select
                            value={
                                localData.internalResistance === 'USER'
                                    ? 'USER'
                                    : String(localData.internalResistance ?? 220)
                            }
                            onValueChange={handleResistorChange}
                        >
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                {resistorOptions.map((r) => (
                                    <SelectItem
                                        key={String(r)}
                                        value={String(r)}
                                        className="text-[#e6e6e6]"
                                    >
                                        {r === 'USER' ? 'Custom' : `${r} Ω`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {localData.internalResistance === 'USER' && (
                            <Input
                                type="number"
                                placeholder="Custom Ω"
                                value={localData.customResistance ?? ''}
                                onChange={(e) =>
                                    handleChange('customResistance', parseFloat(e.target.value) || 0)
                                }
                                className="mt-1 bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            />
                        )}
                    </div>
                </div>

                {/* ── Optical & Simulation ── */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Optical & Simulation
                    </h3>

                    {/* Burned banner */}
                    {localData.isBurned && (
                        <div className="flex items-center gap-2 p-2 rounded bg-red-500/15 border border-red-500/50 text-red-300 text-xs">
                            <Flame className="w-4 h-4 shrink-0" />
                            <span>LED Burned — overcurrent detected. Reset simulation to restore.</span>
                        </div>
                    )}

                    {/* Live calculations */}
                    <div className="space-y-1 text-xs text-[#9ca3af]">
                        <div className="flex justify-between">
                            <span>MCU</span>
                            <span className="text-[#e5e7eb]">{mcu.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>V_source</span>
                            <span className="text-[#e5e7eb]">{mcu.v_out.toFixed(1)} V</span>
                        </div>
                        <div className="flex justify-between">
                            <span>I_real</span>
                            <span className="text-[#e5e7eb]">{(iReal * 1000).toFixed(1)} mA</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Intensity</span>
                            <span className="text-[#e5e7eb]">
                                {intensity.toFixed(0)} mcd ({intPct}%)
                            </span>
                        </div>
                    </div>

                    {/* Safety banner (só se não safe) */}
                    {safety !== 'safe' && (
                        <div
                            className={cn(
                                'flex items-start gap-2 p-2 rounded-md border text-xs',
                                safetyBannerClass[safety]
                            )}
                        >
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">
                                    {safety === 'burned'
                                        ? 'LED burned!'
                                        : safety === 'error'
                                        ? 'MCU pin overload!'
                                        : 'Current above nominal'}
                                </div>
                                <div className="mt-0.5 text-[11px]">{safetyLabel[safety]}</div>
                            </div>
                        </div>
                    )}

                    {/* Initial State */}
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Initial State</Label>
                        <Select
                            value={localData.initialState ?? 'off'}
                            onValueChange={(v) => handleChange('initialState', v as 'on' | 'off')}
                        >
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                <SelectItem value="off" className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)]">
                                    Off
                                </SelectItem>
                                <SelectItem value="on" className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)]">
                                    On
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Brightness Override */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-[#9ca3af] text-xs">Brightness Override</Label>
                            <span className="text-[#00d9ff] text-xs">
                                {brtOverride != null ? `${Math.round(brtOverride * 100)}%` : 'Auto'}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={brtOverride ?? (intPct / 100)}
                            onChange={(e) => handleChange('brightnessOverride', parseFloat(e.target.value))}
                            className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]"
                        />
                        <div className="flex justify-between text-[10px] text-[#9ca3af]">
                            <span>0%</span>
                            <span className="text-[#6b7280] italic">
                                Auto uses I_real / If_nom
                            </span>
                            <span>100%</span>
                        </div>
                    </div>

                    {/* Polarity Enforce */}
                    <div className="flex items-center justify-between py-2">
                        <Label className="text-[#9ca3af] text-xs cursor-pointer">
                            Enforce Polarity
                        </Label>
                        <Switch
                            checked={localData.polarityEnforced ?? true}
                            onCheckedChange={(v) => handleChange('polarityEnforced', v)}
                            className="data-[state=checked]:bg-[#00d9ff]"
                        />
                    </div>
                    <p className="text-[10px] text-[#9ca3af] -mt-3">
                        When ON, reversed connections are treated as open-circuit (no light, no burn).
                    </p>
                </div>

                {/* ── Preview ── */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Preview
                    </h3>
                    <div className="flex flex-col items-center gap-3 p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
                        {/* LED bulb */}
                        <div className="relative flex items-center justify-center w-16 h-16">
                            {/* Glow ring */}
                            {isOnPreview && !localData.isBurned && (
                                <div
                                    className="absolute rounded-full transition-all duration-300"
                                    style={{
                                        width:  `${32 + glowSize}px`,
                                        height: `${32 + glowSize}px`,
                                        backgroundColor: displayColor,
                                        opacity: 0.18,
                                        filter: `blur(${glowSize / 2}px)`,
                                    }}
                                />
                            )}
                            {/* LED body */}
                            <div
                                className={cn(
                                    'w-8 h-8 rounded-full transition-all duration-300',
                                    localData.isBurned && 'ring-2 ring-red-500'
                                )}
                                style={{
                                    backgroundColor: displayColor,
                                    opacity:         previewOpacity,
                                    boxShadow:
                                        isOnPreview && !localData.isBurned
                                            ? `0 0 ${glowSize}px ${displayColor}99`
                                            : 'none',
                                }}
                            />
                            {/* Shine */}
                            {!localData.isBurned && (
                                <div
                                    className="absolute top-2.5 left-3 w-3 h-2 rounded-full bg-white opacity-30"
                                    style={{ pointerEvents: 'none' }}
                                />
                            )}
                        </div>

                        {/* Status row */}
                        <div className="flex items-center gap-2">
                            <div
                                className={cn(
                                    'w-2 h-2 rounded-full',
                                    localData.isBurned
                                        ? 'bg-red-500'
                                        : isOnPreview
                                        ? 'bg-green-400 animate-pulse'
                                        : 'bg-[#374151]'
                                )}
                            />
                            <span className="text-[11px] text-[#9ca3af]">
                                {localData.isBurned
                                    ? 'Burned'
                                    : isOnPreview
                                    ? `ON · ${(iReal * 1000).toFixed(1)} mA · ${intensity.toFixed(0)} mcd`
                                    : 'OFF'}
                            </span>
                        </div>

                        {/* Intensity bar */}
                        <div className="w-full h-1.5 bg-[#1a2a3a] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width:           `${brtOverride != null ? Math.round(brtOverride * 100) : intPct}%`,
                                    backgroundColor: localData.isBurned ? '#ef4444' : displayColor,
                                    opacity:         0.85,
                                }}
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LEDPropertiesPanel;
```
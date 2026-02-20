import React, { useEffect, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useUIStore } from '@/stores/useUIStore';
import { useSerialStore } from '@/stores/useSerialStore';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { cn } from '@/lib/utils';
import {
  ledProfiles,
  getActiveMicrocontrollerProfile,
  calculateRealCurrent,
  calculateLuminousIntensity,
  getSafetyStatus,
  type LedColorProfile,
  type ResistorOption,
} from '@/lib/ledCalculations';

interface LEDNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const LEDNode: React.FC<LEDNodeProps> = ({ data, selected, id }) => {
  // Estados visuais
  const [isOn, setIsOn] = useState<boolean>((data.isOn as boolean) ?? false);
  const [brightness, setBrightness] = useState<number>(
    (data.brightness as number) ?? 255
  );
  const [isBurned, setIsBurned] = useState<boolean>(
    (data.isBurned as boolean) ?? false
  );

  // Wiring
  const [isProperlyWired, setIsProperlyWired] = useState(false);
  const [connectedPin, setConnectedPin] = useState<number | null>(
    (data.connectedPin as number) ?? null
  );

  // Propriedades elétricas vindas do painel (com defaults seguros)
  const colorProfile: LedColorProfile =
    ((data.colorProfile as LedColorProfile) ?? 'RED') || 'RED';
  const profile = ledProfiles[colorProfile];

  const forwardVoltage =
    (data.forwardVoltage as number) || profile.vf || 2.0;

  const nominalCurrent =
    (data.nominalCurrent as number) || profile.if_nom || 0.02; // A

  const internalResistanceOption =
    (data.internalResistance as ResistorOption) ?? 220;

  const customResistance =
    (data.customResistance as number | undefined) ?? undefined;

  const effectiveResistance =
    internalResistanceOption === 'USER'
      ? customResistance || 220
      : internalResistanceOption || 220;

  const label = (data.name as string) || (data.label as string) || 'LED';

  const { connections } = useConnectionStore();
  const { openWindow } = useUIStore();

  const [realCurrent, setRealCurrent] = useState<number>(
    (data.realCurrent as number) ?? 0
  );
  const [luminousIntensity, setLuminousIntensity] = useState<number>(
    (data.luminousIntensity as number) ?? 0
  );

  const handleDoubleClick = useCallback(() => {
    openWindow('properties');
  }, [openWindow]);

  // Check wiring and find connected MCU pin
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

      if (hasAnodeConnection && !hasCathodeConnection) {
        const serialStore = (useSerialStore as any).getState();
        if (serialStore && serialStore.addTerminalLine) {
          // We only log if simulation is actually starting or running to avoid spam
          const simStatus = (useSimulationStore as any).getState().status;
          if (simStatus === 'running') {
            serialStore.addTerminalLine(`⚠️ LED (${label}): Anode connected to pin, but Cathode is NOT connected to GND. It won't light up!`, 'warning');
          }
        }
      }

      if (anodeConnection) {
        const otherEnd =
          anodeConnection.source === `${id}:anode`
            ? anodeConnection.target
            : anodeConnection.source;

        // Isolating the handle ID (e.g., 'mcu-1:D13' -> 'D13')
        const handleParts = otherEnd.split(':');
        const handleId = handleParts.length > 1 ? handleParts[handleParts.length - 1] : otherEnd;

        // Match only number in the specific handle ID
        const pinMatch = handleId.match(/(\d+)/);
        if (pinMatch) {
          const pinNumber = Number(pinMatch[1]);
          setConnectedPin(pinNumber);
        }
      } else {
        setConnectedPin(null);
      }
    };

    checkWiring();
  }, [connections, id]);

  // Calcula física do LED dado o estado (on/off)
  const recalcPhysics = useCallback(
    (isActive: boolean) => {
      const mcu = getActiveMicrocontrollerProfile();
      if (!isActive || !isProperlyWired || effectiveResistance <= 0) {
        setRealCurrent(0);
        setLuminousIntensity(0);
        setBrightness(0);
        return;
      }

      const iReal = calculateRealCurrent(
        mcu.v_out,
        forwardVoltage,
        effectiveResistance
      );
      const intensity = calculateLuminousIntensity(
        profile.mcd,
        iReal,
        nominalCurrent
      );
      const safety = getSafetyStatus(iReal, nominalCurrent, mcu.max_ma);

      setRealCurrent(iReal);
      setLuminousIntensity(intensity);

      if (safety === 'burned') {
        setIsBurned(true);
        setIsOn(false);
        setBrightness(0);
        return;
      }

      const ratio =
        nominalCurrent > 0 ? Math.min(1, Math.max(0, iReal / nominalCurrent)) : 0;
      setBrightness(Math.round(50 + ratio * 205));

      setIsOn(isActive);
    },
    [
      effectiveResistance,
      forwardVoltage,
      isProperlyWired,
      nominalCurrent,
      profile.mcd,
    ]
  );

  // Listen for pin changes from simulation engine
  useEffect(() => {
    const unsubscribe = simulationEngine.on('pinChange', (event) => {
      const pinEvent = event as {
        pin: number;
        value: 'HIGH' | 'LOW' | number;
      };

      if (connectedPin === null || Number(connectedPin) !== Number(pinEvent.pin)) {
        return;
      }

      let isActive = false;
      if (typeof pinEvent.value === 'number') {
        isActive = pinEvent.value > 0;
      } else {
        isActive = pinEvent.value === 'HIGH';
      }

      recalcPhysics(isActive);
    });

    return unsubscribe;
  }, [connectedPin, recalcPhysics, id]);

  // Reset LED state when simulation stops
  useEffect(() => {
    const unsubscribe = simulationEngine.on('simulationStopped', () => {
      setIsOn(false);
      setBrightness(0);
      setRealCurrent(0);
      setLuminousIntensity(0);
      setIsBurned(false);
    });

    return unsubscribe;
  }, []);

  const displayColor =
    colorProfile === 'USER'
      ? ((data.customColorHex as string) || ledProfiles.USER.hex)
      : ledProfiles[colorProfile].hex;

  const strokeColor = isBurned ? '#ff4d4f' : isOn ? displayColor : '#444';
  const fillOpacity = isBurned ? 0.2 : isOn ? 0.3 + (brightness / 255) * 0.7 : 0.4;

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
      <svg width="60" height="60" viewBox="0 0 60 60">
        <defs>
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur
              stdDeviation={isOn && !isBurned ? 6 : 2}
              result="coloredBlur"
            />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id={`ledGradient-${id}`} cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.8} />
            <stop
              offset="100%"
              stopColor={isBurned ? '#333333' : displayColor}
              stopOpacity={1}
            />
          </radialGradient>
        </defs>

        <circle
          cx="30"
          cy="30"
          r="20"
          fill={`url(#ledGradient-${id})`}
          stroke={strokeColor}
          strokeWidth={2}
          filter={isOn && !isBurned ? `url(#glow-${id})` : 'none'}
          style={{
            opacity: isBurned ? 0.2 : fillOpacity,
            transition: 'all 0.1s ease-out',
          }}
        />

        <ellipse
          cx="25"
          cy="20"
          rx="8"
          ry="5"
          fill="white"
          opacity={isOn && !isBurned ? 0.6 : 0.2}
          style={{ transition: 'opacity 0.1s ease-out' }}
        />

        <line x1="22" y1="50" x2="22" y2="60" stroke="#888" strokeWidth="2" />
        <line x1="38" y1="50" x2="38" y2="60" stroke="#888" strokeWidth="2" />
      </svg>

      <div
        className={cn(
          'absolute top-1 right-1 w-2 h-2 rounded-full',
          isBurned
            ? 'bg-red-500'
            : isOn
              ? 'bg-green-400 animate-pulse'
              : 'bg-gray-600'
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

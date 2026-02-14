import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { boardConfigs, useSimulationStore } from '@/stores/useSimulationStore';
import { useUIStore } from '@/stores/useUIStore';
import { simulationEngine } from '@/engine/SimulationEngine';
import { cn } from '@/lib/utils';
import type { BoardType } from '@/types';
import arduinoUnoSvg from '@/components/boards/arduino/svg/arduino-uno-r3.svg';

interface MCUNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

const SVG_VIEWBOX_WIDTH = 171;
const SVG_VIEWBOX_HEIGHT = 129;
const SVG_RENDER_WIDTH = 260;
const SVG_RENDER_HEIGHT = (SVG_VIEWBOX_HEIGHT / SVG_VIEWBOX_WIDTH) * SVG_RENDER_WIDTH;
const SCALE = SVG_RENDER_WIDTH / SVG_VIEWBOX_WIDTH;

// Pin configuration
const PIN_RADIUS = 2.198;
const PIN_DIAMETER = PIN_RADIUS * 2 * SCALE;

// LED configuration
const LED_RADIUS = 2.198;
const LED_DIAMETER = LED_RADIUS * 2 * SCALE;

// LED mapping (extracted from arduino-uno-r3.svg)
const LED_MAP = [
  { id: 'led-pin13', cx: 74.43, cy: 26.163, linkedPin: 13, color: '#ff8c00', type: 'pin' as const },
  { id: 'led-tx', cx: 74.43, cy: 39.537, linkedPin: 1, color: '#ffd700', type: 'uart-tx' as const },
  { id: 'led-rx', cx: 74.43, cy: 45.32, linkedPin: 0, color: '#ffd700', type: 'uart-rx' as const },
  { id: 'led-power', cx: 147.433, cy: 39.717, linkedPin: null, color: '#00ff00', type: 'power' as const },
];

const PIN_MAP = [
  { id: 'D0', cx: 159.977, cy: 3.933, position: Position.Top },
  { id: 'D1', cx: 153.705, cy: 3.933, position: Position.Top },
  { id: 'D2', cx: 147.433, cy: 3.933, position: Position.Top },
  { id: 'D3', cx: 141.162, cy: 3.933, position: Position.Top },
  { id: 'D4', cx: 134.89, cy: 3.933, position: Position.Top },
  { id: 'D5', cx: 128.618, cy: 3.933, position: Position.Top },
  { id: 'D6', cx: 122.346, cy: 3.933, position: Position.Top },
  { id: 'D7', cx: 116.075, cy: 3.933, position: Position.Top },
  { id: 'D8', cx: 105.789, cy: 3.933, position: Position.Top },
  { id: 'D9', cx: 99.517, cy: 3.933, position: Position.Top },
  { id: 'D10', cx: 93.245, cy: 3.933, position: Position.Top },
  { id: 'D11', cx: 86.974, cy: 3.933, position: Position.Top },
  { id: 'D12', cx: 80.702, cy: 3.933, position: Position.Top },
  { id: 'D13', cx: 74.43, cy: 3.933, position: Position.Top },
  { id: 'GND', cx: 68.158, cy: 3.933, position: Position.Top },
  { id: 'AREF', cx: 61.886, cy: 3.933, position: Position.Top },
  { id: 'SDA', cx: 55.615, cy: 3.933, position: Position.Top },
  { id: 'SCL', cx: 49.343, cy: 3.933, position: Position.Top },
  { id: 'A0', cx: 128.832, cy: 123.071, position: Position.Bottom },
  { id: 'A1', cx: 135.103, cy: 123.071, position: Position.Bottom },
  { id: 'A2', cx: 141.375, cy: 123.071, position: Position.Bottom },
  { id: 'A3', cx: 147.647, cy: 123.071, position: Position.Bottom },
  { id: 'A4', cx: 153.919, cy: 123.071, position: Position.Bottom },
  { id: 'A5', cx: 160.191, cy: 123.071, position: Position.Bottom },
  { id: 'VIN', cx: 116.288, cy: 123.071, position: Position.Bottom },
  { id: 'GND_1', cx: 110.016, cy: 123.071, position: Position.Bottom },
  { id: 'GND_2', cx: 103.745, cy: 123.071, position: Position.Bottom },
  { id: '5V', cx: 97.473, cy: 123.071, position: Position.Bottom },
  { id: '3V3', cx: 91.201, cy: 123.071, position: Position.Bottom },
  { id: 'RESET', cx: 84.929, cy: 123.071, position: Position.Bottom },
  { id: 'IOREF', cx: 78.658, cy: 123.071, position: Position.Bottom },
];

const getPinColor = (pinId: string): string => {
  if (pinId.startsWith('GND')) return '#1f2937';
  if (pinId === '5V') return '#ef4444';
  if (pinId === '3V3') return '#f472b6';
  if (pinId === 'VIN') return '#fbbf24';
  if (pinId === 'RESET') return '#9ca3af';
  if (pinId === 'IOREF') return '#60a5fa';
  if (pinId === 'AREF') return '#a78bfa';
  if (pinId === 'SDA' || pinId === 'SCL') return '#10b981';
  if (pinId.startsWith('A')) return '#fbbf24';
  return '#00d9ff';
};

export const MCUNode: React.FC<MCUNodeProps> = ({ data, selected }) => {
  const mcuType = (data.mcuType as BoardType) || 'arduino-uno';
  const config = boardConfigs[mcuType];
  const label = (data.label as string) || config.name;
  
  // FIX: Read isRunning directly from store instead of data
  const status = useSimulationStore((state) => state.status);
  const isRunning = status === 'running';
  
  const useSvgBoard = (data.useSvgBoard as boolean) ?? false;
  const rotation = (data.rotation as number) ?? 0;
  const { openWindow } = useUIStore();
  const [hoveredPin, setHoveredPin] = useState<number | string | null>(null);
  const [selectedPin, setSelectedPin] = useState<number | string | null>(null);
  
  // MISSION 3: Track pin 13 value for LED
  const [pin13Value, setPin13Value] = useState<number>(0);

  // MISSION 3: Listen to pin changes from SimulationEngine
  useEffect(() => {
    const handlePinChange = (data: unknown) => {
      const event = data as { pin: number; value: number | 'HIGH' | 'LOW' };
      
      if (event.pin === 13) {
        // Convert 'HIGH'/'LOW' to numeric value (digitalWrite)
        // or use numeric value directly (analogWrite)
        let numericValue: number;
        
        if (event.value === 'HIGH') {
          numericValue = 255;
        } else if (event.value === 'LOW') {
          numericValue = 0;
        } else {
          numericValue = event.value as number;
        }
        
        setPin13Value(numericValue);
      }
    };

    // FIX: simulationEngine.on() returns a cleanup function
    const unsubscribe = simulationEngine.on('pinChange', handlePinChange);

    return () => {
      unsubscribe(); // Use the returned cleanup function
    };
  }, []);

  const handlePinClick = useCallback((pin: number | string) => {
    setSelectedPin(pin === selectedPin ? null : pin);
  }, [selectedPin]);

  const handleDoubleClick = useCallback(() => {
    openWindow('properties');
  }, [openWindow]);

  const isArduino = mcuType === 'arduino-uno';
  const isESP32 = mcuType === 'esp32-devkit';
  const isPico = mcuType === 'raspberry-pi-pico';

  // Normalize rotation for dimension calculations (but not for CSS transform)
  const normalizedRotation = rotation % 360;

  // Calculate container dimensions based on normalized rotation
  const containerDimensions = useMemo(() => {
    const isRotated90or270 = normalizedRotation === 90 || normalizedRotation === 270;
    if (useSvgBoard) {
      return {
        width: isRotated90or270 ? SVG_RENDER_HEIGHT : SVG_RENDER_WIDTH,
        height: isRotated90or270 ? SVG_RENDER_WIDTH : SVG_RENDER_HEIGHT,
      };
    }
    // CSS boards
    const baseWidth = isArduino ? 200 : 240;
    const baseHeight = isArduino ? 280 : 320;
    return {
      width: isRotated90or270 ? baseHeight : baseWidth,
      height: isRotated90or270 ? baseWidth : baseHeight,
    };
  }, [normalizedRotation, useSvgBoard, isArduino]);

  if (isArduino && useSvgBoard) {
    return (
      <div
        className="relative inline-block shadow-lg"
        onDoubleClick={handleDoubleClick}
        title="Double-click to open properties | Press R to rotate"
        style={{
          width: containerDimensions.width,
          height: containerDimensions.height,
        }}
      >
        {/* Rotatable content wrapper with fixed dimensions */}
        <div
          className={cn(
            'absolute top-1/2 left-1/2 rounded-lg',
            selected ? 'ring-2 ring-[#00d9ff]' : '',
            'transition-all duration-200'
          )}
          style={{
            width: SVG_RENDER_WIDTH,
            height: SVG_RENDER_HEIGHT,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.3s ease',
          }}
        >
          <img
            src={arduinoUnoSvg}
            alt={label}
            className="block w-full h-full select-none"
            draggable={false}
            style={{
              width: SVG_RENDER_WIDTH,
              height: SVG_RENDER_HEIGHT,
            }}
          />
          
          {/* Pin Handles */}
          {PIN_MAP.map((pin) => {
            const left = pin.cx * SCALE;
            const top = pin.cy * SCALE;
            const color = getPinColor(pin.id);
            const isHovered = hoveredPin === pin.id;
            
            return (
              <Handle
                key={pin.id}
                type="source"
                position={pin.position}
                id={pin.id}
                onMouseEnter={() => setHoveredPin(pin.id)}
                onMouseLeave={() => setHoveredPin(null)}
                style={{
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  transform: 'translate(-50%, -50%)',
                  width: PIN_DIAMETER,
                  height: PIN_DIAMETER,
                  borderRadius: '50%',
                  border: 'none',
                  background: color,
                  cursor: 'crosshair',
                  zIndex: 10,
                  opacity: 1,
                  boxShadow: isHovered ? `0 0 8px ${color}` : 'none',
                  transition: 'box-shadow 0.2s ease',
                  pointerEvents: 'all',
                }}
              />
            );
          })}

          {/* Functional LEDs with improved visual effects */}
          {LED_MAP.map((led) => {
            const left = led.cx * SCALE;
            const top = led.cy * SCALE;
            
            // Determine if LED should be ON based on type
            let isOn = false;
            let brightness = 0;
            
            if (led.type === 'power') {
              // MISSION 2: Power LED lights up when simulation is running
              isOn = isRunning;
              brightness = isOn ? 255 : 0;
            } else if (led.type === 'pin' && led.linkedPin === 13) {
              // MISSION 3: Pin 13 LED reacts to digitalWrite/analogWrite
              brightness = pin13Value;
              isOn = brightness > 0;
            }
            
            // Fallback color in case led.color is undefined
            const ledColor = led.color ?? '#9ca3af';
            
            // Calculate opacity based on brightness (0-255)
            const baseOpacity = isOn ? 0.3 + (brightness / 255) * 0.7 : 0.4;
            
            return (
              <div
                key={led.id}
                data-led-id={led.id}
                data-led-type={led.type}
                data-linked-pin={led.linkedPin ?? 'none'}
                style={{
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  transform: 'translate(-50%, -50%)',
                  width: LED_DIAMETER,
                  height: LED_DIAMETER,
                  borderRadius: '50%',
                  // Radial gradient effect (like LEDNode)
                  background: isOn 
                    ? `radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.8), ${ledColor})`
                    : '#9ca3af',
                  // Multi-layer glow effect (similar to LEDNode filter)
                  boxShadow: isOn 
                    ? `0 0 4px ${ledColor}, 
                       0 0 8px ${ledColor}, 
                       0 0 12px ${ledColor},
                       inset 0 0 3px rgba(255, 255, 255, 0.6)` 
                    : 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
                  // Fast transition like LEDNode (0.1s)
                  transition: 'all 0.1s ease-out',
                  pointerEvents: 'none',
                  zIndex: 5,
                  opacity: baseOpacity,
                  // Subtle border to define LED edge
                  border: isOn ? `1px solid ${ledColor}` : '1px solid #6b7280',
                }}
                title={`${led.id}${led.linkedPin !== null ? ` (Pin ${led.linkedPin})` : ' (Power)'}`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const getBoardColor = () => {
    if (isArduino) return 'bg-[#1a5fb4]';
    if (isESP32) return 'bg-[#2d5016]';
    if (isPico) return 'bg-[#c51e4a]';
    return 'bg-[#1a5fb4]';
  };

  const getBorderColor = () => {
    if (isArduino) return 'border-[#0d3a7a]';
    if (isESP32) return 'border-[#1a3a0d]';
    if (isPico) return 'border-[#8b1539]';
    return 'border-[#0d3a7a]';
  };

  // CSS Board rendering with rotation
  return (
    <div
      className="relative inline-block"
      onDoubleClick={handleDoubleClick}
      title="Double-click to open properties | Press R to rotate"
      style={{
        width: containerDimensions.width,
        height: containerDimensions.height,
      }}
    >
      <div
        className={cn(
          'absolute top-1/2 left-1/2 rounded-lg overflow-hidden border-4 shadow-lg',
          selected ? 'ring-2 ring-[#00d9ff]' : '',
          selected ? 'border-[#00d9ff]' : getBorderColor(),
          isArduino ? 'w-[200px] h-[280px]' : 'w-[240px] h-[320px]',
          'transition-all duration-200'
        )}
        style={{
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: 'transform 0.3s ease',
        }}
      >
        <div className={cn('w-full h-full', getBoardColor())}>
          <div className={cn('px-3 py-2', getBorderColor())}>
            <span className="text-white text-xs font-bold truncate block">{label}</span>
          </div>
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-12 h-8 bg-[#333] rounded border-2 border-[#555]" />
          <div className="absolute top-20 left-0 flex flex-col gap-1">
            <div className="flex items-center gap-1 relative">
              <button
                className={cn(
                  'w-3 h-3 rounded-full transition-all duration-150',
                  selectedPin === '5V' ? 'bg-red-400 scale-125 ring-2 ring-white' :
                  hoveredPin === '5V' ? 'bg-red-300 scale-110' : 'bg-red-500 hover:bg-red-400'
                )}
                onMouseEnter={() => setHoveredPin('5V')}
                onMouseLeave={() => setHoveredPin(null)}
                onClick={() => handlePinClick('5V')}
              />
              <span className="text-[8px] text-white">5V</span>
              <Handle type="source" position={Position.Left} id="5V"
                style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: 12, height: 12, background: 'transparent', border: 'none', opacity: 0, zIndex: 20, pointerEvents: 'all' }} />
            </div>
            <div className="flex items-center gap-1 relative">
              <button
                className={cn(
                  'w-3 h-3 rounded-full border border-gray-600 transition-all duration-150',
                  selectedPin === 'GND' ? 'bg-gray-500 scale-125 ring-2 ring-white' :
                  hoveredPin === 'GND' ? 'bg-gray-600 scale-110' : 'bg-black hover:bg-gray-700'
                )}
                onMouseEnter={() => setHoveredPin('GND')}
                onMouseLeave={() => setHoveredPin(null)}
                onClick={() => handlePinClick('GND')}
              />
              <span className="text-[8px] text-white">GND</span>
              <Handle type="source" position={Position.Left} id="GND"
                style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: 12, height: 12, background: 'transparent', border: 'none', opacity: 0, zIndex: 20, pointerEvents: 'all' }} />
            </div>
            <div className="flex items-center gap-1 relative">
              <button
                className={cn(
                  'w-3 h-3 rounded-full transition-all duration-150',
                  selectedPin === 'VIN' ? 'bg-yellow-300 scale-125 ring-2 ring-white' :
                  hoveredPin === 'VIN' ? 'bg-yellow-300 scale-110' : 'bg-yellow-500 hover:bg-yellow-400'
                )}
                onMouseEnter={() => setHoveredPin('VIN')}
                onMouseLeave={() => setHoveredPin(null)}
                onClick={() => handlePinClick('VIN')}
              />
              <span className="text-[8px] text-white">VIN</span>
              <Handle type="source" position={Position.Left} id="VIN"
                style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: 12, height: 12, background: 'transparent', border: 'none', opacity: 0, zIndex: 20, pointerEvents: 'all' }} />
            </div>
          </div>
          <div className="absolute top-20 right-0 flex flex-col gap-0.5">
            {config.digitalPins.slice(0, 14).map((pin) => (
              <div key={pin} className="flex items-center gap-1 relative">
                <span className="text-[7px] text-white">D{pin}</span>
                <button
                  className={cn(
                    'w-2.5 h-2.5 rounded-full transition-all duration-150',
                    selectedPin === pin ? 'bg-[#00d9ff] scale-125 ring-2 ring-white' :
                    hoveredPin === pin ? 'bg-white scale-110' : 'bg-[#00d9ff] hover:bg-white'
                  )}
                  onMouseEnter={() => setHoveredPin(pin)}
                  onMouseLeave={() => setHoveredPin(null)}
                  onClick={() => handlePinClick(pin)}
                />
                <Handle type="source" position={Position.Right} id={`D${pin}`}
                  style={{ position: 'absolute', right: '50%', top: '50%', transform: 'translate(50%, -50%)',
                    width: 12, height: 12, background: 'transparent', border: 'none', opacity: 0, zIndex: 20, pointerEvents: 'all' }} />
              </div>
            ))}
          </div>
          <div className="absolute bottom-4 left-2 flex flex-row gap-1">
            {config.analogPins.slice(0, 6).map((pin, i) => (
              <div key={pin} className="flex flex-col items-center gap-0.5 relative">
                <button
                  className={cn(
                    'w-2.5 h-2.5 rounded-full transition-all duration-150',
                    selectedPin === pin ? 'bg-[#ffd600] scale-125 ring-2 ring-white' :
                    hoveredPin === pin ? 'bg-white scale-110' : 'bg-[#ffd600] hover:bg-white'
                  )}
                  onMouseEnter={() => setHoveredPin(pin)}
                  onMouseLeave={() => setHoveredPin(null)}
                  onClick={() => handlePinClick(pin)}
                />
                <span className="text-[7px] text-white">A{i}</span>
                <Handle type="source" position={Position.Bottom} id={`A${i}`}
                  style={{ position: 'absolute', bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)',
                    width: 12, height: 12, background: 'transparent', border: 'none', opacity: 0, zIndex: 20, pointerEvents: 'all' }} />
              </div>
            ))}
          </div>
          <div className="absolute bottom-4 right-4">
            <div className="w-6 h-4 bg-[#333] rounded border border-[#555] flex items-center justify-center">
              <span className="text-[6px] text-white">RST</span>
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className={cn(
              'w-12 h-16 rounded border flex items-center justify-center',
              isArduino ? 'bg-[#222] border-[#444]' : isESP32 ? 'bg-[#1a1a1a] border-[#333]' : 'bg-[#1a1a1a] border-[#333]'
            )}>
              <span className="text-[8px] text-[#666]">
                {isArduino ? 'ATmega' : isESP32 ? 'ESP32' : 'RP2040'}
              </span>
            </div>
          </div>
          <div className="absolute top-16 left-1/2 -translate-x-1/2">
            <div className={cn(
              'w-2 h-2 rounded-full transition-colors duration-200',
              isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
            )} />
          </div>
        </div>
        {selectedPin !== null && (
          <div className="absolute bottom-8 left-2 right-2 bg-black/80 rounded px-2 py-1 text-center">
            <span className="text-[10px] text-[#00d9ff]">
              {typeof selectedPin === 'string' ? selectedPin : `Pin ${selectedPin}`} selected
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MCUNode;

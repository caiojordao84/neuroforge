import React, { useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { boardConfigs } from '@/stores/useSimulationStore';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';
import type { BoardType } from '@/types';

interface MCUNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const MCUNode: React.FC<MCUNodeProps> = ({ data, selected }) => {
  const mcuType = (data.mcuType as BoardType) || 'arduino-uno';
  const config = boardConfigs[mcuType];
  const label = (data.label as string) || config.name;
  const isRunning = (data.isRunning as boolean) ?? false;
  const { openWindow } = useUIStore();

  // Track which pins are being hovered
  const [hoveredPin, setHoveredPin] = useState<number | string | null>(null);
  // Track selected pin for configuration
  const [selectedPin, setSelectedPin] = useState<number | string | null>(null);

  const handlePinClick = useCallback((pin: number | string) => {
    setSelectedPin(pin === selectedPin ? null : pin);
  }, [selectedPin]);

  const handleDoubleClick = useCallback(() => {
    openWindow('properties');
  }, [openWindow]);

  const isArduino = mcuType === 'arduino-uno';
  const isESP32 = mcuType === 'esp32-devkit';
  const isPico = mcuType === 'raspberry-pi-pico';

  // Get board color based on type
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

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden',
        'border-4',
        selected ? 'border-[#00d9ff]' : getBorderColor(),
        'shadow-lg transition-all duration-200',
        isArduino ? 'w-[200px] h-[280px]' : 'w-[240px] h-[320px]'
      )}
      onDoubleClick={handleDoubleClick}
      title="Double-click to open properties"
    >
      {/* Board background */}
      <div className={cn('w-full h-full', getBoardColor())}>
        {/* Header with board name */}
        <div className={cn('px-3 py-2', getBorderColor())}>
          <span className="text-white text-xs font-bold truncate block">{label}</span>
        </div>

        {/* USB Port */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-12 h-8 bg-[#333] rounded border-2 border-[#555]" />

        {/* Power pins on left with interactive hitboxes */}
        <div className="absolute top-20 left-0 flex flex-col gap-1">
          {/* 5V Pin */}
          <div className="flex items-center gap-1 relative">
            <button
              className={cn(
                'w-3 h-3 rounded-full transition-all duration-150',
                selectedPin === '5V'
                  ? 'bg-red-400 scale-125 ring-2 ring-white'
                  : hoveredPin === '5V'
                    ? 'bg-red-300 scale-110'
                    : 'bg-red-500 hover:bg-red-400'
              )}
              title={`5V Power${selectedPin === '5V' ? ' (Selected)' : ''}`}
              onMouseEnter={() => setHoveredPin('5V')}
              onMouseLeave={() => setHoveredPin(null)}
              onClick={() => handlePinClick('5V')}
            />
            <span className="text-[8px] text-white">5V</span>
            {/* Power handle for wiring - source type so other nodes can connect to it */}
            <Handle
              type="source"
              position={Position.Left}
              id="5V"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                background: 'transparent',
                border: 'none',
                opacity: 0,
                zIndex: 20,
              }}
            />
          </div>

          {/* GND Pin */}
          <div className="flex items-center gap-1 relative">
            <button
              className={cn(
                'w-3 h-3 rounded-full border border-gray-600 transition-all duration-150',
                selectedPin === 'GND'
                  ? 'bg-gray-500 scale-125 ring-2 ring-white'
                  : hoveredPin === 'GND'
                    ? 'bg-gray-600 scale-110'
                    : 'bg-black hover:bg-gray-700'
              )}
              title={`GND${selectedPin === 'GND' ? ' (Selected)' : ''}`}
              onMouseEnter={() => setHoveredPin('GND')}
              onMouseLeave={() => setHoveredPin(null)}
              onClick={() => handlePinClick('GND')}
            />
            <span className="text-[8px] text-white">GND</span>
            {/* Power handle for wiring - source type so other nodes can connect to it */}
            <Handle
              type="source"
              position={Position.Left}
              id="GND"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                background: 'transparent',
                border: 'none',
                opacity: 0,
                zIndex: 20,
              }}
            />
          </div>

          {/* VIN Pin */}
          <div className="flex items-center gap-1 relative">
            <button
              className={cn(
                'w-3 h-3 rounded-full transition-all duration-150',
                selectedPin === 'VIN'
                  ? 'bg-yellow-300 scale-125 ring-2 ring-white'
                  : hoveredPin === 'VIN'
                    ? 'bg-yellow-300 scale-110'
                    : 'bg-yellow-500 hover:bg-yellow-400'
              )}
              title={`VIN${selectedPin === 'VIN' ? ' (Selected)' : ''}`}
              onMouseEnter={() => setHoveredPin('VIN')}
              onMouseLeave={() => setHoveredPin(null)}
              onClick={() => handlePinClick('VIN')}
            />
            <span className="text-[8px] text-white">VIN</span>
            {/* Power handle for wiring - source type so other nodes can connect to it */}
            <Handle
              type="source"
              position={Position.Left}
              id="VIN"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                background: 'transparent',
                border: 'none',
                opacity: 0,
                zIndex: 20,
              }}
            />
          </div>
        </div>

        {/* Digital pins on right with interactive hitboxes */}
        <div className="absolute top-20 right-0 flex flex-col gap-0.5">
          {config.digitalPins.slice(0, 14).map((pin) => (
            <div key={pin} className="flex items-center gap-1 relative">
              <span className="text-[7px] text-white">D{pin}</span>
              <button
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-150',
                  selectedPin === pin
                    ? 'bg-[#00d9ff] scale-125 ring-2 ring-white'
                    : hoveredPin === pin
                      ? 'bg-white scale-110'
                      : 'bg-[#00d9ff] hover:bg-white'
                )}
                title={`Digital Pin ${pin}${selectedPin === pin ? ' (Selected)' : ''}`}
                onMouseEnter={() => setHoveredPin(pin)}
                onMouseLeave={() => setHoveredPin(null)}
                onClick={() => handlePinClick(pin)}
              />
              {/* Pin handle for wiring */}
              <Handle
                type="source"
                position={Position.Right}
                id={`D${pin}`}
                style={{
                  position: 'absolute',
                  right: '50%',
                  top: '50%',
                  transform: 'translate(50%, -50%)',
                  width: 12,
                  height: 12,
                  background: 'transparent',
                  border: 'none',
                  opacity: 0,
                  zIndex: 20,
                }}
              />
            </div>
          ))}
        </div>

        {/* Analog pins on bottom */}
        <div className="absolute bottom-4 left-2 flex flex-row gap-1">
          {config.analogPins.slice(0, 6).map((pin, i) => (
            <div key={pin} className="flex flex-col items-center gap-0.5 relative">
              <button
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-150',
                  selectedPin === pin
                    ? 'bg-[#ffd600] scale-125 ring-2 ring-white'
                    : hoveredPin === pin
                      ? 'bg-white scale-110'
                      : 'bg-[#ffd600] hover:bg-white'
                )}
                title={`Analog Pin A${i}${selectedPin === pin ? ' (Selected)' : ''}`}
                onMouseEnter={() => setHoveredPin(pin)}
                onMouseLeave={() => setHoveredPin(null)}
                onClick={() => handlePinClick(pin)}
              />
              <span className="text-[7px] text-white">A{i}</span>
              {/* Pin handle for wiring */}
              <Handle
                type="source"
                position={Position.Bottom}
                id={`A${i}`}
                style={{
                  position: 'absolute',
                  bottom: '50%',
                  left: '50%',
                  transform: 'translate(-50%, 50%)',
                  width: 12,
                  height: 12,
                  background: 'transparent',
                  border: 'none',
                  opacity: 0,
                  zIndex: 20,
                }}
              />
            </div>
          ))}
        </div>

        {/* Reset button */}
        <div className="absolute bottom-4 right-4">
          <div className="w-6 h-4 bg-[#333] rounded border border-[#555] flex items-center justify-center">
            <span className="text-[6px] text-white">RST</span>
          </div>
        </div>

        {/* Main chip */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className={cn(
            'w-12 h-16 rounded border flex items-center justify-center',
            isArduino ? 'bg-[#222] border-[#444]' :
              isESP32 ? 'bg-[#1a1a1a] border-[#333]' :
                'bg-[#1a1a1a] border-[#333]'
          )}>
            <span className="text-[8px] text-[#666]">
              {isArduino ? 'ATmega' : isESP32 ? 'ESP32' : 'RP2040'}
            </span>
          </div>
        </div>

        {/* Status LED */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2">
          <div className={cn(
            'w-2 h-2 rounded-full transition-colors duration-200',
            isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
          )} />
        </div>

      </div>

      {/* Selected pin indicator */}
      {selectedPin !== null && (
        <div className="absolute bottom-8 left-2 right-2 bg-black/80 rounded px-2 py-1 text-center">
          <span className="text-[10px] text-[#00d9ff]">
            {typeof selectedPin === 'string' ? selectedPin : `Pin ${selectedPin}`} selected
          </span>
        </div>
      )}
    </div>
  );
};

export default MCUNode;

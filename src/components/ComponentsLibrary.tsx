import React, { useCallback } from 'react';
import type { ComponentType, ComponentLibraryItem } from '@/types';
import { cn } from '@/lib/utils';
import {
  Lightbulb,
  Palette,
  CircleDot,
  RotateCw,
  SlidersHorizontal,
  Cpu,
  Wifi,
  Bluetooth
} from 'lucide-react';

const componentItems: ComponentLibraryItem[] = [
  {
    type: 'mcu',
    name: 'Arduino Uno R3',
    description: 'ATmega328P - 14 digital, 6 analog pins',
    icon: 'Cpu',
    defaultData: {
      mcuType: 'arduino-uno',
      label: 'Arduino Uno',
      isRunning: false,
    },
  },
  {
    type: 'mcu',
    name: 'ESP32 DevKit',
    description: '38 GPIO, WiFi/Bluetooth enabled',
    icon: 'Wifi',
    defaultData: {
      mcuType: 'esp32-devkit',
      label: 'ESP32 DevKit',
      isRunning: false,
    },
  },
  {
    type: 'mcu',
    name: 'Raspberry Pi Pico',
    description: 'RP2040 - 26 GPIO, 3 analog pins',
    icon: 'Bluetooth',
    defaultData: {
      mcuType: 'raspberry-pi-pico',
      label: 'Raspberry Pi Pico',
      isRunning: false,
    },
  },
  {
    type: 'led',
    name: 'LED',
    description: 'Single color LED (Red, Green, Blue, Yellow, White)',
    icon: 'Lightbulb',
    defaultData: {
      color: '#ff0000',
      isOn: false,
      brightness: 255,
    },
  },
  {
    type: 'rgbLed',
    name: 'RGB LED',
    description: 'RGB LED with Red, Green, Blue channels',
    icon: 'Palette',
    defaultData: {
      rgbColor: { r: 255, g: 0, b: 0 },
      isCommonAnode: false,
    },
  },
  {
    type: 'button',
    name: 'Push Button',
    description: 'Momentary push button with pull-up/down support',
    icon: 'CircleDot',
    defaultData: {
      isPressed: false,
      isPullUp: false,
    },
  },
  {
    type: 'servo',
    name: 'Servo Motor',
    description: 'Standard servo motor (0-180 degrees)',
    icon: 'RotateCw',
    defaultData: {
      angle: 90,
      minAngle: 0,
      maxAngle: 180,
    },
  },
  {
    type: 'potentiometer',
    name: 'Potentiometer',
    description: 'Variable resistor (0-1023 analog output)',
    icon: 'SlidersHorizontal',
    defaultData: {
      value: 512,
      percentage: 50,
    },
  },
];

const iconMap: Record<string, React.ElementType> = {
  Lightbulb,
  Palette,
  CircleDot,
  RotateCw,
  SlidersHorizontal,
  Cpu,
  Wifi,
  Bluetooth,
};

export const ComponentsLibrary: React.FC = () => {
  const onDragStart = useCallback(
    (event: React.DragEvent, componentType: ComponentType, defaultData: Record<string, unknown>) => {
      // Set the drag data
      event.dataTransfer.setData('application/reactflow', componentType);
      event.dataTransfer.setData('componentData', JSON.stringify(defaultData));
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3',
          'bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]'
        )}
      >
        <h3 className="text-[#e6e6e6] text-sm font-medium">Components</h3>
        <p className="text-[#9ca3af] text-xs mt-1">
          Drag components to the canvas
        </p>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {componentItems.map((item) => {
          const Icon = iconMap[item.icon];

          return (
            <div
              key={item.name}
              draggable
              onDragStart={(e) => onDragStart(e, item.type, item.defaultData)}
              className={cn(
                'group p-3 rounded-lg cursor-move',
                'bg-[#151b24] border border-[rgba(0,217,255,0.2)]',
                'hover:border-[#00d9ff] hover:bg-[rgba(0,217,255,0.05)]',
                'transition-all duration-200'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg shrink-0',
                    'bg-[#0a0e14] border border-[rgba(0,217,255,0.3)]',
                    'flex items-center justify-center',
                    'group-hover:border-[#00d9ff] group-hover:shadow-lg group-hover:shadow-[#00d9ff]/10',
                    'transition-all duration-200'
                  )}
                >
                  <Icon className="w-5 h-5 text-[#00d9ff]" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-[#e6e6e6] text-sm font-medium">
                    {item.name}
                  </h4>
                  <p className="text-[#9ca3af] text-xs mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className={cn(
          'px-4 py-2',
          'bg-[#151b24] border-t border-[rgba(0,217,255,0.2)]',
          'text-[#666] text-xs'
        )}
      >
        <p>Tip: Drag MCUs first, then connect components to pins</p>
      </div>
    </div>
  );
};

export default ComponentsLibrary;

<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { asl } from '../../../../state/asl.svelte.js';
  import { cn } from '../../../../../lib/utils';

  interface Props {
    id?: string;
    data: {
      label?: string;
      mcuType?: string;
      rotation?: number;
      [key: string]: any;
    };
    selected?: boolean;
  }

  let { id, data, selected = false } = $props<Props>();

  const mcuType = data.mcuType || 'arduino-uno';
  const label = data.label || 'Arduino Uno R3';
  const rotation = data.rotation || 0;

  // Constants consistent with original React version
  const SVG_VIEWBOX_WIDTH = 171;
  const SVG_VIEWBOX_HEIGHT = 129;
  const SVG_RENDER_WIDTH = 260;
  const SCALE = SVG_RENDER_WIDTH / SVG_VIEWBOX_WIDTH;
  const SVG_RENDER_HEIGHT = (SVG_VIEWBOX_HEIGHT / SVG_VIEWBOX_WIDTH) * SVG_RENDER_WIDTH;
  
  const PIN_RADIUS = 2.198;
  const PIN_DIAMETER = PIN_RADIUS * 2 * SCALE;
  const LED_RADIUS = 2.198;
  const LED_DIAMETER = LED_RADIUS * 2 * SCALE;

  // Pin Map from React source
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

  // LED Map from React source
  const LED_MAP = [
    { id: 'led-pin13', cx: 74.43, cy: 26.163, linkedPin: 13, color: '#ff8c00', type: 'pin' },
    { id: 'led-tx', cx: 74.43, cy: 39.537, linkedPin: 1, color: '#ffd700', type: 'uart-tx' },
    { id: 'led-rx', cx: 74.43, cy: 45.32, linkedPin: 0, color: '#ffd700', type: 'uart-rx' },
    { id: 'led-power', cx: 147.433, cy: 39.717, linkedPin: null, color: '#00ff00', type: 'power' },
  ];

  function getPinColor(pinId: string): string {
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
  }

  // Reactive simulation status
  let isRunning = $derived(asl.status === 'running');
  
  // Track led states (mocked or from ASL events later)
  // For now, let's just make the Power LED work with 'isRunning'
</script>

<div
  class="relative inline-block shadow-xl rounded-lg bg-surface-container-low p-0 group"
  style="width: {SVG_RENDER_WIDTH}px; height: {SVG_RENDER_HEIGHT}px;"
>
  <!-- Board SVG Background -->
  <img
    src="/boards/arduino-uno-r3.svg"
    alt={label}
    class="block w-full h-full select-none"
    draggable="false"
  />

  <!-- Selection Ring -->
  <div 
    class={cn(
      "absolute inset-0 rounded-lg pointer-events-none border-2 transition-all duration-300",
      selected ? "border-primary-fixed-dim shadow-[0_0_20px_rgba(236,195,0,0.3)]" : "border-transparent"
    )}
  ></div>

  <!-- Pin Handles -->
  {#each PIN_MAP as pin}
    {@const left = pin.cx * SCALE}
    {@const top = pin.cy * SCALE}
    {@const color = getPinColor(pin.id)}
    
    <div 
      class="absolute z-10"
      style="left: {left}px; top: {top}px; transform: translate(-50%, -50%);"
    >
      <Handle
        type="source"
        position={pin.position}
        id={pin.id}
        style="width: {PIN_DIAMETER}px; height: {PIN_DIAMETER}px; background: {color}; border: 1px solid rgba(255,255,255,0.2); cursor: crosshair;"
        class="hover:scale-125 transition-transform duration-150 shadow-sm"
      />
      <!-- Pin Label on Hover -->
      <div class="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1 bg-black/80 text-[8px] text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
        {pin.id}
      </div>
    </div>
  {/each}

  <!-- Functional LEDs -->
  {#each LED_MAP as led}
    {@const left = led.cx * SCALE}
    {@const top = led.cy * SCALE}
    {@const isOn = led.type === 'power' ? isRunning : false}
    {@const ledColor = led.color}

    <div
      class="absolute z-5 rounded-full transition-all duration-300"
      style="
        left: {left}px; 
        top: {top}px; 
        transform: translate(-50%, -50%);
        width: {LED_DIAMETER}px;
        height: {LED_DIAMETER}px;
        background: {isOn ? `radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.8), ${ledColor})` : '#333'};
        box-shadow: {isOn ? `0 0 10px ${ledColor}, 0 0 5px ${ledColor}` : 'inset 0 1px 2px rgba(0,0,0,0.5)'};
        opacity: {isOn ? 1 : 0.4};
      "
      title="{led.id}"
    ></div>
  {/each}
</div>

<style>
  :global(.svelte-flow__handle) {
    min-width: 0 !important;
    min-height: 0 !important;
  }
</style>

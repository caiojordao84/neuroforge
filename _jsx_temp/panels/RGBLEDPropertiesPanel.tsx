import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Palette, RotateCcw, Save } from 'lucide-react';
import {
  calculateRealCurrent,
  getSafetyStatus,
  getActiveMicrocontrollerProfile,
  resistorOptions,
  type ResistorOption,
  type SafetyStatus,
} from '@/lib/ledCalculations';

// --- TIPOS ---

interface RGBLEDNodeData {
  label?: string;
  isCommonAnode?: boolean;
  r?: number;
  g?: number;
  b?: number;
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
  connectedPins?: {
    red?: number;
    green?: number;
    blue?: number;
    common?: string;
  };
}

// --- HELPERS ---

interface ChannelCalc {
  current_ma: number;
  status: SafetyStatus;
}

function calcChannelLive(
  Vf: number,
  resistor: ResistorOption,
  customResistance: number | undefined,
  nominalCurrent: number,
  vOut: number,
  mcuMaxMa: number
): ChannelCalc {
  const R = resistor === 'USER' ? (customResistance ?? 220) : resistor;
  const I = calculateRealCurrent(vOut, Vf, R);
  const status = getSafetyStatus(I, nominalCurrent, mcuMaxMa);
  return { current_ma: Math.round(I * 10000) / 10, status };
}

const statusColors: Record<SafetyStatus, string> = {
  safe:    'text-green-400',
  warning: 'text-yellow-400',
  error:   'text-red-400',
  burned:  'text-gray-400',
};

const statusBg: Record<SafetyStatus, string> = {
  safe:    'bg-green-500/10 border-green-500/30',
  warning: 'bg-yellow-500/10 border-yellow-500/30',
  error:   'bg-red-500/10 border-red-500/30',
  burned:  'bg-gray-500/10 border-gray-500/30',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

// --- COMPONENTE ---

export const RGBLEDPropertiesPanel: React.FC = () => {
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const selectedNode = nodes.find((n) => n.selected && n.type === 'rgbLed');

  const [localData, setLocalData] = useState<RGBLEDNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data;
    setLocalData({
      label:              (d.label as string)              || 'RGB LED',
      isCommonAnode:      (d.isCommonAnode as boolean)     ?? false,
      r:                  (d.r as number)                  ?? 255,
      g:                  (d.g as number)                  ?? 255,
      b:                  (d.b as number)                  ?? 255,
      brightness:         (d.brightness as number)         ?? 1,
      initialState:       (d.initialState as RGBLEDNodeData['initialState']) || 'off',
      pulseSpeed:         (d.pulseSpeed as number)         ?? 1,
      rainbowSpeed:       (d.rainbowSpeed as number)       ?? 1,
      rForwardVoltage:    (d.rForwardVoltage as number)    ?? 2.0,
      gForwardVoltage:    (d.gForwardVoltage as number)    ?? 3.2,
      bForwardVoltage:    (d.bForwardVoltage as number)    ?? 3.2,
      rResistor:          (d.rResistor as ResistorOption)  ?? 220,
      gResistor:          (d.gResistor as ResistorOption)  ?? 220,
      bResistor:          (d.bResistor as ResistorOption)  ?? 220,
      rCustomResistance:  (d.rCustomResistance as number)  ?? 220,
      gCustomResistance:  (d.gCustomResistance as number)  ?? 220,
      bCustomResistance:  (d.bCustomResistance as number)  ?? 220,
      nominalCurrent:     (d.nominalCurrent as number)     ?? 0.020,
      connectedPins:      (d.connectedPins as RGBLEDNodeData['connectedPins']),
    });
    setHasChanges(false);
  }, [selectedNode?.id]);

  const handleChange = useCallback(
    <K extends keyof RGBLEDNodeData>(key: K, value: RGBLEDNodeData[K]) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    }, []
  );

  // Sync color picker ↔ R/G/B sliders
  const handleColorPicker = useCallback((hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    setLocalData((prev) => ({ ...prev, r, g, b }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    // connectedPins é read-only — não persistir
    const { connectedPins, ...persistable } = localData;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, ...persistable } } : n
      )
    );
    setHasChanges(false);
  }, [selectedNode, localData, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    const d = selectedNode.data;
    setLocalData({
      label:              (d.label as string)              || 'RGB LED',
      isCommonAnode:      (d.isCommonAnode as boolean)     ?? false,
      r:                  (d.r as number)                  ?? 255,
      g:                  (d.g as number)                  ?? 255,
      b:                  (d.b as number)                  ?? 255,
      brightness:         (d.brightness as number)         ?? 1,
      initialState:       (d.initialState as RGBLEDNodeData['initialState']) || 'off',
      pulseSpeed:         (d.pulseSpeed as number)         ?? 1,
      rainbowSpeed:       (d.rainbowSpeed as number)       ?? 1,
      rForwardVoltage:    (d.rForwardVoltage as number)    ?? 2.0,
      gForwardVoltage:    (d.gForwardVoltage as number)    ?? 3.2,
      bForwardVoltage:    (d.bForwardVoltage as number)    ?? 3.2,
      rResistor:          (d.rResistor as ResistorOption)  ?? 220,
      gResistor:          (d.gResistor as ResistorOption)  ?? 220,
      bResistor:          (d.bResistor as ResistorOption)  ?? 220,
      rCustomResistance:  (d.rCustomResistance as number)  ?? 220,
      gCustomResistance:  (d.gCustomResistance as number)  ?? 220,
      bCustomResistance:  (d.bCustomResistance as number)  ?? 220,
      nominalCurrent:     (d.nominalCurrent as number)     ?? 0.020,
      connectedPins:      (d.connectedPins as RGBLEDNodeData['connectedPins']),
    });
    setHasChanges(false);
  }, [selectedNode]);

  // Live calculations
  const mcu = useMemo(() => getActiveMicrocontrollerProfile(), []);
  const nominalCurrent = localData.nominalCurrent ?? 0.020;

  const chR = useMemo(() => calcChannelLive(
    localData.rForwardVoltage ?? 2.0,
    localData.rResistor ?? 220,
    localData.rCustomResistance,
    nominalCurrent, mcu.v_out, mcu.max_ma
  ), [localData.rForwardVoltage, localData.rResistor, localData.rCustomResistance, nominalCurrent, mcu]);

  const chG = useMemo(() => calcChannelLive(
    localData.gForwardVoltage ?? 3.2,
    localData.gResistor ?? 220,
    localData.gCustomResistance,
    nominalCurrent, mcu.v_out, mcu.max_ma
  ), [localData.gForwardVoltage, localData.gResistor, localData.gCustomResistance, nominalCurrent, mcu]);

  const chB = useMemo(() => calcChannelLive(
    localData.bForwardVoltage ?? 3.2,
    localData.bResistor ?? 220,
    localData.bCustomResistance,
    nominalCurrent, mcu.v_out, mcu.max_ma
  ), [localData.bForwardVoltage, localData.bResistor, localData.bCustomResistance, nominalCurrent, mcu]);

  // Display color (respeita isCommonAnode)
  const isCommonAnode = localData.isCommonAnode ?? false;
  const displayR = isCommonAnode ? 255 - (localData.r ?? 255) : (localData.r ?? 255);
  const displayG = isCommonAnode ? 255 - (localData.g ?? 255) : (localData.g ?? 255);
  const displayB = isCommonAnode ? 255 - (localData.b ?? 255) : (localData.b ?? 255);
  const rgbColor = `rgb(${displayR}, ${displayG}, ${displayB})`;
  const isOn = localData.initialState !== 'off';

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <Palette className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select an RGB LED component to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">RGB LED Properties</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm" onClick={handleReset}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm" onClick={handleSave} disabled={!hasChanges}
            className={cn('h-7 px-3', hasChanges ? 'bg-[#00d9ff] text-[#0a0e14]' : 'bg-[#1a3a5c] text-[#9ca3af]')}
          >
            <Save className="w-3.5 h-3.5 mr-1" />Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* IDENTIFICATION */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Identification</h3>

          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">ID</Label>
            <Input
              value={selectedNode.id} readOnly
              className="bg-[#0d1219] border-[rgba(0,217,255,0.15)] text-[#4a5568] text-xs h-7 cursor-default"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Display Name</Label>
            <Input
              value={localData.label || ''}
              onChange={(e) => handleChange('label', e.target.value)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-[#9ca3af] text-xs cursor-pointer">Common Anode</Label>
              <p className="text-[10px] text-[#4a5568] mt-0.5">
                {isCommonAnode
                  ? 'Common pin connects to VCC (+). Each channel is LOW to activate.'
                  : 'Common pin connects to GND (−). Each channel is HIGH to activate.'}
              </p>
            </div>
            <Switch
              checked={isCommonAnode}
              onCheckedChange={(v) => handleChange('isCommonAnode', v)}
              className="data-[state=checked]:bg-[#00d9ff] ml-3 flex-shrink-0"
            />
          </div>
        </div>

        {/* PIN MAPPING — read-only */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Pin Mapping</h3>
          <div className="grid grid-cols-4 gap-1 text-[10px]">
            {(['red', 'green', 'blue'] as const).map((ch, i) => {
              const pin = localData.connectedPins?.[ch];
              const labels = ['R', 'G', 'B'];
              const colors = ['text-red-400', 'text-green-400', 'text-blue-400'];
              const borders = ['border-red-500/20', 'border-green-500/20', 'border-blue-500/20'];
              return (
                <div key={ch} className={cn('p-1.5 bg-[#0d1219] rounded border text-center', borders[i])}>
                  <div className={cn('font-bold', colors[i])}>{labels[i]}</div>
                  <div className={pin != null ? 'text-green-400' : 'text-yellow-500'}>
                    {pin != null ? `D${pin} ✓` : '⚠'}
                  </div>
                </div>
              );
            })}
            <div className="p-1.5 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.1)] text-center">
              <div className="text-[#9ca3af] font-bold">COM</div>
              <div className={localData.connectedPins?.common ? 'text-green-400' : 'text-yellow-500'}>
                {localData.connectedPins?.common ?? '⚠'}
              </div>
            </div>
          </div>
        </div>

        {/* COLOR (RGB) */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Color (RGB)</h3>

          {/* Color picker nativo — sincroniza com R/G/B */}
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={rgbToHex(localData.r ?? 255, localData.g ?? 255, localData.b ?? 255)}
              onChange={(e) => handleColorPicker(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-[rgba(0,217,255,0.3)] bg-transparent p-0.5"
            />
            <span className="text-[10px] text-[#4a5568] font-mono">
              {rgbToHex(localData.r ?? 255, localData.g ?? 255, localData.b ?? 255).toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'r', label: 'R', color: 'text-red-400', border: 'border-red-500/30' },
                { key: 'g', label: 'G', color: 'text-green-400', border: 'border-green-500/30' },
                { key: 'b', label: 'B', color: 'text-blue-400', border: 'border-blue-500/30' },
              ] as const
            ).map(({ key, label, color, border }) => (
              <div key={key} className="space-y-1">
                <Label className={cn('text-xs', color)}>{label}</Label>
                <Input
                  type="number" min={0} max={255}
                  value={localData[key] ?? 255}
                  onChange={(e) => handleChange(key, Math.max(0, Math.min(255, parseInt(e.target.value) || 0)))}
                  className={cn('bg-[#151b24] text-sm h-8 border', border, color)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[#9ca3af] text-xs">Brightness</Label>
              <span className="text-[#00d9ff] text-xs">{Math.round((localData.brightness ?? 1) * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={localData.brightness ?? 1}
              onChange={(e) => handleChange('brightness', parseFloat(e.target.value))}
              className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]"
            />
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
            <div
              className="w-12 h-12 rounded-full transition-all duration-300 relative"
              style={{
                backgroundColor: rgbColor,
                opacity: isOn ? 0.3 + (localData.brightness ?? 1) * 0.7 : 0.2,
                boxShadow: isOn ? `0 0 24px 8px ${rgbColor}80` : 'none',
              }}
            >
              <div className="absolute top-1 left-2 w-4 h-2.5 rounded-full bg-white opacity-40" />
            </div>
          </div>
        </div>

        {/* ELECTRICAL PER CHANNEL */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Electrical (per channel)</h3>

          {/* Vf row */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { vKey: 'rForwardVoltage', label: 'R Vf (V)', color: 'text-red-400', border: 'border-red-500/30' },
                { vKey: 'gForwardVoltage', label: 'G Vf (V)', color: 'text-green-400', border: 'border-green-500/30' },
                { vKey: 'bForwardVoltage', label: 'B Vf (V)', color: 'text-blue-400', border: 'border-blue-500/30' },
              ] as const
            ).map(({ vKey, label, color, border }) => (
              <div key={vKey} className="space-y-1">
                <Label className={cn('text-xs', color)}>{label}</Label>
                <Input
                  type="number" step={0.1} min={0.5} max={4.0}
                  value={localData[vKey] ?? 2.0}
                  onChange={(e) => handleChange(vKey, parseFloat(e.target.value))}
                  className={cn('bg-[#151b24] text-sm h-8 border', border, color)}
                />
              </div>
            ))}
          </div>

          {/* Resistor row */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { rKey: 'rResistor', cKey: 'rCustomResistance', label: 'R (Ω)', color: 'text-red-400' },
                { rKey: 'gResistor', cKey: 'gCustomResistance', label: 'G (Ω)', color: 'text-green-400' },
                { rKey: 'bResistor', cKey: 'bCustomResistance', label: 'B (Ω)', color: 'text-blue-400' },
              ] as const
            ).map(({ rKey, cKey, label, color }) => (
              <div key={rKey} className="space-y-1">
                <Label className={cn('text-xs', color)}>{label}</Label>
                <Select
                  value={String(localData[rKey] ?? 220)}
                  onValueChange={(v) => handleChange(rKey, v === 'USER' ? 'USER' : (parseInt(v) as ResistorOption))}
                >
                  <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                    {resistorOptions.map((o) => (
                      <SelectItem key={String(o)} value={String(o)} className="text-[#e6e6e6] text-xs">
                        {o === 'USER' ? 'Custom...' : `${o} Ω`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {localData[rKey] === 'USER' && (
                  <Input
                    type="number" min={1} placeholder="Ω"
                    value={localData[cKey] ?? 220}
                    onChange={(e) => handleChange(cKey, parseInt(e.target.value))}
                    className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-xs h-7 mt-1"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Nominal current (shared) */}
          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Nominal Current (shared, mA)</Label>
            <Input
              type="number" step={1} min={1} max={50}
              value={Math.round((localData.nominalCurrent ?? 0.020) * 1000)}
              onChange={(e) => handleChange('nominalCurrent', parseInt(e.target.value) / 1000)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
            />
          </div>
        </div>

        {/* LIVE CALCULATIONS */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Live Calculations</h3>
          <p className="text-[10px] text-[#4a5568]">MCU: {mcu.name} — {mcu.v_out}V / {mcu.max_ma}mA max per pin</p>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { ch: chR, label: 'R', color: 'text-red-400' },
                { ch: chG, label: 'G', color: 'text-green-400' },
                { ch: chB, label: 'B', color: 'text-blue-400' },
              ]
            ).map(({ ch, label, color }) => (
              <div
                key={label}
                className={cn('p-2 rounded border text-center text-[11px]', statusBg[ch.status])}
              >
                <div className={cn('font-bold', color)}>{label}</div>
                <div className={cn('font-mono', statusColors[ch.status])}>
                  {ch.current_ma.toFixed(1)} mA
                </div>
                <div className={cn('text-[9px] capitalize', statusColors[ch.status])}>
                  {ch.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SIMULATION */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Simulation</h3>

          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Initial State</Label>
            <Select
              value={localData.initialState || 'off'}
              onValueChange={(v) => handleChange('initialState', v as RGBLEDNodeData['initialState'])}
            >
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
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-[#9ca3af] text-xs">Pulse Speed</Label>
                <span className="text-[#00d9ff] text-xs">{localData.pulseSpeed ?? 1}x</span>
              </div>
              <input
                type="range" min={0.5} max={5} step={0.5}
                value={localData.pulseSpeed ?? 1}
                onChange={(e) => handleChange('pulseSpeed', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]"
              />
            </div>
          )}

          {localData.initialState === 'rainbow' && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-[#9ca3af] text-xs">Rainbow Speed</Label>
                <span className="text-[#00d9ff] text-xs">{localData.rainbowSpeed ?? 1}x</span>
              </div>
              <input
                type="range" min={0.5} max={5} step={0.5}
                value={localData.rainbowSpeed ?? 1}
                onChange={(e) => handleChange('rainbowSpeed', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]"
              />
              <p className="text-[10px] text-[#4a5568]">1x ≈ full cycle in 5s</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default RGBLEDPropertiesPanel;

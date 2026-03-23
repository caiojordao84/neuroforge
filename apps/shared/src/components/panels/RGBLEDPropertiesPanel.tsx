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
            <Palette className="w-3.5 h-3.5 mr-1" /> Save
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
              : 'Common pin → GND (-). Each channel is HIGH to activate.'}
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

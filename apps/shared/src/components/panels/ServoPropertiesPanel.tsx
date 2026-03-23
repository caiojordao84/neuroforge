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

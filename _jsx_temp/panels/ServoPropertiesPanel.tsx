import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Cog, RotateCcw, Save } from 'lucide-react';

// --- TIPOS ---

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

interface ServoNodeData {
  label?: string;
  modelName?: string;
  servoType?: ServoType;
  minAngle?: number;
  maxAngle?: number;
  initialAngle?: number;       // standard: ângulo inicial (0–maxAngle)
  initialSpeed?: number;       // continuous: -100 a +100 (%), 0 = stop
  minPulseWidth?: number;
  maxPulseWidth?: number;
  pwmFrequency?: number;
  smoothing?: number;          // 0.0–1.0
  connectedPin?: number;       // read-only
  isPwmPin?: boolean;          // read-only
}

// --- MODELOS ---
// NOTA: voltage, torque, current_stall, notes são lookup-only —
// NÃO persistir no ServoNodeData ao fazer Save.

const servoModels: ServoModel[] = [
  {
    name: 'SG50',
    servoType: 'standard_90',
    minAngle: 0, maxAngle: 90,
    minPulse: 500, maxPulse: 2400,
    voltage: '4.8–6V', torque: '1.5 kg·cm @ 4.8V',
    current_stall: '650mA',
    notes: 'Compact 90° servo. Good for tight space applications.',
  },
  {
    name: 'SG90',
    servoType: 'standard_180',
    minAngle: 0, maxAngle: 180,
    minPulse: 500, maxPulse: 2400,
    voltage: '4.8–5V', torque: '1.8 kg·cm @ 4.8V',
    current_stall: '700mA',
    notes: 'Standard micro servo. Ideal for small robotics.',
  },
  {
    name: 'MG996R',
    servoType: 'standard_180',
    minAngle: 0, maxAngle: 180,
    minPulse: 500, maxPulse: 2500,
    voltage: '4.8–7.2V', torque: '9.4 kg·cm @ 4.8V',
    current_stall: '2500mA',
    notes: 'High-torque metal gear servo.',
  },
  {
    name: 'DS3218',
    servoType: 'standard_270',
    minAngle: 0, maxAngle: 270,
    minPulse: 500, maxPulse: 2500,
    voltage: '4.8–6.8V', torque: '21 kg·cm @ 4.8V',
    current_stall: '1500mA',
    notes: 'Wide-angle servo. 270° travel range.',
  },
  {
    name: 'FS90R',
    servoType: 'continuous_360',
    minAngle: 0, maxAngle: 360,
    minPulse: 500, maxPulse: 2500,
    voltage: '4.8–6V', torque: '1.3 kg·cm @ 4.8V',
    current_stall: '800mA',
    notes: 'Continuous rotation. PWM ~1500µs = stop; <1500µs = CCW; >1500µs = CW.',
  },
];

// --- HELPERS ---

function getPwmNeutral(model: ServoModel): number {
  return Math.round((model.minPulse + model.maxPulse) / 2);
}

function speedToPulse(speed: number, model: ServoModel): number {
  const neutral = getPwmNeutral(model);
  if (speed === 0) return neutral;
  if (speed > 0) return Math.round(neutral + (speed / 100) * (model.maxPulse - neutral));
  return Math.round(neutral + (speed / 100) * (neutral - model.minPulse));
}

// --- COMPONENTE ---

export const ServoPropertiesPanel: React.FC = () => {
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const selectedNode = nodes.find((n) => n.selected && n.type === 'servo');

  const [localData, setLocalData] = useState<ServoNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Modelo activo para info card (lookup-only, nunca persistido)
  const activeModel = useMemo(
    () => servoModels.find((m) => m.name === localData.modelName) ?? servoModels[1],
    [localData.modelName]
  );

  const isContinuous = localData.servoType === 'continuous_360';

  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data;
    setLocalData({
      label:         (d.label as string)        || 'Servo',
      modelName:     (d.modelName as string)     || 'SG90',
      servoType:     (d.servoType as ServoType)  || 'standard_180',
      minAngle:      (d.minAngle as number)      ?? 0,
      maxAngle:      (d.maxAngle as number)      ?? 180,
      initialAngle:  (d.initialAngle as number)  ?? 90,
      initialSpeed:  (d.initialSpeed as number)  ?? 0,
      minPulseWidth: (d.minPulseWidth as number) ?? 500,
      maxPulseWidth: (d.maxPulseWidth as number) ?? 2400,
      pwmFrequency:  (d.pwmFrequency as number)  ?? 50,
      smoothing:     (d.smoothing as number)     ?? 0.5,
      connectedPin:  d.connectedPin as number | undefined,
      isPwmPin:      d.isPwmPin as boolean | undefined,
    });
    setHasChanges(false);
  }, [selectedNode?.id]);

  const handleChange = useCallback(
    <K extends keyof ServoNodeData>(key: K, value: ServoNodeData[K]) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    }, []
  );

  const handleModelChange = useCallback((modelName: string) => {
    const model = servoModels.find((m) => m.name === modelName);
    if (!model) return;
    setLocalData((prev) => ({
      ...prev,
      modelName,
      servoType:     model.servoType,
      minAngle:      model.minAngle,
      maxAngle:      model.maxAngle,
      minPulseWidth: model.minPulse,
      maxPulseWidth: model.maxPulse,
      // Reset posição inicial ao mudar modelo
      initialAngle: model.servoType !== 'continuous_360'
        ? Math.round(model.maxAngle / 2)
        : prev.initialAngle,
      initialSpeed: model.servoType === 'continuous_360' ? 0 : prev.initialSpeed,
    }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    // NOTA: voltage, torque, current_stall, notes NÃO entram no setNodes
    const { connectedPin, isPwmPin, ...persistable } = localData;
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
      label:         (d.label as string)        || 'Servo',
      modelName:     (d.modelName as string)     || 'SG90',
      servoType:     (d.servoType as ServoType)  || 'standard_180',
      minAngle:      (d.minAngle as number)      ?? 0,
      maxAngle:      (d.maxAngle as number)      ?? 180,
      initialAngle:  (d.initialAngle as number)  ?? 90,
      initialSpeed:  (d.initialSpeed as number)  ?? 0,
      minPulseWidth: (d.minPulseWidth as number) ?? 500,
      maxPulseWidth: (d.maxPulseWidth as number) ?? 2400,
      pwmFrequency:  (d.pwmFrequency as number)  ?? 50,
      smoothing:     (d.smoothing as number)     ?? 0.5,
      connectedPin:  d.connectedPin as number | undefined,
      isPwmPin:      d.isPwmPin as boolean | undefined,
    });
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

  // PWM mapping info (read-only)
  const midAngle = Math.round((localData.minAngle ?? 0) + ((localData.maxAngle ?? 180) - (localData.minAngle ?? 0)) / 2);
  const midPulse = Math.round(((localData.minPulseWidth ?? 500) + (localData.maxPulseWidth ?? 2400)) / 2);

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Cog className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">Servo Properties</span>
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

          {/* ID read-only */}
          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">ID</Label>
            <Input
              value={selectedNode.id}
              readOnly
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

          {/* Model select */}
          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Model</Label>
            <Select value={localData.modelName || 'SG90'} onValueChange={handleModelChange}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="SG50"   className="text-[#e6e6e6] text-xs">SG50 — 90° Standard</SelectItem>
                <SelectItem value="SG90"   className="text-[#e6e6e6] text-xs">SG90 — 180° Standard</SelectItem>
                <SelectItem value="MG996R" className="text-[#e6e6e6] text-xs">MG996R — 180° High Torque</SelectItem>
                <SelectItem value="DS3218" className="text-[#e6e6e6] text-xs">DS3218 — 270° Wide Angle</SelectItem>
                <SelectItem value="FS90R"  className="text-[#e6e6e6] text-xs">FS90R — 360° Continuous</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info card — lookup-only, nunca persistido */}
          {activeModel && (
            <div className="p-3 bg-[#0d1219] rounded-md border border-[rgba(0,217,255,0.15)] space-y-1">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <span className="text-[#4a5568]">Voltage</span>
                <span className="text-[#9ca3af]">{activeModel.voltage}</span>
                <span className="text-[#4a5568]">Torque</span>
                <span className="text-[#9ca3af]">{activeModel.torque}</span>
                <span className="text-[#4a5568]">Stall Current</span>
                <span className="text-[#9ca3af]">{activeModel.current_stall}</span>
              </div>
              <p className="text-[10px] text-[#4a5568] mt-1 leading-relaxed">{activeModel.notes}</p>
            </div>
          )}
        </div>

        {/* WIRING — read-only */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Wiring</h3>
          <div className="p-3 bg-[#0d1219] rounded-md border border-[rgba(0,217,255,0.15)] space-y-2 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-[#4a5568]">Signal Pin</span>
              {localData.connectedPin != null ? (
                <span className={cn(
                  'font-mono',
                  localData.isPwmPin ? 'text-green-400' : 'text-red-400'
                )}>
                  D{localData.connectedPin}{localData.isPwmPin ? ' (PWM) ✓' : ' ⚠ Not PWM'}
                </span>
              ) : (
                <span className="text-yellow-500">Not connected ⚠</span>
              )}
            </div>
            {localData.connectedPin != null && !localData.isPwmPin && (
              <div className="mt-1 px-2 py-1 bg-red-900/20 border border-red-500/30 rounded text-[10px] text-red-400">
                ⚠ Pin D{localData.connectedPin} is not PWM-capable. Move to a PWM pin (e.g. D3, D5, D6, D9, D10, D11).
              </div>
            )}
          </div>
        </div>

        {/* MOTION CONFIGURATION — condicional por servoType */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Motion Configuration</h3>

          {!isContinuous ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[#9ca3af] text-xs">Min Angle (°)</Label>
                  <Input
                    type="number" readOnly
                    value={localData.minAngle ?? 0}
                    className="bg-[#0d1219] border-[rgba(0,217,255,0.15)] text-[#4a5568] text-sm h-8 cursor-default"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[#9ca3af] text-xs">Max Angle (°)</Label>
                  <Input
                    type="number" readOnly
                    value={localData.maxAngle ?? 180}
                    className="bg-[#0d1219] border-[rgba(0,217,255,0.15)] text-[#4a5568] text-sm h-8 cursor-default"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[#9ca3af] text-xs">Initial Angle (°)</Label>
                  <span className="text-[#00d9ff] text-xs">{localData.initialAngle ?? 90}°</span>
                </div>
                <input
                  type="range"
                  min={localData.minAngle ?? 0}
                  max={localData.maxAngle ?? 180}
                  step={1}
                  value={localData.initialAngle ?? 90}
                  onChange={(e) => handleChange('initialAngle', parseInt(e.target.value))}
                  className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]"
                />
                <div className="flex justify-between text-[10px] text-[#4a5568]">
                  <span>{localData.minAngle ?? 0}°</span>
                  <span>{localData.maxAngle ?? 180}°</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-[#9ca3af] text-xs">PWM Neutral (µs)</Label>
                <Input
                  type="number" readOnly
                  value={getPwmNeutral(activeModel)}
                  className="bg-[#0d1219] border-[rgba(0,217,255,0.15)] text-[#4a5568] text-sm h-8 cursor-default"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[#9ca3af] text-xs">Initial Speed (%)</Label>
                  <span className={cn(
                    'text-xs font-mono',
                    (localData.initialSpeed ?? 0) > 0 ? 'text-green-400' :
                    (localData.initialSpeed ?? 0) < 0 ? 'text-blue-400' : 'text-[#9ca3af]'
                  )}>
                    {(localData.initialSpeed ?? 0) > 0 ? `+${localData.initialSpeed}% CW` :
                     (localData.initialSpeed ?? 0) < 0 ? `${localData.initialSpeed}% CCW` : '0% STOP'}
                  </span>
                </div>
                <input
                  type="range"
                  min={-100} max={100} step={1}
                  value={localData.initialSpeed ?? 0}
                  onChange={(e) => handleChange('initialSpeed', parseInt(e.target.value))}
                  className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]"
                />
                <div className="flex justify-between text-[10px] text-[#4a5568]">
                  <span>-100% CCW</span>
                  <span>STOP</span>
                  <span>+100% CW</span>
                </div>
                <div className="text-[10px] text-[#4a5568] text-center mt-1">
                  PWM: {speedToPulse(localData.initialSpeed ?? 0, activeModel)} µs
                </div>
              </div>
            </>
          )}
        </div>

        {/* PWM CONFIGURATION */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">PWM Configuration</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">Min Pulse (µs)</Label>
              <Input
                type="number"
                value={localData.minPulseWidth ?? 500}
                onChange={(e) => handleChange('minPulseWidth', parseInt(e.target.value))}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">Max Pulse (µs)</Label>
              <Input
                type="number"
                value={localData.maxPulseWidth ?? 2400}
                onChange={(e) => handleChange('maxPulseWidth', parseInt(e.target.value))}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">PWM Frequency (Hz)</Label>
            <Input
              type="number"
              value={localData.pwmFrequency ?? 50}
              onChange={(e) => handleChange('pwmFrequency', parseInt(e.target.value))}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
            />
          </div>

          {/* PWM Mapping info */}
          <div className="p-2 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.1)] text-[10px] text-[#4a5568] space-y-0.5 font-mono">
            <div>PWM   0/255 → {localData.minAngle ?? 0}° ({localData.minPulseWidth ?? 500} µs)</div>
            <div>PWM 127/255 → {midAngle}° ({midPulse} µs)</div>
            <div>PWM 255/255 → {localData.maxAngle ?? 180}° ({localData.maxPulseWidth ?? 2400} µs)</div>
          </div>

          {/* Movement Damping */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[#9ca3af] text-xs">Movement Damping</Label>
              <span className="text-[#00d9ff] text-xs">{Math.round((localData.smoothing ?? 0.5) * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={localData.smoothing ?? 0.5}
              onChange={(e) => handleChange('smoothing', parseFloat(e.target.value))}
              className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]"
            />
            <p className="text-[10px] text-[#4a5568]">0% = instant, 100% = slow & smooth</p>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Preview</h3>
          <div className="flex flex-col items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
            {!isContinuous ? (
              <>
                {/* Standard servo — arco + agulha */}
                <svg width="100" height="60" viewBox="0 0 100 60">
                  {/* Arco de range */}
                  <path
                    d={describeArc(50, 55, 40, -(localData.maxAngle ?? 180) / 2, (localData.maxAngle ?? 180) / 2)}
                    fill="none"
                    stroke="rgba(0,217,255,0.2)"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                  {/* Agulha */}
                  <line
                    x1={50}
                    y1={55}
                    x2={
                      50 + 38 * Math.sin(((localData.initialAngle ?? 90) - (localData.maxAngle ?? 180) / 2) * Math.PI / 180)
                    }
                    y2={
                      55 - 38 * Math.cos(((localData.initialAngle ?? 90) - (localData.maxAngle ?? 180) / 2) * Math.PI / 180)
                    }
                    stroke="#00d9ff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Centro */}
                  <circle cx={50} cy={55} r={4} fill="#00d9ff" />
                </svg>
                <div className="text-xs text-[#9ca3af] mt-1">
                  {localData.initialAngle ?? 90}° / {localData.maxAngle ?? 180}°
                </div>
              </>
            ) : (
              <>
                {/* Continuous — seta circular */}
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx={30} cy={30} r={22} fill="none" stroke="rgba(0,217,255,0.2)" strokeWidth="2" strokeDasharray="4 2" />
                  {(localData.initialSpeed ?? 0) !== 0 && (
                    <path
                      d="M30 8 L34 16 L30 14 L26 16 Z"
                      fill="#00d9ff"
                      transform={`rotate(${(localData.initialSpeed ?? 0) > 0 ? 0 : 180}, 30, 30)`}
                    />
                  )}
                  {(localData.initialSpeed ?? 0) === 0 && (
                    <rect x={26} y={24} width={8} height={12} rx={2} fill="#4a5568" />
                  )}
                </svg>
                <div className="text-xs text-[#9ca3af] mt-1">
                  {(localData.initialSpeed ?? 0) > 0
                    ? `CW — ${localData.initialSpeed}%`
                    : (localData.initialSpeed ?? 0) < 0
                    ? `CCW — ${Math.abs(localData.initialSpeed ?? 0)}%`
                    : 'STOP'}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// Helper SVG arc
function describeArc(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number
): string {
  const toRad = (d: number) => (d - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export default ServoPropertiesPanel;

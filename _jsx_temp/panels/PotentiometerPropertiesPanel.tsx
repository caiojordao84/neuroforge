import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, RotateCcw, Save } from 'lucide-react';
import {
  taperMap,
  getWiperResistance,
  getWiperVoltage,
  getAdcValue,
  getWiperPower,
  type TaperType,
} from '@/lib/potentiometerCalculations';

// --- TIPOS ---

interface PotentiometerNodeData {
  label?: string;
  resistance?: number;
  tolerance?: number;
  taper?: TaperType;
  initialValue?: number;     // posição inicial do wiper (0–100%)
  powerRating?: number;      // W
  wiperPosition?: number;    // espelho de initialValue — usado em runtime
  vcc?: number;              // tensão de alimentação (default 5V)
  connectedPin?: number;     // read-only — pino ADC ligado
  isAnalogPin?: boolean;     // read-only — confirmação de pino ADC
}

// --- HELPERS ---

function formatResistance(r: number): string {
  return r >= 1000 ? `${(r / 1000).toFixed(1)} kΩ` : `${r} Ω`;
}

const taperDescriptions: Record<TaperType, string> = {
  linear:  'Linear (B) — proportional response. Common for voltage dividers.',
  log:     'Logarithmic (A) — slow start, fast end. Audio volume control.',
  antilog: 'Anti-Log (C) — fast start, slow end. Inverse audio applications.',
};

// Gera pontos para o gráfico SVG da curva taper
function buildCurvePath(taper: TaperType, w: number, h: number): string {
  const steps = 50;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const pct = i / steps;
    const val = taperMap(pct * 100, taper);
    return `${(pct * w).toFixed(1)},${(h - val * h).toFixed(1)}`;
  });
  return `M ${points.join(' L ')}`;
}

// --- COMPONENTE ---

export const PotentiometerPropertiesPanel: React.FC = () => {
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const selectedNode = nodes.find((n) => n.selected && n.type === 'potentiometer');

  const [localData, setLocalData] = useState<PotentiometerNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data;
    setLocalData({
      label:         (d.label as string)         || 'Potentiometer',
      resistance:    (d.resistance as number)     ?? 10000,
      tolerance:     (d.tolerance as number)      ?? 20,
      taper:         (d.taper as TaperType)       || 'linear',
      initialValue:  (d.initialValue as number)   ?? 50,
      powerRating:   (d.powerRating as number)    ?? 0.5,
      wiperPosition: (d.wiperPosition as number)  ?? 50,
      vcc:           (d.vcc as number)            ?? 5.0,
      connectedPin:  d.connectedPin as number | undefined,
      isAnalogPin:   d.isAnalogPin as boolean | undefined,
    });
    setHasChanges(false);
  }, [selectedNode?.id]);

  const handleChange = useCallback(
    <K extends keyof PotentiometerNodeData>(key: K, value: PotentiometerNodeData[K]) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    }, []
  );

  // Slider de posição — actualiza initialValue e wiperPosition em sincronia
  const handlePositionChange = useCallback((pct: number) => {
    setLocalData((prev) => ({ ...prev, initialValue: pct, wiperPosition: pct }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    const { connectedPin, isAnalogPin, ...persistable } = localData;
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
      label:         (d.label as string)         || 'Potentiometer',
      resistance:    (d.resistance as number)     ?? 10000,
      tolerance:     (d.tolerance as number)      ?? 20,
      taper:         (d.taper as TaperType)       || 'linear',
      initialValue:  (d.initialValue as number)   ?? 50,
      powerRating:   (d.powerRating as number)    ?? 0.5,
      wiperPosition: (d.wiperPosition as number)  ?? 50,
      vcc:           (d.vcc as number)            ?? 5.0,
      connectedPin:  d.connectedPin as number | undefined,
      isAnalogPin:   d.isAnalogPin as boolean | undefined,
    });
    setHasChanges(false);
  }, [selectedNode]);

  // --- LIVE CALCULATIONS ---
  const taper        = localData.taper        ?? 'linear';
  const position     = localData.initialValue ?? 50;
  const resistance   = localData.resistance   ?? 10000;
  const vcc          = localData.vcc          ?? 5.0;
  const powerRating  = localData.powerRating  ?? 0.5;

  const liveResistance = useMemo(() => getWiperResistance(resistance, position, taper), [resistance, position, taper]);
  const liveVoltage    = useMemo(() => getWiperVoltage(position, taper, vcc),           [position, taper, vcc]);
  const liveAdc        = useMemo(() => getAdcValue(position, taper),                    [position, taper]);
  const livePower      = useMemo(() => getWiperPower(resistance, position, taper, vcc), [resistance, position, taper, vcc]);
  const powerExceeded  = livePower > powerRating;

  // Curva SVG taper
  const curvePath = useMemo(() => buildCurvePath(taper, 120, 40), [taper]);
  // Posição do marcador na curva
  const markerX = (position / 100) * 120;
  const markerY = 40 - taperMap(position, taper) * 40;

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <SlidersHorizontal className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select a Potentiometer component to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">Potentiometer Properties</span>
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
        </div>

        {/* WIRING — read-only */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Wiring</h3>
          <div className="p-3 bg-[#0d1219] rounded-md border border-[rgba(0,217,255,0.15)] text-[11px] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[#4a5568]">Wiper (Signal) Pin</span>
              {localData.connectedPin != null ? (
                <span className={cn('font-mono', localData.isAnalogPin ? 'text-green-400' : 'text-yellow-400')}>
                  {localData.isAnalogPin ? `A${localData.connectedPin} ✓` : `D${localData.connectedPin} ⚠`}
                </span>
              ) : (
                <span className="text-yellow-500">Not connected ⚠</span>
              )}
            </div>
            {localData.connectedPin != null && !localData.isAnalogPin && (
              <div className="px-2 py-1 bg-yellow-900/20 border border-yellow-500/30 rounded text-[10px] text-yellow-400">
                ⚠ Connect wiper to an analog pin (A0–A5) for analogRead().
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[#4a5568]">VCC Pin</span>
              <span className="text-[#9ca3af] font-mono">{vcc}V</span>
            </div>
          </div>
        </div>

        {/* ELECTRICAL SPECIFICATIONS */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Electrical Specifications</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">Total Resistance (Ω)</Label>
              <Input
                type="number" step={100} min={100}
                value={localData.resistance ?? 10000}
                onChange={(e) => handleChange('resistance', parseInt(e.target.value))}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">Tolerance (±%)</Label>
              <Input
                type="number" step={1} min={1} max={30}
                value={localData.tolerance ?? 20}
                onChange={(e) => handleChange('tolerance', parseFloat(e.target.value))}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">Power Rating (W)</Label>
              <Input
                type="number" step={0.1} min={0.1}
                value={localData.powerRating ?? 0.5}
                onChange={(e) => handleChange('powerRating', parseFloat(e.target.value))}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">VCC (V)</Label>
              <Input
                type="number" step={0.1} min={1.8} max={12}
                value={localData.vcc ?? 5.0}
                onChange={(e) => handleChange('vcc', parseFloat(e.target.value))}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Taper Type</Label>
            <Select
              value={localData.taper || 'linear'}
              onValueChange={(v) => handleChange('taper', v as TaperType)}
            >
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="linear"  className="text-[#e6e6e6]">Linear (B)</SelectItem>
                <SelectItem value="log"     className="text-[#e6e6e6]">Logarithmic (A)</SelectItem>
                <SelectItem value="antilog" className="text-[#e6e6e6]">Anti-Log (C)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-[#4a5568] mt-1 leading-relaxed">
              {taperDescriptions[localData.taper ?? 'linear']}
            </p>
          </div>
        </div>

        {/* SIMULATION */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Simulation</h3>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-[#9ca3af] text-xs">Initial Position</Label>
              <div className="flex items-center gap-2">
                <span className="text-[#00d9ff] text-xs font-mono">{position}%</span>
                {/* Reset rápido para 50% */}
                <button
                  onClick={() => handlePositionChange(50)}
                  className="text-[10px] text-[#4a5568] hover:text-[#9ca3af] underline"
                >
                  reset
                </button>
              </div>
            </div>
            <input
              type="range" min={0} max={100} step={1}
              value={position}
              onChange={(e) => handlePositionChange(parseInt(e.target.value))}
              className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]"
            />
            <div className="flex justify-between text-[10px] text-[#4a5568]">
              <span>0% — 0Ω</span>
              <span>50%</span>
              <span>100% — {formatResistance(resistance)}</span>
            </div>
          </div>
        </div>

        {/* LIVE CALCULATIONS */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Live Values</h3>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.15)] text-center">
              <div className="text-[10px] text-[#4a5568]">Wiper R</div>
              <div className="text-sm text-[#00d9ff] font-mono">{formatResistance(Math.round(liveResistance))}</div>
            </div>
            <div className="p-2 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.15)] text-center">
              <div className="text-[10px] text-[#4a5568]">Wiper V</div>
              <div className="text-sm text-[#00d9ff] font-mono">{liveVoltage.toFixed(3)} V</div>
            </div>
            <div className="p-2 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.15)] text-center">
              <div className="text-[10px] text-[#4a5568]">ADC Value</div>
              <div className="text-sm text-[#00d9ff] font-mono">{liveAdc} / 1023</div>
            </div>
            <div className={cn(
              'p-2 rounded border text-center',
              powerExceeded
                ? 'bg-red-900/20 border-red-500/30'
                : 'bg-[#0d1219] border-[rgba(0,217,255,0.15)]'
            )}>
              <div className="text-[10px] text-[#4a5568]">Power</div>
              <div className={cn('text-sm font-mono', powerExceeded ? 'text-red-400' : 'text-[#00d9ff]')}>
                {(livePower * 1000).toFixed(2)} mW
              </div>
              {powerExceeded && (
                <div className="text-[9px] text-red-400">⚠ Exceeds {powerRating}W</div>
              )}
            </div>
          </div>
        </div>

        {/* TAPER CURVE PREVIEW */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Taper Curve</h3>
          <div className="p-3 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
            <svg width="100%" viewBox="0 0 130 50" className="overflow-visible">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <line
                  key={v}
                  x1={0} y1={40 - v * 40}
                  x2={120} y2={40 - v * 40}
                  stroke="rgba(0,217,255,0.08)" strokeWidth="0.5"
                />
              ))}
              {/* Linear reference (dashed) */}
              <line x1={0} y1={40} x2={120} y2={0} stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" strokeDasharray="3 2" />
              {/* Taper curve */}
              <path d={curvePath} fill="none" stroke="#00d9ff" strokeWidth="1.5" strokeLinejoin="round" />
              {/* Marker */}
              <circle cx={markerX} cy={markerY} r={3} fill="#00d9ff" />
              <line x1={markerX} y1={0} x2={markerX} y2={40} stroke="rgba(0,217,255,0.3)" strokeWidth="0.8" strokeDasharray="2 2" />
              {/* Axes labels */}
              <text x={0} y={48} fill="#4a5568" fontSize="6">0%</text>
              <text x={108} y={48} fill="#4a5568" fontSize="6">100%</text>
              <text x={123} y={40} fill="#4a5568" fontSize="6">0</text>
              <text x={123} y={4} fill="#4a5568" fontSize="6">V</text>
            </svg>
          </div>

          {/* Linear wiper preview (banda) */}
          <div className="relative w-full h-6 bg-gradient-to-r from-[#1a3a5c] to-[#00d9ff] rounded-full overflow-hidden">
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
              style={{
                left: `${taperMap(position, taper) * 100}%`,
                transform: 'translateX(-50%)',
              }}
            />
          </div>
          <div className="text-center text-[10px] text-[#9ca3af]">
            {formatResistance(Math.round(liveResistance))} / {formatResistance(resistance)} — {liveVoltage.toFixed(3)} V — ADC {liveAdc}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PotentiometerPropertiesPanel;

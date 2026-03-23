import React, { useCallback, useEffect, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, RotateCcw, Save } from 'lucide-react';
import {
  taperMap, getWiperResistance, getWiperVoltage,
} from '@/lib/potentiometerCalculations';
import { simulationEngine } from '@/engine/SimulationEngine';
import { useConnectionStore } from '@/stores/useConnectionStore';

type TaperType = 'linear' | 'log' | 'antilog';

interface PotentiometerNodeData {
  id?: string;
  label?: string;
  resistance?: number;
  tolerance?: number;
  taper?: TaperType;
  powerRating?: number;
  initialValue?: number;
  connectedPin?: number | null;
  connectedPinType?: 'A' | 'D';
}

// Mini curva SVG para o taper (30px)
function TaperCurve({ taper }: { taper: TaperType }) {
  const pts = [0, 25, 50, 75, 100].map((p) => ({
    x: (p / 100) * 28 + 1,
    y: 29 - taperMap(p, taper) * 28,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" className="inline-block ml-2 opacity-70">
      <path d={d} fill="none" stroke="#00d9ff" strokeWidth="1.5" />
    </svg>
  );
}

export const PotentiometerPropertiesPanel: React.FC = () => {
  const { setNodes }    = useReactFlow();
  const nodes           = useNodes();
  const { connections } = useConnectionStore();
  const selectedNode    = nodes.find((n) => n.selected && n.type === 'potentiometer');

  const [localData,     setLocalData]     = useState<PotentiometerNodeData>({});
  const [wiperPosition, setWiperPosition] = useState(50); // estado local, não persistido
  const [hasChanges,    setHasChanges]    = useState(false);

  // ── Inicialização ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as PotentiometerNodeData;

    const signalConn = connections.find(
      (c) => c.source === `${selectedNode.id}:signal` || c.target === `${selectedNode.id}:signal`
    );
    let connectedPin: number | null = null;
    let connectedPinType: 'A' | 'D' | undefined;
    if (signalConn) {
      const other = signalConn.source.startsWith(selectedNode.id)
        ? signalConn.target : signalConn.source;
      const mA = other.match(/A(\d+)/);
      const mD = other.match(/D(\d+)/);
      if (mA) { connectedPin = parseInt(mA[1], 10) + 14; connectedPinType = 'A'; }
      else if (mD) { connectedPin = parseInt(mD[1], 10); connectedPinType = 'D'; }
    }

    const initVal = d.initialValue ?? 50;
    setLocalData({
      id:              selectedNode.id,
      label:           d.label        ?? 'Potentiometer',
      resistance:      d.resistance   ?? 10000,
      tolerance:       d.tolerance    ?? 20,
      taper:           d.taper        ?? 'linear',
      powerRating:     d.powerRating  ?? 0.5,
      initialValue:    initVal,
      connectedPin,
      connectedPinType,
    });
    setWiperPosition(initVal);
    setHasChanges(false);
  }, [selectedNode?.id, connections]);

  const handleChange = useCallback(
    <K extends keyof PotentiometerNodeData>(key: K, value: PotentiometerNodeData[K]) => {
      setLocalData((p) => ({ ...p, [key]: value }));
      setHasChanges(true);
    }, []
  );

  // Slider do wiper — emite analogChange em tempo real, não faz Save
  const handleWiperSlide = useCallback((pct: number) => {
    setWiperPosition(pct);
    const taper = localData.taper ?? 'linear';
    const mapped = Math.round(taperMap(pct, taper) * 1023);
    if (localData.connectedPin != null) {
      simulationEngine.externalAnalogWrite(localData.connectedPin, mapped);
    }
  }, [localData.taper, localData.connectedPin]);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((n) => n.id !== selectedNode.id ? n : {
      ...n,
      data: {
        ...n.data,
        label:        localData.label       ?? 'Potentiometer',
        resistance:   localData.resistance  ?? 10000,
        tolerance:    localData.tolerance   ?? 20,
        taper:        localData.taper       ?? 'linear',
        powerRating:  localData.powerRating ?? 0.5,
        initialValue: wiperPosition, // persiste posição actual do slider
      },
    }));
    setHasChanges(false);
  }, [selectedNode, localData, wiperPosition, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    // Reset para defaults genéricos (não os valores do nó guardados)
    setLocalData((p) => ({
      ...p,
      label:        (selectedNode.data.label as string) ?? 'Potentiometer',
      resistance:   10000,
      tolerance:    20,
      taper:        'linear',
      powerRating:  0.5,
      initialValue: 50,
    }));
    setWiperPosition(50);
    setHasChanges(false);
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <SlidersHorizontal className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select a Potentiometer component to edit its properties</p>
      </div>
    );
  }

  const taper        = localData.taper ?? 'linear';
  const resistance   = localData.resistance ?? 10000;
  const wiperR       = getWiperResistance(resistance, wiperPosition, taper);
  const wiperV       = getWiperVoltage(wiperPosition, taper);
  const adcValue     = Math.round(taperMap(wiperPosition, taper) * 1023);

  const taperLabels: Record<TaperType, string> = {
    linear:  'Linear (B)',
    log:     'Logarithmic (A)',
    antilog: 'Anti-Log (C)',
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">Potentiometer Properties</span>
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
        </div>

        {/* ── Wiring ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Wiring</h3>
          <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Signal (Wiper)</span>
              {localData.connectedPin != null
                ? <span className={localData.connectedPinType === 'A' ? 'text-green-400' : 'text-orange-400'}>
                    {localData.connectedPinType === 'A'
                      ? `A${localData.connectedPin - 14} ✓`
                      : `D${localData.connectedPin} ⚠`}
                  </span>
                : <span className="text-yellow-400">Not connected ⚠</span>}
            </div>
          </div>
          {localData.connectedPinType === 'D' && (
            <div className="p-2 rounded bg-yellow-500/10 border border-yellow-400/40 text-[11px] text-yellow-300">
              ⚠ Signal connected to digital pin D{localData.connectedPin}. Use an analog pin (A0–A5) for correct ADC readings.
            </div>
          )}
        </div>

        {/* ── Electrical Specifications ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Electrical Specifications</h3>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Total Resistance (Ω)</Label>
            <Input type="number" step="100" value={localData.resistance ?? ''}
              onChange={(e) => handleChange('resistance', parseInt(e.target.value) || 10000)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Tolerance (±%)</Label>
            <Input type="number" value={localData.tolerance ?? ''}
              onChange={(e) => handleChange('tolerance', parseFloat(e.target.value) || 20)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center">
              <Label className="text-[#9ca3af] text-xs">Taper Type</Label>
              <TaperCurve taper={taper} />
            </div>
            <Select value={taper} onValueChange={(v) => handleChange('taper', v as TaperType)}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="linear"  className="text-[#e6e6e6]">Linear (B)</SelectItem>
                <SelectItem value="log"     className="text-[#e6e6e6]">Logarithmic (A)</SelectItem>
                <SelectItem value="antilog" className="text-[#e6e6e6]">Anti-Log (C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Power Rating (W)</Label>
            <Input type="number" step="0.1" value={localData.powerRating ?? ''}
              onChange={(e) => handleChange('powerRating', parseFloat(e.target.value) || 0.5)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
        </div>

        {/* ── Simulation ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Simulation</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-[#9ca3af] text-xs">Position</Label>
              <span className="text-[#00d9ff] text-xs font-mono">
                {wiperPosition}% → {wiperR >= 1000
                  ? `${(wiperR / 1000).toFixed(2)}kΩ`
                  : `${wiperR.toFixed(0)}Ω`} → {wiperV.toFixed(2)}V
              </span>
            </div>
            <input type="range" min="0" max="100" step="1"
              value={wiperPosition}
              onChange={(e) => handleWiperSlide(parseInt(e.target.value))}
              className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
          </div>
        </div>

        {/* ── Live Value ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Live Value</h3>
          <div className="p-3 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#9ca3af]">ADC</span>
              <span className="text-[#00d9ff] font-mono">{adcValue}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#9ca3af]">Voltage</span>
              <span className="text-[#e6e6e6] font-mono">{wiperV.toFixed(2)} V</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#9ca3af]">Wiper R</span>
              <span className="text-[#e6e6e6] font-mono">
                {wiperR >= 1000 ? `${(wiperR / 1000).toFixed(2)} kΩ` : `${wiperR.toFixed(0)} Ω`}
              </span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full h-1.5 bg-[#1a2a3a] rounded-full overflow-hidden mt-1">
              <div className="h-full bg-[#00d9ff] rounded-full transition-all"
                style={{ width: `${taperMap(wiperPosition, taper) * 100}%` }} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PotentiometerPropertiesPanel;

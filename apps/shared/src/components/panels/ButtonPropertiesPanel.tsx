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
import { Square, RotateCcw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useConnectionStore } from '@/stores/useConnectionStore';

type PullResistor = 'NONE' | 'PULLUP' | 'PULLDOWN';
type ButtonType   = 'momentary' | 'toggle';

interface ButtonNodeData {
  id?: string;
  name?: string;
  label?: string;
  type?: ButtonType;
  connectedPin?: number | null;
  pullResistor?: PullResistor;
  debounceTime?: number;
  isPressed?: boolean;
  isFloating?: boolean;
}

export const ButtonPropertiesPanel: React.FC = () => {
  const { setNodes }    = useReactFlow();
  const nodes           = useNodes();
  const { connections } = useConnectionStore();
  const selectedNode    = nodes.find((n) => n.selected && n.type === 'button');

  const [localData, setLocalData] = useState<ButtonNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  // ── Wiring lookup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as ButtonNodeData;

    // Procura conexão no handle 'pin' do nó de botão
    const conn = connections.find(
      (c) => c.source === `${selectedNode.id}:pin` || c.target === `${selectedNode.id}:pin`
    );
    let connectedPin: number | null = null;
    if (conn) {
      const other = conn.source.startsWith(selectedNode.id) ? conn.target : conn.source;
      const m = other.match(/D(\d+)/);
      if (m) connectedPin = parseInt(m[1], 10);
    }

    setLocalData({
      id:           selectedNode.id,
      label:        d.label        ?? 'Button',
      type:         d.type         ?? (d as any).buttonType ?? 'momentary', // Suporte legado
      pullResistor: d.pullResistor ?? 'PULLUP',
      debounceTime: d.debounceTime ?? 50,
      connectedPin,
    });
    setHasChanges(false);
  }, [selectedNode?.id, connections]);

  const handleChange = useCallback(
    <K extends keyof ButtonNodeData>(key: K, value: ButtonNodeData[K]) => {
      setLocalData((p) => ({ ...p, [key]: value }));
      setHasChanges(true);
    }, []
  );

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((n) => n.id !== selectedNode.id ? n : {
      ...n,
      data: {
        ...n.data,
        label:        localData.label        ?? 'Button',
        type:         localData.type         ?? 'momentary',
        pullResistor: localData.pullResistor ?? 'PULLUP',
        debounceTime: localData.debounceTime ?? 50,
      },
    }));
    setHasChanges(false);
  }, [selectedNode, localData, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as ButtonNodeData;
    setLocalData((p) => ({
      ...p,
      label:        d.label        ?? 'Button',
      type:         d.type         ?? (d as any).buttonType ?? 'momentary',
      pullResistor: d.pullResistor ?? 'PULLUP',
      debounceTime: d.debounceTime ?? 50,
    }));
    setHasChanges(false);
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <Square className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select a Button component to edit its properties</p>
      </div>
    );
  }

  const isToggled = (selectedNode.data as ButtonNodeData).isPressed;

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Square className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">Button Properties</span>
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
            <Label className="text-[#9ca3af] text-xs">Button Behavior</Label>
            <Select value={localData.type ?? 'momentary'} onValueChange={(v) => handleChange('type', v as ButtonType)}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="momentary" className="text-[#e6e6e6]">Momentary (Push-to-make)</SelectItem>
                <SelectItem value="toggle"    className="text-[#e6e6e6]">Toggle (Latching)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Wiring ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Wiring & Logic</h3>
          <div className="p-2 rounded bg-[#0d1520] border border-[rgba(0,217,255,0.15)] text-[11px] space-y-2">
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Connected Pin</span>
              {localData.connectedPin != null
                ? <span className="text-green-400">D{localData.connectedPin} ✓</span>
                : <span className="text-yellow-400">Not connected ⚠</span>}
            </div>
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-[10px]">Internal Resistor</Label>
              <Select value={localData.pullResistor ?? 'PULLUP'} onValueChange={(v) => handleChange('pullResistor', v as PullResistor)}>
                <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.15)] text-[#e6e6e6] text-xs h-6">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                  <SelectItem value="NONE"     className="text-[#e6e6e6] text-xs">None (Floating)</SelectItem>
                  <SelectItem value="PULLUP"   className="text-[#e6e6e6] text-xs">PULLUP (Internal 20k-50k)</SelectItem>
                  <SelectItem value="PULLDOWN" className="text-[#e6e6e6] text-xs">PULLDOWN (External simulation)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[10px] text-[#9ca3af]">
            {localData.pullResistor === 'PULLUP'
              ? 'Logic is INVERTED: Pressed = LOW (0), Released = HIGH (1).'
              : localData.pullResistor === 'PULLDOWN'
              ? 'Logic is DIRECT: Pressed = HIGH (1), Released = LOW (0).'
              : '⚠ Input is floating. Logic level may be unpredictable.'}
          </p>
          <div className="space-y-2 pt-1">
            <Label className="text-[#9ca3af] text-xs">Debounce Time (ms)</Label>
            <Input type="number" step="5" min="0" max="500"
              value={localData.debounceTime ?? 50}
              onChange={(e) => handleChange('debounceTime', parseInt(e.target.value) || 0)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
          </div>
        </div>

        {/* ── Status ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Current Status</h3>
          <div className="flex items-center justify-between p-3 rounded bg-[#151b24] border border-[rgba(0,217,255,0.2)]">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-3 h-3 rounded-full',
                isToggled ? 'bg-[#00d9ff] shadow-[0_0_8px_#00d9ff]' : 'bg-[#1f2937]'
              )} />
              <span className="text-sm text-[#e6e6e6]">
                {localData.type === 'toggle'
                  ? (isToggled ? 'ON (Latched)' : 'OFF (Latched)')
                  : (isToggled ? 'PRESSED' : 'RELEASED')}
              </span>
            </div>
            {localData.type === 'toggle' ? (
              isToggled ? <ToggleRight className="text-[#00d9ff]" /> : <ToggleLeft className="text-[#9ca3af]" />
            ) : null}
          </div>
        </div>

        {/* ── Preview ── */}
        <div className="space-y-3 py-2">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase text-center pb-2">Component Preview</h3>
          <div className="flex flex-col items-center">
             <div className="relative w-20 h-20 bg-[#2d3748] rounded-xl border-b-4 border-[#1a202c] flex items-center justify-center p-2 shadow-xl">
                <div className={cn(
                  'w-14 h-14 rounded-full border-t border-white/20 transition-all duration-75 flex items-center justify-center',
                  isToggled ? 'bg-red-600 translate-y-0.5 scale-95 shadow-inner' : 'bg-red-500 shadow-lg'
                )}>
                   <div className="w-10 h-10 rounded-full border border-black/10 opacity-30" />
                </div>
             </div>
             <p className="text-[10px] text-[#9ca3af] mt-4">
               {localData.type === 'toggle' ? 'Click to toggle latch' : 'Hold to press'}
             </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ButtonPropertiesPanel;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Square, RotateCcw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useConnectionStore } from '@/stores/useConnectionStore';

// --- TIPOS ---

type PullResistor = 'NONE' | 'PULLUP' | 'PULLDOWN';
type ButtonType   = 'momentary' | 'toggle';

interface ButtonNodeData {
  id?: string;
  name?: string;
  label?: string;
  buttonType?: ButtonType;
  connectedPin?: number | null;
  pullResistor?: PullResistor;
  debounceTime?: number;
  isPressed?: boolean;
  isFloating?: boolean;
}

// --- CONTEÚDO DOS CARDS INFORMATIVOS ---

const pullResistorInfo: Record<PullResistor, { title: string; description: string; schematic: string }> = {
  NONE: {
    title: 'No Pull Resistor',
    description: 'Pin has no defined idle state. Susceptible to noise and floating voltage. Always add an external pull-up or pull-down unless handled in firmware.',
    schematic: 'MCU pin ── button ── GND  (floating when open)',
  },
  PULLUP: {
    title: 'Pull-Up (INPUT_PULLUP)',
    description: 'Pin idles HIGH. When button is pressed, pin goes LOW. Common for active-low button wiring. Built into most MCUs.',
    schematic: 'VCC ── 10kΩ ── MCU pin ── button ── GND',
  },
  PULLDOWN: {
    title: 'Pull-Down',
    description: 'Pin idles LOW. When button is pressed, pin goes HIGH. Use when active-high logic is required. Often requires external resistor.',
    schematic: 'VCC ── button ── MCU pin ── 10kΩ ── GND',
  },
};

const buttonTypeInfo: Record<ButtonType, { title: string; description: string }> = {
  momentary: {
    title: 'Momentary',
    description: 'Active only while held. Returns to idle when released. Typical push-button (e.g. tactile switch).',
  },
  toggle: {
    title: 'Toggle (Latching)',
    description: 'Each press flips state between ON and OFF. Stays in last state when released. Simulates a latch or on/off switch.',
  },
};

// --- HELPERS ---

function getLogicDescription(pull: PullResistor, type: ButtonType): string {
  if (pull === 'PULLUP') {
    return type === 'toggle'
      ? 'Idle: HIGH. Press toggles latched LOW/HIGH.'
      : 'Idle: HIGH → Press: LOW (active-low)';
  }
  if (pull === 'PULLDOWN') {
    return type === 'toggle'
      ? 'Idle: LOW. Press toggles latched LOW/HIGH.'
      : 'Idle: LOW → Press: HIGH (active-high)';
  }
  return 'No defined idle level — floating pin risk';
}

function resolveConnectedPin(
  nodeId: string,
  nodeData: ButtonNodeData,
  connections: any[]
): number | null {
  if (nodeData.connectedPin != null) return nodeData.connectedPin;
  const signalConn = connections.find(
    (c) => c.source === `${nodeId}:signal` || c.target === `${nodeId}:signal`
  );
  if (!signalConn) return null;
  const otherEnd =
    signalConn.source === `${nodeId}:signal` ? signalConn.target : signalConn.source;
  const match = otherEnd.match(/D(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// --- COMPONENTE ---

export const ButtonPropertiesPanel: React.FC = () => {
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const { connections } = useConnectionStore();

  const selectedNode = nodes.find((n) => n.selected && n.type === 'button');

  const [localData, setLocalData] = useState<ButtonNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as ButtonNodeData;
    const connectedPin = resolveConnectedPin(selectedNode.id, d, connections);
    setLocalData({
      id:           d.id           ?? selectedNode.id,
      name:         d.name         ?? d.label ?? 'BTN',
      label:        d.label,
      buttonType:   d.buttonType   ?? 'momentary',
      connectedPin,
      pullResistor: d.pullResistor ?? 'NONE',
      debounceTime: d.debounceTime ?? 50,
      isPressed:    d.isPressed    ?? false,
      isFloating:   d.isFloating   ?? false,
    });
    setHasChanges(false);
  }, [selectedNode?.id, connections]);

  const handleChange = useCallback(
    <K extends keyof ButtonNodeData>(key: K, value: ButtonNodeData[K]) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    }, []
  );

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                id:           localData.id           ?? selectedNode.id,
                name:         localData.name         ?? 'BTN',
                label:        localData.name         ?? 'BTN',
                buttonType:   localData.buttonType   ?? 'momentary',
                connectedPin: localData.connectedPin ?? null,
                pullResistor: localData.pullResistor ?? 'NONE',
                debounceTime: localData.debounceTime ?? 50,
                isPressed:    localData.isPressed    ?? false,
                isFloating:   localData.isFloating   ?? false,
              },
            }
          : n
      )
    );
    setHasChanges(false);
  }, [selectedNode, localData, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as ButtonNodeData;
    const connectedPin = resolveConnectedPin(selectedNode.id, d, connections);
    setLocalData({
      id:           d.id           ?? selectedNode.id,
      name:         d.name         ?? d.label ?? 'BTN',
      label:        d.label,
      buttonType:   d.buttonType   ?? 'momentary',
      connectedPin,
      pullResistor: d.pullResistor ?? 'NONE',
      debounceTime: d.debounceTime ?? 50,
      isPressed:    d.isPressed    ?? false,
      isFloating:   d.isFloating   ?? false,
    });
    setHasChanges(false);
  }, [selectedNode, connections]);

  // Dados derivados
  const pull       = localData.pullResistor ?? 'NONE';
  const btnType    = localData.buttonType   ?? 'momentary';
  const isFloating = pull === 'NONE';
  const logicDesc  = useMemo(() => getLogicDescription(pull, btnType), [pull, btnType]);
  const pullInfo   = pullResistorInfo[pull];
  const typeInfo   = buttonTypeInfo[btnType];

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <Square className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select a Button component to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Square className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">Button Properties</span>
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
              value={localData.id ?? selectedNode.id} readOnly
              className="bg-[#0d1219] border-[rgba(0,217,255,0.15)] text-[#4a5568] text-xs h-7 cursor-default"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Display Name</Label>
            <Input
              value={localData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
            />
          </div>

          {/* Pin mapping read-only */}
          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Signal Pin</Label>
            <Input
              value={localData.connectedPin != null ? `D${localData.connectedPin}` : 'Not connected'}
              readOnly
              className={cn(
                'text-xs h-7 cursor-default',
                localData.connectedPin != null
                  ? 'bg-[#0d1219] border-[rgba(0,217,255,0.15)] text-green-400'
                  : 'bg-[#0d1219] border-yellow-500/30 text-yellow-500'
              )}
            />
          </div>
        </div>

        {/* BUTTON TYPE */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Button Type</h3>

          {/* Toggle visual entre momentary / toggle */}
          <div className="flex gap-2">
            {(['momentary', 'toggle'] as ButtonType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleChange('buttonType', t)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 h-9 rounded border text-xs font-medium transition-all',
                  btnType === t
                    ? 'bg-[#00d9ff] text-[#0a0e14] border-[#00d9ff]'
                    : 'bg-transparent text-[#9ca3af] border-[rgba(0,217,255,0.3)] hover:border-[rgba(0,217,255,0.6)]'
                )}
              >
                {t === 'momentary'
                  ? <ToggleLeft className="w-3.5 h-3.5" />
                  : <ToggleRight className="w-3.5 h-3.5" />
                }
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Info card do tipo */}
          <div className="p-2.5 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.12)] space-y-1">
            <p className="text-[11px] text-[#9ca3af] font-medium">{typeInfo.title}</p>
            <p className="text-[10px] text-[#4a5568] leading-relaxed">{typeInfo.description}</p>
          </div>
        </div>

        {/* ELECTRICAL */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Electrical</h3>

          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Pull Resistor</Label>
            <Select
              value={pull}
              onValueChange={(v) => handleChange('pullResistor', v as PullResistor)}
            >
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="NONE"     className="text-[#e6e6e6]">None</SelectItem>
                <SelectItem value="PULLUP"   className="text-[#e6e6e6]">Pull-Up (INPUT_PULLUP)</SelectItem>
                <SelectItem value="PULLDOWN" className="text-[#e6e6e6]">Pull-Down</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Floating warning — visível só quando NONE */}
          {isFloating && (
            <div className="px-3 py-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-[10px] text-yellow-400 leading-relaxed">
              ⚠ No pull resistor selected. Pin may float when button is open, causing unpredictable readings. Add INPUT_PULLUP/PULLDOWN in firmware or wire an external resistor.
            </div>
          )}

          {/* Info card do pull */}
          <div className="p-2.5 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.12)] space-y-1.5">
            <p className="text-[11px] text-[#9ca3af] font-medium">{pullInfo.title}</p>
            <p className="text-[10px] text-[#4a5568] leading-relaxed">{pullInfo.description}</p>
            <code className="block text-[9px] text-[#00d9ff]/60 font-mono bg-[#060a0f] px-2 py-1 rounded mt-1">
              {pullInfo.schematic}
            </code>
          </div>

          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Debounce Time (ms)</Label>
            <Input
              type="number" min={0} max={500} step={5}
              value={localData.debounceTime ?? 50}
              onChange={(e) => handleChange('debounceTime', parseInt(e.target.value) || 0)}
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
            />
            <p className="text-[10px] text-[#4a5568]">
              Recommended: 20–50ms. Higher values reduce noise but slow response.
            </p>
          </div>
        </div>

        {/* LOGIC */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Logic Behaviour</h3>
          <div className="p-3 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.12)] space-y-2">
            <p className="text-[11px] text-[#9ca3af] leading-relaxed">{logicDesc}</p>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                  pull === 'PULLUP' ? 'bg-green-400' : pull === 'PULLDOWN' ? 'bg-blue-400' : 'bg-yellow-500'
                )} />
                <span className="text-[#4a5568]">Idle:</span>
                <span className="text-[#9ca3af]">
                  {pull === 'PULLUP' ? 'HIGH (1)' : pull === 'PULLDOWN' ? 'LOW (0)' : 'Undefined'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00d9ff] flex-shrink-0" />
                <span className="text-[#4a5568]">Active:</span>
                <span className="text-[#9ca3af]">
                  {pull === 'PULLUP' ? 'LOW (0)' : pull === 'PULLDOWN' ? 'HIGH (1)' : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SIMULATION */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Simulation</h3>

          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-[#9ca3af] text-xs cursor-pointer">
                {btnType === 'toggle' ? 'Initially ON (latched)' : 'Initially Pressed'}
              </Label>
              <p className="text-[10px] text-[#4a5568] mt-0.5">
                {btnType === 'toggle'
                  ? 'Toggle starts in the ON/latched state.'
                  : 'Button starts in pressed state at simulation start.'}
              </p>
            </div>
            <Switch
              checked={localData.isPressed ?? false}
              onCheckedChange={(v) => handleChange('isPressed', v)}
              className="data-[state=checked]:bg-[#00d9ff] ml-3 flex-shrink-0"
            />
          </div>
        </div>

        {/* PREVIEW */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Preview</h3>
          <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)] gap-4">

            {/* Botão visual */}
            <div className={cn(
              'w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-150',
              localData.isPressed
                ? 'bg-[#00d9ff] border-[#00d9ff] shadow-[0_0_20px_rgba(0,217,255,0.4)]'
                : 'bg-[#1a3a5c] border-[rgba(0,217,255,0.3)]'
            )}>
              <Square className={cn('w-7 h-7', localData.isPressed ? 'text-[#0a0e14]' : 'text-[#00d9ff]')} />
              {btnType === 'toggle' && (
                <span className={cn('text-[8px] font-bold uppercase tracking-wider',
                  localData.isPressed ? 'text-[#0a0e14]' : 'text-[#4a5568]'
                )}>
                  {localData.isPressed ? 'ON' : 'OFF'}
                </span>
              )}
            </div>

            {/* Estado lógico */}
            <div className="text-center space-y-1">
              <div className={cn(
                'text-lg font-mono font-bold',
                localData.isPressed
                  ? pull === 'PULLUP' ? 'text-red-400' : 'text-green-400'
                  : pull === 'PULLUP' ? 'text-green-400' : pull === 'PULLDOWN' ? 'text-red-400' : 'text-yellow-500'
              )}>
                {localData.isPressed
                  ? (pull === 'PULLUP' ? 'LOW' : 'HIGH')
                  : (pull === 'PULLUP' ? 'HIGH' : pull === 'PULLDOWN' ? 'LOW' : '???')}
              </div>
              <div className="text-[10px] text-[#4a5568]">
                {localData.connectedPin != null ? `D${localData.connectedPin}` : 'no pin'}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ButtonPropertiesPanel;

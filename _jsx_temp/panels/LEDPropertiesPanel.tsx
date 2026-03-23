import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Lightbulb, RotateCcw, Save, AlertTriangle, Flame } from 'lucide-react';
import {
  ledProfiles,
  resistorOptions,
  getActiveMicrocontrollerProfile,
  calculateRealCurrent,
  calculateLuminousIntensity,
  getSafetyStatus,
  type LedColorProfile,
  type ResistorOption,
} from '@/lib/ledCalculations';
import { useConnectionStore } from '@/stores/useConnectionStore';

// --- TIPOS ---

interface LEDNodeData {
  id?: string;
  name?: string;
  label?: string;
  connectedPin?: number | null;
  isPwmPin?: boolean;
  colorProfile?: LedColorProfile;
  customColorHex?: string;
  forwardVoltage?: number;
  nominalCurrent?: number;  // A
  maxCurrent?: number;      // A
  internalResistance?: ResistorOption;
  customResistance?: number;
  isOn?: boolean;
  brightness?: number;      // 0–1 (PWM)
  realCurrent?: number;
  luminousIntensity?: number;
  isBurned?: boolean;
  polarityEnforced?: boolean;
  initialState?: 'on' | 'off';
}

// --- PERFIS PARA DISPLAY ---

// Todos os perfis disponíveis no select (inclui IR/COLD/WARM/RGB novos)
const ALL_PROFILES: LedColorProfile[] = [
  'RED', 'GREEN', 'BLUE', 'YELLOW', 'WHITE', 'ORANGE',
  'UV', 'IR', 'COLD', 'WARM', 'RGB', 'USER',
];

const profileLabels: Record<LedColorProfile, string> = {
  RED:    'Red',
  GREEN:  'Green',
  BLUE:   'Blue',
  YELLOW: 'Yellow',
  WHITE:  'White',
  ORANGE: 'Orange',
  UV:     'UV',
  IR:     'IR (Infrared)',
  COLD:   'Cold White (~6500K)',
  WARM:   'Warm White (~2700K)',
  RGB:    'RGB (generic channel)',
  USER:   'Custom / USER',
};

// --- HELPERS ---

function resolveConnectedPin(
  nodeId: string,
  nodeData: LEDNodeData,
  connections: any[]
): { pin: number | null; isPwm: boolean } {
  if (nodeData.connectedPin != null) {
    return { pin: nodeData.connectedPin, isPwm: nodeData.isPwmPin ?? false };
  }
  const anodeConn = connections.find(
    (c) => c.source === `${nodeId}:anode` || c.target === `${nodeId}:anode`
  );
  if (!anodeConn) return { pin: null, isPwm: false };
  const otherEnd =
    anodeConn.source === `${nodeId}:anode` ? anodeConn.target : anodeConn.source;
  const match = otherEnd.match(/D(\d+)/);
  if (!match) return { pin: null, isPwm: false };
  // Pinos PWM standard Arduino: 3, 5, 6, 9, 10, 11
  const pinNum = parseInt(match[1], 10);
  const pwmPins = [3, 5, 6, 9, 10, 11];
  return { pin: pinNum, isPwm: pwmPins.includes(pinNum) };
}

// --- COMPONENTE ---

export const LEDPropertiesPanel: React.FC = () => {
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const { connections } = useConnectionStore();

  const selectedNode = nodes.find((n) => n.selected && n.type === 'led');

  const [localData, setLocalData] = useState<LEDNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as LEDNodeData;
    const profileKey: LedColorProfile = d.colorProfile ?? 'RED';
    const profile = ledProfiles[profileKey];
    const { pin, isPwm } = resolveConnectedPin(selectedNode.id, d, connections);

    setLocalData({
      id:                d.id               ?? selectedNode.id,
      name:              d.name             ?? d.label ?? 'LED',
      label:             d.label,
      connectedPin:      pin,
      isPwmPin:          isPwm,
      colorProfile:      profileKey,
      customColorHex:    d.customColorHex   ?? profile.hex,
      forwardVoltage:    d.forwardVoltage   ?? profile.vf,
      nominalCurrent:    d.nominalCurrent   ?? profile.if_nom,
      maxCurrent:        d.maxCurrent       ?? profile.if_max,
      internalResistance: d.internalResistance ?? 220,
      customResistance:  d.customResistance,
      brightness:        d.brightness       ?? 1.0,
      realCurrent:       d.realCurrent      ?? 0,
      luminousIntensity: d.luminousIntensity ?? 0,
      isBurned:          d.isBurned         ?? false,
      polarityEnforced:  d.polarityEnforced ?? true,
      initialState:      d.initialState     ?? 'off',
    });
    setHasChanges(false);
  }, [selectedNode?.id, connections]);

  const handleChange = useCallback(
    <K extends keyof LEDNodeData>(key: K, value: LEDNodeData[K]) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    }, []
  );

  const handleColorChange = useCallback((value: LedColorProfile) => {
    const profile = ledProfiles[value];
    setLocalData((prev) => ({
      ...prev,
      colorProfile:   value,
      forwardVoltage: profile.vf      || prev.forwardVoltage,
      nominalCurrent: profile.if_nom  || prev.nominalCurrent,
      maxCurrent:     profile.if_max  || prev.maxCurrent,
      customColorHex: value === 'USER' ? (prev.customColorHex ?? profile.hex) : profile.hex,
    }));
    setHasChanges(true);
  }, []);

  const handleResistorChange = useCallback((value: string) => {
    const parsed: ResistorOption = value === 'USER' ? 'USER' : parseInt(value, 10);
    setLocalData((prev) => ({ ...prev, internalResistance: parsed }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    // isPwmPin é read-only — não persistir
    const { isPwmPin, ...persistable } = localData;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNode.id) return n;
        return {
          ...n,
          data: {
            ...n.data,
            id:                persistable.id               ?? selectedNode.id,
            name:              persistable.name             ?? 'LED',
            label:             persistable.name             ?? 'LED',
            connectedPin:      persistable.connectedPin     ?? null,
            colorProfile:      persistable.colorProfile     ?? 'RED',
            customColorHex:    persistable.customColorHex,
            forwardVoltage:    persistable.forwardVoltage,
            nominalCurrent:    persistable.nominalCurrent,
            maxCurrent:        persistable.maxCurrent,
            internalResistance: persistable.internalResistance ?? 220,
            customResistance:
              persistable.internalResistance === 'USER'
                ? persistable.customResistance
                : undefined,
            brightness:        persistable.brightness,
            realCurrent:       persistable.realCurrent,
            luminousIntensity: persistable.luminousIntensity,
            isBurned:          persistable.isBurned,
            polarityEnforced:  persistable.polarityEnforced,
            initialState:      persistable.initialState,
          },
        };
      })
    );
    setHasChanges(false);
  }, [selectedNode, localData, setNodes]);

  const handleReset = useCallback(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as LEDNodeData;
    const profileKey: LedColorProfile = d.colorProfile ?? 'RED';
    const profile = ledProfiles[profileKey];
    const { pin, isPwm } = resolveConnectedPin(selectedNode.id, d, connections);
    setLocalData({
      id:                d.id               ?? selectedNode.id,
      name:              d.name             ?? d.label ?? 'LED',
      label:             d.label,
      connectedPin:      pin,
      isPwmPin:          isPwm,
      colorProfile:      profileKey,
      customColorHex:    d.customColorHex   ?? profile.hex,
      forwardVoltage:    d.forwardVoltage   ?? profile.vf,
      nominalCurrent:    d.nominalCurrent   ?? profile.if_nom,
      maxCurrent:        d.maxCurrent       ?? profile.if_max,
      internalResistance: d.internalResistance ?? 220,
      customResistance:  d.customResistance,
      brightness:        d.brightness       ?? 1.0,
      realCurrent:       d.realCurrent      ?? 0,
      luminousIntensity: d.luminousIntensity ?? 0,
      isBurned:          d.isBurned         ?? false,
      polarityEnforced:  d.polarityEnforced ?? true,
      initialState:      d.initialState     ?? 'off',
    });
    setHasChanges(false);
  }, [selectedNode, connections]);

  // --- LIVE CALC ---
  const mcu     = useMemo(() => getActiveMicrocontrollerProfile(), []);
  const profileKey: LedColorProfile = localData.colorProfile ?? 'RED';
  const profile = ledProfiles[profileKey];

  const internalR = useMemo(() =>
    localData.internalResistance === 'USER'
      ? (localData.customResistance ?? 220)
      : (localData.internalResistance ?? 220),
    [localData.internalResistance, localData.customResistance]
  );

  const vf   = localData.forwardVoltage ?? profile.vf;
  const iNom = localData.nominalCurrent ?? profile.if_nom;

  const iReal     = useMemo(() => calculateRealCurrent(mcu.v_out, vf, internalR),    [mcu, vf, internalR]);
  const intensity = useMemo(() => calculateLuminousIntensity(profile.mcd, iReal, iNom), [profile.mcd, iReal, iNom]);
  const safety    = useMemo(() => getSafetyStatus(iReal, iNom, mcu.max_ma),           [iReal, iNom, mcu.max_ma]);

  const isBurned = safety === 'burned' || (localData.isBurned ?? false);

  const intensityPercent = iNom > 0
    ? Math.round(Math.min(1, Math.max(0, iReal / iNom)) * 100)
    : 0;

  // Cor do preview — IR não tem cor visível
  const previewHex = profileKey === 'IR'
    ? '#1a0000'
    : profileKey === 'USER'
    ? (localData.customColorHex ?? profile.hex)
    : profile.hex;

  const isOn = localData.initialState === 'on';

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <Lightbulb className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Select an LED component to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">LED Properties</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm" onClick={handleReset}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-[#00d9ff]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm" onClick={handleSave} disabled={!hasChanges}
            className={cn('h-7 px-3', hasChanges ? 'bg-[#00d9ff] text-[#0a0e14]' : 'bg-[#1a3a5c] text-[#9ca3af] cursor-not-allowed')}
          >
            <Save className="w-3.5 h-3.5 mr-1" />Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* BURNED BANNER — sticky no topo do scroll */}
        {isBurned && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-900/40 border border-red-500/60 rounded-md">
            <Flame className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-red-300">LED Burned Out</p>
              <p className="text-[10px] text-red-400/80 mt-0.5">
                Current exceeded If × 1.5. LED is permanently damaged. Reduce resistance or check circuit.
              </p>
            </div>
          </div>
        )}

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
            <Label className="text-[#9ca3af] text-xs">Name</Label>
            <Input
              value={localData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="LED"
              className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
            />
          </div>

          {/* Pin mapping — com indicador PWM */}
          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Pin Mapping (Anode)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={localData.connectedPin != null ? `D${localData.connectedPin}` : 'Not connected'}
                readOnly
                className={cn(
                  'text-xs h-7 cursor-default flex-1',
                  localData.connectedPin != null
                    ? 'bg-[#0d1219] border-[rgba(0,217,255,0.15)] text-green-400'
                    : 'bg-[#0d1219] border-yellow-500/30 text-yellow-500'
                )}
              />
              {localData.connectedPin != null && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0',
                  localData.isPwmPin
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                )}>
                  {localData.isPwmPin ? 'PWM ✓' : 'Digital'}
                </span>
              )}
            </div>
            {localData.connectedPin != null && !localData.isPwmPin && (
              <p className="text-[10px] text-yellow-400/80 mt-1">
                ⚠ Non-PWM pin — brightness control (analogWrite) won't work. Use D3, D5, D6, D9, D10 or D11.
              </p>
            )}
          </div>
        </div>

        {/* ELECTRICAL CHARACTERISTICS */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Electrical Characteristics</h3>

          {/* LED Color / Profile */}
          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">LED Color / Profile</Label>
            <Select value={profileKey} onValueChange={(v) => handleColorChange(v as LedColorProfile)}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                {ALL_PROFILES.map((key) => (
                  <SelectItem key={key} value={key} className="text-[#e6e6e6] text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                        style={{ backgroundColor: ledProfiles[key].hex }}
                      />
                      {profileLabels[key]}
                      <span className="text-[#4a5568] text-[10px] ml-1">
                        Vf {ledProfiles[key].vf}V
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* IR note */}
          {profileKey === 'IR' && (
            <div className="px-2.5 py-2 bg-[#1a0000] border border-red-900/40 rounded text-[10px] text-red-400/80 leading-relaxed">
              ℹ IR LEDs emit ~850–940nm — invisible to the human eye. Preview shows no visible light. Higher If_max (up to 100mA pulse) is common.
            </div>
          )}

          {/* USER custom hex */}
          {profileKey === 'USER' && (
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">Custom Color (HEX)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localData.customColorHex || '#cccccc'}
                  onChange={(e) => handleChange('customColorHex', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-[rgba(0,217,255,0.3)] bg-transparent p-0.5"
                />
                <Input
                  value={localData.customColorHex || ''}
                  onChange={(e) => handleChange('customColorHex', e.target.value)}
                  placeholder="#cccccc"
                  className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8 flex-1 font-mono"
                />
              </div>
            </div>
          )}

          {/* Vf + If grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">Forward Voltage Vf (V)</Label>
              <Input
                type="number" step={0.1} min={0.5} max={5}
                value={localData.forwardVoltage ?? profile.vf}
                onChange={(e) => handleChange('forwardVoltage', parseFloat(e.target.value) || 0)}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[#9ca3af] text-xs">Nominal If (mA)</Label>
              <Input
                type="number" step={1} min={1} max={100}
                value={Math.round((localData.nominalCurrent ?? profile.if_nom) * 1000)}
                onChange={(e) => handleChange('nominalCurrent', parseInt(e.target.value) / 1000)}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
              />
            </div>
          </div>

          {/* Resistor */}
          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Series Resistor (Ω)</Label>
            <Select
              value={localData.internalResistance === 'USER' ? 'USER' : String(localData.internalResistance ?? 220)}
              onValueChange={handleResistorChange}
            >
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                {resistorOptions.map((r) => (
                  <SelectItem key={String(r)} value={String(r)} className="text-[#e6e6e6] text-xs">
                    {r === 'USER' ? 'Custom...' : `${r} Ω`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localData.internalResistance === 'USER' && (
              <Input
                type="number" min={1} placeholder="Ω"
                value={localData.customResistance ?? ''}
                onChange={(e) => handleChange('customResistance', parseFloat(e.target.value) || 0)}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8 mt-1"
              />
            )}
          </div>
        </div>

        {/* LIVE CALCULATIONS */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Live Calculations</h3>

          <div className="p-3 bg-[#0d1219] rounded border border-[rgba(0,217,255,0.12)] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#4a5568]">MCU</span>
              <span className="text-[#9ca3af]">{mcu.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#4a5568]">V source</span>
              <span className="text-[#9ca3af] font-mono">{mcu.v_out.toFixed(1)} V</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#4a5568]">I real</span>
              <span className={cn(
                'font-mono',
                safety === 'safe' ? 'text-green-400' :
                safety === 'warning' ? 'text-yellow-400' : 'text-red-400'
              )}>
                {(iReal * 1000).toFixed(1)} mA
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#4a5568]">Intensity</span>
              <span className="text-[#9ca3af] font-mono">
                {profileKey === 'IR'
                  ? 'IR (not visible)'
                  : `${intensity.toFixed(0)} mcd (${intensityPercent}%)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#4a5568]">Status</span>
              <span className={cn(
                'font-medium capitalize',
                safety === 'safe' ? 'text-green-400' :
                safety === 'warning' ? 'text-yellow-400' :
                safety === 'error' ? 'text-red-400' : 'text-gray-400'
              )}>
                {safety}
              </span>
            </div>
          </div>

          {/* Ohm's law reference */}
          <div className="px-2 py-1.5 bg-[#060a0f] rounded text-[9px] text-[#4a5568] font-mono leading-relaxed">
            I = (V_source − Vf) / R = ({mcu.v_out.toFixed(1)} − {vf.toFixed(1)}) / {internalR} = {(iReal * 1000).toFixed(2)} mA
          </div>

          {/* Safety alerts */}
          {safety !== 'safe' && (
            <div className={cn(
              'flex items-start gap-2 p-2.5 rounded border text-xs',
              safety === 'burned'
                ? 'border-red-500/60 bg-red-500/10 text-red-300'
                : safety === 'error'
                ? 'border-red-400/60 bg-red-400/10 text-red-200'
                : 'border-yellow-400/60 bg-yellow-500/10 text-yellow-200'
            )}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">
                  {safety === 'burned'  ? '⚡ LED Burned!' :
                   safety === 'error'   ? '⚠ MCU Overload!' :
                                          '↑ Above Nominal Current'}
                </div>
                <div className="mt-0.5 text-[10px] leading-relaxed">
                  {safety === 'burned'
                    ? `I_real (${(iReal * 1000).toFixed(1)}mA) > If_nom × 1.5 (${(iNom * 1500).toFixed(0)}mA). Increase series resistance.`
                    : safety === 'error'
                    ? `I_real (${(iReal * 1000).toFixed(1)}mA) exceeds MCU max (${mcu.max_ma}mA). Risk of pin damage.`
                    : `I_real (${(iReal * 1000).toFixed(1)}mA) > 20mA nominal. Consider a higher resistor.`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* OPTICAL & SIMULATION */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Optical & Simulation</h3>

          {/* Brightness — só útil se PWM */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className={cn(
                'text-xs',
                !localData.isPwmPin ? 'text-[#4a5568]' : 'text-[#9ca3af]'
              )}>
                Brightness (PWM)
              </Label>
              <span className={cn(
                'text-xs font-mono',
                !localData.isPwmPin ? 'text-[#4a5568]' : 'text-[#00d9ff]'
              )}>
                {!localData.isPwmPin ? 'N/A (non-PWM pin)' : `${Math.round((localData.brightness ?? 1) * 100)}%`}
              </span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={localData.brightness ?? 1}
              disabled={!localData.isPwmPin}
              onChange={(e) => handleChange('brightness', parseFloat(e.target.value))}
              className={cn(
                'w-full h-2 rounded-lg',
                localData.isPwmPin
                  ? 'bg-[#151b24] cursor-pointer accent-[#00d9ff]'
                  : 'bg-[#0d1219] cursor-not-allowed opacity-40'
              )}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[#9ca3af] text-xs">Initial State</Label>
            <Select
              value={localData.initialState || 'off'}
              onValueChange={(v) => handleChange('initialState', v as 'on' | 'off')}
            >
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                <SelectItem value="off" className="text-[#e6e6e6]">Off</SelectItem>
                <SelectItem value="on"  className="text-[#e6e6e6]">On</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-[#9ca3af] text-xs cursor-pointer">Enforce Polarity</Label>
              <p className="text-[10px] text-[#4a5568] mt-0.5">
                When ON, simulator blocks reverse-biased connections.
              </p>
            </div>
            <Switch
              checked={localData.polarityEnforced ?? true}
              onCheckedChange={(v) => handleChange('polarityEnforced', v)}
              className="data-[state=checked]:bg-[#00d9ff] ml-3 flex-shrink-0"
            />
          </div>
        </div>

        {/* PREVIEW */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Preview</h3>
          <div className="flex flex-col items-center justify-center p-5 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)] gap-3">

            {/* LED visual */}
            <div className="relative">
              <div
                className={cn(
                  'w-12 h-12 rounded-full transition-all duration-300',
                  isBurned && 'ring-2 ring-red-500'
                )}
                style={{
                  backgroundColor: previewHex,
                  opacity: isBurned
                    ? 0.15
                    : !isOn
                    ? 0.2
                    : 0.3 + (localData.brightness ?? 1) * 0.7 * (intensityPercent / 100),
                  boxShadow: isBurned || !isOn
                    ? 'none'
                    : `0 0 ${20 + intensityPercent / 5}px 6px ${previewHex}60`,
                }}
              >
                {/* Glint */}
                {!isBurned && isOn && (
                  <div className="absolute top-1.5 left-2.5 w-4 h-2.5 rounded-full bg-white opacity-30" />
                )}
              </div>
              {/* Burned X */}
              {isBurned && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-red-500 text-xl font-bold">✕</span>
                </div>
              )}
            </div>

            {/* Status row */}
            <div className="flex items-center gap-2 text-[10px]">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                isBurned ? 'bg-red-500' :
                !isOn    ? 'bg-[#4a5568]' :
                safety === 'safe' ? 'bg-green-400' :
                safety === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
              )} />
              <span className="text-[#9ca3af]">
                {isBurned ? 'Burned' :
                 !isOn    ? 'Off' :
                 profileKey === 'IR' ? `IR active — ${(iReal * 1000).toFixed(1)}mA` :
                 `${intensity.toFixed(0)} mcd — ${(iReal * 1000).toFixed(1)}mA`}
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default LEDPropertiesPanel;

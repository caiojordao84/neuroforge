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
import { Lightbulb, RotateCcw, Save, AlertTriangle, Flame } from 'lucide-react';
import {
  ledProfiles, resistorOptions, getActiveMicrocontrollerProfile,
  calculateRealCurrent, calculateLuminousIntensity, getSafetyStatus,
  type LedColorProfile, type ResistorOption,
} from '@/lib/ledCalculations';
import { useConnectionStore } from '@/stores/useConnectionStore';

interface LEDNodeData {
  id?: string;
  name?: string;
  label?: string;
  connectedPin?: number | null;
  cathodeConnected?: boolean;
  colorProfile?: LedColorProfile;
  forwardVoltage?: number;
  forwardCurrent?: number;
  resistor?: ResistorOption;
  customResistance?: number;
  brightness?: number;
  overrideBrightness?: boolean;
  isCommonAnode?: boolean;
}

export const LEDPropertiesPanel: React.FC = () => {
  const { setNodes }    = useReactFlow();
  const nodes           = useNodes();
  const { connections } = useConnectionStore();
  const selectedNode    = nodes.find((n) => n.selected && n.type === 'led');

  const [localData, setLocalData] = useState<LEDNodeData>({});
  const [hasChanges, setHasChanges] = useState(false);

  // ── Wiring resolution ───────────────────────────────────────────
  const resolveWiring = useCallback(() => {
    if (!selectedNode) return { pin: null, cathode: 'Floating' };
    const anodeConn = connections.find(c => 
      c.source === `${selectedNode.id}:anode` || c.target === `${selectedNode.id}:anode`
    );
    const cathodeConn = connections.find(c => 
      c.source === `${selectedNode.id}:cathode` || c.target === `${selectedNode.id}:cathode`
    );

    let pin: number | null = null;
    if (anodeConn) {
      const other = anodeConn.source.startsWith(selectedNode.id) ? anodeConn.target : anodeConn.source;
      const m = other.match(/D(\d+)/);
      if (m) pin = parseInt(m[1], 10);
    }

    let cathode = 'Floating';
    if (cathodeConn) {
      const other = cathodeConn.source.startsWith(selectedNode.id) ? cathodeConn.target : cathodeConn.source;
      if (other.includes('GND')) cathode = 'GND ✓';
      else if (other.match(/D(\d+)/)) cathode = `Pin ${other.split(':')[1]} (Logic)`;
      else cathode = 'Connected';
    }

    return { pin, cathode };
  }, [selectedNode, connections]);

  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as LEDNodeData;
    const { pin } = resolveWiring();

    setLocalData({
      id:                 selectedNode.id,
      label:              d.label              ?? 'LED',
      colorProfile:       d.colorProfile       ?? 'red_standard',
      forwardVoltage:     d.forwardVoltage     ?? 2.0,
      forwardCurrent:     d.forwardCurrent     ?? 0.020,
      resistor:           d.resistor           ?? 220,
      customResistance:   d.customResistance,
      brightness:         d.brightness         ?? 1.0,
      overrideBrightness: d.overrideBrightness ?? false,
      isCommonAnode:      d.isCommonAnode      ?? false,
      connectedPin:       pin,
    });
    setHasChanges(false);
  }, [selectedNode?.id, connections]);

  const handleChange = useCallback(<K extends keyof LEDNodeData>(key: K, value: LEDNodeData[K]) => {
    setLocalData(p => ({ ...p, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleProfileChange = useCallback((profileKey: string) => {
    const profile = ledProfiles[profileKey as LedColorProfile];
    if (!profile) return;
    setLocalData(p => ({
      ...p,
      colorProfile:   profileKey as LedColorProfile,
      forwardVoltage: profile.vf,
      forwardCurrent: profile.if_nom,
    }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNode) return;
    setNodes(nds => nds.map(n => n.id !== selectedNode.id ? n : {
      ...n,
      data: {
        ...n.data,
        label:              localData.label,
        colorProfile:       localData.colorProfile,
        forwardVoltage:     localData.forwardVoltage,
        forwardCurrent:     localData.forwardCurrent,
        resistor:           localData.resistor,
        customResistance:   localData.resistor === 'USER' ? localData.customResistance : undefined,
        brightness:         localData.brightness,
        overrideBrightness: localData.overrideBrightness,
        isCommonAnode:      localData.isCommonAnode,
      }
    }));
    setHasChanges(false);
  }, [selectedNode, localData, setNodes]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
        <Lightbulb className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm text-center">Select an LED component to configuration</p>
      </div>
    );
  }

  const mcu = getActiveMicrocontrollerProfile();
  const R = localData.resistor === 'USER' ? (localData.customResistance ?? 220) : (localData.resistor ?? 220);
  const current_a = calculateRealCurrent(mcu.v_out, localData.forwardVoltage ?? 2.0, R);
  const current_ma = parseFloat((current_a * 1000).toFixed(1));
  const safety = getSafetyStatus(current_a, localData.forwardCurrent ?? 0.020, mcu.max_ma);
  const intensity = calculateLuminousIntensity(current_a, localData.forwardCurrent ?? 0.020, localData.brightness ?? 1.0);

  const { pin, cathode } = resolveWiring();
  const profile = ledProfiles[localData.colorProfile ?? 'red_standard'];

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[#00d9ff]" />
          <span className="text-[#e6e6e6] font-medium text-sm">LED Properties</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setHasChanges(false)}
            className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}
            className={cn('h-7 px-3', hasChanges ? 'bg-[#00d9ff] text-[#0a0e14]' : 'bg-[#1a3a5c] text-[#9ca3af]')}>
            <Save className="w-3.5 h-3.5 mr-1" />Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Identification Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Identification</h3>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-[#9ca3af] text-xs">Component Label</Label>
              <Input value={localData.label ?? ''} onChange={e => handleChange('label', e.target.value)}
                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#9ca3af] text-xs">Color Profile</Label>
              <Select value={localData.colorProfile} onValueChange={handleProfileChange}>
                <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                  {Object.entries(ledProfiles).map(([key, p]) => (
                    <SelectItem key={key} value={key} className="text-[#e6e6e6] capitalize">
                      {key.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Wiring Info (ReadOnly in Panel) */}
        <section className="space-y-3">
           <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Wiring Status</h3>
           <div className="grid gap-2 p-3 rounded-lg bg-[#0d1520] border border-[rgba(0,217,255,0.1)] text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#64748b]">Anode (+)</span>
                <span className={pin ? 'text-green-400' : 'text-orange-400'}>{pin ? `Pin D${pin}` : 'Disconnected'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Cathode (-)</span>
                <span className={cathode.includes('✓') ? 'text-green-400' : 'text-orange-400'}>{cathode}</span>
              </div>
           </div>
        </section>

        {/* Electrical Config */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Electrical Configuration</h3>
          
          <div className="space-y-2">
            <Label className="text-[#9ca3af] text-xs">Current Limiting Resistor</Label>
            <Select value={String(localData.resistor)} onValueChange={v => handleChange('resistor', v === 'USER' ? 'USER' : parseInt(v))}>
              <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                {resistorOptions.map(r => (
                  <SelectItem key={String(r)} value={String(r)} className="text-[#e6e6e6]">
                    {r === 'USER' ? 'Custom Value' : `${r} Ω`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localData.resistor === 'USER' && (
              <div className="mt-2 flex items-center gap-2">
                <Input type="number" placeholder="Value in Ohms" value={localData.customResistance ?? ''}
                  onChange={e => handleChange('customResistance', parseInt(e.target.value))}
                  className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
                <span className="text-[#9ca3af] text-sm">Ω</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <Label className="text-[#9ca3af] text-xs">Forward Voltage (Vf)</Label>
                <Input type="number" step="0.1" value={localData.forwardVoltage}
                  onChange={e => handleChange('forwardVoltage', parseFloat(e.target.value))}
                  className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
             </div>
             <div className="space-y-1.5">
                <Label className="text-[#9ca3af] text-xs">Limit Current (mA)</Label>
                <Input type="number" step="1" value={(localData.forwardCurrent ?? 0) * 1000}
                  onChange={e => handleChange('forwardCurrent', parseFloat(e.target.value) / 1000)}
                  className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" />
             </div>
          </div>
        </section>

        {/* Real-time Lab Analysis */}
        <section className="space-y-3">
           <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider flex items-center gap-2">
             Simulation Analysis
             {safety === 'safe' ? (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
             ) : (
                <AlertTriangle className="w-3 h-3 text-orange-500" />
             )}
           </h3>
           <div className="space-y-2 p-3 rounded-lg bg-[#0d1520] border border-[rgba(0,217,255,0.1)]">
              <div className="flex justify-between items-center text-sm">
                 <span className="text-[#9ca3af]">Real-time Current</span>
                 <span className={cn(
                    "font-mono font-bold",
                    safety === 'burned' ? 'text-red-500' : safety === 'error' ? 'text-orange-500' : 'text-[#00d9ff]'
                 )}>{current_ma} mA</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                 <span className="text-[#64748b]">Safety Status</span>
                 <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                    safety === 'safe' ? "bg-green-500/10 text-green-500" :
                    safety === 'warning' ? "bg-yellow-500/10 text-yellow-500" :
                    "bg-red-500/20 text-red-500"
                 )}>
                    {safety === 'burned' ? <><Flame className="w-3 h-3 inline mr-1"/> OVERLOAD</> : safety}
                 </span>
              </div>
           </div>
        </section>

        {/* Optical Configuration */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Optical Config</h3>
            <div className="flex items-center gap-2">
               <Label className="text-[10px] text-[#9ca3af]">Override</Label>
               <Switch checked={localData.overrideBrightness} onCheckedChange={v => handleChange('overrideBrightness', v)}
                 className="scale-75 data-[state=checked]:bg-[#00d9ff]" />
            </div>
          </div>
          
          <div className="space-y-3">
             <div className="flex justify-between text-xs text-[#9ca3af]">
                <span>Apparent Intensity</span>
                <span className="text-[#e6e6e6]">{Math.round(intensity * 100)}%</span>
             </div>
             <input type="range" min="0" max="2" step="0.1"
                value={localData.brightness}
                onChange={e => handleChange('brightness', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
             <p className="text-[10px] text-[#475569]">
               Controls how the LED glow appears in the workspace. Current simulation model: <strong>{profile?.intensity_model ?? 'Standard'}</strong>
             </p>
          </div>
        </section>

        {/* Visual Preview */}
        <section className="pt-2 text-center space-y-3">
          <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">Visual Preview</h3>
          <div className="flex flex-col items-center justify-center p-6 bg-[#151b24] rounded-xl border border-[rgba(0,217,255,0.1)]">
             <div className="relative group">
                <div 
                  className="absolute inset-0 rounded-full blur-xl opacity-60 transition-all duration-500 group-hover:opacity-100"
                  style={{ 
                    backgroundColor: profile?.hex ?? '#ffffff',
                    transform: `scale(${0.5 + intensity})`
                  }}
                />
                <div 
                  className={cn(
                    "relative w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center",
                    safety === 'burned' && "sepia grayscale"
                  )}
                  style={{ backgroundColor: (current_ma > 0.1 ? profile?.hex : '#1e293b') }}
                >
                  <div className="absolute top-2 left-3 w-4 h-2 bg-white/30 rounded-full -rotate-12" />
                </div>
             </div>
             <span className="mt-4 text-[10px] font-mono text-[#475569]">{profile?.hex} @ {current_ma}mA</span>
          </div>
        </section>

      </div>
    </div>
  );
};

export default LEDPropertiesPanel;

import React, { useCallback, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Palette, RotateCcw, Save } from 'lucide-react';

interface RGBLEDNodeData {
    label?: string;
    isCommonAnode?: boolean;
    r?: number;
    g?: number;
    b?: number;
    brightness?: number;
    initialState?: 'off' | 'solid' | 'rainbow' | 'pulse';
    pulseSpeed?: number;
    rForwardVoltage?: number;
    gForwardVoltage?: number;
    bForwardVoltage?: number;
}

export const RGBLEDPropertiesPanel: React.FC = () => {
    const { setNodes } = useReactFlow();
    const nodes = useNodes();
    const selectedNode = nodes.find((n) => n.selected && n.type === 'rgbLed');
    const [localData, setLocalData] = useState<RGBLEDNodeData>({});
    const [hasChanges, setHasChanges] = useState(false);

    React.useEffect(() => {
        if (selectedNode) {
            setLocalData({
                label: (selectedNode.data.label as string) || 'RGB LED',
                isCommonAnode: (selectedNode.data.isCommonAnode as boolean) ?? false,
                r: (selectedNode.data.r as number) ?? 255,
                g: (selectedNode.data.g as number) ?? 255,
                b: (selectedNode.data.b as number) ?? 255,
                brightness: (selectedNode.data.brightness as number) ?? 1,
                initialState: (selectedNode.data.initialState as RGBLEDNodeData['initialState']) || 'off',
                pulseSpeed: (selectedNode.data.pulseSpeed as number) ?? 1,
                rForwardVoltage: (selectedNode.data.rForwardVoltage as number) ?? 2.0,
                gForwardVoltage: (selectedNode.data.gForwardVoltage as number) ?? 3.2,
                bForwardVoltage: (selectedNode.data.bForwardVoltage as number) ?? 3.2,
            });
            setHasChanges(false);
        }
    }, [selectedNode?.id]);

    const handleChange = useCallback(<K extends keyof RGBLEDNodeData>(key: K, value: RGBLEDNodeData[K]) => {
        setLocalData((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }, []);

    const handleSave = useCallback(() => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...localData } } : n)));
        setHasChanges(false);
    }, [selectedNode, localData, setNodes]);

    const handleReset = useCallback(() => {
        if (selectedNode) {
            setLocalData({
                label: (selectedNode.data.label as string) || 'RGB LED',
                isCommonAnode: (selectedNode.data.isCommonAnode as boolean) ?? false,
                r: (selectedNode.data.r as number) ?? 255,
                g: (selectedNode.data.g as number) ?? 255,
                b: (selectedNode.data.b as number) ?? 255,
                brightness: (selectedNode.data.brightness as number) ?? 1,
                initialState: (selectedNode.data.initialState as RGBLEDNodeData['initialState']) || 'off',
                pulseSpeed: (selectedNode.data.pulseSpeed as number) ?? 1,
                rForwardVoltage: (selectedNode.data.rForwardVoltage as number) ?? 2.0,
                gForwardVoltage: (selectedNode.data.gForwardVoltage as number) ?? 3.2,
                bForwardVoltage: (selectedNode.data.bForwardVoltage as number) ?? 3.2,
            });
            setHasChanges(false);
        }
    }, [selectedNode]);

    if (!selectedNode) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
                <Palette className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Select an RGB LED component to edit its properties</p>
            </div>
        );
    }

    const rgbColor = `rgb(${localData.r || 255}, ${localData.g || 255}, ${localData.b || 255})`;

    return (
        <div className="flex flex-col h-full bg-[#0a0e14]">
            <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
                <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-[#00d9ff]" />
                    <span className="text-[#e6e6e6] font-medium text-sm">RGB LED Properties</span>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset} className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]"><RotateCcw className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" onClick={handleSave} disabled={!hasChanges} className={cn('h-7 px-3', hasChanges ? 'bg-[#00d9ff] text-[#0a0e14]' : 'bg-[#1a3a5c] text-[#9ca3af]')}><Save className="w-3.5 h-3.5 mr-1" />Save</Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Identification</h3>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Display Name</Label><Input value={localData.label || ''} onChange={(e) => handleChange('label', e.target.value)} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                    <div className="flex items-center justify-between py-2"><Label className="text-[#9ca3af] text-xs cursor-pointer">Common Anode</Label><Switch checked={localData.isCommonAnode ?? false} onCheckedChange={(v) => handleChange('isCommonAnode', v)} className="data-[state=checked]:bg-[#00d9ff]" /></div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Color (RGB)</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1"><Label className="text-red-400 text-xs">R</Label><Input type="number" min="0" max="255" value={localData.r || ''} onChange={(e) => handleChange('r', parseInt(e.target.value))} className="bg-[#151b24] border-red-500/30 text-red-400 text-sm h-8" /></div>
                        <div className="space-y-1"><Label className="text-green-400 text-xs">G</Label><Input type="number" min="0" max="255" value={localData.g || ''} onChange={(e) => handleChange('g', parseInt(e.target.value))} className="bg-[#151b24] border-green-500/30 text-green-400 text-sm h-8" /></div>
                        <div className="space-y-1"><Label className="text-blue-400 text-xs">B</Label><Input type="number" min="0" max="255" value={localData.b || ''} onChange={(e) => handleChange('b', parseInt(e.target.value))} className="bg-[#151b24] border-blue-500/30 text-blue-400 text-sm h-8" /></div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between"><Label className="text-[#9ca3af] text-xs">Brightness</Label><span className="text-[#00d9ff] text-xs">{Math.round((localData.brightness || 1) * 100)}%</span></div>
                        <input type="range" min="0" max="1" step="0.05" value={localData.brightness || 1} onChange={(e) => handleChange('brightness', parseFloat(e.target.value))} className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Electrical (per channel)</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1"><Label className="text-red-400 text-xs">R Vf (V)</Label><Input type="number" step="0.1" value={localData.rForwardVoltage || ''} onChange={(e) => handleChange('rForwardVoltage', parseFloat(e.target.value))} className="bg-[#151b24] border-red-500/30 text-red-400 text-sm h-8" /></div>
                        <div className="space-y-1"><Label className="text-green-400 text-xs">G Vf (V)</Label><Input type="number" step="0.1" value={localData.gForwardVoltage || ''} onChange={(e) => handleChange('gForwardVoltage', parseFloat(e.target.value))} className="bg-[#151b24] border-green-500/30 text-green-400 text-sm h-8" /></div>
                        <div className="space-y-1"><Label className="text-blue-400 text-xs">B Vf (V)</Label><Input type="number" step="0.1" value={localData.bForwardVoltage || ''} onChange={(e) => handleChange('bForwardVoltage', parseFloat(e.target.value))} className="bg-[#151b24] border-blue-500/30 text-blue-400 text-sm h-8" /></div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Simulation</h3>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Initial State</Label>
                        <Select value={localData.initialState || 'off'} onValueChange={(v) => handleChange('initialState', v as RGBLEDNodeData['initialState'])}>
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                <SelectItem value="off" className="text-[#e6e6e6]">Off</SelectItem>
                                <SelectItem value="solid" className="text-[#e6e6e6]">Solid Color</SelectItem>
                                <SelectItem value="rainbow" className="text-[#e6e6e6]">Rainbow Cycle</SelectItem>
                                <SelectItem value="pulse" className="text-[#e6e6e6]">Pulse</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {localData.initialState === 'pulse' && (
                        <div className="space-y-2">
                            <div className="flex justify-between"><Label className="text-[#9ca3af] text-xs">Pulse Speed</Label><span className="text-[#00d9ff] text-xs">{localData.pulseSpeed}x</span></div>
                            <input type="range" min="0.5" max="5" step="0.5" value={localData.pulseSpeed || 1} onChange={(e) => handleChange('pulseSpeed', parseFloat(e.target.value))} className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Preview</h3>
                    <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
                        <div className="w-12 h-12 rounded-full transition-all duration-300" style={{ backgroundColor: rgbColor, opacity: localData.initialState === 'off' ? 0.3 : localData.brightness, boxShadow: localData.initialState !== 'off' ? `0 0 30px ${rgbColor}80` : 'none' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RGBLEDPropertiesPanel;
import React, { useCallback, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, RotateCcw, Save } from 'lucide-react';

interface PotentiometerNodeData {
    label?: string;
    resistance?: number;
    tolerance?: number;
    taper?: 'linear' | 'log' | 'antilog';
    initialValue?: number;
    powerRating?: number;
    wiperPosition?: number;
}

export const PotentiometerPropertiesPanel: React.FC = () => {
    const { setNodes } = useReactFlow();
    const nodes = useNodes();
    const selectedNode = nodes.find((n) => n.selected && n.type === 'potentiometer');
    const [localData, setLocalData] = useState<PotentiometerNodeData>({});
    const [hasChanges, setHasChanges] = useState(false);

    React.useEffect(() => {
        if (selectedNode) {
            setLocalData({
                label: (selectedNode.data.label as string) || 'Potentiometer',
                resistance: (selectedNode.data.resistance as number) ?? 10000,
                tolerance: (selectedNode.data.tolerance as number) ?? 20,
                taper: (selectedNode.data.taper as PotentiometerNodeData['taper']) || 'linear',
                initialValue: (selectedNode.data.initialValue as number) ?? 50,
                powerRating: (selectedNode.data.powerRating as number) ?? 0.5,
                wiperPosition: (selectedNode.data.wiperPosition as number) ?? 50,
            });
            setHasChanges(false);
        }
    }, [selectedNode?.id]);

    const handleChange = useCallback(<K extends keyof PotentiometerNodeData>(key: K, value: PotentiometerNodeData[K]) => {
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
                label: (selectedNode.data.label as string) || 'Potentiometer',
                resistance: (selectedNode.data.resistance as number) ?? 10000,
                tolerance: (selectedNode.data.tolerance as number) ?? 20,
                taper: (selectedNode.data.taper as PotentiometerNodeData['taper']) || 'linear',
                initialValue: (selectedNode.data.initialValue as number) ?? 50,
                powerRating: (selectedNode.data.powerRating as number) ?? 0.5,
                wiperPosition: (selectedNode.data.wiperPosition as number) ?? 50,
            });
            setHasChanges(false);
        }
    }, [selectedNode]);

    if (!selectedNode) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
                <SlidersHorizontal className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Select a Potentiometer component to edit its properties</p>
            </div>
        );
    }

    const resistanceFormatted = localData.resistance! >= 1000
        ? `${(localData.resistance! / 1000).toFixed(1)}kΩ`
        : `${localData.resistance}Ω`;

    return (
        <div className="flex flex-col h-full bg-[#0a0e14]">
            <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-[#00d9ff]" />
                    <span className="text-[#e6e6e6] font-medium text-sm">Potentiometer Properties</span>
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
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Electrical Specifications</h3>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Total Resistance (Ω)</Label><Input type="number" step="100" value={localData.resistance || ''} onChange={(e) => handleChange('resistance', parseInt(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Tolerance (±%)</Label><Input type="number" value={localData.tolerance || ''} onChange={(e) => handleChange('tolerance', parseFloat(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Taper Type</Label>
                        <Select value={localData.taper || 'linear'} onValueChange={(v) => handleChange('taper', v as PotentiometerNodeData['taper'])}>
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                <SelectItem value="linear" className="text-[#e6e6e6]">Linear (B)</SelectItem>
                                <SelectItem value="log" className="text-[#e6e6e6]">Logarithmic (A)</SelectItem>
                                <SelectItem value="antilog" className="text-[#e6e6e6]">Anti-Logarithmic (C)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Power Rating (W)</Label><Input type="number" step="0.1" value={localData.powerRating || ''} onChange={(e) => handleChange('powerRating', parseFloat(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Simulation</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between"><Label className="text-[#9ca3af] text-xs">Initial Position</Label><span className="text-[#00d9ff] text-xs">{localData.initialValue}%</span></div>
                        <input type="range" min="0" max="100" value={localData.initialValue || 50} onChange={(e) => { handleChange('initialValue', parseInt(e.target.value)); handleChange('wiperPosition', parseInt(e.target.value)); }} className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Preview</h3>
                    <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
                        <div className="relative w-32 h-8 bg-gradient-to-r from-[#1a3a5c] to-[#00d9ff] rounded-full overflow-hidden">
                            <div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ left: `${localData.initialValue}%`, transform: 'translateX(-50%)' }} />
                        </div>
                    </div>
                    <div className="text-center text-xs text-[#9ca3af]">{resistanceFormatted} @ {localData.initialValue}% = {(localData.resistance! * (localData.initialValue! / 100) / 1000).toFixed(2)}kΩ</div>
                </div>
            </div>
        </div>
    );
};

export default PotentiometerPropertiesPanel;
import React, { useCallback, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Cog, RotateCcw, Save } from 'lucide-react';

interface ServoNodeData {
    label?: string;
    modelName?: string;
    minAngle?: number;
    maxAngle?: number;
    initialAngle?: number;
    minPulseWidth?: number;
    maxPulseWidth?: number;
    pwmFrequency?: number;
    smoothing?: number;
}

const servoModels = [
    { name: 'SG90', minAngle: 0, maxAngle: 180, minPulse: 500, maxPulse: 2400 },
    { name: 'MG996R', minAngle: 0, maxAngle: 180, minPulse: 500, maxPulse: 2500 },
    { name: 'DS3218', minAngle: 0, maxAngle: 270, minPulse: 500, maxPulse: 2500 },
    { name: 'FS90R', minAngle: 0, maxAngle: 360, minPulse: 500, maxPulse: 2500 },
];

export const ServoPropertiesPanel: React.FC = () => {
    const { setNodes } = useReactFlow();
    const nodes = useNodes();
    const selectedNode = nodes.find((n) => n.selected && n.type === 'servo');
    const [localData, setLocalData] = useState<ServoNodeData>({});
    const [hasChanges, setHasChanges] = useState(false);

    React.useEffect(() => {
        if (selectedNode) {
            setLocalData({
                label: (selectedNode.data.label as string) || 'Servo',
                modelName: (selectedNode.data.modelName as string) || 'SG90',
                minAngle: (selectedNode.data.minAngle as number) ?? 0,
                maxAngle: (selectedNode.data.maxAngle as number) ?? 180,
                initialAngle: (selectedNode.data.initialAngle as number) ?? 90,
                minPulseWidth: (selectedNode.data.minPulseWidth as number) ?? 500,
                maxPulseWidth: (selectedNode.data.maxPulseWidth as number) ?? 2400,
                pwmFrequency: (selectedNode.data.pwmFrequency as number) ?? 50,
                smoothing: (selectedNode.data.smoothing as number) ?? 0.5,
            });
            setHasChanges(false);
        }
    }, [selectedNode?.id]);

    const handleChange = useCallback(<K extends keyof ServoNodeData>(key: K, value: ServoNodeData[K]) => {
        setLocalData((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }, []);

    const handleModelChange = useCallback((modelName: string) => {
        const model = servoModels.find((m) => m.name === modelName);
        if (model) {
            setLocalData((prev) => ({
                ...prev,
                modelName,
                minAngle: model.minAngle,
                maxAngle: model.maxAngle,
                minPulseWidth: model.minPulse,
                maxPulseWidth: model.maxPulse,
            }));
            setHasChanges(true);
        }
    }, []);

    const handleSave = useCallback(() => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...localData } } : n)));
        setHasChanges(false);
    }, [selectedNode, localData, setNodes]);

    const handleReset = useCallback(() => {
        if (selectedNode) {
            setLocalData({
                label: (selectedNode.data.label as string) || 'Servo',
                modelName: (selectedNode.data.modelName as string) || 'SG90',
                minAngle: (selectedNode.data.minAngle as number) ?? 0,
                maxAngle: (selectedNode.data.maxAngle as number) ?? 180,
                initialAngle: (selectedNode.data.initialAngle as number) ?? 90,
                minPulseWidth: (selectedNode.data.minPulseWidth as number) ?? 500,
                maxPulseWidth: (selectedNode.data.maxPulseWidth as number) ?? 2400,
                pwmFrequency: (selectedNode.data.pwmFrequency as number) ?? 50,
                smoothing: (selectedNode.data.smoothing as number) ?? 0.5,
            });
            setHasChanges(false);
        }
    }, [selectedNode]);

    if (!selectedNode) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
                <Cog className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Select a Servo component to edit its properties</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0a0e14]">
            <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
                <div className="flex items-center gap-2">
                    <Cog className="w-5 h-5 text-[#00d9ff]" />
                    <span className="text-[#e6e6e6] font-medium text-sm">Servo Properties</span>
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
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Model</Label>
                        <Select value={localData.modelName || 'SG90'} onValueChange={handleModelChange}>
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                {servoModels.map((m) => (<SelectItem key={m.name} value={m.name} className="text-[#e6e6e6]">{m.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Angle Range</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Min Angle (°)</Label><Input type="number" value={localData.minAngle || ''} onChange={(e) => handleChange('minAngle', parseInt(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                        <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Max Angle (°)</Label><Input type="number" value={localData.maxAngle || ''} onChange={(e) => handleChange('maxAngle', parseInt(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                    </div>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Initial Angle (°)</Label><Input type="number" value={localData.initialAngle || ''} onChange={(e) => handleChange('initialAngle', parseInt(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">PWM Configuration</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Min Pulse (μs)</Label><Input type="number" value={localData.minPulseWidth || ''} onChange={(e) => handleChange('minPulseWidth', parseInt(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                        <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Max Pulse (μs)</Label><Input type="number" value={localData.maxPulseWidth || ''} onChange={(e) => handleChange('maxPulseWidth', parseInt(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                    </div>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">PWM Frequency (Hz)</Label><Input type="number" value={localData.pwmFrequency || ''} onChange={(e) => handleChange('pwmFrequency', parseInt(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                    <div className="space-y-2">
                        <div className="flex justify-between"><Label className="text-[#9ca3af] text-xs">Smoothing</Label><span className="text-[#00d9ff] text-xs">{Math.round((localData.smoothing || 0.5) * 100)}%</span></div>
                        <input type="range" min="0" max="1" step="0.05" value={localData.smoothing || 0.5} onChange={(e) => handleChange('smoothing', parseFloat(e.target.value))} className="w-full h-2 bg-[#151b24] rounded-lg cursor-pointer accent-[#00d9ff]" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Preview</h3>
                    <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 rounded-full border-2 border-[rgba(0,217,255,0.3)]" />
                            <div className="absolute top-1/2 left-1/2 w-1 h-8 bg-[#00d9ff] origin-bottom -translate-x-1/2 -translate-y-full" style={{ transform: `translateX(-50%) rotate(${(localData.initialAngle || 90) - 90}deg)` }} />
                            <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-[#00d9ff] rounded-full -translate-x-1/2 -translate-y-1/2" />
                        </div>
                    </div>
                    <div className="text-center text-xs text-[#9ca3af]">{localData.initialAngle}°</div>
                </div>
            </div>
        </div>
    );
};

export default ServoPropertiesPanel;
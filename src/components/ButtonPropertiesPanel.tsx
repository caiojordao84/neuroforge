import React, { useCallback, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Square, RotateCcw, Save } from 'lucide-react';

interface ButtonNodeData {
    label?: string;
    buttonType?: 'momentary' | 'toggle' | 'no' | 'nc';
    formFactor?: string;
    debounceTime?: number;
    isPressed?: boolean;
    pullResistor?: 'none' | 'pullup' | 'pulldown';
}

export const ButtonPropertiesPanel: React.FC = () => {
    const { setNodes } = useReactFlow();
    const nodes = useNodes();
    const selectedNode = nodes.find((n) => n.selected && n.type === 'button');
    const [localData, setLocalData] = useState<ButtonNodeData>({});
    const [hasChanges, setHasChanges] = useState(false);

    React.useEffect(() => {
        if (selectedNode) {
            setLocalData({
                label: (selectedNode.data.label as string) || 'Button',
                buttonType: (selectedNode.data.buttonType as ButtonNodeData['buttonType']) || 'momentary',
                formFactor: (selectedNode.data.formFactor as string) || 'tactile',
                debounceTime: (selectedNode.data.debounceTime as number) ?? 50,
                isPressed: (selectedNode.data.isPressed as boolean) ?? false,
                pullResistor: (selectedNode.data.pullResistor as ButtonNodeData['pullResistor']) || 'none',
            });
            setHasChanges(false);
        }
    }, [selectedNode?.id]);

    const handleChange = useCallback(<K extends keyof ButtonNodeData>(key: K, value: ButtonNodeData[K]) => {
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
                label: (selectedNode.data.label as string) || 'Button',
                buttonType: (selectedNode.data.buttonType as ButtonNodeData['buttonType']) || 'momentary',
                formFactor: (selectedNode.data.formFactor as string) || 'tactile',
                debounceTime: (selectedNode.data.debounceTime as number) ?? 50,
                isPressed: (selectedNode.data.isPressed as boolean) ?? false,
                pullResistor: (selectedNode.data.pullResistor as ButtonNodeData['pullResistor']) || 'none',
            });
            setHasChanges(false);
        }
    }, [selectedNode]);

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
            <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
                <div className="flex items-center gap-2">
                    <Square className="w-5 h-5 text-[#00d9ff]" />
                    <span className="text-[#e6e6e6] font-medium text-sm">Button Properties</span>
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
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Electrical</h3>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Button Type</Label>
                        <Select value={localData.buttonType || 'momentary'} onValueChange={(v) => handleChange('buttonType', v as ButtonNodeData['buttonType'])}>
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                <SelectItem value="momentary" className="text-[#e6e6e6]">Momentary</SelectItem>
                                <SelectItem value="toggle" className="text-[#e6e6e6]">Toggle</SelectItem>
                                <SelectItem value="no" className="text-[#e6e6e6]">Normally Open (NO)</SelectItem>
                                <SelectItem value="nc" className="text-[#e6e6e6]">Normally Closed (NC)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Pull Resistor</Label>
                        <Select value={localData.pullResistor || 'none'} onValueChange={(v) => handleChange('pullResistor', v as ButtonNodeData['pullResistor'])}>
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                <SelectItem value="none" className="text-[#e6e6e6]">None</SelectItem>
                                <SelectItem value="pullup" className="text-[#e6e6e6]">Pull-up</SelectItem>
                                <SelectItem value="pulldown" className="text-[#e6e6e6]">Pull-down</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label className="text-[#9ca3af] text-xs">Debounce Time (ms)</Label><Input type="number" value={localData.debounceTime || ''} onChange={(e) => handleChange('debounceTime', parseInt(e.target.value))} className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" /></div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Simulation</h3>
                    <div className="flex items-center justify-between py-2"><Label className="text-[#9ca3af] text-xs cursor-pointer">Initially Pressed</Label><Switch checked={localData.isPressed ?? false} onCheckedChange={(v) => handleChange('isPressed', v)} className="data-[state=checked]:bg-[#00d9ff]" /></div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Preview</h3>
                    <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
                        <div className={cn('w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all', localData.isPressed ? 'bg-[#00d9ff] border-[#00d9ff]' : 'bg-[#1a3a5c] border-[rgba(0,217,255,0.3)]')}><Square className={cn('w-8 h-8', localData.isPressed ? 'text-[#0a0e14]' : 'text-[#00d9ff]')} /></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ButtonPropertiesPanel;
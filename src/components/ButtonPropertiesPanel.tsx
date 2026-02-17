import React, { useCallback, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Square, RotateCcw, Save } from 'lucide-react';
import { useConnectionStore } from '@/stores/useConnectionStore';

type PullResistor = 'NONE' | 'PULLUP' | 'PULLDOWN';

interface ButtonNodeData {
    id?: string;
    name?: string;
    label?: string;

    connectedPin?: number | null;

    pullResistor?: PullResistor;
    debounceTime?: number;
    isPressed?: boolean;
    isFloating?: boolean;
}

export const ButtonPropertiesPanel: React.FC = () => {
    const { setNodes } = useReactFlow();
    const nodes = useNodes();
    const { connections } = useConnectionStore();

    const selectedNode = nodes.find((n) => n.selected && n.type === 'button');

    const [localData, setLocalData] = useState<ButtonNodeData>({});
    const [hasChanges, setHasChanges] = useState(false);

    React.useEffect(() => {
        if (selectedNode) {
            const d = selectedNode.data as ButtonNodeData;

            let connectedPin: number | null = d.connectedPin ?? null;
            const signalConnection = connections.find(
                (c) => c.source === `${selectedNode.id}:signal` || c.target === `${selectedNode.id}:signal`
            );
            if (signalConnection) {
                const otherEnd =
                    signalConnection.source === `${selectedNode.id}:signal`
                        ? signalConnection.target
                        : signalConnection.source;
                const pinMatch = otherEnd.match(/D(\d+)/);
                if (pinMatch) {
                    connectedPin = parseInt(pinMatch[1], 10);
                }
            }

            setLocalData({
                id: d.id ?? selectedNode.id,
                name: d.name ?? d.label ?? 'BTN',
                label: d.label,
                connectedPin,
                pullResistor: d.pullResistor ?? 'NONE',
                debounceTime: d.debounceTime ?? 50,
                isPressed: d.isPressed ?? false,
                isFloating: d.isFloating ?? false,
            });
            setHasChanges(false);
        }
    }, [selectedNode?.id, connections]);

    const handleChange = useCallback(<K extends keyof ButtonNodeData>(key: K, value: ButtonNodeData[K]) => {
        setLocalData((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }, []);

    const handleSave = useCallback(() => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? {
            ...n,
            data: {
                ...n.data,
                id: localData.id ?? selectedNode.id,
                name: localData.name ?? 'BTN',
                label: localData.name ?? 'BTN',
                connectedPin: localData.connectedPin ?? null,
                pullResistor: localData.pullResistor ?? 'NONE',
                debounceTime: localData.debounceTime ?? 50,
                isPressed: localData.isPressed ?? false,
                isFloating: localData.isFloating ?? false,
            },
        } : n)));
        setHasChanges(false);
    }, [selectedNode, localData, setNodes]);

    const handleReset = useCallback(() => {
        if (!selectedNode) return;

        const d = selectedNode.data as ButtonNodeData;

        let connectedPin: number | null = d.connectedPin ?? null;
        const signalConnection = connections.find(
            (c) => c.source === `${selectedNode.id}:signal` || c.target === `${selectedNode.id}:signal`
        );
        if (signalConnection) {
            const otherEnd =
                signalConnection.source === `${selectedNode.id}:signal`
                    ? signalConnection.target
                    : signalConnection.source;
            const pinMatch = otherEnd.match(/D(\d+)/);
            if (pinMatch) {
                connectedPin = parseInt(pinMatch[1], 10);
            }
        }

        setLocalData({
            id: d.id ?? selectedNode.id,
            name: d.name ?? d.label ?? 'BTN',
            label: d.label,
            connectedPin,
            pullResistor: d.pullResistor ?? 'NONE',
            debounceTime: d.debounceTime ?? 50,
            isPressed: d.isPressed ?? false,
            isFloating: d.isFloating ?? false,
        });
        setHasChanges(false);
    }, [selectedNode, connections]);

    if (!selectedNode) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
                <Square className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Select a Button component to edit its properties</p>
            </div>
        );
    }

    const logicStateLabel =
        localData.pullResistor === 'PULLUP'
            ? 'Default HIGH, press → LOW'
            : localData.pullResistor === 'PULLDOWN'
            ? 'Default LOW, press → HIGH'
            : 'No internal pull; requires external wiring';

    const floatingLabel =
        localData.pullResistor === 'NONE'
            ? localData.connectedPin != null
                ? 'May be floating if not tied to VCC/GND'
                : 'Floating (no defined level)'
            : 'Defined by pull resistor';

    return (
        <div className="flex flex-col h-full bg-[#0a0e14]">
            <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
                <div className="flex items-center gap-2">
                    <Square className="w-5 h-5 text-[#00d9ff]" />
                    <span className="text-[#e6e6e6] font-medium text-sm">Button Properties</span>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleReset} 
                        className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af]"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                        size="sm" 
                        onClick={handleSave} 
                        disabled={!hasChanges} 
                        className={cn('h-7 px-3', hasChanges ? 'bg-[#00d9ff] text-[#0a0e14]' : 'bg-[#1a3a5c] text-[#9ca3af]')}
                    >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Save
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Identification</h3>
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">ID</Label>
                        <Input
                            value={localData.id ?? selectedNode.id}
                            readOnly
                            className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Display Name</Label>
                        <Input 
                            value={localData.name || ''} 
                            onChange={(e) => handleChange('name', e.target.value)} 
                            className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Pin Mapping</Label>
                        <Input
                            value={
                                localData.connectedPin != null
                                    ? `D${localData.connectedPin}`
                                    : 'Not connected'
                            }
                            readOnly
                            className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Electrical</h3>
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Pull Resistor</Label>
                        <Select 
                            value={localData.pullResistor ?? 'NONE'} 
                            onValueChange={(v) => handleChange('pullResistor', v as PullResistor)}
                        >
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                <SelectItem value="NONE" className="text-[#e6e6e6]">None</SelectItem>
                                <SelectItem value="PULLUP" className="text-[#e6e6e6]">Pull-up</SelectItem>
                                <SelectItem value="PULLDOWN" className="text-[#e6e6e6]">Pull-down</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-[#9ca3af] mt-1">{logicStateLabel}</p>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Debounce Time (ms)</Label>
                        <Input 
                            type="number" 
                            value={localData.debounceTime ?? 50} 
                            onChange={(e) => handleChange('debounceTime', parseInt(e.target.value) || 0)}
                            className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8" 
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Simulation</h3>
                    <div className="flex items-center justify-between py-2">
                        <Label className="text-[#9ca3af] text-xs cursor-pointer">Initially Pressed</Label>
                        <Switch 
                            checked={localData.isPressed ?? false} 
                            onCheckedChange={(v) => handleChange('isPressed', v)} 
                            className="data-[state=checked]:bg-[#00d9ff]" 
                        />
                    </div>

                    <div className="space-y-1 text-xs text-[#9ca3af]">
                        <div className="flex justify-between">
                            <span>Floating State</span>
                            <span className="text-[#e5e7eb]">
                                {localData.pullResistor === 'NONE'
                                    ? localData.connectedPin != null
                                        ? 'Potentially floating'
                                        : 'Floating'
                                    : 'Defined by pull'}
                            </span>
                        </div>
                        <p className="text-[11px]">{floatingLabel}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase">Preview</h3>
                    <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
                        <div className={cn('w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all', localData.isPressed ? 'bg-[#00d9ff] border-[#00d9ff]' : 'bg-[#1a3a5c] border-[rgba(0,217,255,0.3)]')}>
                            <Square className={cn('w-8 h-8', localData.isPressed ? 'text-[#0a0e14]' : 'text-[#00d9ff]')} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ButtonPropertiesPanel;

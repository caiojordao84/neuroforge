import React, { useCallback, useState } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Lightbulb, RotateCcw, Save } from 'lucide-react';

// LED color presets
const ledColors = [
    { value: 'red', label: 'Red', color: '#ff0000', vf: 2.0 },
    { value: 'green', label: 'Green', color: '#00ff00', vf: 2.2 },
    { value: 'blue', label: 'Blue', color: '#0000ff', vf: 3.3 },
    { value: 'yellow', label: 'Yellow', color: '#ffff00', vf: 2.1 },
    { value: 'white', label: 'White', color: '#ffffff', vf: 3.0 },
    { value: 'orange', label: 'Orange', color: '#ff8800', vf: 2.0 },
];

interface LEDNodeData {
    label?: string;
    color?: string;
    isOn?: boolean;
    brightness?: number;
    forwardVoltage?: number;
    nominalCurrent?: number;
    maxCurrent?: number;
    polarityEnforced?: boolean;
    initialState?: 'on' | 'off';
}

export const LEDPropertiesPanel: React.FC = () => {
    const { setNodes } = useReactFlow();
    const nodes = useNodes();

    // Find the selected LED node
    const selectedNode = nodes.find((n) => n.selected && n.type === 'led');

    const [localData, setLocalData] = useState<LEDNodeData>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize local state when selection changes
    React.useEffect(() => {
        if (selectedNode) {
            setLocalData({
                label: (selectedNode.data.label as string) || 'LED',
                color: (selectedNode.data.color as string) || 'red',
                isOn: (selectedNode.data.isOn as boolean) ?? false,
                brightness: (selectedNode.data.brightness as number) ?? 1.0,
                forwardVoltage: (selectedNode.data.forwardVoltage as number) ?? 2.0,
                nominalCurrent: (selectedNode.data.nominalCurrent as number) ?? 20,
                maxCurrent: (selectedNode.data.maxCurrent as number) ?? 30,
                polarityEnforced: (selectedNode.data.polarityEnforced as boolean) ?? true,
                initialState: (selectedNode.data.initialState as 'on' | 'off') || 'off',
            });
            setHasChanges(false);
        }
    }, [selectedNode?.id]);

    // All callbacks must be defined before any conditional returns
    const handleChange = useCallback(<K extends keyof LEDNodeData>(
        key: K,
        value: LEDNodeData[K]
    ) => {
        setLocalData((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }, []);

    const handleColorChange = useCallback((colorValue: string) => {
        const colorData = ledColors.find((c) => c.value === colorValue);
        if (colorData) {
            setLocalData((prev) => ({
                ...prev,
                color: colorValue,
                forwardVoltage: colorData.vf,
            }));
            setHasChanges(true);
        }
    }, []);

    const handleSave = useCallback(() => {
        if (!selectedNode) return;

        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === selectedNode.id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            ...localData,
                        },
                    };
                }
                return n;
            })
        );

        setHasChanges(false);
    }, [selectedNode, localData, setNodes]);

    const handleReset = useCallback(() => {
        if (selectedNode) {
            setLocalData({
                label: (selectedNode.data.label as string) || 'LED',
                color: (selectedNode.data.color as string) || 'red',
                isOn: (selectedNode.data.isOn as boolean) ?? false,
                brightness: (selectedNode.data.brightness as number) ?? 1.0,
                forwardVoltage: (selectedNode.data.forwardVoltage as number) ?? 2.0,
                nominalCurrent: (selectedNode.data.nominalCurrent as number) ?? 20,
                maxCurrent: (selectedNode.data.maxCurrent as number) ?? 30,
                polarityEnforced: (selectedNode.data.polarityEnforced as boolean) ?? true,
                initialState: (selectedNode.data.initialState as 'on' | 'off') || 'off',
            });
            setHasChanges(false);
        }
    }, [selectedNode]);

    // Now we can do conditional rendering after all hooks are defined
    if (!selectedNode) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
                <Lightbulb className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Select an LED component to edit its properties</p>
            </div>
        );
    }

    const selectedColor = ledColors.find((c) => c.value === localData.color) || ledColors[0];

    return (
        <div className="flex flex-col h-full bg-[#0a0e14]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-[#00d9ff]" />
                    <span className="text-[#e6e6e6] font-medium text-sm">LED Properties</span>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        className="h-7 px-2 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-[#00d9ff]"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={cn(
                            'h-7 px-3',
                            hasChanges
                                ? 'bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00a8cc]'
                                : 'bg-[#1a3a5c] text-[#9ca3af] cursor-not-allowed'
                        )}
                    >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Save
                    </Button>
                </div>
            </div>

            {/* Properties Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Identification Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Identification
                    </h3>

                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Display Name</Label>
                        <Input
                            value={localData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                            className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            placeholder="LED"
                        />
                    </div>
                </div>

                {/* Electrical Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Electrical Characteristics
                    </h3>

                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">LED Color</Label>
                        <Select
                            value={localData.color || 'red'}
                            onValueChange={handleColorChange}
                        >
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                {ledColors.map((color) => (
                                    <SelectItem
                                        key={color.value}
                                        value={color.value}
                                        className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: color.color }}
                                            />
                                            {color.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-[#9ca3af] text-xs">Forward Voltage (V)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={localData.forwardVoltage || ''}
                                onChange={(e) => handleChange('forwardVoltage', parseFloat(e.target.value))}
                                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[#9ca3af] text-xs">Nominal Current (mA)</Label>
                            <Input
                                type="number"
                                value={localData.nominalCurrent || ''}
                                onChange={(e) => handleChange('nominalCurrent', parseFloat(e.target.value))}
                                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Maximum Current (mA)</Label>
                        <Input
                            type="number"
                            value={localData.maxCurrent || ''}
                            onChange={(e) => handleChange('maxCurrent', parseFloat(e.target.value))}
                            className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                        />
                    </div>
                </div>

                {/* Optical Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Optical & Simulation
                    </h3>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label className="text-[#9ca3af] text-xs">Brightness Multiplier</Label>
                            <span className="text-[#00d9ff] text-xs">
                                {Math.round((localData.brightness || 1) * 100)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={localData.brightness || 1}
                            onChange={(e) => handleChange('brightness', parseFloat(e.target.value))}
                            className="w-full h-2 bg-[#151b24] rounded-lg appearance-none cursor-pointer accent-[#00d9ff]"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Initial State</Label>
                        <Select
                            value={localData.initialState || 'off'}
                            onValueChange={(v) => handleChange('initialState', v as 'on' | 'off')}
                        >
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                <SelectItem
                                    value="off"
                                    className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
                                >
                                    Off
                                </SelectItem>
                                <SelectItem
                                    value="on"
                                    className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
                                >
                                    On
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <Label className="text-[#9ca3af] text-xs cursor-pointer">
                            Enforce Polarity
                        </Label>
                        <Switch
                            checked={localData.polarityEnforced ?? true}
                            onCheckedChange={(v) => handleChange('polarityEnforced', v)}
                            className="data-[state=checked]:bg-[#00d9ff]"
                        />
                    </div>
                </div>

                {/* Preview */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Preview
                    </h3>
                    <div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
                        <div
                            className={cn(
                                'w-8 h-8 rounded-full transition-all duration-300',
                                localData.initialState === 'on' && 'animate-pulse'
                            )}
                            style={{
                                backgroundColor: selectedColor.color,
                                opacity: localData.initialState === 'on' ? localData.brightness : 0.3,
                                boxShadow: localData.initialState === 'on'
                                    ? `0 0 20px ${selectedColor.color}80`
                                    : 'none',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LEDPropertiesPanel;
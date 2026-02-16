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
import { Lightbulb, RotateCcw, Save, AlertTriangle } from 'lucide-react';
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

interface LEDNodeData {
    id?: string;
    name?: string;
    label?: string;

    connectedPin?: number | null;

    colorProfile?: LedColorProfile;
    customColorHex?: string;

    forwardVoltage?: number;
    nominalCurrent?: number; // A
    maxCurrent?: number;     // A

    internalResistance?: ResistorOption;
    customResistance?: number;

    isOn?: boolean;
    brightness?: number;

    realCurrent?: number;
    luminousIntensity?: number;
    isBurned?: boolean;

    polarityEnforced?: boolean;
    initialState?: 'on' | 'off';
}

export const LEDPropertiesPanel: React.FC = () => {
    const { setNodes } = useReactFlow();
    const nodes = useNodes();

    const selectedNode = nodes.find((n) => n.selected && n.type === 'led');

    const [localData, setLocalData] = useState<LEDNodeData>({});
    const [hasChanges, setHasChanges] = useState(false);

    React.useEffect(() => {
        if (selectedNode) {
            const d = selectedNode.data as LEDNodeData;
            const profileKey: LedColorProfile = d.colorProfile ?? 'RED';
            const profile = ledProfiles[profileKey];

            setLocalData({
                id: d.id ?? selectedNode.id,
                name: d.name ?? d.label ?? 'LED',
                label: d.label,
                connectedPin: d.connectedPin ?? null,

                colorProfile: profileKey,
                customColorHex: d.customColorHex ?? profile.hex,

                forwardVoltage: d.forwardVoltage ?? profile.vf,
                nominalCurrent: d.nominalCurrent ?? profile.if_nom,
                maxCurrent: d.maxCurrent ?? profile.if_max,

                internalResistance: d.internalResistance ?? 220,
                customResistance: d.customResistance,

                realCurrent: d.realCurrent ?? 0,
                luminousIntensity: d.luminousIntensity ?? 0,
                isBurned: d.isBurned ?? false,

                brightness: d.brightness ?? 1.0,
                polarityEnforced: d.polarityEnforced ?? true,
                initialState: d.initialState ?? 'off',
            });
            setHasChanges(false);
        }
    }, [selectedNode?.id]);

    const handleChange = useCallback(<K extends keyof LEDNodeData>(
        key: K,
        value: LEDNodeData[K]
    ) => {
        setLocalData((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }, []);

    const handleColorChange = useCallback((value: LedColorProfile) => {
        const profile = ledProfiles[value];

        setLocalData((prev) => ({
            ...prev,
            colorProfile: value,
            forwardVoltage: prev.forwardVoltage ?? profile.vf,
            nominalCurrent: prev.nominalCurrent ?? profile.if_nom,
            maxCurrent: prev.maxCurrent ?? profile.if_max,
            customColorHex: value === 'USER' ? prev.customColorHex ?? profile.hex : profile.hex,
        }));
        setHasChanges(true);
    }, []);

    const handleResistorChange = useCallback((value: string) => {
        const parsed: ResistorOption = value === 'USER' ? 'USER' : parseInt(value, 10);
        setLocalData((prev) => ({
            ...prev,
            internalResistance: parsed,
        }));
        setHasChanges(true);
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
                            id: localData.id ?? selectedNode.id,
                            name: localData.name ?? 'LED',
                            label: localData.name ?? 'LED',
                            connectedPin: localData.connectedPin ?? null,

                            colorProfile: localData.colorProfile ?? 'RED',
                            customColorHex: localData.customColorHex,

                            forwardVoltage: localData.forwardVoltage,
                            nominalCurrent: localData.nominalCurrent,
                            maxCurrent: localData.maxCurrent,

                            internalResistance: localData.internalResistance ?? 220,
                            customResistance:
                                localData.internalResistance === 'USER'
                                    ? localData.customResistance
                                    : undefined,

                            brightness: localData.brightness,
                            realCurrent: localData.realCurrent,
                            luminousIntensity: localData.luminousIntensity,
                            isBurned: localData.isBurned,

                            polarityEnforced: localData.polarityEnforced,
                            initialState: localData.initialState,
                        },
                    };
                }
                return n;
            })
        );

        setHasChanges(false);
    }, [selectedNode, localData, setNodes]);

    const handleReset = useCallback(() => {
        if (!selectedNode) return;

        const d = selectedNode.data as LEDNodeData;
        const profileKey: LedColorProfile = d.colorProfile ?? 'RED';
        const profile = ledProfiles[profileKey];

        setLocalData({
            id: d.id ?? selectedNode.id,
            name: d.name ?? d.label ?? 'LED',
            label: d.label,
            connectedPin: d.connectedPin ?? null,
            colorProfile: profileKey,
            customColorHex: d.customColorHex ?? profile.hex,
            forwardVoltage: d.forwardVoltage ?? profile.vf,
            nominalCurrent: d.nominalCurrent ?? profile.if_nom,
            maxCurrent: d.maxCurrent ?? profile.if_max,
            internalResistance: d.internalResistance ?? 220,
            customResistance: d.customResistance,
            brightness: d.brightness ?? 1.0,
            realCurrent: d.realCurrent ?? 0,
            luminousIntensity: d.luminousIntensity ?? 0,
            isBurned: d.isBurned ?? false,
            polarityEnforced: d.polarityEnforced ?? true,
            initialState: d.initialState ?? 'off',
        });
        setHasChanges(false);
    }, [selectedNode]);

    if (!selectedNode) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-4">
                <Lightbulb className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Select an LED component to edit its properties</p>
            </div>
        );
    }

    const profileKey: LedColorProfile = localData.colorProfile ?? 'RED';
    const profile = ledProfiles[profileKey];
    const mcu = getActiveMicrocontrollerProfile();

    const internalR =
        localData.internalResistance === 'USER'
            ? localData.customResistance || 220
            : localData.internalResistance || 220;

    const vf = localData.forwardVoltage ?? profile.vf;
    const iNom = localData.nominalCurrent ?? profile.if_nom;

    const iReal = calculateRealCurrent(mcu.v_out, vf, internalR);
    const intensity = calculateLuminousIntensity(profile.mcd, iReal, iNom);

    const safety = getSafetyStatus(iReal, iNom, mcu.max_ma);

    const statusLabel =
        safety === 'burned'
            ? 'Burned (no light)'
            : safety === 'error'
            ? 'MCU Overload'
            : safety === 'warning'
            ? 'Over nominal current'
            : 'Within safe range';

    const intensityPercent =
        iNom > 0 ? Math.round((Math.min(1, Math.max(0, iReal / iNom)) || 0) * 100) : 0;

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
                        <Label className="text-[#9ca3af] text-xs">ID</Label>
                        <Input
                            value={localData.id ?? selectedNode.id}
                            readOnly
                            className="bg-[#111827] border-[rgba(0,217,255,0.3)] text-[#9ca3af] text-xs h-8"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Name</Label>
                        <Input
                            value={localData.name || ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            placeholder="LED"
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

                {/* Electrical Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Electrical Characteristics
                    </h3>

                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">LED Color</Label>
                        <Select
                            value={profileKey}
                            onValueChange={(v) => handleColorChange(v as LedColorProfile)}
                        >
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                {(
                                    ['RED', 'GREEN', 'BLUE', 'YELLOW', 'WHITE', 'ORANGE', 'UV', 'USER'] as LedColorProfile[]
                                ).map((key) => (
                                    <SelectItem
                                        key={key}
                                        value={key}
                                        className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: ledProfiles[key].hex }}
                                            />
                                            {key}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {profileKey === 'USER' && (
                        <div className="space-y-2">
                            <Label className="text-[#9ca3af] text-xs">Custom Color (HEX)</Label>
                            <Input
                                value={localData.customColorHex || ''}
                                onChange={(e) => handleChange('customColorHex', e.target.value)}
                                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                                placeholder="#ff0000"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-[#9ca3af] text-xs">Forward Voltage (Vf)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={localData.forwardVoltage ?? ''}
                                onChange={(e) =>
                                    handleChange('forwardVoltage', parseFloat(e.target.value) || 0)
                                }
                                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[#9ca3af] text-xs">Nominal Current (A)</Label>
                            <Input
                                type="number"
                                step="0.001"
                                value={localData.nominalCurrent ?? ''}
                                onChange={(e) =>
                                    handleChange('nominalCurrent', parseFloat(e.target.value) || 0)
                                }
                                className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Internal Resistance (Ω)</Label>
                        <Select
                            value={
                                localData.internalResistance === 'USER'
                                    ? 'USER'
                                    : String(localData.internalResistance ?? 220)
                            }
                            onValueChange={handleResistorChange}
                        >
                            <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                                {resistorOptions.map((r) => (
                                    <SelectItem
                                        key={String(r)}
                                        value={String(r)}
                                        className="text-[#e6e6e6]"
                                    >
                                        {r === 'USER' ? 'Custom' : `${r} Ω`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {localData.internalResistance === 'USER' && (
                            <div className="mt-1">
                                <Input
                                    type="number"
                                    value={localData.customResistance ?? ''}
                                    onChange={(e) =>
                                        handleChange('customResistance', parseFloat(e.target.value) || 0)
                                    }
                                    className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-sm h-8"
                                    placeholder="Custom Ohms"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Optical & Simulation */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#00d9ff] uppercase tracking-wider">
                        Optical & Simulation
                    </h3>

                    <div className="space-y-1 text-xs text-[#9ca3af]">
                        <div className="flex justify-between">
                            <span>MCU</span>
                            <span className="text-[#e5e7eb]">{mcu.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>V_source</span>
                            <span className="text-[#e5e7eb]">{mcu.v_out.toFixed(1)} V</span>
                        </div>
                        <div className="flex justify-between">
                            <span>I_real</span>
                            <span className="text-[#e5e7eb]">
                                {(iReal * 1000).toFixed(1)} mA
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Intensity</span>
                            <span className="text-[#e5e7eb]">
                                {intensity.toFixed(0)} mcd ({intensityPercent}%)
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[#9ca3af] text-xs">Initial State</Label>
                        <Select
                            value={localData.initialState || 'off'}
                            onValueChange={(v) =>
                                handleChange('initialState', v as 'on' | 'off')
                            }
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

                    {/* Alertas de segurança */}
                    {safety !== 'safe' && (
                        <div
                            className={cn(
                                'flex items-start gap-2 p-2 rounded-md border text-xs',
                                safety === 'burned'
                                    ? 'border-red-500/60 bg-red-500/10 text-red-300'
                                    : safety === 'error'
                                    ? 'border-red-500/60 bg-red-500/10 text-red-200'
                                    : 'border-yellow-400/60 bg-yellow-500/10 text-yellow-200'
                            )}
                        >
                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                            <div>
                                <div className="font-semibold">
                                    {safety === 'burned'
                                        ? 'LED burned!'
                                        : safety === 'error'
                                        ? 'Microcontroller overload!'
                                        : 'Current above nominal'}
                                </div>
                                <div className="mt-0.5 text-[11px]">{statusLabel}</div>
                            </div>
                        </div>
                    )}
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
                                safety === 'burned' && 'ring-2 ring-red-500'
                            )}
                            style={{
                                backgroundColor:
                                    profileKey === 'USER'
                                        ? localData.customColorHex || profile.hex
                                        : profile.hex,
                                opacity: safety === 'burned' ? 0.2 : intensityPercent / 100,
                                boxShadow:
                                    safety === 'burned'
                                        ? 'none'
                                        : `0 0 20px ${
                                              profile.hex
                                          }${Math.round(intensityPercent / 100 * 128)
                                              .toString(16)
                                              .padStart(2, '0')}`,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LEDPropertiesPanel;

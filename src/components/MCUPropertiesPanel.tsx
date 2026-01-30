import React from 'react';
import { boardConfigs } from '@/stores/useSimulationStore';
import { useUIStore } from '@/stores/useUIStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X, Cpu, Wifi, Bluetooth, Zap, Clock, HardDrive, Signal } from 'lucide-react';
import type { BoardType } from '@/types';

interface MCUPropertiesPanelProps {
    nodeId?: string;
    mcuType?: BoardType;
}

export const MCUPropertiesPanel: React.FC<MCUPropertiesPanelProps> = ({ nodeId, mcuType = 'arduino-uno' }) => {
    const { closeWindow } = useUIStore();

    const config = boardConfigs[mcuType];
    const isArduino = mcuType === 'arduino-uno';
    const isESP32 = mcuType === 'esp32-devkit';

    const handleBoardChange = (newBoard: BoardType) => {
        console.log('Board changed to:', newBoard);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0e14] text-[#e6e6e6]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#151b24] border-b border-[rgba(0,217,255,0.2)]">
                <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-[#00d9ff]" />
                    <h3 className="font-medium text-sm">MCU Properties</h3>
                    {nodeId && <Badge variant="outline" className="text-[10px] border-[rgba(0,217,255,0.3)]">{nodeId}</Badge>}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]"
                    onClick={() => closeWindow('properties')}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Model Selection */}
                <div className="space-y-2">
                    <Label className="text-[#9ca3af] text-xs">Model</Label>
                    <Select value={mcuType} onValueChange={(v) => handleBoardChange(v as BoardType)}>
                        <SelectTrigger className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                            <SelectItem value="arduino-uno">Arduino Uno R3</SelectItem>
                            <SelectItem value="esp32-devkit">ESP32 DevKit</SelectItem>
                            <SelectItem value="raspberry-pi-pico">Raspberry Pi Pico</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* MCU Info Card */}
                <div className="p-3 rounded-lg bg-[#151b24] border border-[rgba(0,217,255,0.1)] space-y-2">
                    <h4 className="text-sm font-medium text-[#00d9ff]">{config.name}</h4>
                    <p className="text-[10px] text-[#9ca3af]">{config.description}</p>

                    <div className="flex gap-2 pt-2">
                        {config.hasWiFi && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                                <Wifi className="w-3 h-3 mr-1" />
                                WiFi
                            </Badge>
                        )}
                        {config.hasBluetooth && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">
                                <Bluetooth className="w-3 h-3 mr-1" />
                                Bluetooth
                            </Badge>
                        )}
                        {!config.hasWiFi && !config.hasBluetooth && (
                            <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]">
                                <Signal className="w-3 h-3 mr-1" />
                                No Wireless
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Clock Speed */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#9ca3af]" />
                        <Label className="text-[#9ca3af] text-xs">Clock Speed</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Input
                            type="text"
                            value={isArduino ? '16 MHz' : isESP32 ? '240 MHz' : '133 MHz'}
                            readOnly
                            className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-sm"
                        />
                        <Badge variant="outline" className="text-[10px] border-[rgba(0,217,255,0.3)]">
                            {isArduino ? '8-bit' : isESP32 ? '32-bit Xtensa' : '32-bit ARM'}
                        </Badge>
                    </div>
                </div>

                {/* Memory */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-[#9ca3af]" />
                        <Label className="text-[#9ca3af] text-xs">Memory</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-[10px] text-[#9ca3af] block">Flash</span>
                            <span className="text-sm text-[#e6e6e6]">
                                {isArduino ? '32 KB' : isESP32 ? '4 MB' : '2 MB'}
                            </span>
                        </div>
                        <div className="p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-[10px] text-[#9ca3af] block">RAM</span>
                            <span className="text-sm text-[#e6e6e6]">
                                {isArduino ? '2 KB' : isESP32 ? '520 KB' : '264 KB'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Pin Configuration */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#9ca3af]" />
                        <Label className="text-[#9ca3af] text-xs">Pin Configuration</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-[10px] text-[#9ca3af] block">Digital Pins</span>
                            <span className="text-sm text-[#00d9ff]">{config.digitalPins.length}</span>
                        </div>
                        <div className="p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-[10px] text-[#9ca3af] block">Analog Pins</span>
                            <span className="text-sm text-[#ffd600]">{config.analogPins.length}</span>
                        </div>
                        <div className="p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-[10px] text-[#9ca3af] block">PWM Pins</span>
                            <span className="text-sm text-[#e6e6e6]">{config.pwmPins.length}</span>
                        </div>
                        <div className="p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-[10px] text-[#9ca3af] block">Communication</span>
                            <span className="text-[10px] text-[#9ca3af]">UART, I2C, SPI</span>
                        </div>
                    </div>
                </div>

                {/* Communication Interfaces */}
                <div className="space-y-2">
                    <Label className="text-[#9ca3af] text-xs">Communication Interfaces</Label>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-xs">UART (Serial)</span>
                            <Badge variant="outline" className="text-[10px] border-[rgba(0,217,255,0.3)]">
                                {isArduino ? '1x' : isESP32 ? '3x' : '2x'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-xs">I2C (Wire)</span>
                            <Badge variant="outline" className="text-[10px] border-[rgba(0,217,255,0.3)]">
                                {isArduino ? '1x' : isESP32 ? '2x' : '2x'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                            <span className="text-xs">SPI</span>
                            <Badge variant="outline" className="text-[10px] border-[rgba(0,217,255,0.3)]">
                                {isArduino ? '1x' : isESP32 ? '4x' : '2x'}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Power Settings */}
                <div className="space-y-2">
                    <Label className="text-[#9ca3af] text-xs">Power Configuration</Label>
                    <div className="p-3 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)] space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs">Operating Voltage</span>
                            <span className="text-xs text-[#00d9ff]">
                                {isArduino ? '5V' : isESP32 ? '3.3V' : '3.3V'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs">Input Voltage (VIN)</span>
                            <span className="text-xs text-[#e6e6e6]">
                                {isArduino ? '7-12V' : isESP32 ? '5-12V' : '1.8-5.5V'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs">DC Current per Pin</span>
                            <span className="text-xs text-[#e6e6e6]">
                                {isArduino ? '40 mA' : isESP32 ? '40 mA' : '16 mA'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Simulation Settings */}
                <div className="space-y-2">
                    <Label className="text-[#9ca3af] text-xs">Simulation Settings</Label>
                    <div className="space-y-2 p-3 rounded bg-[#151b24] border border-[rgba(0,217,255,0.1)]">
                        <div className="flex items-center justify-between">
                            <span className="text-xs">Clock Speed Scaling</span>
                            <Switch
                                defaultChecked={false}
                                className="data-[state=checked]:bg-[#00d9ff]"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs">Power Consumption Sim</span>
                            <Switch
                                defaultChecked={true}
                                className="data-[state=checked]:bg-[#00d9ff]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-[#151b24] border-t border-[rgba(0,217,255,0.2)]">
                <Button
                    className="w-full bg-[#00d9ff] hover:bg-[#00a8cc] text-[#0a0e14] text-sm font-medium"
                    onClick={() => closeWindow('properties')}
                >
                    Apply Changes
                </Button>
            </div>
        </div>
    );
};

export default MCUPropertiesPanel;
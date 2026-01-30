import React from 'react';
import { useNodes } from '@xyflow/react';
import { MCUPropertiesPanel } from './MCUPropertiesPanel';
import { LEDPropertiesPanel } from './LEDPropertiesPanel';
import { ButtonPropertiesPanel } from './ButtonPropertiesPanel';
import { ServoPropertiesPanel } from './ServoPropertiesPanel';
import { RGBLEDPropertiesPanel } from './RGBLEDPropertiesPanel';
import { PotentiometerPropertiesPanel } from './PotentiometerPropertiesPanel';
import { PanelTopOpen } from 'lucide-react';

export const PropertiesPanel: React.FC = () => {
    const nodes = useNodes();

    // Find the selected node
    const selectedNode = nodes.find((n) => n.selected);

    // If no node is selected, show empty state
    if (!selectedNode) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-6 bg-[#0a0e14]">
                <PanelTopOpen className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm text-center">Select a component on the canvas to view and edit its properties</p>
            </div>
        );
    }

    // Render the appropriate panel based on node type
    switch (selectedNode.type) {
        case 'mcu':
            return <MCUPropertiesPanel />;
        case 'led':
            return <LEDPropertiesPanel />;
        case 'button':
            return <ButtonPropertiesPanel />;
        case 'servo':
            return <ServoPropertiesPanel />;
        case 'rgbLed':
            return <RGBLEDPropertiesPanel />;
        case 'potentiometer':
            return <PotentiometerPropertiesPanel />;
        default:
            return (
                <div className="flex flex-col h-full items-center justify-center text-[#9ca3af] p-6 bg-[#0a0e14]">
                    <PanelTopOpen className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-sm text-center">Unknown component type: {selectedNode.type}</p>
                    <p className="text-xs text-[#9ca3af]/70 mt-2">Properties panel not available for this component</p>
                </div>
            );
    }
};

export default PropertiesPanel;
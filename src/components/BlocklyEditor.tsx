import React, { useRef, useEffect, useCallback } from 'react';
import { useSimulationStore, boardConfigs } from '@/stores/useSimulationStore';
import { useUIStore } from '@/stores/useUIStore';
import { blocklyToCode, codeToBlocklyRoundtrip } from '@/engine/asl/blocklyToASL';

// Types for Blockly window globals
declare global {
    interface Window {
        Blockly: any;
    }
}

const EMPTY_XML = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';

export const BlocklyEditor: React.FC = () => {
    const blocklyDiv = useRef<HTMLDivElement>(null);
    const workspace = useRef<any>(null);

    // Use store selectively
    const activeMCUId = useSimulationStore((state) => state.activeMCUId);
    const mcus = useSimulationStore((state) => state.mcus);
    const updateMCUBlockly = useSimulationStore((state) => state.updateMCUBlockly);
    const updateMCUCode = useSimulationStore((state) => state.updateMCUCode);
    const activeWindowId = useUIStore((state) => state.activeWindowId);
    const isMounted = useRef<boolean>(true);

    const mcu = activeMCUId ? mcus.get(activeMCUId) : undefined;
    const boardConfig = mcu ? boardConfigs[mcu.type] : undefined;

    // Control refs to prevent infinite loops
    const lastXmlStore = useRef<string>('');
    const lastCodeStore = useRef<string>('');
    const isUpdatingProgrammatically = useRef<boolean>(false);

    // Dynamic Pin Options Harvesting
    const memoizedPinOptions = React.useMemo(() => {
        const pins: [string, string][] = [];
        if (boardConfig) {
            boardConfig.digitalPins.forEach(pin => pins.push([`Pin ${pin}`, pin.toString()]));
            boardConfig.analogPins.forEach(pin => {
                if (!pins.find(p => p[1] === pin.toString())) {
                    pins.push([`Pin ${pin} (Analog)`, pin.toString()]);
                }
            });
        }
        if (mcu?.code) {
            const pinAssignRegex = /([a-zA-Z_]\w*)\s*=\s*(?:machine\.)?Pin\s*\(/g;
            const forInRegex = /for\s+([a-zA-Z_]\w*)\s+in/g;
            const pinMethodRegex = /([a-zA-Z_]\w*)\.(?:value|on|off|duty|read|read_u16)\(/g;

            const addMatches = (regex: RegExp) => {
                let match;
                const code = mcu.code || '';
                regex.lastIndex = 0;
                while ((match = regex.exec(code)) !== null) {
                    const varName = match[1];
                    const forbidden = ['machine', 'time', 'utime', 'Pin', 'True', 'False', 'None', 'self'];
                    if (varName && !forbidden.includes(varName) && !pins.find(p => p[1] === varName)) {
                        pins.push([`${varName} (Variable)`, varName]);
                    }
                }
            };
            addMatches(pinAssignRegex);
            addMatches(forInRegex);
            addMatches(pinMethodRegex);
        }

        if (pins.length === 0) return [["None", "0"]];
        const unique = Array.from(new Map(pins.map(item => [item[1], item])).values());
        return unique.sort((a, b) => {
            const aIsNum = /^\d+$/.test(a[1]);
            const bIsNum = /^\d+$/.test(b[1]);
            if (aIsNum && bIsNum) return parseInt(a[1]) - parseInt(b[1]);
            if (aIsNum) return -1;
            if (bIsNum) return 1;
            return a[0].localeCompare(b[0]);
        });
    }, [boardConfig, mcu?.code]);

    const getPinOptionsRef = useRef(() => memoizedPinOptions);
    getPinOptionsRef.current = () => memoizedPinOptions;

    // Helper: Safely load XML into workspace
    const loadXmlIntoWorkspace = useCallback((xmlText: string) => {
        if (!workspace.current || !window.Blockly) return;
        const Blockly = window.Blockly;
        console.log("[BlocklyEditor] Programmatically loading XML");
        try {
            isUpdatingProgrammatically.current = true;
            Blockly.Events.disable();
            workspace.current.clear();
            if (xmlText && xmlText !== EMPTY_XML) {
                const dom = Blockly.utils.xml.textToDom(xmlText);
                Blockly.Xml.domToWorkspace(dom, workspace.current);
            }
            lastXmlStore.current = xmlText;
        } catch (e) {
            console.error("[BlocklyEditor] Error loading XML:", e);
        } finally {
            Blockly.Events.enable();
            setTimeout(() => { isUpdatingProgrammatically.current = false; }, 50);
        }
    }, []);

    // 1. Core Lifecycle: Setup Workspace
    useEffect(() => {
        if (!blocklyDiv.current || !window.Blockly) return;
        const Blockly = window.Blockly;

        const dynamicPinDropdown = function (this: any) {
            const options = getPinOptionsRef.current();
            const val = this?.getValue?.();
            if (val && !options.find(o => o[1] === val)) {
                return [...options, [`${val} (Variable)`, val]];
            }
            return options;
        };

        // NF Blocks Definition
        Blockly.Blocks['nf_gpio_set'] = { init: function () { this.appendDummyInput().appendField("Set Pin").appendField(new Blockly.FieldDropdown(dynamicPinDropdown), "PIN").appendField("to").appendField(new Blockly.FieldDropdown([["HIGH", "HIGH"], ["LOW", "LOW"]]), "VALUE"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_servo'] = { init: function () { this.appendDummyInput().appendField("Servo Pin").appendField(new Blockly.FieldDropdown(dynamicPinDropdown), "PIN").appendField("Angle").appendField(new Blockly.FieldNumber(90, 0, 180), "ANGLE"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_tone'] = { init: function () { this.appendDummyInput().appendField("Play Tone Pin").appendField(new Blockly.FieldDropdown(dynamicPinDropdown), "PIN").appendField("Freq").appendField(new Blockly.FieldNumber(440, 0, 20000), "FREQ").appendField("Dur (ms)").appendField(new Blockly.FieldNumber(500, 0), "DUR"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_notone'] = { init: function () { this.appendDummyInput().appendField("Stop Tone Pin").appendField(new Blockly.FieldDropdown(dynamicPinDropdown), "PIN"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_analog_read'] = { init: function () { this.appendDummyInput().appendField("Read Analog").appendField(new Blockly.FieldDropdown(dynamicPinDropdown), "PIN"); this.setOutput(true, "Number"); this.setColour(230); } };
        Blockly.Blocks['nf_digital_read'] = { init: function () { this.appendDummyInput().appendField("Read Digital").appendField(new Blockly.FieldDropdown(dynamicPinDropdown), "PIN"); this.setOutput(true, "Number"); this.setColour(230); } };
        Blockly.Blocks['nf_motors_move'] = { init: function () { this.appendDummyInput().appendField("Motors Move Left").appendField(new Blockly.FieldNumber(0, -255, 255), "LEFT").appendField("Right").appendField(new Blockly.FieldNumber(0, -255, 255), "RIGHT"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_lcd_print'] = { init: function () { this.appendValueInput("TEXT").setCheck(null).appendField("LCD Print"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); } };
        Blockly.Blocks['nf_lcd_clear'] = { init: function () { this.appendDummyInput().appendField("LCD Clear"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); } };
        Blockly.Blocks['nf_lcd_cursor'] = { init: function () { this.appendDummyInput().appendField("LCD Set Cursor").appendField(new Blockly.FieldNumber(0, 0, 15), "COL").appendField(new Blockly.FieldNumber(0, 0, 1), "ROW"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); } };
        Blockly.Blocks['nf_oled_text'] = { init: function () { this.appendDummyInput().appendField("OLED Text").appendField(new Blockly.FieldTextInput("Hello"), "TEXT").appendField("X").appendField(new Blockly.FieldNumber(0, 0, 127), "X").appendField("Y").appendField(new Blockly.FieldNumber(0, 0, 63), "Y"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); } };
        Blockly.Blocks['nf_oled_show'] = { init: function () { this.appendDummyInput().appendField("OLED Show"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); } };
        Blockly.Blocks['nf_oled_clear'] = { init: function () { this.appendDummyInput().appendField("OLED Clear"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); } };
        Blockly.Blocks['nf_rgb_set'] = { init: function () { this.appendDummyInput().appendField("Set RGB Color").appendField("R").appendField(new Blockly.FieldNumber(255, 0, 255), "R").appendField("G").appendField(new Blockly.FieldNumber(255, 0, 255), "G").appendField("B").appendField(new Blockly.FieldNumber(255, 0, 255), "B"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_neopixel_set'] = { init: function () { this.appendDummyInput().appendField("Set Neopixel").appendField(new Blockly.FieldNumber(0, 0, 63), "IDX").appendField("R").appendField(new Blockly.FieldNumber(0, 0, 255), "R").appendField("G").appendField(new Blockly.FieldNumber(0, 0, 255), "G").appendField("B").appendField(new Blockly.FieldNumber(0, 0, 255), "B"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_neopixel_show'] = { init: function () { this.appendDummyInput().appendField("Show Neopixels"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_neopixel_clear'] = { init: function () { this.appendDummyInput().appendField("Clear Neopixels"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); } };
        Blockly.Blocks['nf_sevseg_print'] = { init: function () { this.appendValueInput("VAL").setCheck("Number").appendField("7-Seg Display"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); } };
        Blockly.Blocks['nf_keypad_read'] = { init: function () { this.appendDummyInput().appendField("Read Keypad"); this.setOutput(true, "Number"); this.setColour(230); } };
        Blockly.Blocks['nf_ldr_read'] = { init: function () { this.appendDummyInput().appendField("Read Light Level"); this.setOutput(true, "Number"); this.setColour(230); } };
        Blockly.Blocks['nf_delay'] = { init: function () { this.appendValueInput("MS").setCheck("Number").appendField("Wait (ms)"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(120); } };
        Blockly.Blocks['nf_loop'] = { init: function () { this.appendDummyInput().appendField("Loop"); this.appendStatementInput("DO").setCheck(null); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(120); this.setTooltip("Main execution loop"); } };

        if (!workspace.current) {
            workspace.current = Blockly.inject(blocklyDiv.current, {
                toolbox: `<xml>
                <category name="Logic" colour="210">
                    <block type="controls_if"></block>
                    <block type="logic_compare"></block>
                    <block type="logic_operation"></block>
                    <block type="logic_negate"></block>
                    <block type="logic_boolean"></block>
                </category>
                <category name="Loops" colour="120">
                    <block type="nf_loop"></block>
                    <block type="controls_whileUntil"></block>
                    <block type="controls_for"></block>
                    <block type="controls_repeat_ext"></block>
                    <block type="controls_forEach"></block>
                </category>
                <category name="Math" colour="230">
                    <block type="math_number"></block>
                    <block type="math_arithmetic"></block>
                </category>
                <category name="Text" colour="160">
                    <block type="text"></block>
                    <block type="text_print"></block>
                </category>
                <category name="Variables" colour="330" custom="VARIABLE"></category>
                <category name="IO" colour="160"><block type="nf_gpio_set"></block><block type="nf_digital_read"></block><block type="nf_servo"></block><block type="nf_motors_move"></block><block type="nf_tone"></block><block type="nf_notone"></block><block type="nf_rgb_set"></block><block type="nf_analog_read"></block><block type="nf_delay"></block></category>
                <category name="Displays" colour="180"><block type="nf_lcd_print"></block><block type="nf_lcd_clear"></block><block type="nf_lcd_cursor"></block><block type="nf_sevseg_print"></block></category>
                <category name="Sensors" colour="230"><block type="nf_ldr_read"></block><block type="nf_keypad_read"></block></category>
                </xml>`,
                scrollbars: true,
                theme: Blockly.Theme.getTheme?.('nf_dark') || Blockly.Theme.defineTheme('nf_dark', {
                    base: Blockly.Themes.Classic,
                    componentStyles: {
                        workspaceBackgroundColour: '#1e1e1e',
                        toolboxBackgroundColour: '#2d2d2d',
                        toolboxForegroundColour: '#e6e6e6',
                        flyoutBackgroundColour: '#252526',
                        flyoutForegroundColour: '#e6e6e6',
                        flyoutOpacity: 1,
                        scrollbarColour: '#797979',
                        insertionMarkerColour: '#fff',
                        insertionMarkerOpacity: 0.3,
                        scrollbarOpacity: 0.4,
                        cursorColour: '#d0d0d0'
                    }
                })
            });

            // Initial manual load
            const currentMcu = useSimulationStore.getState().mcus.get(activeMCUId || '');
            if (currentMcu?.blocklyXml) {
                loadXmlIntoWorkspace(currentMcu.blocklyXml);
            }

            workspace.current.addChangeListener(async (e: any) => {
                if (!isMounted.current || !workspace.current) return;
                if (isUpdatingProgrammatically.current) return;
                if (!Blockly.Events.recordUndo) return;
                if (e.type === Blockly.Events.UI || e.isUiEvent) return;

                const currentWorkspace = workspace.current;
                const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(currentWorkspace));
                if (xml === lastXmlStore.current) return;

                // Protect against wipeouts
                const blockCount = currentWorkspace.getAllBlocks().length;
                if (blockCount === 0 && lastXmlStore.current !== EMPTY_XML && lastXmlStore.current !== '') return;

                lastXmlStore.current = xml;
                const state = useSimulationStore.getState();
                const mcuId = state.activeMCUId;
                if (mcuId && state.mcus.get(mcuId)) {
                    updateMCUBlockly(mcuId, xml);
                    // ONLY update code if Blockly window is focused
                    if (useUIStore.getState().activeWindowId === 'blocklyEditor') {
                        try {
                            const activeMcu = state.mcus.get(mcuId)!;
                            const result = await blocklyToCode(xml, activeMcu.language);
                            if (!isMounted.current) return;
                            if (result.transpile.success) {
                                lastCodeStore.current = result.transpile.code;
                                updateMCUCode(mcuId, result.transpile.code);
                            }
                        } catch (err) { console.error("[BlocklyEditor] Sync error:", err); }
                    }
                }
            });

            const ro = new ResizeObserver(() => { if (isMounted.current && workspace.current) Blockly.svgResize(workspace.current); });
            ro.observe(blocklyDiv.current);
            return () => {
                isMounted.current = false;
                ro.disconnect();
                if (workspace.current) {
                    const ws = workspace.current;
                    workspace.current = null;
                    ws.dispose();
                }
            };
        }
    }, [activeMCUId, activeWindowId]);

    // 2. External XML changes
    useEffect(() => {
        if (!workspace.current || !mcu?.blocklyXml) return;
        if (mcu.blocklyXml !== lastXmlStore.current) loadXmlIntoWorkspace(mcu.blocklyXml);
    }, [mcu?.blocklyXml, loadXmlIntoWorkspace]);

    // 3. Roundtrip from code
    useEffect(() => {
        if (!workspace.current || !mcu?.code || !mcu?.language) return;
        if (mcu.code === lastCodeStore.current) return;
        if (mcu.code.trim().length > 20) {
            codeToBlocklyRoundtrip(mcu.code, mcu.language).then(result => {
                if (result.xml && result.xml !== lastXmlStore.current) {
                    lastCodeStore.current = mcu.code;
                    loadXmlIntoWorkspace(result.xml);
                    updateMCUBlockly(mcu.id, result.xml);
                }
            }).catch(e => console.error("[BlocklyEditor] Roundtrip failed:", e));
        }
    }, [mcu?.code, mcu?.id, mcu?.language, loadXmlIntoWorkspace, updateMCUBlockly]);

    if (!mcu) {
        return <div className="w-full h-full flex items-center justify-center text-[#9ca3af] bg-[#0a0e14]">Select an MCU to edit logic</div>;
    }

    return (
        <div className="w-full h-full flex flex-col bg-[#1e1e1e] relative">
            <div ref={blocklyDiv} className="absolute inset-0" />
        </div>
    );
};

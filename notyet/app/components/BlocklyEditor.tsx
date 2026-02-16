
import React, { useRef, useEffect } from 'react';

const PIN_OPTIONS: any[] = [
    ["D2 (LED)", "2"], ["D4 (Servo)", "4"], ["D5 (Tone)", "5"],
    ["D12 (Neo)", "12"], ["D13", "13"], ["D14 (DHT)", "14"], ["D15", "15"],
    ["D16", "16"], ["D17", "17"], ["D18", "18"], ["D19", "19"],
    ["D21", "21"], ["D22", "22"], ["D23", "23"], ["D25", "25"],
    ["D26 (Analog)", "26"], ["D27", "27"], ["D32", "32"], ["D33", "33"],
    ["D34 (Joy X)", "34"], ["D35 (Joy Y)", "35"], ["D36", "36"], ["D39", "39"],
    ["D0", "0"]
].sort((a,b) => parseInt(a[1]) - parseInt(b[1]));

export const BlocklyEditor = ({ onXmlChange, xmlInput }: { onXmlChange: (xml: string) => void, xmlInput?: string }) => {
    const blocklyDiv = useRef<HTMLDivElement>(null);
    const workspace = useRef<any>(null);

    // Initial Setup
    useEffect(() => {
        if (!blocklyDiv.current || !(window as any).Blockly) return;
        const Blockly = (window as any).Blockly;
        
        // Define blocks if not already defined (idempotent check)
        if(!Blockly.Blocks['nf_gpio_set']) {
            Blockly.Blocks['nf_gpio_set'] = { init: function() { this.appendDummyInput().appendField("Set Pin").appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN").appendField("to").appendField(new Blockly.FieldDropdown([["HIGH","HIGH"],["LOW","LOW"]]), "VALUE"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_servo'] = { init: function() { this.appendDummyInput().appendField("Servo Pin").appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN").appendField("Angle").appendField(new Blockly.FieldNumber(90, 0, 180), "ANGLE"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_tone'] = { init: function() { this.appendDummyInput().appendField("Play Tone Pin").appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN").appendField("Freq").appendField(new Blockly.FieldNumber(440, 0, 20000), "FREQ").appendField("Dur (ms)").appendField(new Blockly.FieldNumber(500, 0), "DUR"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_notone'] = { init: function() { this.appendDummyInput().appendField("Stop Tone Pin").appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_motors_move'] = { init: function() { this.appendDummyInput().appendField("Motors Move Left").appendField(new Blockly.FieldNumber(0, -255, 255), "LEFT").appendField("Right").appendField(new Blockly.FieldNumber(0, -255, 255), "RIGHT"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_lcd_print'] = { init: function() { this.appendValueInput("TEXT").setCheck(null).appendField("LCD Print"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); }};
            Blockly.Blocks['nf_lcd_clear'] = { init: function() { this.appendDummyInput().appendField("LCD Clear"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); }};
            Blockly.Blocks['nf_lcd_cursor'] = { init: function() { this.appendDummyInput().appendField("LCD Set Cursor").appendField(new Blockly.FieldNumber(0, 0, 15), "COL").appendField(new Blockly.FieldNumber(0, 0, 1), "ROW"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); }};
            Blockly.Blocks['nf_oled_text'] = { init: function() { this.appendDummyInput().appendField("OLED Text").appendField(new Blockly.FieldTextInput("Hello"), "TEXT").appendField("X").appendField(new Blockly.FieldNumber(0, 0, 127), "X").appendField("Y").appendField(new Blockly.FieldNumber(0, 0, 63), "Y"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); }};
            Blockly.Blocks['nf_oled_show'] = { init: function() { this.appendDummyInput().appendField("OLED Show"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); }};
            Blockly.Blocks['nf_oled_clear'] = { init: function() { this.appendDummyInput().appendField("OLED Clear"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); }};
            Blockly.Blocks['nf_rgb_set'] = { init: function() { this.appendDummyInput().appendField("Set RGB Color").appendField("R").appendField(new Blockly.FieldNumber(255,0,255), "R").appendField("G").appendField(new Blockly.FieldNumber(255,0,255), "G").appendField("B").appendField(new Blockly.FieldNumber(255,0,255), "B"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_neopixel_set'] = { init: function() { this.appendDummyInput().appendField("Set Neopixel").appendField(new Blockly.FieldNumber(0, 0, 63), "IDX").appendField("R").appendField(new Blockly.FieldNumber(0, 0, 255), "R").appendField("G").appendField(new Blockly.FieldNumber(0, 0, 255), "G").appendField("B").appendField(new Blockly.FieldNumber(0, 0, 255), "B"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_neopixel_show'] = { init: function() { this.appendDummyInput().appendField("Show Neopixels"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_neopixel_clear'] = { init: function() { this.appendDummyInput().appendField("Clear Neopixels"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(160); }};
            Blockly.Blocks['nf_sevseg_print'] = { init: function() { this.appendValueInput("VAL").setCheck("Number").appendField("7-Seg Display"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(180); }};
            Blockly.Blocks['nf_keypad_read'] = { init: function() { this.appendDummyInput().appendField("Read Keypad"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_ldr_read'] = { init: function() { this.appendDummyInput().appendField("Read Light Level"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_ir_read'] = { init: function() { this.appendDummyInput().appendField("Read IR Remote"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_joystick_read'] = { init: function() { this.appendDummyInput().appendField("Read Joystick").appendField(new Blockly.FieldDropdown([["X-Axis","X"],["Y-Axis","Y"]]), "AXIS"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_mpu_get'] = { init: function() { this.appendDummyInput().appendField("Get MPU6050").appendField(new Blockly.FieldDropdown([["AccelX","AccelX"],["AccelY","AccelY"],["AccelZ","AccelZ"]]), "AXIS"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_analog_read'] = { init: function() { this.appendDummyInput().appendField("Read Analog").appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_digital_read'] = { init: function() { this.appendDummyInput().appendField("Read Digital").appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_dht_temp'] = { init: function() { this.appendDummyInput().appendField("Read Temp (C)"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_dht_hum'] = { init: function() { this.appendDummyInput().appendField("Read Humidity (%)"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_ultrasonic_read'] = { init: function() { this.appendDummyInput().appendField("Read Distance (cm)"); this.setOutput(true, "Number"); this.setColour(230); }};
            Blockly.Blocks['nf_wifi_begin'] = { init: function() { this.appendDummyInput().appendField("WiFi Begin SSID").appendField(new Blockly.FieldTextInput("Wokwi-GUEST"), "SSID").appendField("PASS").appendField(new Blockly.FieldTextInput(""), "PASS"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(210); }};
            Blockly.Blocks['nf_wifi_status'] = { init: function() { this.appendDummyInput().appendField("WiFi Status"); this.setOutput(true, "Number"); this.setColour(210); }};
            Blockly.Blocks['nf_http_get'] = { init: function() { this.appendDummyInput().appendField("HTTP Get URL").appendField(new Blockly.FieldTextInput("http://api.time/current"), "URL"); this.setOutput(true, "String"); this.setColour(210); }};
            Blockly.Blocks['nf_spiffs_open'] = { init: function() { this.appendDummyInput().appendField("Write to File").appendField(new Blockly.FieldTextInput("/log.txt"), "PATH").appendField("Mode").appendField(new Blockly.FieldDropdown([["Write","w"],["Append","a"]]), "MODE").appendField("Content").appendField(new Blockly.FieldTextInput("data"), "CONTENT"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(290); }};
            Blockly.Blocks['nf_delay'] = { init: function() { this.appendValueInput("MS").setCheck("Number").appendField("Wait (ms)"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(120); }};
        }

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
                    <block type="controls_whileUntil"></block>
                    <block type="controls_for"></block>
                    <block type="controls_flow_statements"></block>
                </category>
                <category name="Math" colour="230">
                    <block type="math_number"></block>
                    <block type="math_arithmetic"></block>
                    <block type="math_single"></block>
                    <block type="math_modulo"></block>
                    <block type="math_random_int"></block>
                </category>
                <category name="Text" colour="160">
                    <block type="text"></block>
                    <block type="text_print"></block>
                    <block type="text_join"></block>
                </category>
                <category name="Variables" colour="330" custom="VARIABLE"></category>
                <category name="IO" colour="160"><block type="nf_gpio_set"></block><block type="nf_digital_read"></block><block type="nf_servo"></block><block type="nf_motors_move"></block><block type="nf_tone"></block><block type="nf_notone"></block><block type="nf_rgb_set"></block><block type="nf_analog_read"></block><block type="nf_delay"></block></category>
                <category name="LEDs & Color" colour="300"><block type="nf_neopixel_set"></block><block type="nf_neopixel_show"></block><block type="nf_neopixel_clear"></block><block type="nf_rgb_set"></block></category>
                <category name="Displays" colour="180"><block type="nf_lcd_print"></block><block type="nf_lcd_clear"></block><block type="nf_lcd_cursor"></block><block type="nf_oled_text"></block><block type="nf_oled_show"></block><block type="nf_oled_clear"></block><block type="nf_sevseg_print"></block></category>
                <category name="Sensors" colour="230"><block type="nf_dht_temp"></block><block type="nf_dht_hum"></block><block type="nf_ultrasonic_read"></block><block type="nf_ldr_read"></block><block type="nf_ir_read"></block><block type="nf_keypad_read"></block><block type="nf_joystick_read"></block><block type="nf_mpu_get"></block></category>
                <category name="Network" colour="210"><block type="nf_wifi_begin"></block><block type="nf_wifi_status"></block><block type="nf_http_get"></block></category>
                <category name="Files" colour="290"><block type="nf_spiffs_open"></block></category>
                </xml>`,
                scrollbars: true
            });
            
            // Enable variable management
            workspace.current.createVariable('i');
            workspace.current.createVariable('x');

            workspace.current.addChangeListener(() => {
                const Blockly = (window as any).Blockly;
                if (!Blockly.Events.getGroup()) {
                    onXmlChange(Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace.current)));
                }
            });
        }
    }, []);

    // Handle incoming XML (Code -> Blocks sync)
    useEffect(() => {
        if (xmlInput && workspace.current && (window as any).Blockly) {
            const Blockly = (window as any).Blockly;
            workspace.current.clear();
            try {
                const dom = Blockly.Xml.textToDom(xmlInput);
                Blockly.Xml.domToWorkspace(dom, workspace.current);
            } catch(e) {
                console.error("Failed to parse blockly xml", e);
            }
        }
    }, [xmlInput]);

    return <div ref={blocklyDiv} className="w-full h-full" />;
};

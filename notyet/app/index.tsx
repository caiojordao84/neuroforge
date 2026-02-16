
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { LucideCpu, LucideCode, LucideBlocks, LucidePlay, LucidePause, LucideAlertTriangle, LucideZap, LucideTerminal, LucideFileText, LucideSearch, LucideCheckCircle, LucideAlertOctagon, LucideInfo, LucideSend, LucideSparkles, LucideMap, LucideNetwork, LucideRefreshCw, LucideLanguages, LucideFlaskConical, LucideArrowRightLeft, LucideSettings, LucideWorkflow } from 'lucide-react';

import { CppParser } from './plugins/cpp/CppParser';
import { RustParser } from './plugins/rust/RustParser';
import { PythonParser } from './plugins/python/PythonParser';
import { BlocklyParser } from './system/blockly/BlocklyParser';
import { CodeToBlockly } from './system/blockly/CodeToBlockly';
import { FlowToAst } from './system/flow/FlowToAst';
import { PythonGenerator, PythonFlavor } from './plugins/python/PythonGenerator';
import { CGenerator } from './plugins/c/CGenerator';
import { RustGenerator } from './plugins/rust/RustGenerator';
import { PatternDetector } from './plugins/analysis/PatternDetector';
import { Optimizer } from './plugins/optimizer/Optimizer';
import { SimulatorInterpreter } from './system/simulator/SimulatorInterpreter';
import { ProgramNode, PatternMatch, SourceMapEntry, AnalysisIssue } from './system/types';

import { SimulatorBoard } from './components/SimulatorBoard';
import { BlocklyEditor } from './components/BlocklyEditor';
import { CodeEditor } from './components/CodeEditor';
import { AstViewer } from './components/AstViewer';
import { TestRunner } from './components/TestRunner';
import { FlowchartWrapper } from './components/FlowchartEditor';

const DEFAULT_C_CODE = `// Data Logger & Logic Analysis
int counter = 0;
int state = 0;

void setup() {
  oled.clear();
  oled.text("Analysis Demo", 10, 10, 1);
  oled.show();
}

void loop() {
  // Pattern 1: Software PWM (Detected by Analysis)
  // Optimizer will replace this with Hardware PWM!
  digitalWrite(2, HIGH);
  delay(10);
  digitalWrite(2, LOW);
  delay(10);
  
  // Pattern 2: State Machine (Detected by Analysis)
  if (state == 0) {
      state = 1;
  } else if (state == 1) {
      state = 0;
  }
}`;

const DEFAULT_RUST_CODE = `// Rust Embedded Logic
fn main() {
    setup();
    loop {
        run_loop();
    }
}

fn setup() {
    println!("Starting Rust Logic");
}

fn run_loop() {
    let mut x = 10;
    // Toggling Pin 2
    gpio_set(2, 1);
    delay(100);
    gpio_set(2, 0);
    delay(100);
}`;

const DEFAULT_PYTHON_CODE = `# MicroPython Logic
import time

print("Starting MicroPython")

# Setup (Top level)
state = 0

while True:
    # Loop
    # Analysis detects this PWM on p2!
    p2.value(1)
    time.sleep_ms(1000)
    p2.value(0)
    time.sleep_ms(1000)
`;

export default function App() {
  const [mode, setMode] = useState<'CODE' | 'BLOCKS' | 'FLOW'>('CODE');
  const [lang, setLang] = useState<'C' | 'RUST' | 'PYTHON'>('C');
  const [cCode, setCCode] = useState(() => localStorage.getItem('nf_c_code') || DEFAULT_C_CODE);
  const [rustCode, setRustCode] = useState(() => localStorage.getItem('nf_rust_code') || DEFAULT_RUST_CODE);
  const [pyCode, setPyCode] = useState(() => localStorage.getItem('nf_py_code') || DEFAULT_PYTHON_CODE);
  
  const [blocklyXml, setBlocklyXml] = useState('');
  const [incomingXml, setIncomingXml] = useState<string>(''); // For Code->Block Sync
  
  const [flowNodes, setFlowNodes] = useState<any[]>([]);
  const [flowEdges, setFlowEdges] = useState<any[]>([]);

  const [pythonCode, setPythonCode] = useState('');
  const [transpiledCode, setTranspiledCode] = useState('');
  const [transpileTarget, setTranspileTarget] = useState<'PYTHON' | 'C' | 'RUST'>('PYTHON');
  const [pythonFlavor, setPythonFlavor] = useState<PythonFlavor>('MICROPYTHON');
  
  const [sourceMap, setSourceMap] = useState<SourceMapEntry[]>([]);
  const [ast, setAst] = useState<ProgramNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<PatternMatch[]>([]);
  const [optimize, setOptimize] = useState(false);
  const [showTests, setShowTests] = useState(false);
  
  const [simRunning, setSimRunning] = useState(false);
  const [simPins, setSimPins] = useState<any>({});
  const [simTones, setSimTones] = useState<any>({});
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simLcd, setSimLcd] = useState<any>({lines: ["", ""], cx:0, cy:0});
  const [simDht, setSimDht] = useState<any>({temp: 24, hum: 50});
  const [simUltrasonic, setSimUltrasonic] = useState(50);
  const [simLdr, setSimLdr] = useState(500);
  const [simIr, setSimIr] = useState(0);
  const [simRgb, setSimRgb] = useState<any>({r:0, g:0, b:0});
  const [simSevSeg, setSimSevSeg] = useState("    ");
  const [simNeopixels, setSimNeopixels] = useState<any[]>(Array(8).fill({r:0,g:0,b:0}));
  const [simMotors, setSimMotors] = useState<any>({left:0, right:0});
  const [simMpu, setSimMpu] = useState<any>({ax:0,ay:0,az:0,gx:0,gy:0,gz:0});
  const [simOled, setSimOled] = useState<any>(null); // Passed as pending buffer/command object
  const [simWifi, setSimWifi] = useState<any>({status:0, ssid:'', ip:'0.0.0.0'});
  const [simFiles, setSimFiles] = useState<any>({});
  const [serialInput, setSerialInput] = useState('');
  const [activeTab, setActiveTab] = useState<'SERIAL' | 'TRANSPILE' | 'FILES' | 'ANALYSIS' | 'AST'>('SERIAL');
  
  const interpreterRef = useRef<SimulatorInterpreter | null>(null);
  const intervalRef = useRef<any>(null);
  
  // Parsers
  const cppParserRef = useRef<CppParser>(new CppParser());
  const rustParserRef = useRef<RustParser>(new RustParser());
  const pythonParserRef = useRef<PythonParser>(new PythonParser());

  // Initialize Parsers
  useEffect(() => {
    Promise.all([
        cppParserRef.current.init(),
        rustParserRef.current.init(),
        pythonParserRef.current.init()
    ]).then(() => {
        console.log("All Parsers Initialized");
        triggerParse();
    });
  }, []);

  // Persist code changes
  useEffect(() => localStorage.setItem('nf_c_code', cCode), [cCode]);
  useEffect(() => localStorage.setItem('nf_rust_code', rustCode), [rustCode]);
  useEffect(() => localStorage.setItem('nf_py_code', pyCode), [pyCode]);

  // Handle Mode Switching: Sync Code to Blocks
  useEffect(() => {
      if (mode === 'BLOCKS' && ast) {
          try {
             const converter = new CodeToBlockly();
             const xml = converter.generate(ast);
             setIncomingXml(xml);
             setBlocklyXml(xml);
          } catch(e) {
              console.error("Failed to convert AST to Blocks", e);
          }
      }
      // Note: Syncing Code -> Flow is complex (Control Flow Analysis), omitting for MVP
      // We rely on Flow -> Code direction primarily for the Flow mode.
  }, [mode]);

  // Main Compile/Parse Loop
  useEffect(() => {
     triggerParse();
  }, [cCode, rustCode, pyCode, blocklyXml, flowNodes, flowEdges, mode, optimize, lang, transpileTarget, pythonFlavor]);

  const triggerParse = () => {
      try {
        setError(null);
        let newAst;
        let parseErrors: AnalysisIssue[] = [];
        
        if (mode === 'BLOCKS') {
            newAst = new BlocklyParser().parse(blocklyXml || '<xml></xml>');
        } else if (mode === 'FLOW') {
            newAst = new FlowToAst().generate(flowNodes, flowEdges);
        } else if (lang === 'RUST') {
            const res = rustParserRef.current.parse(rustCode);
            newAst = res.ast;
            parseErrors = res.errors;
        } else if (lang === 'PYTHON') {
            const res = pythonParserRef.current.parse(pyCode);
            newAst = res.ast;
            parseErrors = res.errors;
        } else {
            // C/C++
            const res = cppParserRef.current.parse(cCode);
            newAst = res.ast;
            parseErrors = res.errors;
        }

        if(parseErrors.length > 0) {
             setError(parseErrors[0].message);
        }
        
        // Detect patterns on RAW AST
        const detectedPatterns = new PatternDetector().detect(newAst);
        setPatterns(detectedPatterns);

        // Optimize if enabled
        if (optimize) {
            newAst = new Optimizer().optimize(newAst);
        }

        setAst(newAst);
        
        // Generate Interpreter Code (Always MicroPython for Sim)
        const simGen = new PythonGenerator().generate(newAst, 'MICROPYTHON');
        setPythonCode(simGen.code);
        
        // Generate Transpiled Code for Display and SourceMap
        let transpiled = "";
        let newMap: SourceMapEntry[] = [];
        
        if (transpileTarget === 'PYTHON') {
             const res = new PythonGenerator().generate(newAst, pythonFlavor);
             transpiled = res.code;
             newMap = res.map;
        }
        else if (transpileTarget === 'C') {
             const res = new CGenerator().generate(newAst);
             transpiled = res.code;
             newMap = res.map;
        }
        else if (transpileTarget === 'RUST') {
             const res = new RustGenerator().generate(newAst);
             transpiled = res.code;
             newMap = res.map;
        }
        
        setTranspiledCode(transpiled);
        setSourceMap(newMap);

        interpreterRef.current = new SimulatorInterpreter(newAst, (v, p, l, t, lcd, dht, dist, ldr, ir, rgb, sevseg, np, motors, mpu, oled, wifi, files) => {
            setSimPins(p); setSimLogs(l); setSimTones(t); setSimLcd(lcd); setSimDht(dht); setSimUltrasonic(dist); setSimLdr(ldr); setSimIr(ir); setSimRgb(rgb); setSimSevSeg(sevseg); setSimNeopixels(np); setSimMotors(motors); setSimMpu(mpu); setSimOled(oled); setSimWifi(wifi); setSimFiles(files);
        });
        interpreterRef.current.setDht(simDht.temp, simDht.hum);
        interpreterRef.current.setUltrasonic(simUltrasonic);
        interpreterRef.current.setLdr(simLdr);
        interpreterRef.current.setMpu(simMpu);
    } catch(e: any) { 
        console.error(e);
        setError(e.message || "Unknown error");
    }
  };

  const toggleSim = () => {
      if (simRunning) { clearInterval(intervalRef.current); setSimRunning(false); }
      else {
          if (interpreterRef.current) {
              interpreterRef.current.reset();
              interpreterRef.current.setDht(simDht.temp, simDht.hum);
              interpreterRef.current.setUltrasonic(simUltrasonic);
              interpreterRef.current.setLdr(simLdr);
              interpreterRef.current.setMpu(simMpu);
          }
          intervalRef.current = setInterval(() => interpreterRef.current?.step(), 50);
          setSimRunning(true);
      }
  };

  const toggleLang = () => {
      if(lang === 'C') setLang('RUST');
      else if(lang === 'RUST') setLang('PYTHON');
      else setLang('C');
  };

  const getCode = () => {
      if(lang === 'C') return cCode;
      if(lang === 'RUST') return rustCode;
      return pyCode;
  };

  const setCode = (val: string) => {
      if(lang === 'C') setCCode(val);
      else if(lang === 'RUST') setRustCode(val);
      else setPyCode(val);
  };

  const sendSerial = (e: React.FormEvent) => {
      e.preventDefault();
      if(!simRunning || !interpreterRef.current) return;
      interpreterRef.current.pushSerial(serialInput);
      setSerialInput('');
  };

  // Combine patterns and errors for Editor display
  const editorIssues = [
      ...(patterns.map(p => ({ line: p.line || 0, message: p.description, severity: p.severity }))),
      // We could add parser errors here if we extracted line numbers from them consistently
      ...(error ? [{ line: 0, message: error, severity: 'CRITICAL' as const }] : []) 
  ].filter(i => i.line > 0);

  return (
    <div className="flex flex-col h-full font-sans text-slate-900 bg-slate-50 relative">
        {showTests && <TestRunner onClose={() => setShowTests(false)} />}
        
        <header className="bg-slate-900 text-white p-3 flex items-center justify-between shadow-lg z-10">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-1.5 rounded-lg"><LucideCpu size={20} className="text-white" /></div>
                <h1 className="text-lg font-bold">NeuroForge <span className="text-blue-400 text-xs font-normal">IDE</span></h1>
            </div>
            <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
                <button onClick={() => setMode('CODE')} className={`px-3 py-1 rounded text-xs flex items-center gap-2 ${mode==='CODE'?'bg-blue-600 text-white':'text-slate-400'}`}><LucideCode size={14}/> Code</button>
                <button onClick={() => setMode('BLOCKS')} className={`px-3 py-1 rounded text-xs flex items-center gap-2 ${mode==='BLOCKS'?'bg-blue-600 text-white':'text-slate-400'}`}><LucideBlocks size={14}/> Blocks</button>
                <button onClick={() => setMode('FLOW')} className={`px-3 py-1 rounded text-xs flex items-center gap-2 ${mode==='FLOW'?'bg-blue-600 text-white':'text-slate-400'}`}><LucideWorkflow size={14}/> Flow</button>
            </div>
            <div className="flex gap-2 items-center">
                 {mode === 'CODE' && (
                     <>
                        <button onClick={toggleLang} className="flex items-center gap-2 px-3 py-1.5 rounded font-medium text-xs border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400">
                             <LucideLanguages size={14} /> {lang === 'C' ? 'C++' : lang === 'RUST' ? 'Rust' : 'MicroPython'}
                        </button>
                     </>
                 )}
                 <button onClick={() => setShowTests(true)} className="flex items-center gap-2 px-3 py-1.5 rounded font-medium text-xs border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400" title="Run Integration Tests">
                    <LucideFlaskConical size={14} /> Tests
                 </button>
                 <button onClick={() => setOptimize(!optimize)} className={`flex items-center gap-2 px-3 py-1.5 rounded font-medium text-xs border ${optimize ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-600 text-slate-400'}`}>
                    <LucideSparkles size={14} /> Optimizer: {optimize ? 'ON' : 'OFF'}
                </button>
                <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
                <button onClick={toggleSim} className={`flex items-center gap-2 px-3 py-1.5 rounded font-medium text-xs ${simRunning ? 'bg-red-500' : 'bg-green-500'} text-white`}>
                    {simRunning ? <LucidePause size={14} /> : <LucidePlay size={14} />} {simRunning ? 'Stop' : 'Run'}
                </button>
            </div>
        </header>
        
        {error && (
            <div className="bg-red-100 border-b border-red-200 text-red-700 px-4 py-2 text-xs flex items-center gap-2">
                <LucideAlertTriangle size={14}/> {error}
            </div>
        )}
        
        <div className="flex-1 flex overflow-hidden">
            <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
                {mode === 'CODE' ? (
                    <CodeEditor 
                        code={getCode()} 
                        onChange={setCode} 
                        issues={editorIssues}
                    />
                ) : mode === 'BLOCKS' ? (
                    <BlocklyEditor onXmlChange={setBlocklyXml} xmlInput={incomingXml} />
                ) : (
                    <FlowchartWrapper onGraphChange={(n: any[], e: any[]) => { setFlowNodes(n); setFlowEdges(e); }} />
                )}
            </div>
            <div className="w-1/2 flex flex-col bg-slate-50">
                <div className="h-3/5 border-b border-slate-300 relative">
                    <SimulatorBoard 
                        pins={simPins} logs={simLogs} tones={simTones} lcd={simLcd} dht={simDht} ultrasonic={simUltrasonic} ldr={simLdr} ir={simIr} rgb={simRgb} sevseg={simSevSeg} neopixels={simNeopixels} motors={simMotors} mpu={simMpu} oled={simOled} wifi={simWifi} files={simFiles}
                        onPinChange={(p: number, v: number) => interpreterRef.current?.setPinInput(p, v)} 
                        onDhtChange={(t: number, h: number) => { setSimDht({temp: t, hum: h}); interpreterRef.current?.setDht(t, h); }}
                        onUltrasonicChange={(d: number) => { setSimUltrasonic(d); interpreterRef.current?.setUltrasonic(d); }}
                        onLdrChange={(l: number) => { setSimLdr(l); interpreterRef.current?.setLdr(l); }}
                        onIrPress={(c: number) => interpreterRef.current?.setIr(c)}
                        onKeyPress={(k: string) => interpreterRef.current?.pressKey(k)}
                        onMpuChange={(m: any) => { setSimMpu(m); interpreterRef.current?.setMpu(m); }}
                    />
                </div>
                <div className="h-2/5 bg-slate-900 text-slate-300 flex flex-col">
                     <div className="p-2 bg-slate-800 text-xs font-bold flex justify-between items-center border-b border-slate-700">
                         <div className="flex gap-2 items-center">
                             <LucideArrowRightLeft size={14} className="text-yellow-400"/>
                             <span className="text-slate-400">Target:</span>
                             <div className="flex gap-1">
                                 <button onClick={() => setTranspileTarget('PYTHON')} className={`px-2 py-0.5 rounded text-[10px] ${transpileTarget==='PYTHON'?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300'}`}>Python</button>
                                 <button onClick={() => setTranspileTarget('C')} className={`px-2 py-0.5 rounded text-[10px] ${transpileTarget==='C'?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300'}`}>C++</button>
                                 <button onClick={() => setTranspileTarget('RUST')} className={`px-2 py-0.5 rounded text-[10px] ${transpileTarget==='RUST'?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300'}`}>Rust</button>
                             </div>
                             {transpileTarget === 'PYTHON' && (
                                 <div className="flex items-center gap-1 ml-2 bg-slate-700 rounded p-0.5">
                                    <button onClick={() => setPythonFlavor('MICROPYTHON')} className={`px-1.5 py-0.5 rounded text-[9px] ${pythonFlavor==='MICROPYTHON'?'bg-slate-500 text-white':'text-slate-400'}`}>Micro</button>
                                    <button onClick={() => setPythonFlavor('CIRCUITPYTHON')} className={`px-1.5 py-0.5 rounded text-[9px] ${pythonFlavor==='CIRCUITPYTHON'?'bg-slate-500 text-white':'text-slate-400'}`}>Circuit</button>
                                 </div>
                             )}
                             {optimize && <span className="text-[10px] bg-purple-600 text-white px-1.5 rounded ml-2">Optimized</span>}
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => setActiveTab('SERIAL')} className={`flex items-center gap-1 px-2 py-1 rounded ${activeTab==='SERIAL' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                 <LucideTerminal size={12}/> Serial
                             </button>
                             <button onClick={() => setActiveTab('TRANSPILE')} className={`flex items-center gap-1 px-2 py-1 rounded ${activeTab==='TRANSPILE' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                 <LucideCode size={12}/> Code
                             </button>
                             <button onClick={() => setActiveTab('FILES')} className={`flex items-center gap-1 px-2 py-1 rounded ${activeTab==='FILES' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                 <LucideFileText size={12}/> Files
                             </button>
                             <button onClick={() => setActiveTab('ANALYSIS')} className={`flex items-center gap-1 px-2 py-1 rounded ${activeTab==='ANALYSIS' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                 <LucideSearch size={12}/> Analysis
                                 {patterns.length > 0 && <span className="bg-red-500 text-white text-[9px] px-1 rounded-full">{patterns.length}</span>}
                             </button>
                             <button onClick={() => setActiveTab('AST')} className={`flex items-center gap-1 px-2 py-1 rounded ${activeTab==='AST' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                 <LucideNetwork size={12}/> AST
                             </button>
                         </div>
                     </div>
                     <div className="flex-1 flex overflow-hidden">
                        <div className="w-1/2 flex flex-col border-r border-slate-700">
                             <pre className="flex-1 p-4 font-mono text-xs overflow-auto text-green-300">{transpiledCode}</pre>
                             <div className="bg-slate-800 text-[10px] p-1 text-slate-500 flex items-center gap-2 border-t border-slate-700">
                                 <LucideMap size={10} className={sourceMap.length > 0 ? "text-green-400" : "text-slate-600"}/> 
                                 Source Map {sourceMap.length > 0 ? 'Active' : 'Inactive'} ({sourceMap.length} nodes mapped)
                             </div>
                        </div>
                        <div className="w-1/2 flex flex-col bg-slate-800">
                            {activeTab === 'SERIAL' && (
                                <>
                                 <div className="flex-1 p-2 font-mono text-xs overflow-y-auto space-y-1">
                                    {simLogs.length === 0 && <span className="text-slate-600 italic">No serial output...</span>}
                                    {simLogs.map((l: string, i: number) => <div key={i}>{l}</div>)}
                                 </div>
                                 <form onSubmit={sendSerial} className="p-2 border-t border-slate-700 flex gap-2">
                                     <input type="text" value={serialInput} onChange={e=>setSerialInput(e.target.value)} placeholder="Send to Serial..." className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500" />
                                     <button type="submit" className="bg-blue-600 text-white rounded px-2 py-1"><LucideSend size={12}/></button>
                                 </form>
                                </>
                            )}
                            {activeTab === 'TRANSPILE' && (
                                <div className="flex-1 p-4 font-mono text-xs overflow-auto text-blue-300">
                                    {transpiledCode}
                                </div>
                            )}
                            {activeTab === 'FILES' && (
                                <div className="flex-1 p-2 overflow-y-auto">
                                    {Object.keys(simFiles).length === 0 && <span className="text-xs text-slate-600 italic">No files in SPIFFS...</span>}
                                    <div className="space-y-2">
                                        {Object.entries(simFiles).map(([name, content]: any) => (
                                            <div key={name} className="bg-slate-800 rounded border border-slate-700 p-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                                        <LucideFileText size={12} className="text-blue-400"/> {name}
                                                    </div>
                                                    <span className="text-[10px] text-slate-500">{content.length} bytes</span>
                                                </div>
                                                <pre className="text-[10px] text-slate-400 font-mono bg-slate-900/50 p-1 rounded overflow-x-auto whitespace-pre-wrap">{content}</pre>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'ANALYSIS' && (
                                <div className="flex-1 p-2 overflow-y-auto space-y-2">
                                    {patterns.length === 0 && <div className="flex flex-col items-center justify-center h-full text-slate-500 italic gap-2"><LucideCheckCircle size={24}/> No issues detected</div>}
                                    {patterns.map((p, i) => (
                                        <div key={i} className={`p-2 rounded border-l-4 ${p.severity === 'CRITICAL' ? 'bg-red-900/20 border-red-500' : p.severity === 'WARNING' ? 'bg-yellow-900/20 border-yellow-500' : 'bg-blue-900/20 border-blue-500'} cursor-pointer hover:bg-opacity-30`}>
                                            <div className="flex items-start gap-2">
                                                {p.severity === 'CRITICAL' ? <LucideAlertOctagon size={16} className="text-red-500 mt-0.5"/> : 
                                                 p.severity === 'WARNING' ? <LucideAlertTriangle size={16} className="text-yellow-500 mt-0.5"/> : 
                                                 <LucideInfo size={16} className="text-blue-500 mt-0.5"/>}
                                                <div>
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className={`text-xs font-bold ${p.severity === 'CRITICAL' ? 'text-red-400' : p.severity === 'WARNING' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                                            {p.type.replace('_', ' ')}
                                                        </span>
                                                        {p.line && <span className="text-[10px] text-slate-500 bg-slate-800 px-1 rounded">L{p.line}</span>}
                                                    </div>
                                                    <div className="text-[11px] text-slate-300 mt-1">{p.description}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {optimize && (
                                         <div className="p-2 rounded border-l-4 bg-purple-900/20 border-purple-500">
                                            <div className="flex items-start gap-2">
                                                <LucideSparkles size={16} className="text-purple-500 mt-0.5"/>
                                                <div>
                                                    <div className="text-xs font-bold text-purple-400">Optimization Active</div>
                                                    <div className="text-[11px] text-slate-300 mt-1">Bit-bang PWM replaced with Hardware PWM. Delays merged. GPIO batched.</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeTab === 'AST' && <AstViewer ast={ast} />}
                        </div>
                     </div>
                </div>
            </div>
        </div>
    </div>
  );
}


import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Connection,
    Edge,
    Node,
    MarkerType,
    ReactFlowProvider,
    Handle,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { LucidePlus, LucideTrash2, LucidePlay, LucideRepeat, LucidePower, LucideCheckSquare, LucideAlertTriangle, LucideAlertOctagon, LucideCheckCircle, LucideInfo, LucideGitCommit, LucideCircle, LucideTimer, LucideHash, LucideTrendingUp, LucideTrendingDown, LucideToggleLeft, LucideScale, LucideBoxSelect, LucideArrowRightCircle, LucideCalculator, LucideSettings, LucideX } from 'lucide-react';
import { FlowValidator, FlowIssue } from '../system/flow/FlowValidator';

// --- Custom Node Components with Validation Highlighting ---

const useValidationStyle = (id: string, issues: FlowIssue[]) => {
    const issue = issues.find(i => i.nodeId === id);
    if (!issue) return "";
    if (issue.severity === 'CRITICAL') return "ring-4 ring-red-500 ring-offset-2";
    if (issue.severity === 'WARNING') return "ring-4 ring-yellow-400 ring-offset-2";
    if (issue.severity === 'INFO') return "ring-2 ring-blue-400 ring-offset-2";
    return "";
};

const StartNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    return (
        <div className={`px-4 py-2 rounded-full bg-green-100 border-2 border-green-500 shadow-sm flex items-center justify-center min-w-[100px] ${style}`}>
            <LucidePower size={14} className="mr-2 text-green-700" />
            <div className="text-xs font-bold text-green-900">{data.label}</div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-500" />
        </div>
    );
};

const EndNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    return (
        <div className={`px-4 py-2 rounded-full bg-red-100 border-2 border-red-500 shadow-sm flex items-center justify-center min-w-[100px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-red-500" />
            <div className="text-xs font-bold text-red-900">{data.label}</div>
            <LucidePower size={14} className="ml-2 text-red-700" />
        </div>
    );
};

const LoopNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    return (
        <div className={`px-4 py-2 rounded-md bg-orange-100 border-2 border-orange-500 shadow-sm flex items-center justify-center min-w-[120px] relative ${style}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-orange-500" />
            <div className="absolute -top-3 left-2 bg-orange-500 text-white text-[8px] px-1 rounded">LOOP</div>
            <LucideRepeat size={14} className="mr-2 text-orange-700" />
            <div className="text-xs font-bold text-orange-900">{data.label}</div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-orange-500" />
            <Handle type="target" position={Position.Right} id="loop-back" className="w-2 h-4 bg-orange-400 rounded-sm" style={{ top: '50%' }} />
        </div>
    );
};

const DecisionNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    return (
        <div className={`w-20 h-20 bg-white border-2 border-purple-500 rotate-45 flex items-center justify-center shadow-sm ${style}`}>
            <div className="-rotate-45 text-center text-[10px] font-medium leading-tight p-1">{data.label}</div>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-500 -mt-3.5 -ml-3.5" />
            <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-green-500 -mb-3.5 -mr-3.5" />
            <Handle type="source" position={Position.Right} id="false" className="w-3 h-3 bg-red-500 -mr-3.5 -mt-3.5" />

            <div className="absolute -bottom-6 -right-2 -rotate-45 text-[8px] font-bold text-green-600 bg-white px-1 border border-green-200 rounded">True</div>
            <div className="absolute top-2 -right-8 -rotate-45 text-[8px] font-bold text-red-600 bg-white px-1 border border-red-200 rounded">False</div>
        </div>
    );
};

const ProcessNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    return (
        <div className={`px-4 py-2 bg-white border border-slate-300 shadow-sm rounded flex items-center min-w-[150px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className="flex-1">
                <div className="text-[10px] text-slate-400 mb-0.5 font-mono truncate max-w-[120px]">{data.code || 'Statement'}</div>
                <div className="text-xs font-medium text-slate-800">{data.label}</div>
                {data.annotation && <div className="text-[9px] text-blue-500 mt-1 italic">// {data.annotation}</div>}
            </div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-400" />
        </div>
    );
};

const StateNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    return (
        <div className={`w-[140px] bg-white border-2 border-indigo-500 rounded-lg shadow-sm overflow-hidden ${style}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-500" />
            <div className="bg-indigo-500 text-white px-2 py-1 text-xs font-bold flex items-center justify-between">
                <span>{data.label}</span>
                <LucideBoxSelect size={12} className="text-indigo-200" />
            </div>
            <div className="p-2 space-y-1">
                {data.entry && <div className="text-[9px] text-indigo-700 bg-indigo-50 px-1 rounded truncate border-l-2 border-indigo-300">Entry: {data.entry}</div>}
                <div className="text-[10px] text-slate-800 font-medium px-1 truncate">{data.code || '// Do...'}</div>
                {data.exit && <div className="text-[9px] text-orange-700 bg-orange-50 px-1 rounded truncate border-l-2 border-orange-300">Exit: {data.exit}</div>}
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
        </div>
    );
};

// --- Industrial / Ladder Nodes ---

const LadderContactNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    const isNC = data.subType === 'NC';
    return (
        <div className={`px-2 py-1 bg-white border-2 ${isNC ? 'border-red-400' : 'border-blue-400'} shadow-sm rounded flex flex-col items-center min-w-[80px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className="flex items-center gap-1 my-1">
                <span className="font-mono text-xs font-bold text-slate-400">|</span>
                {isNC ? <span className="text-xs font-bold text-red-500">/</span> : <span className="w-2"></span>}
                <span className="font-mono text-xs font-bold text-slate-400">|</span>
            </div>
            <div className="text-[10px] font-bold text-slate-700">{data.label}</div>
            <div className="text-[8px] text-slate-400">{data.pinLabel ? data.pinLabel : data.pin ? `Pin ${data.pin}` : 'VAR'}</div>
            <Handle type="source" position={Position.Bottom} id="true" className="w-2 h-2 bg-green-500" />
            <Handle type="source" position={Position.Right} id="false" className="w-2 h-2 bg-red-500" />
        </div>
    );
};

const LadderCoilNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    return (
        <div className={`px-2 py-1 bg-white border-2 border-slate-600 shadow-sm rounded-full flex flex-col items-center min-w-[60px] aspect-square justify-center ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className="text-xs font-bold text-slate-800">( {data.label} )</div>
            <div className="text-[8px] text-slate-400">{data.pinLabel ? data.pinLabel : data.pin ? `Pin ${data.pin}` : 'VAR'}</div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-400" />
        </div>
    );
};

const LadderTimerNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    const type = data.subType || 'TON'; // TON, TOF, TP
    const color = type === 'TON' ? 'yellow' : type === 'TOF' ? 'orange' : 'emerald';

    return (
        <div className={`px-2 py-2 bg-${color}-50 border border-${color}-600 shadow-sm rounded flex flex-col items-center min-w-[100px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className={`flex items-center gap-2 border-b border-${color}-200 w-full justify-center pb-1 mb-1`}>
                <LucideTimer size={12} className={`text-${color}-700`} />
                <span className={`text-xs font-bold text-${color}-900`}>{type}</span>
            </div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>PT:</span> <span>{data.preset}ms</span></div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>IN:</span> <span>{data.variable}</span></div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>TAG:</span> <span>{data.id || 'T1'}</span></div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-green-500" />
        </div>
    );
};

const LadderCounterNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    const type = data.subType || 'CTU'; // CTU, CTD
    const color = type === 'CTU' ? 'blue' : 'purple';

    return (
        <div className={`px-2 py-2 bg-${color}-50 border border-${color}-600 shadow-sm rounded flex flex-col items-center min-w-[100px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className={`flex items-center gap-2 border-b border-${color}-200 w-full justify-center pb-1 mb-1`}>
                <LucideHash size={12} className={`text-${color}-700`} />
                <span className={`text-xs font-bold text-${color}-900`}>{type}</span>
            </div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>PV:</span> <span>{data.preset}</span></div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>IN:</span> <span>{data.variable}</span></div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>TAG:</span> <span>{data.id || 'C1'}</span></div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-green-500" />
        </div>
    );
};

const LadderLatchNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    const type = data.subType || 'SR'; // SR, RS

    return (
        <div className={`px-2 py-2 bg-indigo-50 border border-indigo-600 shadow-sm rounded flex flex-col items-center min-w-[80px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className="flex items-center gap-2 border-b border-indigo-200 w-full justify-center pb-1 mb-1">
                <LucideToggleLeft size={12} className="text-indigo-700" />
                <span className="text-xs font-bold text-indigo-900">{type}</span>
            </div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>S:</span> <span>{data.setVar}</span></div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>R:</span> <span>{data.resetVar}</span></div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>Q:</span> <span>{data.id || 'L1'}</span></div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-green-500" />
        </div>
    );
};

const LadderTrigNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    const type = data.subType || 'R_TRIG';
    const isRising = type === 'R_TRIG';

    return (
        <div className={`px-2 py-2 bg-pink-50 border border-pink-600 shadow-sm rounded flex flex-col items-center min-w-[80px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className="flex items-center gap-2 border-b border-pink-200 w-full justify-center pb-1 mb-1">
                {isRising ? <LucideTrendingUp size={12} className="text-pink-700" /> : <LucideTrendingDown size={12} className="text-pink-700" />}
                <span className="text-xs font-bold text-pink-900">{type}</span>
            </div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>CLK:</span> <span>{data.variable}</span></div>
            <div className="text-[10px] text-slate-700 w-full flex justify-between"><span>Q:</span> <span>{data.id || 'Trig1'}</span></div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-green-500" />
        </div>
    );
};

const LadderCompareNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    return (
        <div className={`px-2 py-2 bg-cyan-50 border border-cyan-600 shadow-sm rounded flex flex-col items-center min-w-[80px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className="flex items-center gap-2 border-b border-cyan-200 w-full justify-center pb-1 mb-1">
                <LucideScale size={12} className="text-cyan-700" />
                <span className="text-xs font-bold text-cyan-900">{data.op || 'EQ'}</span>
            </div>
            <div className="text-[10px] text-slate-700">{data.a} {data.op === 'EQ' ? '==' : data.op} {data.b}</div>
            <Handle type="source" position={Position.Bottom} id="true" className="w-2 h-2 bg-green-500" />
            <Handle type="source" position={Position.Right} id="false" className="w-2 h-2 bg-red-500" />
        </div>
    );
};

const LadderMathNode = ({ id, data }: any) => {
    const style = useValidationStyle(id, data.issues || []);
    const opSym = data.op === 'ADD' ? '+' : data.op === 'SUB' ? '-' : data.op === 'MUL' ? '*' : '/';
    return (
        <div className={`px-2 py-2 bg-teal-50 border border-teal-600 shadow-sm rounded flex flex-col items-center min-w-[90px] ${style}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400" />
            <div className="flex items-center gap-2 border-b border-teal-200 w-full justify-center pb-1 mb-1">
                <LucideCalculator size={12} className="text-teal-700" />
                <span className="text-xs font-bold text-teal-900">{data.op || 'ADD'}</span>
            </div>
            <div className="text-[10px] text-slate-700 w-full text-center font-bold mb-0.5">{data.dest} :=</div>
            <div className="text-[10px] text-slate-700 w-full text-center bg-white rounded border border-teal-100">{data.a} {opSym} {data.b}</div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-green-500" />
        </div>
    );
};

const nodeTypes = {
    start: StartNode,
    end: EndNode,
    loop: LoopNode,
    decision: DecisionNode,
    process: ProcessNode,
    state: StateNode,
    input: StartNode,
    output: EndNode,
    ladder_contact: LadderContactNode,
    ladder_coil: LadderCoilNode,
    ladder_timer: LadderTimerNode,
    ladder_counter: LadderCounterNode,
    ladder_latch: LadderLatchNode,
    ladder_trig: LadderTrigNode,
    ladder_compare: LadderCompareNode,
    ladder_math: LadderMathNode
};

const INITIAL_NODES: Node[] = [
    { id: '1', type: 'start', data: { label: 'Start' }, position: { x: 250, y: 20 } },
];

export const FlowchartEditor = ({ onGraphChange, boardConfig }: { onGraphChange: (nodes: Node[], edges: Edge[]) => void, boardConfig: any }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [issues, setIssues] = useState<FlowIssue[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

    const onConnect = useCallback((params: Connection) => {
        let label = undefined;
        if (params.sourceHandle === 'true') label = 'True';
        if (params.sourceHandle === 'false') label = 'False';

        const newEdges = addEdge({
            ...params,
            label,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed }
        }, edges);
        setEdges(newEdges);
    }, [edges, setEdges]);

    useEffect(() => {
        const validationIssues = FlowValidator.validate(nodes, edges);
        setIssues(validationIssues);
        onGraphChange(nodes, edges);

        setNodes(nds => nds.map(n => ({
            ...n,
            data: { ...n.data, issues: validationIssues }
        })));
    }, [edges, nodes.length, onGraphChange, setNodes]);

    // Update node data handler
    const updateNodeData = (id: string, newData: any) => {
        setNodes(nds => nds.map(n => {
            if (n.id === id) {
                return { ...n, data: { ...n.data, ...newData } };
            }
            return n;
        }));
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');
            const meta = JSON.parse(event.dataTransfer.getData('application/meta') || '{}');

            if (typeof type === 'undefined' || !type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });
            const newNode: Node = {
                id: Math.random().toString(36).substr(2, 9),
                type,
                position,
                data: {
                    label: meta.label || 'New Node',
                    ...meta
                },
            };
            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes]
    );

    const DragItem = ({ type, label, color, meta }: any) => (
        <div
            className="px-3 py-1.5 bg-white border border-slate-200 rounded shadow-sm cursor-grab text-xs flex items-center gap-2 hover:border-blue-400 hover:bg-slate-50 transition-colors whitespace-nowrap"
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData('application/reactflow', type);
                event.dataTransfer.setData('application/meta', JSON.stringify({ label, ...meta }));
            }}
        >
            <div className={`w-2 h-2 rounded-full ${color}`}></div>
            {label}
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col relative">
            <div className="bg-slate-100 p-2 border-b flex flex-col gap-2">
                {/* Standard Palette */}
                <div className="flex gap-2 overflow-x-auto items-center pb-2 border-b border-slate-200">
                    <div className="text-[10px] font-bold mr-2 text-slate-500 uppercase tracking-wider">Flow:</div>
                    <DragItem type="start" label="Start" color="bg-green-500" />
                    <DragItem type="process" label="Process" color="bg-blue-500" meta={{ code: boardId === 'arduino-uno' ? 'digitalWrite(13, HIGH)' : 'digitalWrite(2, HIGH)', label: 'Set LED HIGH' }} />
                    <DragItem type="decision" label="Decision" color="bg-purple-500" meta={{ code: 'x < 10' }} />
                    <DragItem type="loop" label="Loop" color="bg-orange-500" meta={{ code: 'for(int i=0;i<10;i++)' }} />
                    <DragItem type="end" label="End" color="bg-red-500" />
                </div>
                {/* State Machine Palette */}
                <div className="flex gap-2 overflow-x-auto items-center pb-2 border-b border-slate-200">
                    <div className="text-[10px] font-bold mr-2 text-slate-500 uppercase tracking-wider">State:</div>
                    <DragItem type="start" label="Initial" color="bg-green-600" meta={{ label: 'Init' }} />
                    <DragItem type="state" label="State" color="bg-indigo-500" meta={{ label: 'State', code: '// Action', entry: '', exit: '' }} />
                    <DragItem type="state" label="State (LED)" color="bg-indigo-500" meta={{ label: 'LED On', code: 'delay(100);', entry: boardId === 'arduino-uno' ? 'digitalWrite(13,1);' : 'digitalWrite(2,1);', exit: boardId === 'arduino-uno' ? 'digitalWrite(13,0);' : 'digitalWrite(2,0);' }} />
                    <DragItem type="decision" label="Transition" color="bg-purple-500" meta={{ code: 'x > 5' }} />
                </div>
                {/* Industrial Palette */}
                <div className="flex gap-2 overflow-x-auto items-center">
                    <div className="text-[10px] font-bold mr-2 text-slate-500 uppercase tracking-wider">Ladder:</div>
                    <DragItem type="ladder_contact" label="NO" color="bg-blue-400" meta={{ label: 'STOP_BTN', pin: boardId === 'raspberry-pi-pico' ? 25 : 13, pinLabel: boardId === 'raspberry-pi-pico' ? 'GP25' : 'D13', subType: 'NO' }} />
                    <DragItem type="ladder_contact" label="NC" color="bg-red-400" meta={{ label: 'LIMIT_SW', pin: 14, subType: 'NC' }} />
                    <DragItem type="ladder_coil" label="Coil" color="bg-slate-600" meta={{ label: 'MOTOR', pin: 2 }} />

                    <DragItem type="ladder_timer" label="TON" color="bg-yellow-500" meta={{ label: 'On-Delay', preset: 1000, id: 'T1', subType: 'TON', variable: 'in_var' }} />
                    <DragItem type="ladder_timer" label="TOF" color="bg-orange-500" meta={{ label: 'Off-Delay', preset: 1000, id: 'T2', subType: 'TOF', variable: 'in_var' }} />
                    <DragItem type="ladder_timer" label="TP" color="bg-emerald-500" meta={{ label: 'Pulse', preset: 1000, id: 'T3', subType: 'TP', variable: 'in_var' }} />

                    <DragItem type="ladder_counter" label="CTU" color="bg-blue-500" meta={{ label: 'Count Up', preset: 5, id: 'C1', subType: 'CTU', variable: 'pulse_in' }} />
                    <DragItem type="ladder_counter" label="CTD" color="bg-purple-500" meta={{ label: 'Count Dn', preset: 5, id: 'C2', subType: 'CTD', variable: 'pulse_in' }} />

                    <DragItem type="ladder_latch" label="SR" color="bg-indigo-500" meta={{ label: 'Set-Reset', id: 'L1', subType: 'SR', setVar: 's_in', resetVar: 'r_in' }} />
                    <DragItem type="ladder_latch" label="RS" color="bg-indigo-500" meta={{ label: 'Reset-Set', id: 'L2', subType: 'RS', setVar: 's_in', resetVar: 'r_in' }} />

                    <DragItem type="ladder_trig" label="R_TRIG" color="bg-pink-500" meta={{ label: 'Rising', id: 'RT1', subType: 'R_TRIG', variable: 'clk' }} />
                    <DragItem type="ladder_trig" label="F_TRIG" color="bg-pink-500" meta={{ label: 'Falling', id: 'FT1', subType: 'F_TRIG', variable: 'clk' }} />

                    <DragItem type="ladder_compare" label="EQ" color="bg-cyan-500" meta={{ label: 'Equal', op: 'EQ', a: 'val', b: '10' }} />
                    <DragItem type="ladder_compare" label="NEQ" color="bg-cyan-500" meta={{ label: 'NotEq', op: 'NEQ', a: 'val', b: '10' }} />
                    <DragItem type="ladder_compare" label="GT" color="bg-cyan-500" meta={{ label: 'Greater', op: 'GT', a: 'val', b: '10' }} />
                    <DragItem type="ladder_compare" label="LT" color="bg-cyan-500" meta={{ label: 'Less', op: 'LT', a: 'val', b: '10' }} />
                    <DragItem type="ladder_compare" label="GTE" color="bg-cyan-500" meta={{ label: 'GTE', op: 'GTE', a: 'val', b: '10' }} />
                    <DragItem type="ladder_compare" label="LTE" color="bg-cyan-500" meta={{ label: 'LTE', op: 'LTE', a: 'val', b: '10' }} />

                    <DragItem type="ladder_math" label="ADD" color="bg-teal-500" meta={{ label: 'Add', op: 'ADD', dest: 'res', a: 'a', b: 'b' }} />
                    <DragItem type="ladder_math" label="SUB" color="bg-teal-500" meta={{ label: 'Sub', op: 'SUB', dest: 'res', a: 'a', b: 'b' }} />
                    <DragItem type="ladder_math" label="MUL" color="bg-teal-500" meta={{ label: 'Mul', op: 'MUL', dest: 'res', a: 'a', b: 'b' }} />
                    <DragItem type="ladder_math" label="DIV" color="bg-teal-500" meta={{ label: 'Div', op: 'DIV', dest: 'res', a: 'a', b: 'b' }} />
                </div>
            </div>

            <div className="flex-1 bg-slate-50 relative flex" ref={reactFlowWrapper}>
                <div className="flex-1 h-full">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                        onPaneClick={() => setSelectedNodeId(null)}
                        nodeTypes={nodeTypes}
                        fitView
                        attributionPosition="bottom-right"
                    >
                        <Background color="#ccc" gap={20} />
                        <Controls />
                        <MiniMap nodeStrokeColor={(n) => {
                            if (n.type === 'start') return '#22c55e';
                            if (n.type === 'end') return '#ef4444';
                            if (n.type === 'decision') return '#a855f7';
                            return '#64748b';
                        }} nodeColor="#fff" />
                    </ReactFlow>
                </div>

                {/* Property Inspector Sidebar */}
                {selectedNode && (
                    <div className="w-64 bg-white border-l border-slate-200 shadow-lg p-4 flex flex-col gap-4 overflow-y-auto z-20">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                <LucideSettings size={14} className="text-blue-500" />
                                Properties
                            </h3>
                            <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-slate-600"><LucideX size={14} /></button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-500 font-bold mb-1">Label</label>
                                <input type="text" value={selectedNode.data.label} onChange={e => updateNodeData(selectedNode.id, { label: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1" />
                            </div>

                            {(selectedNode.type === 'process' || selectedNode.type === 'decision' || selectedNode.type === 'state') && (
                                <div>
                                    <label className="block text-slate-500 font-bold mb-1">Code / Condition</label>
                                    <textarea rows={3} value={selectedNode.data.code} onChange={e => updateNodeData(selectedNode.id, { code: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                </div>
                            )}

                            {selectedNode.type === 'state' && (
                                <>
                                    <div>
                                        <label className="block text-slate-500 font-bold mb-1">Entry Action</label>
                                        <input type="text" value={selectedNode.data.entry || ''} onChange={e => updateNodeData(selectedNode.id, { entry: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-slate-500 font-bold mb-1">Exit Action</label>
                                        <input type="text" value={selectedNode.data.exit || ''} onChange={e => updateNodeData(selectedNode.id, { exit: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                    </div>
                                </>
                            )}

                            {(selectedNode.type === 'ladder_contact' || selectedNode.type === 'ladder_coil') && (
                                <div>
                                    <label className="block text-slate-500 font-bold mb-1">Pin Target</label>
                                    <select
                                        value={selectedNode.data.pin || ''}
                                        onChange={e => {
                                            const pinVal = e.target.value;
                                            const g = boardConfig?.gpio.find((gpio: any) => gpio.pin.toString() === pinVal);
                                            updateNodeData(selectedNode.id, { pin: pinVal, pinLabel: g ? g.label : `Pin ${pinVal}` });
                                        }}
                                        className="w-full border border-slate-300 rounded px-2 py-1"
                                    >
                                        <option value="">- Select Pin -</option>
                                        {boardConfig?.gpio.map((g: any) => (
                                            <option key={g.pin} value={g.pin}>{g.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {(selectedNode.type === 'ladder_timer' || selectedNode.type === 'ladder_counter') && (
                                <>
                                    <div>
                                        <label className="block text-slate-500 font-bold mb-1">Tag (ID)</label>
                                        <input type="text" value={selectedNode.data.id || ''} onChange={e => updateNodeData(selectedNode.id, { id: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-slate-500 font-bold mb-1">{selectedNode.type === 'ladder_timer' ? 'Preset (ms)' : 'Preset Value'}</label>
                                        <input type="number" value={selectedNode.data.preset || 0} onChange={e => updateNodeData(selectedNode.id, { preset: parseInt(e.target.value) })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-slate-500 font-bold mb-1">Input Variable</label>
                                        <input type="text" value={selectedNode.data.variable || ''} onChange={e => updateNodeData(selectedNode.id, { variable: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                    </div>
                                </>
                            )}

                            {(selectedNode.type === 'ladder_compare' || selectedNode.type === 'ladder_math') && (
                                <>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-slate-500 font-bold mb-1">Op A</label>
                                            <input type="text" value={selectedNode.data.a || ''} onChange={e => updateNodeData(selectedNode.id, { a: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-slate-500 font-bold mb-1">Op B</label>
                                            <input type="text" value={selectedNode.data.b || ''} onChange={e => updateNodeData(selectedNode.id, { b: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                        </div>
                                    </div>
                                    {selectedNode.type === 'ladder_math' && (
                                        <div>
                                            <label className="block text-slate-500 font-bold mb-1">Destination</label>
                                            <input type="text" value={selectedNode.data.dest || ''} onChange={e => updateNodeData(selectedNode.id, { dest: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1 font-mono" />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-slate-500 font-bold mb-1">Operator</label>
                                        <select value={selectedNode.data.op} onChange={e => updateNodeData(selectedNode.id, { op: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1">
                                            {selectedNode.type === 'ladder_math' ?
                                                ['ADD', 'SUB', 'MUL', 'DIV'].map(o => <option key={o} value={o}>{o}</option>) :
                                                ['EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE'].map(o => <option key={o} value={o}>{o}</option>)
                                            }
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="absolute bottom-4 left-4 bg-white/90 p-3 rounded-lg shadow-xl border border-slate-200 max-w-sm max-h-48 overflow-y-auto text-xs z-10 backdrop-blur-sm">
                    <div className="font-bold flex items-center gap-2 mb-2 border-b border-slate-200 pb-1">
                        {issues.length === 0 ? <LucideCheckCircle className="text-green-500" size={14} /> : <LucideAlertOctagon className="text-slate-500" size={14} />}
                        Flow Validation
                        <span className="bg-slate-200 text-slate-600 px-1.5 rounded-full text-[10px]">{issues.length}</span>
                    </div>
                    {issues.length === 0 && <div className="text-slate-500 italic">Graph is valid.</div>}
                    <div className="space-y-1">
                        {issues.map((issue, i) => (
                            <div key={i} className={`flex items-start gap-2 p-1.5 rounded ${issue.severity === 'CRITICAL' ? 'bg-red-50 text-red-800' : issue.severity === 'WARNING' ? 'bg-yellow-50 text-yellow-800' : 'bg-blue-50 text-blue-800'}`}>
                                {issue.severity === 'CRITICAL' ? <LucideAlertOctagon size={12} className="mt-0.5 shrink-0" /> :
                                    issue.severity === 'WARNING' ? <LucideAlertTriangle size={12} className="mt-0.5 shrink-0" /> :
                                        <LucideInfo size={12} className="mt-0.5 shrink-0" />}
                                <span>{issue.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const FlowchartWrapper = (props: any) => (
    <ReactFlowProvider>
        <FlowchartEditor {...props} />
    </ReactFlowProvider>
);

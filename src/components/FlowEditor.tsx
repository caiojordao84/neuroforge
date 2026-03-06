
import React, { useState, useCallback, useRef, useEffect, useMemo, createContext, useContext } from 'react';
import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    type Connection,
    type Edge,
    type Node,
    MarkerType,
    Handle,
    Position,
    Panel,
    useReactFlow,
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    LucideRepeat,
    LucidePower,
    LucideAlertOctagon,
    LucideCheckCircle,
    LucideBoxSelect,
    LucideSettings,
    LucideX
} from 'lucide-react';

import { useSimulationStore, boardConfigs } from '@/stores/useSimulationStore';
import { useUIStore } from '@/stores/useUIStore';
import { flowToASL, validateFlow } from '@/engine/asl/flowToASL';
import { type FlowIssue } from '@/engine/flow/FlowValidator';
import { cn } from '@/lib/utils';

// --- Context for Validation Issues (Breaking the setNodes loop) ---
const FlowValidationContext = createContext<FlowIssue[]>([]);

const useValidationStyle = (id: string) => {
    const issues = useContext(FlowValidationContext);
    const issue = issues.find(i => i.nodeId === id || (i.nodeId === undefined && id === 'canvas'));
    if (!issue) return "";
    if (issue.severity === 'CRITICAL') return "ring-4 ring-red-500 ring-offset-2";
    if (issue.severity === 'WARNING') return "ring-4 ring-yellow-400 ring-offset-2";
    if (issue.severity === 'INFO') return "ring-2 ring-blue-400 ring-offset-2";
    return "";
};

// --- Custom Node Components ---

const StartNode = ({ id, data }: any) => {
    const style = useValidationStyle(id);
    return (
        <div className={cn("px-4 py-2 rounded-full bg-green-900/30 border-2 border-green-500 shadow-lg flex items-center justify-center min-w-[100px] text-[#e6e6e6]", style)}>
            <LucidePower size={14} className="mr-2 text-green-400" />
            <div className="text-xs font-bold">{data.label}</div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-500 border-none" />
        </div>
    );
};

const EndNode = ({ id, data }: any) => {
    const style = useValidationStyle(id);
    return (
        <div className={cn("px-4 py-2 rounded-full bg-red-900/30 border-2 border-red-500 shadow-lg flex items-center justify-center min-w-[100px] text-[#e6e6e6]", style)}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-red-500 border-none" />
            <div className="text-xs font-bold">{data.label}</div>
            <LucidePower size={14} className="ml-2 text-red-400" />
        </div>
    );
};

const LoopNode = ({ id, data }: any) => {
    const style = useValidationStyle(id);
    return (
        <div className={cn("px-4 py-2 rounded-md bg-orange-900/30 border-2 border-orange-500 shadow-lg flex items-center justify-center min-w-[120px] relative text-[#e6e6e6]", style)}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-orange-500 border-none" />
            <div className="absolute -top-3 left-2 bg-orange-500 text-white text-[8px] px-1 rounded font-bold">LOOP</div>
            <LucideRepeat size={14} className="mr-2 text-orange-400" />
            <div className="text-xs font-bold">{data.label}</div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-orange-500 border-none" />
            <Handle type="target" position={Position.Right} id="loop-back" className="w-2 h-4 bg-orange-400 rounded-sm border-none" style={{ top: '50%' }} />
        </div>
    );
};

const DecisionNode = ({ id, data }: any) => {
    const style = useValidationStyle(id);
    return (
        <div className={cn("w-20 h-20 bg-[#151b24] border-2 border-purple-500 rotate-45 flex items-center justify-center shadow-xl text-[#e6e6e6]", style)}>
            <div className="-rotate-45 text-center text-[10px] font-medium leading-tight p-1">{data.label}</div>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-500 border-none -mt-3.5 -ml-3.5" />
            <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-green-500 border-none -mb-3.5 -mr-3.5" />
            <Handle type="source" position={Position.Right} id="false" className="w-3 h-3 bg-red-500 border-none -mr-3.5 -mt-3.5" />

            <div className="absolute -bottom-6 -right-2 -rotate-45 text-[8px] font-bold text-green-400 bg-[#0a0e14] px-1 border border-green-900/50 rounded">True</div>
            <div className="absolute top-2 -right-8 -rotate-45 text-[8px] font-bold text-red-400 bg-[#0a0e14] px-1 border border-red-900/50 rounded">False</div>
        </div>
    );
};

const ProcessNode = ({ id, data }: any) => {
    const style = useValidationStyle(id);
    return (
        <div className={cn("px-4 py-2 bg-[#151b24] border border-[rgba(0,217,255,0.3)] shadow-lg rounded flex items-center min-w-[150px] text-[#e6e6e6]", style)}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400 border-none" />
            <div className="flex-1">
                <div className="text-[10px] text-[#00d9ff]/70 mb-0.5 font-mono truncate max-w-[120px]">{data.code || 'Statement'}</div>
                <div className="text-xs font-medium">{data.label}</div>
                {data.annotation && <div className="text-[9px] text-blue-400 mt-1 italic">// {data.annotation}</div>}
            </div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-400 border-none" />
        </div>
    );
};

const StateNode = ({ id, data }: any) => {
    const style = useValidationStyle(id);
    return (
        <div className={cn("w-[140px] bg-[#151b24] border-2 border-indigo-500 rounded-lg shadow-xl overflow-hidden text-[#e6e6e6]", style)}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-500 border-none" />
            <div className="bg-indigo-600 text-white px-2 py-1 text-xs font-bold flex items-center justify-between">
                <span>{data.label}</span>
                <LucideBoxSelect size={12} className="text-indigo-200" />
            </div>
            <div className="p-2 space-y-1">
                {data.entry && <div className="text-[9px] text-indigo-300 bg-indigo-900/30 px-1 rounded truncate border-l-2 border-indigo-400">Entry: {data.entry}</div>}
                <div className="text-[10px] text-[#e6e6e6] font-medium px-1 truncate">{data.code || '// Do...'}</div>
                {data.exit && <div className="text-[9px] text-orange-300 bg-orange-900/30 px-1 rounded truncate border-l-2 border-orange-400">Exit: {data.exit}</div>}
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-none" />
        </div>
    );
};

const LadderContactNode = ({ id, data }: any) => {
    const style = useValidationStyle(id);
    const isNC = data.subType === 'NC';
    return (
        <div className={cn("px-2 py-1 bg-[#151b24] border-2 shadow-lg rounded flex flex-col items-center min-w-[80px] text-[#e6e6e6]", isNC ? 'border-red-500' : 'border-[#00d9ff]', style)}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400 border-none" />
            <div className="flex items-center gap-1 my-1">
                <span className="font-mono text-xs font-bold text-slate-400">|</span>
                {isNC ? <span className="text-xs font-bold text-red-500">/</span> : <span className="w-2"></span>}
                <span className="font-mono text-xs font-bold text-slate-400">|</span>
            </div>
            <div className="text-[10px] font-bold">{data.label}</div>
            <div className="text-[8px] text-[#9ca3af]">{data.pinLabel ? data.pinLabel : data.pin ? `Pin ${data.pin}` : 'VAR'}</div>
            <Handle type="source" position={Position.Bottom} id="true" className="w-2 h-2 bg-green-500 border-none" />
            <Handle type="source" position={Position.Right} id="false" className="w-2 h-2 bg-red-500 border-none" />
        </div>
    );
};

const LadderCoilNode = ({ id, data }: any) => {
    const style = useValidationStyle(id);
    return (
        <div className={cn("px-2 py-1 bg-[#151b24] border-2 border-slate-500 shadow-lg rounded-full flex flex-col items-center min-w-[60px] aspect-square justify-center text-[#e6e6e6]", style)}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400 border-none" />
            <div className="text-xs font-bold">( {data.label} )</div>
            <div className="text-[8px] text-[#9ca3af]">{data.pinLabel ? data.pinLabel : data.pin ? `Pin ${data.pin}` : 'VAR'}</div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-400 border-none" />
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
    ladder_contact: LadderContactNode,
    ladder_coil: LadderCoilNode,
};

// --- Main Editor Component ---

const FlowEditorInner: React.FC = () => {
    // 1. Optimized Stable Selectors (returning primitives or stable references)
    const activeMCUId = useSimulationStore(s => s.activeMCUId);

    // Select components individually to avoid returning a new object literal
    const currentFlowNodes = useSimulationStore(s => s.activeMCUId ? s.mcus.get(s.activeMCUId)?.flowNodes : undefined);
    const currentFlowEdges = useSimulationStore(s => s.activeMCUId ? s.mcus.get(s.activeMCUId)?.flowEdges : undefined);
    const currentMCUType = useSimulationStore(s => s.activeMCUId ? s.mcus.get(s.activeMCUId)?.type : undefined);

    const updateMCUFlow = useSimulationStore(s => s.updateMCUFlow);
    const isFlowOpen = useUIStore(s => s.windows.flowEditor?.isOpen);

    const boardConfig = boardConfigs[currentMCUType || 'arduino-uno'];

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const { screenToFlowPosition } = useReactFlow();

    // Sync from store when active MCU changes - but only if the ID changed
    const prevId = useRef<string | null>(null);
    useEffect(() => {
        if (activeMCUId !== prevId.current) {
            setNodes(currentFlowNodes || [{ id: 'start', type: 'start', data: { label: 'Start' }, position: { x: 250, y: 50 } }]);
            setEdges(currentFlowEdges || []);
            prevId.current = activeMCUId;
        }
    }, [activeMCUId, currentFlowNodes, currentFlowEdges, setNodes, setEdges]);

    // Validation & Code Gen logic - move to memoized values
    const issues = useMemo(() => validateFlow(nodes, edges), [nodes, edges]);

    // Save to store - IMPORTANT: This should only trigger on meaningful diagram changes
    const lastSavedData = useRef({ nodes: JSON.stringify([]), edges: JSON.stringify([]) });

    useEffect(() => {
        if (!activeMCUId || !isFlowOpen) return;

        const currentNodesStr = JSON.stringify(nodes);
        const currentEdgesStr = JSON.stringify(edges);

        // Prevent infinite loop by checking if content actually changed
        if (currentNodesStr !== lastSavedData.current.nodes || currentEdgesStr !== lastSavedData.current.edges) {
            updateMCUFlow(activeMCUId, nodes, edges);
            lastSavedData.current = { nodes: currentNodesStr, edges: currentEdgesStr };

            // Auto-generate code
            if (issues.filter(i => i.severity === 'CRITICAL').length === 0) {
                try {
                    // flowToASL evaluation could happen here
                } catch (e) {
                    console.error("Error generating ASL from flow:", e);
                }
            }
        }
    }, [nodes, edges, activeMCUId, issues, isFlowOpen, updateMCUFlow]);

    const onConnect = useCallback((params: Connection) => {
        let label = undefined;
        if (params.sourceHandle === 'true') label = 'True';
        if (params.sourceHandle === 'false') label = 'False';

        setEdges((eds) => addEdge({
            ...params,
            label,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#00d9ff' },
            style: { stroke: '#00d9ff', strokeWidth: 2 }
        }, eds));
    }, [setEdges]);

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

            if (!type) return;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: Node = {
                id: `${type}_${Date.now()}`,
                type,
                position,
                data: {
                    label: meta.label || 'New Node',
                    ...meta
                },
            };
            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes]
    );

    const DragItem = ({ type, label, color, meta }: any) => (
        <div
            className="px-3 py-1 bg-[#151b24] border border-[rgba(0,217,255,0.2)] rounded shadow-sm cursor-grab text-[10px] flex items-center gap-2 hover:border-[#00d9ff] hover:bg-[rgba(0,217,255,0.05)] transition-all text-[#e6e6e6]"
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData('application/reactflow', type);
                event.dataTransfer.setData('application/meta', JSON.stringify({ label, ...meta }));
            }}
        >
            <div className={cn("w-2 h-2 rounded-full", color)}></div>
            {label}
        </div>
    );

    return (
        <FlowValidationContext.Provider value={issues}>
            <div className="flex flex-col h-full bg-[#0a0e14]">
                {/* Palette Area */}
                <div className="bg-[#151b24] p-2 border-b border-[rgba(0,217,255,0.2)] flex flex-col gap-1 overflow-x-auto">
                    <div className="flex gap-4 items-center whitespace-nowrap overflow-x-visible">
                        <div className="flex gap-2 items-center border-r border-[rgba(0,217,255,0.1)] pr-4">
                            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-tighter">Flow:</span>
                            <DragItem type="start" label="Start" color="bg-green-500" />
                            <DragItem type="process" label="Process" color="bg-[#00d9ff]" meta={{ code: 'digitalWrite(13, HIGH)', label: 'Set LED HIGH' }} />
                            <DragItem type="decision" label="Decision" color="bg-purple-500" meta={{ code: 'val < 100', label: 'Check Value' }} />
                            <DragItem type="loop" label="Loop" color="bg-orange-500" meta={{ code: 'for(int i=0;i<10;i++)', label: 'Repetir' }} />
                            <DragItem type="end" label="End" color="bg-red-500" />
                        </div>
                        <div className="flex gap-2 items-center border-r border-[rgba(0,217,255,0.1)] pr-4">
                            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-tighter">Ladder:</span>
                            <DragItem type="ladder_contact" label="NO" color="bg-[#00d9ff]" meta={{ label: 'INPUT', pin: 13, subType: 'NO' }} />
                            <DragItem type="ladder_contact" label="NC" color="bg-red-400" meta={{ label: 'LIMIT', pin: 14, subType: 'NC' }} />
                            <DragItem type="ladder_coil" label="Coil" color="bg-slate-400" meta={{ label: 'MOTOR', pin: 2 }} />
                        </div>
                        <div className="flex gap-2 items-center">
                            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-tighter">State:</span>
                            <DragItem type="state" label="State" color="bg-indigo-500" meta={{ label: 'State', code: '// Action' }} />
                        </div>
                    </div>
                </div>

                <div className="flex-1 relative flex overflow-hidden">
                    <div className="flex-1 h-full">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                            onPaneClick={() => setSelectedNodeId(null)}
                            nodeTypes={nodeTypes}
                            fitView
                            className="bg-[#0a0e14]"
                        >
                            <Background color="#1a3a5c" gap={20} size={1} />
                            <Controls className="bg-[#151b24] border-[rgba(0,217,255,0.3)] text-white" />
                            <MiniMap
                                className="bg-[#151b24] border border-[rgba(0,217,255,0.3)]"
                                nodeColor="#00d9ff"
                                maskColor="rgba(10, 14, 20, 0.8)"
                            />

                            <Panel position="bottom-left" className="m-4">
                                <div className={cn(
                                    "p-3 rounded-lg border shadow-2xl backdrop-blur-md max-w-xs transition-all",
                                    issues.length === 0 ? "bg-green-900/20 border-green-500/30 text-green-400" : "bg-[#151b24] border-[rgba(0,217,255,0.3)] text-[#e6e6e6]"
                                )}>
                                    <div className="font-bold flex items-center gap-2 mb-2">
                                        {issues.length === 0 ? <LucideCheckCircle size={14} /> : <LucideAlertOctagon size={14} className="text-yellow-500" />}
                                        Verification: {issues.length === 0 ? 'Ready' : `${issues.length} Issues`}
                                    </div>
                                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                        {issues.length === 0 && <span className="text-[10px] opacity-70 italic">Logic flowchart is valid for ASL conversion.</span>}
                                        {issues.map((issue, i) => (
                                            <div key={i} className="text-[10px] flex gap-2 leading-tight py-0.5">
                                                <span className={cn("shrink-0 font-bold", issue.severity === 'CRITICAL' ? 'text-red-500' : 'text-yellow-500')}>•</span>
                                                {issue.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Panel>
                        </ReactFlow>
                    </div>

                    {/* Property Inspector sidebar inside the window */}
                    {selectedNode && (
                        <div className="w-64 bg-[#151b24] border-l border-[rgba(0,217,255,0.2)] shadow-xl p-4 flex flex-col gap-4 overflow-y-auto z-20">
                            <div className="flex justify-between items-center border-b border-[rgba(0,217,255,0.1)] pb-2 text-[#e6e6e6]">
                                <h3 className="font-bold text-xs flex items-center gap-2">
                                    <LucideSettings size={14} className="text-[#00d9ff]" />
                                    Properties
                                </h3>
                                <button onClick={() => setSelectedNodeId(null)} className="text-[#9ca3af] hover:text-[#e6e6e6]"><LucideX size={14} /></button>
                            </div>

                            <div className="space-y-4 text-[11px] text-[#e6e6e6]">
                                <div>
                                    <label className="block text-[#9ca3af] font-bold mb-1 uppercase tracking-tighter">Label</label>
                                    <input
                                        type="text"
                                        value={selectedNode.data.label as string}
                                        onChange={e => updateNodeData(selectedNode.id, { label: e.target.value })}
                                        className="w-full bg-[#0a0e14] border border-[rgba(0,217,255,0.3)] rounded px-2 py-1 focus:border-[#00d9ff] outline-none"
                                    />
                                </div>

                                {(selectedNode.type === 'process' || selectedNode.type === 'decision' || selectedNode.type === 'state') && (
                                    <div>
                                        <label className="block text-[#9ca3af] font-bold mb-1 uppercase tracking-tighter">Code / Condition</label>
                                        <textarea
                                            rows={4}
                                            value={selectedNode.data.code as string}
                                            onChange={e => updateNodeData(selectedNode.id, { code: e.target.value })}
                                            className="w-full bg-[#0a0e14] border border-[rgba(0,217,255,0.3)] rounded px-2 py-1 font-mono focus:border-[#00d9ff] outline-none"
                                        />
                                    </div>
                                )}

                                {(selectedNode.type === 'ladder_contact' || selectedNode.type === 'ladder_coil') && (
                                    <div>
                                        <label className="block text-[#9ca3af] font-bold mb-1 uppercase tracking-tighter">Pin Target</label>
                                        <select
                                            value={selectedNode.data.pin as string || ''}
                                            onChange={e => {
                                                const pinVal = e.target.value;
                                                // Fallback pin mapping if boardConfig not available or unknown pin
                                                updateNodeData(selectedNode.id, { pin: parseInt(pinVal), pinLabel: `Pin ${pinVal}` });
                                            }}
                                            className="w-full bg-[#0a0e14] border border-[rgba(0,217,255,0.3)] rounded px-2 py-1 focus:border-[#00d9ff] outline-none"
                                        >
                                            <option value="">- Generic Pin -</option>
                                            {boardConfig && boardConfig.digitalPins.map(p => (
                                                <option key={p} value={p}>GPIO {p}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </FlowValidationContext.Provider>
    );
};

export const FlowEditor = () => (
    <ReactFlowProvider>
        <FlowEditorInner />
    </ReactFlowProvider>
);

export default FlowEditor;

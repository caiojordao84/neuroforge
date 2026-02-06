import React, { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { useSimulationStore, boardConfigs, defaultCodeMap } from '@/stores/useSimulationStore';
import { useSerialStore } from '@/stores/useSerialStore';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useUIStore } from '@/stores/useUIStore';
import { simulationEngine } from '@/engine/SimulationEngine';
import { codeParser } from '@/engine/CodeParser';
import { cn } from '@/lib/utils';
import type { BoardType, Language } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Play, Square, RotateCcw, FastForward, Cpu } from 'lucide-react';

// Inner canvas component with React Flow hooks
const CanvasInner: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();

  const {
    status,
    speed,
    setSpeed,
    language,
    getAllMCUs,
    addMCU,
    removeMCU,
    startSimulation,
    stopSimulation,
    resetSimulation,
  } = useSimulationStore();

  const { addConnection, removeConnection, setNodes: setStoreNodes, setEdges: setStoreEdges } = useConnectionStore();

  const { addTerminalLine } = useSerialStore();
  const { openWindow } = useUIStore();

  // Handle node click to open properties window
  const onNodeClick = useCallback((_event: React.MouseEvent, _node: Node) => {
    console.log('onNodeClick fired, opening properties window');
    openWindow('properties');
  }, [openWindow]);

  // Handle node double-click to open properties window
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, _node: Node) => {
    console.log('onNodeDoubleClick fired, opening properties window');
    openWindow('properties');
  }, [openWindow]);

  // Initialize with empty canvas
  useEffect(() => {
    setNodes([]);
  }, [setNodes]);

  // Sync React Flow nodes/edges with Connection Store
  useEffect(() => {
    setStoreNodes(nodes);
  }, [nodes, setStoreNodes]);

  useEffect(() => {
    setStoreEdges(edges);
  }, [edges, setStoreEdges]);

  // Get default code template for board type
  const getDefaultCodeForBoard = useCallback((boardType: BoardType, lang: Language): string => {
    const baseCode = defaultCodeMap[lang];
    const boardName = boardConfigs[boardType].name;
    
    // Add board-specific comment
    return `// ${boardName}\n${baseCode}`;
  }, []);

  // Validate connection before creating edge
  const isValidConnection = useCallback((connection: Connection): boolean => {
    if (connection.source === connection.target) {
      return false;
    }

    const existingEdge = edges.find(
      (e) => e.source === connection.source && e.target === connection.target &&
        e.sourceHandle === connection.sourceHandle && e.targetHandle === connection.targetHandle
    );
    if (existingEdge) {
      return false;
    }

    return true;
  }, [edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!isValidConnection(params)) {
        addTerminalLine('❌ Invalid connection', 'warning');
        return;
      }

      const sourceHandle = params.sourceHandle || '';
      const targetHandle = params.targetHandle || '';

      let wireType = 'digital';
      if (sourceHandle.includes('5V') || targetHandle.includes('5V') ||
        sourceHandle.includes('VIN') || targetHandle.includes('VIN')) {
        wireType = 'power';
      } else if (sourceHandle.includes('GND') || targetHandle.includes('GND')) {
        wireType = 'ground';
      } else if (sourceHandle.includes('A') || targetHandle.includes('A')) {
        wireType = 'analog';
      }

      const newEdge: Edge = {
        ...params,
        id: `e${params.source}-${params.target}-${Date.now()}`,
        type: 'manhattan',
        animated: wireType === 'power' || wireType === 'ground',
        data: {
          label: `${sourceHandle} → ${targetHandle}`,
          isActive: false,
        },
        style: {
          strokeWidth: wireType === 'power' || wireType === 'ground' ? 3 : 2,
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));

      const connection = {
        id: newEdge.id,
        source: `${params.source}:${params.sourceHandle || 'default'}`,
        target: `${params.target}:${params.targetHandle || 'default'}`,
      };
      addConnection(connection);

      addTerminalLine(`🔗 Connected: ${sourceHandle} → ${targetHandle}`, 'info');
    },
    [setEdges, addConnection, addTerminalLine, isValidConnection]
  );

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach((edge) => {
      removeConnection(edge.id);
    });
  }, [removeConnection]);

  // Handle node deletion - remove MCU from store
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    deletedNodes.forEach((node) => {
      if (node.type === 'mcu') {
        removeMCU(node.id);
        addTerminalLine(`🗑️ Removed MCU: ${node.data.label || node.id}`, 'info');
      }
    });
  }, [removeMCU, addTerminalLine]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as string;
      const componentDataStr = event.dataTransfer.getData('componentData');

      if (!type) return;

      const componentData = componentDataStr ? JSON.parse(componentDataStr) : {};

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          id: `${type}_${Date.now()}`,
          type,
          label: type.charAt(0).toUpperCase() + type.slice(1),
          ...componentData,
        },
      };

      setNodes((nds) => [...nds, newNode]);

      // If MCU, add to simulation store
      if (type === 'mcu') {
        const mcuType = (componentData.mcuType as BoardType) || 'arduino-uno';
        const defaultCode = getDefaultCodeForBoard(mcuType, language);
        const boardName = boardConfigs[mcuType].name;
        
        addMCU(newNode.id, {
          type: mcuType,
          code: defaultCode,
          language: language,
          isRunning: false,
          label: componentData.label || boardName
        });

        addTerminalLine(`➕ Added ${boardName} (${newNode.id})`, 'info');
      } else {
        addTerminalLine(`➕ Added ${type} component`, 'info');
      }
    },
    [screenToFlowPosition, setNodes, addTerminalLine, language, addMCU, getDefaultCodeForBoard]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleRun = useCallback(async () => {
    if (status === 'running') {
      stopSimulation();
      simulationEngine.stop();
    } else {
      // Get first MCU for legacy fake mode support
      const allMCUs = getAllMCUs();
      if (allMCUs.length === 0) {
        addTerminalLine('❌ No MCU found. Drag an MCU from Components Library.', 'error');
        return;
      }

      const activeMCU = allMCUs[0];
      codeParser.setLanguage(activeMCU.language);
      const parsed = codeParser.parse(activeMCU.code);

      if (parsed) {
        startSimulation();
        simulationEngine.start(parsed.setup, parsed.loop, speed);
      } else {
        addTerminalLine('❌ Failed to parse code', 'error');
      }
    }
  }, [status, speed, getAllMCUs, startSimulation, stopSimulation, addTerminalLine]);

  const handleReset = useCallback(() => {
    resetSimulation();
    simulationEngine.reset();
  }, [resetSimulation]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    simulationEngine.setSpeed(newSpeed);
  }, [setSpeed]);

  const mcuCount = getAllMCUs().length;

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-right"
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-[#0a0e14]"
        snapToGrid={true}
        snapGrid={[10, 10]}
        connectionLineStyle={{
          stroke: '#00d9ff',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        }}
      >
        <Background
          color="#1a3a5c"
          gap={20}
          size={1}
          style={{ backgroundColor: '#0a0e14' }}
        />
        <Controls className="bg-[#151b24] border-[rgba(0,217,255,0.3)]" />
        <MiniMap
          className="bg-[#151b24] border border-[rgba(0,217,255,0.3)]"
          nodeColor="#00d9ff"
          maskColor="rgba(10, 14, 20, 0.8)"
        />

        <Panel position="top-center" className="m-4">
          <div
            className={cn(
              'flex items-center gap-4 px-4 py-2 rounded-lg',
              'bg-[#151b24] border border-[rgba(0,217,255,0.3)]',
              'shadow-lg shadow-black/30'
            )}
          >
            <div className="flex items-center gap-2">
              <FastForward className="w-4 h-4 text-[#9ca3af]" />
              <Select value={speed.toString()} onValueChange={(v) => handleSpeedChange(parseInt(v, 10))}>
                <SelectTrigger className="w-[70px] h-8 bg-[#0a0e14] border-[rgba(0,217,255,0.3)] text-[#e6e6e6] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#151b24] border-[rgba(0,217,255,0.3)]">
                  {[1, 2, 5, 10].map((s) => (
                    <SelectItem
                      key={s}
                      value={s.toString()}
                      className="text-[#e6e6e6] hover:bg-[rgba(0,217,255,0.1)] focus:bg-[rgba(0,217,255,0.1)] text-xs"
                    >
                      {s}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-px h-6 bg-[rgba(0,217,255,0.2)]" />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-8 px-3 bg-transparent border-[rgba(0,217,255,0.3)] text-[#9ca3af] hover:text-[#00d9ff] hover:bg-[rgba(0,217,255,0.1)]"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleRun}
                className={cn(
                  'h-8 px-4',
                  status === 'running'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-[#00d9ff] hover:bg-[#00a8cc] text-[#0a0e14]'
                )}
              >
                {status === 'running' ? (
                  <>
                    <Square className="w-4 h-4 mr-1" fill="currentColor" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" fill="currentColor" />
                    Run
                  </>
                )}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel position="bottom-left" className="m-4 ml-16">
          <div
            className={cn(
              'px-3 py-2 rounded-lg',
              'bg-[#151b24] border border-[rgba(0,217,255,0.3)]',
              'text-xs'
            )}
          >
            <div className="flex items-center gap-2">
              <Cpu
                className={cn(
                  'w-4 h-4',
                  status === 'running' ? 'text-green-400 animate-pulse' : 'text-[#9ca3af]'
                )}
              />
              <span className={cn(
                status === 'running' ? 'text-green-400' : 'text-[#9ca3af]'
              )}>
                {status === 'idle' && mcuCount === 0 && 'Ready - Drag MCU from library'}
                {status === 'idle' && mcuCount > 0 && `${mcuCount} MCU${mcuCount > 1 ? 's' : ''} on canvas`}
                {status === 'running' && 'Simulation running'}
                {status === 'paused' && 'Simulation paused'}
                {status === 'error' && 'Simulation error'}
              </span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

// Main canvas component
export const CanvasArea: React.FC = () => {
  return (
    <div className="w-full h-full">
      <CanvasInner />
    </div>
  );
};

export default CanvasArea;

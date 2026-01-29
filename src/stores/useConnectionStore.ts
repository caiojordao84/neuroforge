import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WireConnection } from '@/types';
import type { Node, Edge } from '@xyflow/react';

interface ConnectionStore {
  nodes: Node[];
  edges: Edge[];
  connections: WireConnection[];
  
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Record<string, unknown>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  
  addConnection: (connection: WireConnection) => void;
  removeConnection: (connectionId: string) => void;
  
  getConnectionsForPin: (pinId: string) => WireConnection[];
  getComponentConnectedToPin: (pinNumber: number) => { componentId: string; handleId: string } | null;
  
  clearAll: () => void;
  
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      connections: [],

      addNode: (node) => {
        set((state) => ({
          nodes: [...state.nodes, node],
        }));
      },

      removeNode: (nodeId) => {
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== nodeId),
          edges: state.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          ),
          connections: state.connections.filter(
            (c) => !c.source.startsWith(nodeId) && !c.target.startsWith(nodeId)
          ),
        }));
      },

      updateNode: (nodeId, data) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          ),
        }));
      },

      updateNodePosition: (nodeId, position) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, position } : n
          ),
        }));
      },

      addEdge: (edge) => {
        set((state) => ({
          edges: [...state.edges, edge],
        }));
        
        const connection: WireConnection = {
          id: edge.id,
          source: `${edge.source}:${edge.sourceHandle || 'default'}`,
          target: `${edge.target}:${edge.targetHandle || 'default'}`,
        };
        get().addConnection(connection);
      },

      removeEdge: (edgeId) => {
        set((state) => ({
          edges: state.edges.filter((e) => e.id !== edgeId),
          connections: state.connections.filter((c) => c.id !== edgeId),
        }));
      },

      addConnection: (connection) => {
        set((state) => ({
          connections: [...state.connections, connection],
        }));
      },

      removeConnection: (connectionId) => {
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== connectionId),
        }));
      },

      getConnectionsForPin: (pinId) => {
        return get().connections.filter(
          (c) => c.source === pinId || c.target === pinId
        );
      },

      getComponentConnectedToPin: (pinNumber) => {
        const pinId = `board:D${pinNumber}`;
        const connection = get().connections.find(
          (c) => c.source === pinId || c.target === pinId
        );
        
        if (!connection) return null;
        
        const otherEnd = connection.source === pinId ? connection.target : connection.source;
        const [componentId, handleId] = otherEnd.split(':');
        return { componentId, handleId: handleId || 'default' };
      },

      clearAll: () => {
        set({
          nodes: [],
          edges: [],
          connections: [],
        });
      },

      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
    }),
    {
      name: 'neuroforge-connection-store',
      partialize: (state) => ({ 
        nodes: state.nodes.map(n => ({ ...n, data: n.data })),
        edges: state.edges,
        connections: state.connections,
      }),
    }
  )
);

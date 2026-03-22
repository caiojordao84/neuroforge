import type { Node, Edge } from '@xyflow/svelte';

export interface WireConnection {
  id: string;
  source: string; // "nodeId:handleId"
  target: string;
}

const STORAGE_KEY = 'neuroforge-connection-store';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

class ConnectionState {
  nodes       = $state<Node[]>([]);
  edges       = $state<Edge[]>([]);
  connections = $state<WireConnection[]>([]);

  constructor() {
    const saved = loadFromStorage();
    if (saved) {
      this.nodes       = saved.nodes       ?? [];
      this.edges       = saved.edges       ?? [];
      this.connections = saved.connections ?? [];
    }
  }

  // Persistência automática — chamar após mutações
  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: this.nodes, edges: this.edges, connections: this.connections,
    }));
  }

  setNodes(nodes: Node[])  { this.nodes = nodes;  this.persist(); }
  setEdges(edges: Edge[])  { this.edges = edges;  this.persist(); }

  addNode(node: Node) {
    this.nodes = [...this.nodes, node];
    this.persist();
  }

  removeNode(id: string) {
    this.nodes       = this.nodes.filter((n: Node) => n.id !== id);
    this.edges       = this.edges.filter((e: Edge) => e.source !== id && e.target !== id);
    this.connections = this.connections.filter(
      (c: WireConnection) => !c.source.startsWith(id) && !c.target.startsWith(id)
    );
    this.persist();
  }

  updateNode(id: string, data: Record<string, unknown>) {
    this.nodes = this.nodes.map((n: Node) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n);
    this.persist();
  }

  updateNodePosition(id: string, pos: { x: number; y: number }) {
    this.nodes = this.nodes.map((n: Node) => n.id === id ? { ...n, position: pos } : n);
    this.persist();
  }

  addEdge(edge: Edge) {
    this.edges = [...this.edges, edge];
    this.connections = [...this.connections, {
      id: edge.id,
      source: `${edge.source}:${edge.sourceHandle ?? 'default'}`,
      target: `${edge.target}:${edge.targetHandle ?? 'default'}`,
    }];
    this.persist();
  }

  removeEdge(id: string) {
    this.edges       = this.edges.filter((e: Edge) => e.id !== id);
    this.connections = this.connections.filter((c: WireConnection) => c.id !== id);
    this.persist();
  }

  getConnectionsForPin(pinId: string): WireConnection[] {
    return this.connections.filter((c: WireConnection) => c.source === pinId || c.target === pinId);
  }

  getComponentConnectedToPin(pin: number): { componentId: string; handleId: string } | null {
    const pinId = `board:D${pin}`;
    const conn  = this.connections.find((c: WireConnection) => c.source === pinId || c.target === pinId);
    if (!conn) return null;
    const other = conn.source === pinId ? conn.target : conn.source;
    const [componentId, handleId = 'default'] = other.split(':');
    return { componentId, handleId };
  }

  clearAll() {
    this.nodes = []; this.edges = []; this.connections = [];
    this.persist();
  }
}

export const connection = new ConnectionState();

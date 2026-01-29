import { ManhattanEdge } from './ManhattanEdge';

// Edge type mapping for React Flow
export const edgeTypes = {
  manhattan: ManhattanEdge,
} as const;

export type EdgeType = keyof typeof edgeTypes;

export { ManhattanEdge };

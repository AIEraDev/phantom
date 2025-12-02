// Visualization types based on design document

export type VisualizationType = "array" | "tree" | "graph";

export type OperationType = "compare" | "swap" | "insert" | "delete" | "visit" | "highlight";

export interface VisualizationStep {
  timestamp: number;
  operation: OperationType;
  indices: number[];
  values?: any[];
  metadata?: Record<string, any>;
}

export interface VisualizationData {
  type: VisualizationType;
  initialState: any;
  steps: VisualizationStep[];
}

// Tree node structure for tree visualization
export interface TreeNode {
  id: string;
  value: any;
  children: TreeNode[];
  x?: number;
  y?: number;
  z?: number;
}

// Graph node structure for graph visualization
export interface GraphNode {
  id: string;
  value: any;
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Color scheme for operations
export const OPERATION_COLORS = {
  compare: "#ffff00", // Yellow
  swap: "#ff4444", // Red
  insert: "#00ff00", // Green
  delete: "#ff0000", // Red
  visit: "#00ffff", // Cyan
  highlight: "#ff00ff", // Magenta
  default: "#4488ff", // Blue
  sorted: "#00ff88", // Lime green
} as const;

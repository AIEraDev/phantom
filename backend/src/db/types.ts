// Database model type definitions

export interface User {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number;
  wins: number;
  losses: number;
  total_matches: number;
  created_at: Date;
  updated_at: Date;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  time_limit: number;
  test_cases: TestCase[];
  starter_code: StarterCode;
  optimal_solution: string | null;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

export interface TestCase {
  input: any;
  expectedOutput: any;
  isHidden: boolean;
  weight: number;
}

export interface StarterCode {
  javascript: string;
  python: string;
  typescript: string;
}

export interface Match {
  id: string;
  challenge_id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  player1_code: string | null;
  player2_code: string | null;
  player1_language: string;
  player2_language: string;
  player1_feedback: string | null;
  player2_feedback: string | null;
  duration: number | null;
  status: "waiting" | "lobby" | "active" | "completed" | "abandoned";
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MatchEvent {
  id: number;
  match_id: string;
  player_id: string;
  event_type: "code_update" | "test_run" | "submission" | "cursor_move";
  timestamp: number;
  data: any;
  created_at: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  category: string;
  requirement: Record<string, any>;
  points: number;
  created_at: Date;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  progress: Record<string, any>;
  unlocked_at: Date | null;
  created_at: Date;
}

// Helper types for queries
export type NewUser = Omit<User, "id" | "created_at" | "updated_at" | "display_name" | "avatar_url">;

export type NewMatch = Pick<Match, "challenge_id" | "player1_id" | "player2_id" | "player1_language" | "player2_language">;

export type MatchUpdate = Partial<Pick<Match, "winner_id" | "player1_score" | "player2_score" | "player1_code" | "player2_code" | "player1_feedback" | "player2_feedback" | "duration" | "status" | "started_at" | "completed_at">>;

// Ghost Recording types
export interface GhostRecording {
  id: string;
  challenge_id: string;
  user_id: string;
  username: string;
  score: number;
  duration_ms: number;
  events: GhostEvent[];
  is_ai: boolean;
  created_at: Date;
}

export interface GhostEvent {
  event_type: "code_update" | "test_run" | "submission" | "cursor_move";
  timestamp: number;
  data: any;
}

export type NewGhostRecording = Omit<GhostRecording, "id" | "created_at">;

// Practice Session types
// Requirements: 17.1, 17.2

/**
 * AI feedback structure for practice sessions
 */
export interface PracticeFeedback {
  correctness: number; // 0-10
  efficiency: number; // 0-10
  quality: number; // 0-10
  suggestions: string[];
}

/**
 * Represents a solo practice session
 */
export interface PracticeSession {
  id: string;
  userId: string;
  challengeId: string;
  code: string;
  language: "javascript" | "python" | "typescript";
  score: number | null;
  feedback: PracticeFeedback | null;
  hintsUsed: number;
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * Progressive hint for practice mode
 */
export interface PracticeHint {
  level: number; // 1-3, increasing detail
  content: string;
}

export type NewPracticeSession = Pick<PracticeSession, "userId" | "challengeId" | "language">;

// Spectator Message types
// Requirements: 15.2

/**
 * Message type for spectator chat
 */
export type SpectatorMessageType = "text" | "emoji" | "reaction";

/**
 * Represents a chat message from a spectator watching a match
 */
export interface SpectatorMessage {
  id: string;
  matchId: string;
  userId: string;
  username: string;
  message: string;
  messageType: SpectatorMessageType;
  createdAt: Date;
}

/**
 * Input for creating a new spectator message
 */
export type NewSpectatorMessage = Pick<SpectatorMessage, "matchId" | "userId" | "username" | "message" | "messageType">;

// Visualization types
// Requirements: 13.1, 13.2, 13.3

/**
 * Operation types for algorithm visualization
 * - compare: Comparing two elements
 * - swap: Swapping two elements
 * - insert: Inserting an element
 * - delete: Deleting an element
 * - visit: Visiting a node (for trees/graphs)
 * - highlight: Highlighting an element
 */
export type VisualizationOperationType = "compare" | "swap" | "insert" | "delete" | "visit" | "highlight";

/**
 * Data structure types that can be visualized
 */
export type VisualizationDataType = "array" | "tree" | "graph";

/**
 * Represents a single step in the visualization
 */
export interface VisualizationStep {
  timestamp: number;
  operation: VisualizationOperationType;
  indices: number[];
  values?: any[];
  metadata?: Record<string, any>;
}

/**
 * Tree node structure for tree visualizations
 */
export interface TreeNode {
  id: number;
  value: any;
  children: number[]; // IDs of child nodes
  parent?: number; // ID of parent node
}

/**
 * Graph node structure for graph visualizations
 */
export interface GraphNode {
  id: number;
  value: any;
  x?: number;
  y?: number;
}

/**
 * Graph edge structure for graph visualizations
 */
export interface GraphEdge {
  from: number;
  to: number;
  weight?: number;
}

/**
 * Initial state for array visualization
 */
export interface ArrayInitialState {
  elements: any[];
}

/**
 * Initial state for tree visualization
 */
export interface TreeInitialState {
  nodes: TreeNode[];
  root: number;
}

/**
 * Initial state for graph visualization
 */
export interface GraphInitialState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Union type for initial states
 */
export type VisualizationInitialState = ArrayInitialState | TreeInitialState | GraphInitialState;

/**
 * Complete visualization data structure
 */
export interface VisualizationData {
  type: VisualizationDataType;
  initialState: VisualizationInitialState;
  steps: VisualizationStep[];
}

/**
 * Aggregated node for large dataset visualization
 * Requirements: 13.6
 */
export interface AggregatedNode {
  id: number;
  startIndex: number;
  endIndex: number;
  count: number;
  minValue: any;
  maxValue: any;
  avgValue?: number;
}

/**
 * Aggregated visualization data for large datasets (>1000 elements)
 */
export interface AggregatedVisualizationData {
  type: VisualizationDataType;
  isAggregated: true;
  originalSize: number;
  aggregatedNodes: AggregatedNode[];
  steps: VisualizationStep[];
}

/**
 * Visualization marker format for parsing execution traces
 * Format: __VIZ__:{operation}:{indices}:{values}:{metadata}
 */
export interface VisualizationMarker {
  operation: VisualizationOperationType;
  indices: number[];
  values?: any[];
  metadata?: Record<string, any>;
}

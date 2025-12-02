/**
 * Skill Tree Types
 * Based on backend service interfaces
 */

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  time_limit: number;
  test_cases: Array<{ input: unknown; expectedOutput: unknown; isHidden: boolean }>;
  starter_code: Record<string, string>;
  optimal_solution?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface SkillTreeNode {
  id: string;
  challengeId: string;
  tier: number;
  positionX: number;
  positionY: number;
  category: "arrays" | "strings" | "trees" | "graphs" | "dp";
  challenge: Challenge | null;
  prerequisites: string[];
  isUnlocked: boolean;
  isCompleted: boolean;
  isMastered: boolean;
}

export interface SkillTreeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface SkillTree {
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
}

export interface UserProgress {
  id: string;
  userId: string;
  challengeId: string;
  completed: boolean;
  mastered: boolean;
  bestScore: number;
  attempts: number;
  completedAt: Date | null;
}

export type NodeState = "locked" | "unlocked" | "completed" | "mastered";

export function getNodeState(node: SkillTreeNode): NodeState {
  if (node.isMastered) return "mastered";
  if (node.isCompleted) return "completed";
  if (node.isUnlocked) return "unlocked";
  return "locked";
}

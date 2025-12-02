import pool from "../db/connection";
import { Challenge } from "../db/types";

// ============================================================================
// Skill Tree Data Model and Types
// Requirements: 16.1, 16.2, 16.3
// ============================================================================

/**
 * Represents a node in the skill tree, corresponding to a challenge
 */
export interface SkillTreeNode {
  id: string;
  challengeId: string;
  tier: number; // 1-5, determines vertical position
  positionX: number;
  positionY: number;
  category: "arrays" | "strings" | "trees" | "graphs" | "dp";
  challenge: Challenge | null;
  prerequisites: string[]; // node IDs that must be completed first
  isUnlocked: boolean;
  isCompleted: boolean;
  isMastered: boolean;
}

/**
 * Represents an edge connecting two skill tree nodes (prerequisite relationship)
 */
export interface SkillTreeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

/**
 * Tracks a user's progress on a specific challenge
 */
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

/**
 * Result of checking if a challenge is unlocked
 */
export interface UnlockCheckResult {
  unlocked: boolean;
  missingPrerequisites: string[]; // challenge IDs that need to be completed
}

/**
 * Full skill tree structure with nodes and edges
 */
export interface SkillTree {
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
}

// ============================================================================
// Database Row Types (internal use)
// ============================================================================

interface SkillTreeNodeRow {
  id: string;
  challenge_id: string;
  tier: number;
  position_x: number;
  position_y: number;
  category: string;
}

interface SkillTreeEdgeRow {
  id: string;
  from_node_id: string;
  to_node_id: string;
}

interface UserProgressRow {
  id: string;
  user_id: string;
  challenge_id: string;
  completed: boolean;
  mastered: boolean;
  best_score: number;
  attempts: number;
  completed_at: Date | null;
}

// ============================================================================
// Skill Tree Service
// ============================================================================

export class SkillTreeService {
  // ============================================================================
  // Database Query Functions
  // ============================================================================

  /**
   * Get all skill tree nodes from database
   */
  private async getAllNodes(): Promise<SkillTreeNodeRow[]> {
    const result = await pool.query<SkillTreeNodeRow>(
      `SELECT id, challenge_id, tier, position_x, position_y, category
       FROM skill_tree_nodes
       ORDER BY tier, position_x`
    );
    return result.rows;
  }

  /**
   * Get all skill tree edges from database
   */
  private async getAllEdges(): Promise<SkillTreeEdgeRow[]> {
    const result = await pool.query<SkillTreeEdgeRow>(
      `SELECT id, from_node_id, to_node_id
       FROM skill_tree_edges`
    );
    return result.rows;
  }

  /**
   * Get user progress for all challenges
   */
  private async getUserProgressAll(userId: string): Promise<UserProgressRow[]> {
    const result = await pool.query<UserProgressRow>(
      `SELECT id, user_id, challenge_id, completed, mastered, best_score, attempts, completed_at
       FROM user_progress
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get user progress for a specific challenge
   */
  private async getUserProgressForChallenge(userId: string, challengeId: string): Promise<UserProgressRow | null> {
    const result = await pool.query<UserProgressRow>(
      `SELECT id, user_id, challenge_id, completed, mastered, best_score, attempts, completed_at
       FROM user_progress
       WHERE user_id = $1 AND challenge_id = $2`,
      [userId, challengeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get challenge data by ID
   */
  private async getChallengeById(challengeId: string): Promise<Challenge | null> {
    const result = await pool.query(`SELECT * FROM challenges WHERE id = $1`, [challengeId]);
    if (result.rows.length === 0) return null;
    return this.formatChallenge(result.rows[0]);
  }

  /**
   * Get multiple challenges by IDs
   */
  private async getChallengesByIds(challengeIds: string[]): Promise<Map<string, Challenge>> {
    if (challengeIds.length === 0) return new Map();

    const result = await pool.query(`SELECT * FROM challenges WHERE id = ANY($1)`, [challengeIds]);

    const challengeMap = new Map<string, Challenge>();
    for (const row of result.rows) {
      challengeMap.set(row.id, this.formatChallenge(row));
    }
    return challengeMap;
  }

  /**
   * Get node by challenge ID
   */
  private async getNodeByChallengeId(challengeId: string): Promise<SkillTreeNodeRow | null> {
    const result = await pool.query<SkillTreeNodeRow>(
      `SELECT id, challenge_id, tier, position_x, position_y, category
       FROM skill_tree_nodes
       WHERE challenge_id = $1`,
      [challengeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get prerequisite node IDs for a given node
   */
  private async getPrerequisiteNodeIds(nodeId: string): Promise<string[]> {
    const result = await pool.query<{ from_node_id: string }>(
      `SELECT from_node_id
       FROM skill_tree_edges
       WHERE to_node_id = $1`,
      [nodeId]
    );
    return result.rows.map((row) => row.from_node_id);
  }

  /**
   * Format challenge data from database row
   */
  private formatChallenge(row: any): Challenge {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      time_limit: row.time_limit,
      test_cases: typeof row.test_cases === "string" ? JSON.parse(row.test_cases) : row.test_cases,
      starter_code: typeof row.starter_code === "string" ? JSON.parse(row.starter_code) : row.starter_code,
      optimal_solution: row.optimal_solution,
      tags: row.tags,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Format user progress from database row to interface
   */
  private formatUserProgress(row: UserProgressRow): UserProgress {
    return {
      id: row.id,
      userId: row.user_id,
      challengeId: row.challenge_id,
      completed: row.completed,
      mastered: row.mastered,
      bestScore: row.best_score,
      attempts: row.attempts,
      completedAt: row.completed_at,
    };
  }

  /**
   * Check if a score qualifies for mastery (>= 90%)
   * **Feature: phantom-code-battle, Property 13: Mastery threshold correctness**
   */
  checkMastery(score: number): boolean {
    return score >= 90;
  }

  // ============================================================================
  // 45.2 getSkillTree Function
  // Requirements: 16.3, 16.4
  // ============================================================================

  /**
   * Get the full skill tree with user progress
   * - Query all nodes and edges from database
   * - Join with user progress to determine unlock/completion status
   * - Return structured skill tree with user state
   */
  async getSkillTree(userId: string): Promise<SkillTree> {
    // Fetch all data in parallel
    const [nodeRows, edgeRows, progressRows] = await Promise.all([this.getAllNodes(), this.getAllEdges(), this.getUserProgressAll(userId)]);

    // Build progress lookup map by challenge ID
    const progressMap = new Map<string, UserProgressRow>();
    for (const progress of progressRows) {
      progressMap.set(progress.challenge_id, progress);
    }

    // Build prerequisite lookup map (nodeId -> prerequisite nodeIds)
    const prerequisiteMap = new Map<string, string[]>();
    for (const edge of edgeRows) {
      const existing = prerequisiteMap.get(edge.to_node_id) || [];
      existing.push(edge.from_node_id);
      prerequisiteMap.set(edge.to_node_id, existing);
    }

    // Build node ID to challenge ID lookup
    const nodeIdToChallengeId = new Map<string, string>();
    for (const node of nodeRows) {
      nodeIdToChallengeId.set(node.id, node.challenge_id);
    }

    // Get all challenge IDs and fetch challenge data
    const challengeIds = nodeRows.map((n) => n.challenge_id);
    const challengeMap = await this.getChallengesByIds(challengeIds);

    // Build nodes with user state
    const nodes: SkillTreeNode[] = nodeRows.map((nodeRow) => {
      const progress = progressMap.get(nodeRow.challenge_id);
      const prerequisiteNodeIds = prerequisiteMap.get(nodeRow.id) || [];

      // Determine if unlocked: tier 1 is always unlocked, otherwise all prerequisites must be completed
      let isUnlocked = nodeRow.tier === 1;
      if (!isUnlocked && prerequisiteNodeIds.length > 0) {
        isUnlocked = prerequisiteNodeIds.every((prereqNodeId) => {
          const prereqChallengeId = nodeIdToChallengeId.get(prereqNodeId);
          if (!prereqChallengeId) return false;
          const prereqProgress = progressMap.get(prereqChallengeId);
          return prereqProgress?.completed === true;
        });
      }

      return {
        id: nodeRow.id,
        challengeId: nodeRow.challenge_id,
        tier: nodeRow.tier,
        positionX: nodeRow.position_x,
        positionY: nodeRow.position_y,
        category: nodeRow.category as SkillTreeNode["category"],
        challenge: challengeMap.get(nodeRow.challenge_id) || null,
        prerequisites: prerequisiteNodeIds,
        isUnlocked,
        isCompleted: progress?.completed === true,
        isMastered: progress?.mastered === true,
      };
    });

    // Format edges
    const edges: SkillTreeEdge[] = edgeRows.map((edgeRow) => ({
      id: edgeRow.id,
      fromNodeId: edgeRow.from_node_id,
      toNodeId: edgeRow.to_node_id,
    }));

    return { nodes, edges };
  }

  // ============================================================================
  // 45.3 isChallengeUnlocked Function
  // Requirements: 16.4, 16.6
  // ============================================================================

  /**
   * Check if a challenge is unlocked for a user
   * - Check if all prerequisite challenges are completed
   * - Return unlock status and missing prerequisites
   */
  async isChallengeUnlocked(userId: string, challengeId: string): Promise<UnlockCheckResult> {
    // Get the node for this challenge
    const node = await this.getNodeByChallengeId(challengeId);

    // If challenge is not in skill tree, consider it unlocked
    if (!node) {
      return { unlocked: true, missingPrerequisites: [] };
    }

    // Tier 1 challenges are always unlocked
    if (node.tier === 1) {
      return { unlocked: true, missingPrerequisites: [] };
    }

    // Get prerequisite node IDs
    const prerequisiteNodeIds = await this.getPrerequisiteNodeIds(node.id);

    // If no prerequisites, it's unlocked
    if (prerequisiteNodeIds.length === 0) {
      return { unlocked: true, missingPrerequisites: [] };
    }

    // Get challenge IDs for prerequisite nodes
    const prereqNodesResult = await pool.query<{ id: string; challenge_id: string }>(`SELECT id, challenge_id FROM skill_tree_nodes WHERE id = ANY($1)`, [prerequisiteNodeIds]);

    const prereqChallengeIds = prereqNodesResult.rows.map((r) => r.challenge_id);

    // Get user progress for prerequisite challenges
    const progressResult = await pool.query<{ challenge_id: string; completed: boolean }>(
      `SELECT challenge_id, completed FROM user_progress
       WHERE user_id = $1 AND challenge_id = ANY($2)`,
      [userId, prereqChallengeIds]
    );

    // Build a set of completed challenge IDs
    const completedChallengeIds = new Set<string>();
    for (const row of progressResult.rows) {
      if (row.completed) {
        completedChallengeIds.add(row.challenge_id);
      }
    }

    // Find missing prerequisites
    const missingPrerequisites: string[] = [];
    for (const prereqChallengeId of prereqChallengeIds) {
      if (!completedChallengeIds.has(prereqChallengeId)) {
        missingPrerequisites.push(prereqChallengeId);
      }
    }

    return {
      unlocked: missingPrerequisites.length === 0,
      missingPrerequisites,
    };
  }

  // ============================================================================
  // 45.4 updateProgress Function
  // Requirements: 16.2, 16.5
  // ============================================================================

  /**
   * Update user progress after completing a challenge
   * - Update user_progress table with new score
   * - Check and set mastery flag if score >= 90
   * - Trigger unlock of connected challenges
   */
  async updateProgress(userId: string, challengeId: string, score: number): Promise<UserProgress> {
    // Check if progress record exists
    const existingProgress = await this.getUserProgressForChallenge(userId, challengeId);

    const mastered = this.checkMastery(score);
    const completed = score > 0; // Any positive score counts as completion

    let result: UserProgressRow;

    if (existingProgress) {
      // Update existing progress - only update best_score if new score is higher
      const newBestScore = Math.max(existingProgress.best_score, score);
      const newMastered = existingProgress.mastered || mastered;
      const newCompleted = existingProgress.completed || completed;

      const updateResult = await pool.query<UserProgressRow>(
        `UPDATE user_progress
         SET best_score = $1,
             mastered = $2,
             completed = $3,
             attempts = attempts + 1,
             completed_at = CASE WHEN $3 AND completed_at IS NULL THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE user_id = $4 AND challenge_id = $5
         RETURNING id, user_id, challenge_id, completed, mastered, best_score, attempts, completed_at`,
        [newBestScore, newMastered, newCompleted, userId, challengeId]
      );
      result = updateResult.rows[0];
    } else {
      // Insert new progress record
      const insertResult = await pool.query<UserProgressRow>(
        `INSERT INTO user_progress (user_id, challenge_id, completed, mastered, best_score, attempts, completed_at)
         VALUES ($1, $2, $3, $4, $5, 1, CASE WHEN $3 THEN NOW() ELSE NULL END)
         RETURNING id, user_id, challenge_id, completed, mastered, best_score, attempts, completed_at`,
        [userId, challengeId, completed, mastered, score]
      );
      result = insertResult.rows[0];
    }

    return this.formatUserProgress(result);
  }

  // ============================================================================
  // 45.5 getUnlockedChallenges Function
  // Requirements: 16.1, 17.1
  // ============================================================================

  /**
   * Get all unlocked challenges for a user
   * - Query challenges where user has completed prerequisites
   * - Include tier-1 challenges by default (always unlocked)
   */
  async getUnlockedChallenges(userId: string): Promise<Challenge[]> {
    // Get the full skill tree with user state
    const skillTree = await this.getSkillTree(userId);

    // Filter to only unlocked nodes and extract challenges
    const unlockedChallenges: Challenge[] = [];

    for (const node of skillTree.nodes) {
      if (node.isUnlocked && node.challenge) {
        unlockedChallenges.push(node.challenge);
      }
    }

    // Sort by tier then difficulty for consistent ordering
    const difficultyOrder: Record<string, number> = {
      easy: 1,
      medium: 2,
      hard: 3,
      expert: 4,
    };

    unlockedChallenges.sort((a, b) => {
      // Find the nodes for these challenges to get tier
      const nodeA = skillTree.nodes.find((n) => n.challengeId === a.id);
      const nodeB = skillTree.nodes.find((n) => n.challengeId === b.id);

      const tierA = nodeA?.tier ?? 0;
      const tierB = nodeB?.tier ?? 0;

      if (tierA !== tierB) {
        return tierA - tierB;
      }

      return (difficultyOrder[a.difficulty] || 0) - (difficultyOrder[b.difficulty] || 0);
    });

    return unlockedChallenges;
  }

  // ============================================================================
  // Additional Helper Methods
  // ============================================================================

  /**
   * Get user progress for a specific challenge
   */
  async getProgress(userId: string, challengeId: string): Promise<UserProgress | null> {
    const row = await this.getUserProgressForChallenge(userId, challengeId);
    return row ? this.formatUserProgress(row) : null;
  }

  /**
   * Get all user progress records
   */
  async getAllProgress(userId: string): Promise<UserProgress[]> {
    const rows = await this.getUserProgressAll(userId);
    return rows.map((row) => this.formatUserProgress(row));
  }
}

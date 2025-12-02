import pool from "../db/connection";
import { Challenge, PracticeSession, PracticeHint, PracticeFeedback } from "../db/types";
import { calculateCorrectnessScore, calculateEfficiencyScore } from "./judging.service";
import { analyzeCodeQuality } from "./gemini.service";
import { SkillTreeService } from "./skillTree.service";

// ============================================================================
// Practice Service
// Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6
// ============================================================================

// ============================================================================
// Database Row Types (internal use)
// ============================================================================

interface PracticeSessionRow {
  id: string;
  user_id: string;
  challenge_id: string;
  code: string;
  language: "javascript" | "python" | "typescript";
  score: number | null;
  feedback: PracticeFeedback | null;
  hints_used: number;
  started_at: Date;
  completed_at: Date | null;
}

// ============================================================================
// Practice Service Class
// ============================================================================

export class PracticeService {
  private skillTreeService: SkillTreeService;

  constructor() {
    this.skillTreeService = new SkillTreeService();
  }

  // ============================================================================
  // Database Query Functions
  // Requirements: 17.1, 17.2
  // ============================================================================

  /**
   * Get a practice session by ID
   */
  async getSessionById(sessionId: string): Promise<PracticeSession | null> {
    const result = await pool.query<PracticeSessionRow>(
      `SELECT id, user_id, challenge_id, code, language, score, feedback, hints_used, started_at, completed_at
       FROM practice_sessions
       WHERE id = $1`,
      [sessionId]
    );
    return result.rows[0] ? this.formatSession(result.rows[0]) : null;
  }

  /**
   * Get all practice sessions for a user
   */
  async getSessionsByUserId(userId: string): Promise<PracticeSession[]> {
    const result = await pool.query<PracticeSessionRow>(
      `SELECT id, user_id, challenge_id, code, language, score, feedback, hints_used, started_at, completed_at
       FROM practice_sessions
       WHERE user_id = $1
       ORDER BY started_at DESC`,
      [userId]
    );
    return result.rows.map((row) => this.formatSession(row));
  }

  /**
   * Get challenge by ID
   */
  private async getChallengeById(challengeId: string): Promise<Challenge | null> {
    const result = await pool.query(`SELECT * FROM challenges WHERE id = $1`, [challengeId]);
    if (result.rows.length === 0) return null;
    return this.formatChallenge(result.rows[0]);
  }

  /**
   * Format practice session from database row
   */
  private formatSession(row: PracticeSessionRow): PracticeSession {
    return {
      id: row.id,
      userId: row.user_id,
      challengeId: row.challenge_id,
      code: row.code,
      language: row.language,
      score: row.score,
      feedback: typeof row.feedback === "string" ? JSON.parse(row.feedback) : row.feedback,
      hintsUsed: row.hints_used,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  /**
   * Format challenge from database row
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

  // ============================================================================
  // 51.2 startSession Function
  // Requirements: 17.2
  // ============================================================================

  /**
   * Start a new practice session
   * - Create new practice_sessions record
   * - Load challenge data
   * - Return session with challenge info
   */
  async startSession(userId: string, challengeId: string, language: "javascript" | "python" | "typescript"): Promise<{ session: PracticeSession; challenge: Challenge }> {
    // Verify challenge exists
    const challenge = await this.getChallengeById(challengeId);
    if (!challenge) {
      throw new Error(`Challenge not found: ${challengeId}`);
    }

    // Verify challenge is unlocked for user
    const unlockResult = await this.skillTreeService.isChallengeUnlocked(userId, challengeId);
    if (!unlockResult.unlocked) {
      throw new Error(`Challenge is locked. Complete prerequisites first: ${unlockResult.missingPrerequisites.join(", ")}`);
    }

    // Get starter code for the selected language
    const starterCode = challenge.starter_code[language] || "";

    // Create new practice session
    const result = await pool.query<PracticeSessionRow>(
      `INSERT INTO practice_sessions (user_id, challenge_id, code, language, hints_used)
       VALUES ($1, $2, $3, $4, 0)
       RETURNING id, user_id, challenge_id, code, language, score, feedback, hints_used, started_at, completed_at`,
      [userId, challengeId, starterCode, language]
    );

    const session = this.formatSession(result.rows[0]);

    return { session, challenge };
  }

  // ============================================================================
  // 51.3 saveProgress Function
  // Requirements: 17.2
  // ============================================================================

  /**
   * Save progress during practice
   * - Update code in practice_sessions
   * - Auto-save every 30 seconds (client-side responsibility)
   */
  async saveProgress(sessionId: string, code: string): Promise<void> {
    const result = await pool.query(
      `UPDATE practice_sessions
       SET code = $1
       WHERE id = $2 AND completed_at IS NULL`,
      [code, sessionId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Session not found or already completed: ${sessionId}`);
    }
  }

  // ============================================================================
  // 51.4 submitSolution Function
  // Requirements: 17.3, 17.4
  // ============================================================================

  /**
   * Submit solution for evaluation
   * - Execute code against test cases
   * - Generate AI feedback
   * - Update session with score and feedback
   * - Do NOT update user rating
   */
  async submitSolution(sessionId: string, code: string): Promise<PracticeSession> {
    // Get the session
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.completedAt) {
      throw new Error(`Session already completed: ${sessionId}`);
    }

    // Get the challenge
    const challenge = await this.getChallengeById(session.challengeId);
    if (!challenge) {
      throw new Error(`Challenge not found: ${session.challengeId}`);
    }

    // Execute code against test cases
    const correctnessResult = await calculateCorrectnessScore(code, session.language, challenge.test_cases);

    // Calculate efficiency score
    const efficiencyResult = calculateEfficiencyScore(correctnessResult.testResults);

    // Get AI quality analysis
    const qualityResult = await analyzeCodeQuality(code, session.language, session.userId);

    // Build feedback object
    const feedback: PracticeFeedback = {
      correctness: correctnessResult.score,
      efficiency: efficiencyResult.score,
      quality: qualityResult.score,
      suggestions: this.generateSuggestions(correctnessResult, efficiencyResult, qualityResult),
    };

    // Calculate overall score (0-100 scale)
    const score = Math.round((correctnessResult.score * 0.5 + efficiencyResult.score * 0.3 + qualityResult.score * 0.2) * 10);

    // Update session with results (do NOT update user rating)
    const result = await pool.query<PracticeSessionRow>(
      `UPDATE practice_sessions
       SET code = $1, score = $2, feedback = $3, completed_at = NOW()
       WHERE id = $4
       RETURNING id, user_id, challenge_id, code, language, score, feedback, hints_used, started_at, completed_at`,
      [code, score, JSON.stringify(feedback), sessionId]
    );

    return this.formatSession(result.rows[0]);
  }

  /**
   * Generate improvement suggestions based on scores
   */
  private generateSuggestions(correctness: { score: number; passedTests: number; totalTests: number }, efficiency: { score: number; avgExecutionTime: number }, quality: { score: number; analysis: { feedback: string } }): string[] {
    const suggestions: string[] = [];

    // Correctness suggestions
    if (correctness.score < 10) {
      const failedTests = correctness.totalTests - correctness.passedTests;
      suggestions.push(`${failedTests} test case(s) failed. Review edge cases and input validation.`);
    }

    // Efficiency suggestions
    if (efficiency.score < 7) {
      suggestions.push("Consider optimizing your algorithm for better time complexity.");
    }
    if (efficiency.avgExecutionTime > 500) {
      suggestions.push(`Average execution time is ${Math.round(efficiency.avgExecutionTime)}ms. Look for ways to reduce iterations.`);
    }

    // Quality suggestions
    if (quality.score < 7) {
      suggestions.push("Focus on code readability: use meaningful variable names and add comments.");
    }

    // Add AI feedback if available
    if (quality.analysis.feedback && !quality.analysis.feedback.includes("heuristics")) {
      suggestions.push(quality.analysis.feedback);
    }

    return suggestions;
  }

  // ============================================================================
  // 51.5 getHint Function
  // Requirements: 17.6
  // ============================================================================

  /**
   * Get progressive hints for a challenge
   * - Return hint based on level (1-3)
   * - Level 1: General approach
   * - Level 2: Algorithm hint
   * - Level 3: Partial solution
   */
  async getHint(sessionId: string, challengeId: string, hintLevel: number): Promise<PracticeHint> {
    // Validate hint level
    if (hintLevel < 1 || hintLevel > 3) {
      throw new Error("Hint level must be between 1 and 3");
    }

    // Get the session to verify it exists and belongs to the challenge
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.challengeId !== challengeId) {
      throw new Error("Challenge ID does not match session");
    }

    // Get the challenge
    const challenge = await this.getChallengeById(challengeId);
    if (!challenge) {
      throw new Error(`Challenge not found: ${challengeId}`);
    }

    // Generate hint based on level
    const hint = this.generateHint(challenge, hintLevel);

    // Update hints_used counter
    await pool.query(
      `UPDATE practice_sessions
       SET hints_used = GREATEST(hints_used, $1)
       WHERE id = $2`,
      [hintLevel, sessionId]
    );

    return hint;
  }

  /**
   * Generate hint content based on challenge and level
   */
  private generateHint(challenge: Challenge, level: number): PracticeHint {
    // Extract key information from challenge
    const { title, description, difficulty, tags, optimal_solution } = challenge;

    let content: string;

    switch (level) {
      case 1:
        // Level 1: General approach hint
        content = this.generateLevel1Hint(title, description, tags, difficulty);
        break;

      case 2:
        // Level 2: Algorithm hint
        content = this.generateLevel2Hint(title, description, tags, difficulty);
        break;

      case 3:
        // Level 3: Partial solution
        content = this.generateLevel3Hint(title, description, tags, optimal_solution);
        break;

      default:
        content = "No hint available for this level.";
    }

    return { level, content };
  }

  /**
   * Generate Level 1 hint: General approach
   */
  private generateLevel1Hint(title: string, _description: string, tags: string[], difficulty: string): string {
    const hints: string[] = [];

    hints.push(`**General Approach for "${title}"**\n`);

    // Add tag-based hints
    if (tags.includes("arrays") || tags.includes("array")) {
      hints.push("• This problem involves array manipulation. Consider iterating through the array and tracking relevant values.");
    }
    if (tags.includes("strings") || tags.includes("string")) {
      hints.push("• This is a string problem. Think about character-by-character processing or using string methods.");
    }
    if (tags.includes("sorting")) {
      hints.push("• Sorting might help simplify this problem. Consider if a sorted array makes the solution easier.");
    }
    if (tags.includes("hash") || tags.includes("hashmap") || tags.includes("dictionary")) {
      hints.push("• A hash map/dictionary can help with O(1) lookups. Consider what you need to track.");
    }
    if (tags.includes("two-pointers")) {
      hints.push("• The two-pointer technique might be useful here. Consider using pointers from both ends or a slow/fast pointer approach.");
    }
    if (tags.includes("recursion") || tags.includes("trees") || tags.includes("tree")) {
      hints.push("• Think recursively. Can you break this problem into smaller subproblems?");
    }
    if (tags.includes("dynamic-programming") || tags.includes("dp")) {
      hints.push("• This might be a dynamic programming problem. Look for overlapping subproblems and optimal substructure.");
    }

    // Add difficulty-based advice
    if (difficulty === "easy") {
      hints.push("\n💡 Tip: Start with a simple, straightforward solution. Don't overthink it!");
    } else if (difficulty === "medium") {
      hints.push("\n💡 Tip: Consider edge cases carefully. The straightforward approach might need optimization.");
    } else {
      hints.push("\n💡 Tip: Break down the problem into smaller parts. Complex problems often combine multiple techniques.");
    }

    return hints.join("\n");
  }

  /**
   * Generate Level 2 hint: Algorithm hint
   */
  private generateLevel2Hint(title: string, description: string, tags: string[], difficulty: string): string {
    const hints: string[] = [];

    hints.push(`**Algorithm Hint for "${title}"**\n`);

    // More specific algorithm hints based on tags
    if (tags.includes("two-sum") || description.toLowerCase().includes("two numbers")) {
      hints.push("**Recommended Approach: Hash Map**");
      hints.push("1. Create a hash map to store values you've seen");
      hints.push("2. For each element, check if its complement exists in the map");
      hints.push("3. Time complexity: O(n), Space complexity: O(n)");
    } else if (tags.includes("sorting") || tags.includes("arrays")) {
      hints.push("**Recommended Approach: Sorting + Iteration**");
      hints.push("1. Consider sorting the array first if order doesn't matter");
      hints.push("2. Use two pointers or binary search on sorted data");
      hints.push("3. Watch out for duplicate handling");
    } else if (tags.includes("strings") || tags.includes("palindrome")) {
      hints.push("**Recommended Approach: Two Pointers**");
      hints.push("1. Use two pointers from start and end");
      hints.push("2. Compare characters and move pointers inward");
      hints.push("3. Handle edge cases: empty strings, single characters");
    } else if (tags.includes("linked-list")) {
      hints.push("**Recommended Approach: Pointer Manipulation**");
      hints.push("1. Use slow/fast pointers for cycle detection or middle finding");
      hints.push("2. Consider using a dummy head node for edge cases");
      hints.push("3. Draw out the pointer changes before coding");
    } else if (tags.includes("trees") || tags.includes("tree")) {
      hints.push("**Recommended Approach: Recursion/DFS**");
      hints.push("1. Define your base case (null node or leaf)");
      hints.push("2. Process current node and recurse on children");
      hints.push("3. Consider pre-order, in-order, or post-order traversal");
    } else if (tags.includes("dynamic-programming") || tags.includes("dp")) {
      hints.push("**Recommended Approach: Dynamic Programming**");
      hints.push("1. Define your state: what information do you need to track?");
      hints.push("2. Write the recurrence relation");
      hints.push("3. Decide between top-down (memoization) or bottom-up (tabulation)");
    } else {
      hints.push("**General Algorithm Steps:**");
      hints.push("1. Identify the input and output clearly");
      hints.push("2. Think about what data structure best fits the problem");
      hints.push("3. Consider the time/space complexity requirements");
    }

    hints.push(`\n⏱️ Target complexity for ${difficulty} problems:`);
    if (difficulty === "easy") {
      hints.push("• Time: O(n) or O(n log n)");
      hints.push("• Space: O(1) to O(n)");
    } else if (difficulty === "medium") {
      hints.push("• Time: O(n) to O(n²)");
      hints.push("• Space: O(1) to O(n)");
    } else {
      hints.push("• Time: Varies, but optimize where possible");
      hints.push("• Space: Consider space-time tradeoffs");
    }

    return hints.join("\n");
  }

  /**
   * Generate Level 3 hint: Partial solution
   */
  private generateLevel3Hint(title: string, _description: string, tags: string[], optimalSolution: string | null): string {
    const hints: string[] = [];

    hints.push(`**Partial Solution for "${title}"**\n`);

    if (optimalSolution) {
      // Extract the structure from optimal solution without giving away the full answer
      const lines = optimalSolution.split("\n").filter((line) => line.trim());
      const structureLines: string[] = [];

      for (const line of lines) {
        // Keep function signatures and structure, hide implementation details
        if (line.includes("function") || line.includes("def ") || line.includes("class") || line.includes("const ") || line.includes("let ") || line.includes("return") || line.trim().startsWith("//") || line.trim().startsWith("#")) {
          // Partially obscure the line
          if (line.includes("return")) {
            structureLines.push("  return /* your result here */;");
          } else {
            structureLines.push(line);
          }
        } else if (line.includes("{") || line.includes("}") || line.includes(":")) {
          structureLines.push(line);
        }
      }

      if (structureLines.length > 0) {
        hints.push("**Code Structure:**");
        hints.push("```");
        hints.push(structureLines.slice(0, 10).join("\n")); // Limit to first 10 lines
        hints.push("```");
      }
    }

    hints.push("\n**Key Implementation Points:**");

    // Add specific implementation hints based on tags
    if (tags.includes("arrays") || tags.includes("array")) {
      hints.push("• Initialize your result variable before the loop");
      hints.push("• Use array methods like map(), filter(), reduce() when appropriate");
      hints.push("• Don't forget to handle empty array case");
    }
    if (tags.includes("strings")) {
      hints.push("• Strings are immutable - build results with array or StringBuilder");
      hints.push("• Use charCodeAt() for character comparisons in JavaScript");
      hints.push("• Consider case sensitivity requirements");
    }
    if (tags.includes("hash") || tags.includes("hashmap")) {
      hints.push("• Initialize: const map = new Map() or {}");
      hints.push("• Check existence: map.has(key) or key in obj");
      hints.push("• Store complement/target values for O(1) lookup");
    }

    hints.push("\n⚠️ This is the maximum hint level. Try to complete the solution from here!");

    return hints.join("\n");
  }

  // ============================================================================
  // 51.6 getPracticeHistory Function
  // Requirements: 17.5
  // ============================================================================

  /**
   * Get practice history for a user
   * - Query practice_sessions by user_id
   * - Include scores and timestamps
   * - Calculate improvement trends
   */
  async getPracticeHistory(userId: string): Promise<{
    sessions: PracticeSession[];
    stats: PracticeStats;
    trends: PracticeTrends;
  }> {
    // Get all sessions for user
    const sessions = await this.getSessionsByUserId(userId);

    // Calculate statistics
    const stats = this.calculateStats(sessions);

    // Calculate improvement trends
    const trends = this.calculateTrends(sessions);

    return { sessions, stats, trends };
  }

  /**
   * Calculate practice statistics
   */
  private calculateStats(sessions: PracticeSession[]): PracticeStats {
    const completedSessions = sessions.filter((s) => s.completedAt !== null);
    const scores = completedSessions.map((s) => s.score).filter((s): s is number => s !== null);

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      totalHintsUsed: sessions.reduce((sum, s) => sum + s.hintsUsed, 0),
      uniqueChallenges: new Set(sessions.map((s) => s.challengeId)).size,
    };
  }

  /**
   * Calculate improvement trends over time
   */
  private calculateTrends(sessions: PracticeSession[]): PracticeTrends {
    const completedSessions = sessions.filter((s) => s.completedAt !== null && s.score !== null).sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());

    if (completedSessions.length < 2) {
      return {
        scoreImprovement: 0,
        recentAverage: completedSessions[0]?.score ?? 0,
        previousAverage: 0,
        trend: "neutral",
      };
    }

    // Split into recent and previous halves
    const midpoint = Math.floor(completedSessions.length / 2);
    const previousSessions = completedSessions.slice(0, midpoint);
    const recentSessions = completedSessions.slice(midpoint);

    const previousAverage = previousSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / previousSessions.length;
    const recentAverage = recentSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / recentSessions.length;

    const scoreImprovement = Math.round(recentAverage - previousAverage);

    let trend: "improving" | "declining" | "neutral";
    if (scoreImprovement > 5) {
      trend = "improving";
    } else if (scoreImprovement < -5) {
      trend = "declining";
    } else {
      trend = "neutral";
    }

    return {
      scoreImprovement,
      recentAverage: Math.round(recentAverage),
      previousAverage: Math.round(previousAverage),
      trend,
    };
  }

  /**
   * Get unlocked challenges for practice mode
   * Requirements: 17.1
   */
  async getUnlockedChallenges(userId: string, filters?: { difficulty?: string; category?: string }): Promise<Challenge[]> {
    let challenges = await this.skillTreeService.getUnlockedChallenges(userId);

    // Apply filters
    if (filters?.difficulty) {
      challenges = challenges.filter((c) => c.difficulty === filters.difficulty);
    }

    if (filters?.category) {
      challenges = challenges.filter((c) => c.tags.includes(filters.category!));
    }

    return challenges;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface PracticeStats {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  highestScore: number;
  totalHintsUsed: number;
  uniqueChallenges: number;
}

export interface PracticeTrends {
  scoreImprovement: number;
  recentAverage: number;
  previousAverage: number;
  trend: "improving" | "declining" | "neutral";
}

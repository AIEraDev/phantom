/**
 * Coaching Dashboard Service for AI Code Coach
 * Provides dashboard summary, skill timeline, categorized feedback, and trend analysis
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import pool from "../db/connection";
import { MatchAnalysis, MatchHint, CoachingSummary, CategoryScores } from "../db/types";

// Constants
const TREND_WINDOW_SIZE = 10;
const REQUIRED_CATEGORIES = ["time_complexity", "space_complexity", "readability", "patterns"] as const;

/**
 * Dashboard summary structure
 * Requirements: 5.1
 */
export interface DashboardSummary {
  totalHintsUsed: number;
  totalMatchesAnalyzed: number;
  improvementScore: number;
  averageAnalysisScore: number;
}

/**
 * Skill timeline entry structure
 * Requirements: 5.2
 */
export interface SkillTimelineEntry {
  matchId: string;
  date: Date;
  scores: CategoryScores;
}

/**
 * Skill timeline structure
 * Requirements: 5.2
 */
export interface SkillTimeline {
  entries: SkillTimelineEntry[];
}

/**
 * Category feedback item structure
 * Requirements: 5.3
 */
export interface CategoryFeedbackItem {
  matchId: string;
  date: Date;
  feedback: string;
}

/**
 * Category feedback structure
 * Requirements: 5.3
 */
export interface CategoryFeedback {
  category: string;
  feedbackItems: CategoryFeedbackItem[];
}

/**
 * Trend data structure
 * Requirements: 5.5
 */
export interface TrendData {
  category: string;
  dataPoints: Array<{
    matchNumber: number;
    score: number;
  }>;
  trend: "improving" | "stable" | "declining";
}

/**
 * Match detail structure
 * Requirements: 5.4
 */
export interface MatchDetail {
  analysis: MatchAnalysis;
  hints: MatchHint[];
}

/**
 * Parse a database row into MatchAnalysis
 */
function parseAnalysisRow(row: any): MatchAnalysis {
  return {
    id: row.id,
    match_id: row.match_id,
    user_id: row.user_id,
    time_complexity: typeof row.time_complexity === "string" ? JSON.parse(row.time_complexity) : row.time_complexity,
    space_complexity: typeof row.space_complexity === "string" ? JSON.parse(row.space_complexity) : row.space_complexity,
    readability_score: typeof row.readability_score === "string" ? JSON.parse(row.readability_score) : row.readability_score,
    algorithmic_approach: typeof row.algorithmic_approach === "string" ? JSON.parse(row.algorithmic_approach) : row.algorithmic_approach,
    suggestions: typeof row.suggestions === "string" ? JSON.parse(row.suggestions) : row.suggestions,
    bug_analysis: typeof row.bug_analysis === "string" ? JSON.parse(row.bug_analysis) : row.bug_analysis,
    hints_used: row.hints_used,
    created_at: new Date(row.created_at),
  };
}

/**
 * Parse a database row into CoachingSummary
 */
function parseCoachingSummaryRow(row: any): CoachingSummary {
  return {
    id: row.id,
    user_id: row.user_id,
    total_hints_used: row.total_hints_used,
    total_matches_analyzed: row.total_matches_analyzed,
    improvement_score: row.improvement_score,
    trend_data: typeof row.trend_data === "string" ? JSON.parse(row.trend_data) : row.trend_data,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * Get or create coaching summary for a user
 * @param userId - The user ID
 * @returns The coaching summary
 */
export async function getOrCreateCoachingSummary(userId: string): Promise<CoachingSummary> {
  // Try to get existing summary
  const result = await pool.query(`SELECT * FROM coaching_summaries WHERE user_id = $1`, [userId]);

  if (result.rows.length > 0) {
    return parseCoachingSummaryRow(result.rows[0]);
  }

  // Create new summary
  const insertResult = await pool.query(
    `INSERT INTO coaching_summaries (user_id, total_hints_used, total_matches_analyzed, improvement_score, trend_data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, 0, 0, 0, JSON.stringify([])]
  );

  return parseCoachingSummaryRow(insertResult.rows[0]);
}

/**
 * Calculate dashboard summary for a user
 * **Feature: ai-code-coach, Property 10: Dashboard summary completeness**
 * Requirements: 5.1
 * @param userId - The user ID
 * @returns Dashboard summary with all required fields
 */
export async function getSummary(userId: string): Promise<DashboardSummary> {
  // Get total hints used across all matches
  const hintsResult = await pool.query(
    `SELECT COALESCE(SUM(hints_used), 0) as total_hints
     FROM match_analyses
     WHERE user_id = $1`,
    [userId]
  );
  const totalHintsUsed = parseInt(hintsResult.rows[0].total_hints, 10);

  // Get total matches analyzed
  const matchesResult = await pool.query(
    `SELECT COUNT(*) as total_matches
     FROM match_analyses
     WHERE user_id = $1`,
    [userId]
  );
  const totalMatchesAnalyzed = parseInt(matchesResult.rows[0].total_matches, 10);

  // Calculate improvement score from trend data
  const improvementScore = await calculateImprovementScore(userId);

  // Calculate average analysis score
  const averageAnalysisScore = await calculateAverageAnalysisScore(userId);

  return {
    totalHintsUsed,
    totalMatchesAnalyzed,
    improvementScore,
    averageAnalysisScore,
  };
}

/**
 * Calculate improvement score from recent analyses
 * @param userId - The user ID
 * @returns Improvement score (0-100)
 */
async function calculateImprovementScore(userId: string): Promise<number> {
  // Get last 10 analyses ordered by date
  const result = await pool.query(
    `SELECT readability_score, time_complexity, space_complexity
     FROM match_analyses
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, TREND_WINDOW_SIZE]
  );

  if (result.rows.length < 2) {
    return 0; // Not enough data to calculate improvement
  }

  const analyses = result.rows.map((row) => ({
    readability: typeof row.readability_score === "string" ? JSON.parse(row.readability_score) : row.readability_score,
    time: typeof row.time_complexity === "string" ? JSON.parse(row.time_complexity) : row.time_complexity,
    space: typeof row.space_complexity === "string" ? JSON.parse(row.space_complexity) : row.space_complexity,
  }));

  // Calculate average score for first half and second half
  const midpoint = Math.floor(analyses.length / 2);
  const recentHalf = analyses.slice(0, midpoint);
  const olderHalf = analyses.slice(midpoint);

  const recentAvg = calculateAverageFromAnalyses(recentHalf);
  const olderAvg = calculateAverageFromAnalyses(olderHalf);

  // Improvement is the difference, scaled to 0-100
  const improvement = recentAvg - olderAvg;
  // Scale: -50 to +50 improvement maps to 0-100
  const scaledScore = Math.round(Math.max(0, Math.min(100, 50 + improvement)));

  return scaledScore;
}

/**
 * Calculate average score from analyses
 */
function calculateAverageFromAnalyses(analyses: any[]): number {
  if (analyses.length === 0) return 50;

  let totalScore = 0;
  let count = 0;

  for (const analysis of analyses) {
    if (analysis.readability && typeof analysis.readability.score === "number") {
      totalScore += analysis.readability.score * 10; // Scale 0-10 to 0-100
      count++;
    }
  }

  return count > 0 ? totalScore / count : 50;
}

/**
 * Calculate average analysis score across all matches
 * @param userId - The user ID
 * @returns Average score (0-100)
 */
async function calculateAverageAnalysisScore(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT readability_score
     FROM match_analyses
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return 0;
  }

  let totalScore = 0;
  let count = 0;

  for (const row of result.rows) {
    const readability = typeof row.readability_score === "string" ? JSON.parse(row.readability_score) : row.readability_score;
    if (readability && typeof readability.score === "number") {
      totalScore += readability.score * 10; // Scale 0-10 to 0-100
      count++;
    }
  }

  return count > 0 ? Math.round(totalScore / count) : 0;
}

/**
 * Validate dashboard summary has all required fields
 * **Feature: ai-code-coach, Property 10: Dashboard summary completeness**
 * @param summary - The summary to validate
 * @returns True if all required fields are present with numeric values
 */
export function isValidDashboardSummary(summary: DashboardSummary | null): boolean {
  if (!summary) {
    return false;
  }

  return typeof summary.totalHintsUsed === "number" && !isNaN(summary.totalHintsUsed) && typeof summary.totalMatchesAnalyzed === "number" && !isNaN(summary.totalMatchesAnalyzed) && typeof summary.improvementScore === "number" && !isNaN(summary.improvementScore);
}

/**
 * Get skill progression timeline for a user
 * **Feature: ai-code-coach, Property 11: Timeline chronological ordering**
 * Requirements: 5.2
 * @param userId - The user ID
 * @returns Skill timeline with entries ordered by date ascending
 */
export async function getTimeline(userId: string): Promise<SkillTimeline> {
  // Get all analyses ordered by date ascending (oldest first)
  const result = await pool.query(
    `SELECT match_id, created_at, readability_score, time_complexity, space_complexity, algorithmic_approach
     FROM match_analyses
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );

  const entries: SkillTimelineEntry[] = result.rows.map((row) => {
    const readability = typeof row.readability_score === "string" ? JSON.parse(row.readability_score) : row.readability_score;
    const timeComplexity = typeof row.time_complexity === "string" ? JSON.parse(row.time_complexity) : row.time_complexity;
    const spaceComplexity = typeof row.space_complexity === "string" ? JSON.parse(row.space_complexity) : row.space_complexity;
    const algorithmicApproach = typeof row.algorithmic_approach === "string" ? JSON.parse(row.algorithmic_approach) : row.algorithmic_approach;

    // Calculate scores for each category
    const scores: CategoryScores = {
      time_complexity: timeComplexity && timeComplexity.detected === timeComplexity.optimal ? 100 : 50,
      space_complexity: spaceComplexity && spaceComplexity.detected === spaceComplexity.optimal ? 100 : 50,
      readability: readability ? readability.score * 10 : 50,
      patterns: algorithmicApproach && algorithmicApproach.detected === algorithmicApproach.suggested ? 100 : 50,
    };

    return {
      matchId: row.match_id,
      date: new Date(row.created_at),
      scores,
    };
  });

  return { entries };
}

/**
 * Validate timeline entries are in chronological order
 * **Feature: ai-code-coach, Property 11: Timeline chronological ordering**
 * @param timeline - The timeline to validate
 * @returns True if entries are ordered by date ascending
 */
export function isTimelineChronological(timeline: SkillTimeline): boolean {
  if (!timeline || !timeline.entries || timeline.entries.length <= 1) {
    return true;
  }

  for (let i = 1; i < timeline.entries.length; i++) {
    const prevDate = timeline.entries[i - 1].date.getTime();
    const currDate = timeline.entries[i].date.getTime();
    if (currDate < prevDate) {
      return false;
    }
  }

  return true;
}

/**
 * Get categorized feedback history for a user
 * **Feature: ai-code-coach, Property 12: Feedback categorization completeness**
 * Requirements: 5.3
 * @param userId - The user ID
 * @returns Array of category feedback with all required categories
 */
export async function getCategorizedFeedback(userId: string): Promise<CategoryFeedback[]> {
  // Get all analyses for the user
  const result = await pool.query(
    `SELECT match_id, created_at, time_complexity, space_complexity, readability_score, algorithmic_approach
     FROM match_analyses
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  // Initialize feedback for all required categories
  const feedbackMap: Record<string, CategoryFeedbackItem[]> = {
    time_complexity: [],
    space_complexity: [],
    readability: [],
    patterns: [],
  };

  for (const row of result.rows) {
    const matchId = row.match_id;
    const date = new Date(row.created_at);

    // Time complexity feedback
    const timeComplexity = typeof row.time_complexity === "string" ? JSON.parse(row.time_complexity) : row.time_complexity;
    if (timeComplexity && timeComplexity.explanation) {
      feedbackMap.time_complexity.push({
        matchId,
        date,
        feedback: `${timeComplexity.detected} detected (optimal: ${timeComplexity.optimal}). ${timeComplexity.explanation}`,
      });
    }

    // Space complexity feedback
    const spaceComplexity = typeof row.space_complexity === "string" ? JSON.parse(row.space_complexity) : row.space_complexity;
    if (spaceComplexity && spaceComplexity.explanation) {
      feedbackMap.space_complexity.push({
        matchId,
        date,
        feedback: `${spaceComplexity.detected} detected (optimal: ${spaceComplexity.optimal}). ${spaceComplexity.explanation}`,
      });
    }

    // Readability feedback
    const readability = typeof row.readability_score === "string" ? JSON.parse(row.readability_score) : row.readability_score;
    if (readability) {
      const improvements = readability.improvements || [];
      const strengths = readability.strengths || [];
      const feedbackParts = [];
      if (strengths.length > 0) feedbackParts.push(`Strengths: ${strengths.join(", ")}`);
      if (improvements.length > 0) feedbackParts.push(`Improvements: ${improvements.join(", ")}`);
      feedbackMap.readability.push({
        matchId,
        date,
        feedback: `Score: ${readability.score}/10. ${feedbackParts.join(". ")}`,
      });
    }

    // Patterns feedback (algorithmic approach)
    const algorithmicApproach = typeof row.algorithmic_approach === "string" ? JSON.parse(row.algorithmic_approach) : row.algorithmic_approach;
    if (algorithmicApproach && algorithmicApproach.explanation) {
      feedbackMap.patterns.push({
        matchId,
        date,
        feedback: `${algorithmicApproach.detected} approach used. ${algorithmicApproach.explanation}`,
      });
    }
  }

  // Convert to array format
  return REQUIRED_CATEGORIES.map((category) => ({
    category,
    feedbackItems: feedbackMap[category],
  }));
}

/**
 * Validate categorized feedback has all required categories
 * **Feature: ai-code-coach, Property 12: Feedback categorization completeness**
 * @param feedback - The feedback array to validate
 * @returns True if all required categories are present
 */
export function hasFeedbackForAllCategories(feedback: CategoryFeedback[]): boolean {
  if (!feedback || !Array.isArray(feedback)) {
    return false;
  }

  const categories = feedback.map((f) => f.category);
  return REQUIRED_CATEGORIES.every((cat) => categories.includes(cat));
}

/**
 * Get full analysis and hints for a specific match
 * **Feature: ai-code-coach, Property 13: Match analysis retrieval completeness**
 * Requirements: 5.4
 * @param matchId - The match ID
 * @param userId - The user ID
 * @returns Match detail with analysis and hints, or null if not found
 */
export async function getMatchDetail(matchId: string, userId: string): Promise<MatchDetail | null> {
  // Get analysis for the match
  const analysisResult = await pool.query(`SELECT * FROM match_analyses WHERE match_id = $1 AND user_id = $2`, [matchId, userId]);

  if (analysisResult.rows.length === 0) {
    return null;
  }

  const analysis = parseAnalysisRow(analysisResult.rows[0]);

  // Get hints for the match
  const hintsResult = await pool.query(`SELECT * FROM match_hints WHERE match_id = $1 AND user_id = $2 ORDER BY requested_at ASC`, [matchId, userId]);

  const hints: MatchHint[] = hintsResult.rows.map((row) => ({
    id: row.id,
    match_id: row.match_id,
    user_id: row.user_id,
    hint_level: row.hint_level,
    hint_content: row.hint_content,
    requested_at: new Date(row.requested_at),
    consumed: row.consumed,
  }));

  return {
    analysis,
    hints,
  };
}

/**
 * Validate match detail has both analysis and hints
 * **Feature: ai-code-coach, Property 13: Match analysis retrieval completeness**
 * @param detail - The match detail to validate
 * @returns True if both analysis and hints are present
 */
export function isMatchDetailComplete(detail: MatchDetail | null): boolean {
  if (!detail) {
    return false;
  }

  return detail.analysis !== null && detail.analysis !== undefined && detail.hints !== null && detail.hints !== undefined && Array.isArray(detail.hints);
}

/**
 * Get improvement trends for a user (last 10 matches)
 * **Feature: ai-code-coach, Property 14: Trend calculation window**
 * Requirements: 5.5
 * @param userId - The user ID
 * @returns Array of trend data for each category
 */
export async function getTrends(userId: string): Promise<TrendData[]> {
  // Get last 10 analyses ordered by date ascending
  const result = await pool.query(
    `SELECT match_id, created_at, readability_score, time_complexity, space_complexity, algorithmic_approach
     FROM match_analyses
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, TREND_WINDOW_SIZE]
  );

  // Reverse to get chronological order (oldest first)
  const rows = result.rows.reverse();

  // Build trend data for each category
  const trends: TrendData[] = REQUIRED_CATEGORIES.map((category) => {
    const dataPoints: Array<{ matchNumber: number; score: number }> = [];

    rows.forEach((row, index) => {
      let score = 50; // Default score

      if (category === "time_complexity") {
        const tc = typeof row.time_complexity === "string" ? JSON.parse(row.time_complexity) : row.time_complexity;
        score = tc && tc.detected === tc.optimal ? 100 : 50;
      } else if (category === "space_complexity") {
        const sc = typeof row.space_complexity === "string" ? JSON.parse(row.space_complexity) : row.space_complexity;
        score = sc && sc.detected === sc.optimal ? 100 : 50;
      } else if (category === "readability") {
        const rs = typeof row.readability_score === "string" ? JSON.parse(row.readability_score) : row.readability_score;
        score = rs ? rs.score * 10 : 50;
      } else if (category === "patterns") {
        const aa = typeof row.algorithmic_approach === "string" ? JSON.parse(row.algorithmic_approach) : row.algorithmic_approach;
        score = aa && aa.detected === aa.suggested ? 100 : 50;
      }

      dataPoints.push({
        matchNumber: index + 1,
        score,
      });
    });

    // Calculate trend direction
    const trend = calculateTrendDirection(dataPoints);

    return {
      category,
      dataPoints,
      trend,
    };
  });

  return trends;
}

/**
 * Calculate trend direction from data points
 * @param dataPoints - Array of score data points
 * @returns Trend direction
 */
function calculateTrendDirection(dataPoints: Array<{ matchNumber: number; score: number }>): "improving" | "stable" | "declining" {
  if (dataPoints.length < 2) {
    return "stable";
  }

  // Calculate simple linear regression slope
  const n = dataPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of dataPoints) {
    sumX += point.matchNumber;
    sumY += point.score;
    sumXY += point.matchNumber * point.score;
    sumX2 += point.matchNumber * point.matchNumber;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Threshold for determining trend
  if (slope > 2) {
    return "improving";
  } else if (slope < -2) {
    return "declining";
  }
  return "stable";
}

/**
 * Validate trend data uses at most 10 matches
 * **Feature: ai-code-coach, Property 14: Trend calculation window**
 * @param trends - The trend data to validate
 * @returns True if all trends have at most 10 data points
 */
export function isTrendWindowValid(trends: TrendData[]): boolean {
  if (!trends || !Array.isArray(trends)) {
    return false;
  }

  return trends.every((trend) => trend.dataPoints.length <= TREND_WINDOW_SIZE);
}

/**
 * Update coaching summary after a match is completed
 * Requirements: 5.1
 * @param userId - The user ID
 * @param hintsUsed - Number of hints used in the match
 * @returns Updated coaching summary
 */
export async function updateCoachingSummaryAfterMatch(userId: string, hintsUsed: number): Promise<CoachingSummary> {
  // Get or create coaching summary (ensures record exists before update)
  await getOrCreateCoachingSummary(userId);

  // Calculate new improvement score
  const improvementScore = await calculateImprovementScore(userId);

  // Update the summary
  const result = await pool.query(
    `UPDATE coaching_summaries 
     SET total_hints_used = total_hints_used + $1,
         total_matches_analyzed = total_matches_analyzed + 1,
         improvement_score = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $3
     RETURNING *`,
    [hintsUsed, improvementScore, userId]
  );

  return parseCoachingSummaryRow(result.rows[0]);
}

// Export constants for testing
export const CONSTANTS = {
  TREND_WINDOW_SIZE,
  REQUIRED_CATEGORIES,
};

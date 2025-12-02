/**
 * Weakness Service for AI Code Coach
 * Provides weakness detection, tracking, and profile management
 * Requirements: 4.1, 4.2, 4.3, 4.5, 7.4
 */

import pool from "../db/connection";
import { WeaknessProfile, WeaknessPattern, CategoryScores, MatchAnalysis } from "../db/types";

// Constants
const MIN_MATCHES_FOR_WEAKNESS_DETECTION = 5;
const MAX_WEAKNESS_PATTERNS_IN_SUMMARY = 3;
const TREND_WINDOW_SIZE = 10;

/**
 * Weakness summary structure
 * Requirements: 4.3
 */
export interface WeaknessSummary {
  topWeaknesses: WeaknessPattern[];
  strongestArea: string;
  improvementTrend: "improving" | "stable" | "declining";
}

/**
 * Result of weakness detection threshold check
 * Requirements: 4.2
 */
export interface WeaknessDetectionResult {
  hasEnoughData: boolean;
  matchesAnalyzed: number;
  requiredMatches: number;
}

/**
 * Parse a database row into WeaknessProfile
 */
function parseWeaknessProfileRow(row: any): WeaknessProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    patterns: typeof row.patterns === "string" ? JSON.parse(row.patterns) : row.patterns,
    category_scores: typeof row.category_scores === "string" ? JSON.parse(row.category_scores) : row.category_scores,
    matches_analyzed: row.matches_analyzed,
    last_updated: new Date(row.last_updated),
  };
}

/**
 * Get weakness profile for a user
 * @param userId - The user ID
 * @returns The weakness profile or null if not found
 */
export async function getWeaknessProfile(userId: string): Promise<WeaknessProfile | null> {
  const result = await pool.query(`SELECT * FROM weakness_profiles WHERE user_id = $1`, [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return parseWeaknessProfileRow(result.rows[0]);
}

/**
 * Create a new weakness profile for a user
 * Requirements: 4.1
 * @param userId - The user ID
 * @returns The created weakness profile
 */
export async function createWeaknessProfile(userId: string): Promise<WeaknessProfile> {
  const initialScores: CategoryScores = {
    time_complexity: 0,
    space_complexity: 0,
    readability: 0,
    patterns: 0,
  };

  const result = await pool.query(
    `INSERT INTO weakness_profiles (user_id, patterns, category_scores, matches_analyzed, last_updated)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     RETURNING *`,
    [userId, JSON.stringify([]), JSON.stringify(initialScores), 0]
  );

  return parseWeaknessProfileRow(result.rows[0]);
}

/**
 * Get or create weakness profile for a user
 * Requirements: 4.1
 * @param userId - The user ID
 * @returns The weakness profile
 */
export async function getOrCreateWeaknessProfile(userId: string): Promise<WeaknessProfile> {
  const existing = await getWeaknessProfile(userId);
  if (existing) {
    return existing;
  }
  return createWeaknessProfile(userId);
}

/**
 * Extract weakness patterns from a match analysis
 * Requirements: 4.1, 7.4
 * @param analysis - The match analysis
 * @returns Array of weakness patterns detected
 */
export function extractPatternsFromAnalysis(analysis: MatchAnalysis): WeaknessPattern[] {
  const patterns: WeaknessPattern[] = [];
  const now = new Date();

  // Check time complexity issues
  if (analysis.time_complexity && analysis.time_complexity.detected !== analysis.time_complexity.optimal) {
    patterns.push({
      category: "time_complexity",
      pattern: `Suboptimal time complexity: ${analysis.time_complexity.detected} instead of ${analysis.time_complexity.optimal}`,
      frequency: 1,
      last_seen: now,
    });
  }

  // Check space complexity issues
  if (analysis.space_complexity && analysis.space_complexity.detected !== analysis.space_complexity.optimal) {
    patterns.push({
      category: "space_complexity",
      pattern: `Suboptimal space complexity: ${analysis.space_complexity.detected} instead of ${analysis.space_complexity.optimal}`,
      frequency: 1,
      last_seen: now,
    });
  }

  // Check readability issues
  if (analysis.readability_score && analysis.readability_score.score < 7) {
    const improvements = analysis.readability_score.improvements || [];
    if (improvements.length > 0) {
      patterns.push({
        category: "readability",
        pattern: `Readability issue: ${improvements[0]}`,
        frequency: 1,
        last_seen: now,
      });
    }
  }

  // Check algorithmic approach issues
  if (analysis.algorithmic_approach && analysis.algorithmic_approach.detected !== analysis.algorithmic_approach.suggested) {
    patterns.push({
      category: "patterns",
      pattern: `Suboptimal approach: ${analysis.algorithmic_approach.detected} instead of ${analysis.algorithmic_approach.suggested}`,
      frequency: 1,
      last_seen: now,
    });
  }

  // Check for bugs
  if (analysis.bug_analysis && analysis.bug_analysis.hasBugs && analysis.bug_analysis.bugs.length > 0) {
    patterns.push({
      category: "patterns",
      pattern: `Bug pattern: ${analysis.bug_analysis.bugs[0].description}`,
      frequency: 1,
      last_seen: now,
    });
  }

  return patterns;
}

/**
 * Calculate category scores from analysis
 * Requirements: 4.1
 * @param analysis - The match analysis
 * @returns Category scores (0-100)
 */
export function calculateCategoryScoresFromAnalysis(analysis: MatchAnalysis): CategoryScores {
  // Time complexity score: 100 if optimal, lower if suboptimal
  let timeScore = 100;
  if (analysis.time_complexity && analysis.time_complexity.detected !== analysis.time_complexity.optimal) {
    timeScore = 50; // Suboptimal
  }

  // Space complexity score: 100 if optimal, lower if suboptimal
  let spaceScore = 100;
  if (analysis.space_complexity && analysis.space_complexity.detected !== analysis.space_complexity.optimal) {
    spaceScore = 50;
  }

  // Readability score: Convert 0-10 to 0-100
  const readabilityScore = analysis.readability_score ? analysis.readability_score.score * 10 : 50;

  // Patterns score: Based on algorithmic approach and bugs
  let patternsScore = 100;
  if (analysis.algorithmic_approach && analysis.algorithmic_approach.detected !== analysis.algorithmic_approach.suggested) {
    patternsScore -= 25;
  }
  if (analysis.bug_analysis && analysis.bug_analysis.hasBugs) {
    patternsScore -= 25 * Math.min(analysis.bug_analysis.bugs.length, 2);
  }
  patternsScore = Math.max(0, patternsScore);

  return {
    time_complexity: timeScore,
    space_complexity: spaceScore,
    readability: readabilityScore,
    patterns: patternsScore,
  };
}

/**
 * Merge new patterns with existing patterns, updating frequencies
 * **Feature: ai-code-coach, Property 20: Weakness aggregation consistency**
 * Requirements: 7.4
 * @param existingPatterns - Current patterns in profile
 * @param newPatterns - New patterns from analysis
 * @returns Merged patterns array
 */
export function mergePatterns(existingPatterns: WeaknessPattern[], newPatterns: WeaknessPattern[]): WeaknessPattern[] {
  const patternMap = new Map<string, WeaknessPattern>();

  // Add existing patterns to map
  for (const pattern of existingPatterns) {
    const key = `${pattern.category}:${pattern.pattern}`;
    patternMap.set(key, { ...pattern });
  }

  // Merge new patterns
  for (const newPattern of newPatterns) {
    const key = `${newPattern.category}:${newPattern.pattern}`;
    const existing = patternMap.get(key);

    if (existing) {
      // Update frequency and last_seen
      existing.frequency += newPattern.frequency;
      existing.last_seen = newPattern.last_seen;
    } else {
      // Add new pattern
      patternMap.set(key, { ...newPattern });
    }
  }

  return Array.from(patternMap.values());
}

/**
 * Calculate weighted average of category scores
 * @param existingScores - Current scores
 * @param newScores - New scores from analysis
 * @param matchesAnalyzed - Number of matches already analyzed
 * @returns Updated category scores
 */
export function updateCategoryScores(existingScores: CategoryScores, newScores: CategoryScores, matchesAnalyzed: number): CategoryScores {
  // Use weighted average: (existing * count + new) / (count + 1)
  const weight = matchesAnalyzed;
  const newWeight = weight + 1;

  return {
    time_complexity: Math.round((existingScores.time_complexity * weight + newScores.time_complexity) / newWeight),
    space_complexity: Math.round((existingScores.space_complexity * weight + newScores.space_complexity) / newWeight),
    readability: Math.round((existingScores.readability * weight + newScores.readability) / newWeight),
    patterns: Math.round((existingScores.patterns * weight + newScores.patterns) / newWeight),
  };
}

/**
 * Update weakness profile after a match analysis
 * **Feature: ai-code-coach, Property 9: Weakness profile freshness**
 * Requirements: 4.1, 4.5
 * @param userId - The user ID
 * @param analysis - The match analysis
 * @returns Updated weakness profile
 */
export async function updateWeaknessProfile(userId: string, analysis: MatchAnalysis): Promise<WeaknessProfile> {
  // Get or create profile
  const profile = await getOrCreateWeaknessProfile(userId);

  // Extract patterns from analysis
  const newPatterns = extractPatternsFromAnalysis(analysis);

  // Merge patterns
  const mergedPatterns = mergePatterns(profile.patterns, newPatterns);

  // Calculate new category scores
  const newScores = calculateCategoryScoresFromAnalysis(analysis);
  const updatedScores = updateCategoryScores(profile.category_scores, newScores, profile.matches_analyzed);

  // Update profile in database
  const result = await pool.query(
    `UPDATE weakness_profiles 
     SET patterns = $1, 
         category_scores = $2, 
         matches_analyzed = matches_analyzed + 1,
         last_updated = CURRENT_TIMESTAMP
     WHERE user_id = $3
     RETURNING *`,
    [JSON.stringify(mergedPatterns), JSON.stringify(updatedScores), userId]
  );

  return parseWeaknessProfileRow(result.rows[0]);
}

/**
 * Check if user has enough data for weakness detection
 * **Feature: ai-code-coach, Property 7: Weakness detection threshold**
 * Requirements: 4.2
 * @param userId - The user ID
 * @returns Detection result with data status
 */
export async function hasEnoughDataForWeaknessDetection(userId: string): Promise<WeaknessDetectionResult> {
  const profile = await getWeaknessProfile(userId);

  if (!profile) {
    return {
      hasEnoughData: false,
      matchesAnalyzed: 0,
      requiredMatches: MIN_MATCHES_FOR_WEAKNESS_DETECTION,
    };
  }

  return {
    hasEnoughData: profile.matches_analyzed >= MIN_MATCHES_FOR_WEAKNESS_DETECTION,
    matchesAnalyzed: profile.matches_analyzed,
    requiredMatches: MIN_MATCHES_FOR_WEAKNESS_DETECTION,
  };
}

/**
 * Get weakness summary for a user
 * **Feature: ai-code-coach, Property 8: Weakness summary size**
 * Requirements: 4.3
 * @param userId - The user ID
 * @returns Weakness summary with top 3 weaknesses
 */
export async function getWeaknessSummary(userId: string): Promise<WeaknessSummary | null> {
  const profile = await getWeaknessProfile(userId);

  if (!profile) {
    return null;
  }

  // Sort patterns by frequency (descending) and get top 3
  const sortedPatterns = [...profile.patterns].sort((a, b) => b.frequency - a.frequency);
  const topWeaknesses = sortedPatterns.slice(0, MAX_WEAKNESS_PATTERNS_IN_SUMMARY);

  // Find strongest area (highest score)
  const scores = profile.category_scores;
  const categories: Array<{ name: string; score: number }> = [
    { name: "time_complexity", score: scores.time_complexity },
    { name: "space_complexity", score: scores.space_complexity },
    { name: "readability", score: scores.readability },
    { name: "patterns", score: scores.patterns },
  ];
  const strongest = categories.reduce((max, cat) => (cat.score > max.score ? cat : max));
  const strongestArea = strongest.name;

  // Calculate improvement trend
  const improvementTrend = calculateImprovementTrend(profile);

  return {
    topWeaknesses,
    strongestArea,
    improvementTrend,
  };
}

/**
 * Calculate improvement trend from profile data
 * Requirements: 4.3
 * @param profile - The weakness profile
 * @returns Trend direction
 */
function calculateImprovementTrend(profile: WeaknessProfile): "improving" | "stable" | "declining" {
  // If not enough data, return stable
  if (profile.matches_analyzed < 3) {
    return "stable";
  }

  // Calculate average score
  const scores = profile.category_scores;
  const avgScore = (scores.time_complexity + scores.space_complexity + scores.readability + scores.patterns) / 4;

  // Simple heuristic: if average score > 70, improving; < 50, declining; else stable
  if (avgScore >= 70) {
    return "improving";
  } else if (avgScore < 50) {
    return "declining";
  }
  return "stable";
}

/**
 * Get pre-match tip based on user's weaknesses
 * Requirements: 4.4
 * @param userId - The user ID
 * @param challengeCategory - The challenge category
 * @returns A tip string or null if no relevant weakness
 */
export async function getPreMatchTip(userId: string, _challengeCategory: string): Promise<string | null> {
  const profile = await getWeaknessProfile(userId);

  if (!profile || profile.matches_analyzed < MIN_MATCHES_FOR_WEAKNESS_DETECTION) {
    return null;
  }

  // Find most frequent weakness pattern
  const sortedPatterns = [...profile.patterns].sort((a, b) => b.frequency - a.frequency);

  if (sortedPatterns.length === 0) {
    return null;
  }

  const topWeakness = sortedPatterns[0];

  // Generate tip based on weakness category
  const tips: Record<string, string> = {
    time_complexity: "Focus on optimizing your algorithm's time complexity. Consider using more efficient data structures.",
    space_complexity: "Watch your memory usage. Try to minimize auxiliary space in your solution.",
    readability: "Take time to write clean, readable code. Use meaningful variable names and add comments.",
    patterns: "Review common algorithmic patterns. Consider if there's a more elegant approach to the problem.",
  };

  return tips[topWeakness.category] || null;
}

/**
 * Get total pattern frequency sum for a profile
 * **Feature: ai-code-coach, Property 20: Weakness aggregation consistency**
 * Requirements: 7.4
 * @param profile - The weakness profile
 * @returns Sum of all pattern frequencies
 */
export function getTotalPatternFrequency(profile: WeaknessProfile): number {
  return profile.patterns.reduce((sum, pattern) => sum + pattern.frequency, 0);
}

/**
 * Validate weakness profile has required fields
 * @param profile - The profile to validate
 * @returns True if profile is valid
 */
export function isValidWeaknessProfile(profile: WeaknessProfile | null): boolean {
  if (!profile) {
    return false;
  }

  return profile.id !== null && profile.id !== undefined && profile.user_id !== null && profile.user_id !== undefined && profile.patterns !== null && profile.patterns !== undefined && Array.isArray(profile.patterns) && profile.category_scores !== null && profile.category_scores !== undefined && profile.matches_analyzed !== null && profile.matches_analyzed !== undefined && profile.last_updated !== null && profile.last_updated !== undefined;
}

// Export constants for testing
export const CONSTANTS = {
  MIN_MATCHES_FOR_WEAKNESS_DETECTION,
  MAX_WEAKNESS_PATTERNS_IN_SUMMARY,
  TREND_WINDOW_SIZE,
};

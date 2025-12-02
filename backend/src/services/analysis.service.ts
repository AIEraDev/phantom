/**
 * Analysis Service for AI Code Coach
 * Provides post-match code analysis with complexity evaluation, suggestions, and bug detection
 * Requirements: 3.2, 3.4, 3.5, 7.1, 7.2, 7.3
 */

import pool from "../db/connection";
import { MatchAnalysis, NewMatchAnalysis, ComplexityAnalysis, ReadabilityScore, AlgorithmicApproach, BugAnalysis, Challenge } from "../db/types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { rateLimitService, RATE_LIMITS } from "../redis/rateLimit.service";
import { getHintCount } from "./hint.service";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Constants
const MIN_SUGGESTIONS = 3;
const MAX_SUGGESTIONS = 5;
const ANALYSIS_TIMEOUT_MS = 10000; // 10 seconds per requirement 3.1

/**
 * Test result structure for analysis context
 */
export interface TestResult {
  passed: boolean;
  input: any;
  expectedOutput: any;
  actualOutput?: any;
  error?: string;
}

/**
 * Raw analysis response from Gemini
 */
export interface RawAnalysisResponse {
  timeComplexity: {
    detected: string;
    optimal: string;
    explanation: string;
  };
  spaceComplexity: {
    detected: string;
    optimal: string;
    explanation: string;
  };
  readabilityScore: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
  algorithmicApproach: {
    detected: string;
    suggested: string;
    explanation: string;
  };
  suggestions: string[];
  bugAnalysis: {
    hasBugs: boolean;
    bugs: Array<{
      location: string;
      description: string;
      suggestion: string;
    }>;
  };
}

/**
 * Analysis generation context
 */
export interface AnalysisContext {
  matchId: string;
  userId: string;
  code: string;
  language: string;
  challengeDescription: string;
  testResults: TestResult[];
  isWinner: boolean;
}

/**
 * Build the Gemini prompt for post-match analysis
 * Requirements: 3.2, 3.4, 3.5
 * @param context - The analysis context
 * @returns The formatted prompt string
 */
export function buildAnalysisPrompt(context: AnalysisContext): string {
  const { code, language, challengeDescription, testResults, isWinner } = context;

  // Format test results
  const passedTests = testResults.filter((t) => t.passed).length;
  const totalTests = testResults.length;
  const failedTests = testResults.filter((t) => !t.passed);

  let testResultsStr = `Passed: ${passedTests}/${totalTests} tests`;
  if (failedTests.length > 0) {
    testResultsStr += "\n\nFailed tests:";
    failedTests.forEach((t, i) => {
      testResultsStr += `\n${i + 1}. Input: ${JSON.stringify(t.input)}`;
      testResultsStr += `\n   Expected: ${JSON.stringify(t.expectedOutput)}`;
      if (t.actualOutput !== undefined) {
        testResultsStr += `\n   Got: ${JSON.stringify(t.actualOutput)}`;
      }
      if (t.error) {
        testResultsStr += `\n   Error: ${t.error}`;
      }
    });
  }

  const winnerContext = isWinner ? "The player WON this match. Highlight their strengths while still suggesting optimizations." : "The player lost this match. Focus on constructive feedback to help them improve.";

  return `You are an AI coding coach analyzing a player's code after a competitive coding match. Provide comprehensive, educational feedback.

CHALLENGE DESCRIPTION:
${challengeDescription}

PLAYER'S CODE (${language}):
\`\`\`${language}
${code}
\`\`\`

TEST RESULTS:
${testResultsStr}

MATCH OUTCOME: ${winnerContext}

Analyze the code and provide feedback in the following areas:

1. TIME COMPLEXITY: Detect the time complexity of the solution and compare to optimal
2. SPACE COMPLEXITY: Detect the space complexity and compare to optimal
3. READABILITY: Score from 0-10 with specific strengths and areas for improvement
4. ALGORITHMIC APPROACH: Identify the approach used and suggest alternatives if applicable
5. SUGGESTIONS: Provide 3-5 specific, actionable improvement suggestions
6. BUG ANALYSIS: If tests failed, identify bug locations and explain the logical errors

CRITICAL RULES:
1. Be encouraging and educational, not discouraging
2. Provide exactly 3-5 suggestions (no more, no less)
3. If the player won, still suggest optimizations
4. For bug analysis, only include bugs if tests actually failed
5. Use Big O notation for complexity (e.g., "O(n)", "O(n log n)", "O(n²)")

Return your analysis ONLY as valid JSON in this exact format (no markdown, no explanation):
{
  "timeComplexity": {
    "detected": "<Big O notation>",
    "optimal": "<Big O notation>",
    "explanation": "<brief explanation>"
  },
  "spaceComplexity": {
    "detected": "<Big O notation>",
    "optimal": "<Big O notation>",
    "explanation": "<brief explanation>"
  },
  "readabilityScore": {
    "score": <number 0-10>,
    "strengths": ["<strength 1>", "<strength 2>"],
    "improvements": ["<improvement 1>", "<improvement 2>"]
  },
  "algorithmicApproach": {
    "detected": "<approach name>",
    "suggested": "<better approach if applicable, or same as detected>",
    "explanation": "<brief explanation>"
  },
  "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"],
  "bugAnalysis": {
    "hasBugs": <true/false>,
    "bugs": [
      {
        "location": "<line number or code section>",
        "description": "<what's wrong>",
        "suggestion": "<how to fix>"
      }
    ]
  }
}`;
}

/**
 * Validate and normalize the raw analysis response
 * Requirements: 3.2, 3.4
 * @param raw - The raw response from Gemini
 * @returns Validated analysis or null if invalid
 */
export function validateAnalysisResponse(raw: any): RawAnalysisResponse | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  // Validate time complexity
  if (!isValidComplexityAnalysis(raw.timeComplexity)) {
    return null;
  }

  // Validate space complexity
  if (!isValidComplexityAnalysis(raw.spaceComplexity)) {
    return null;
  }

  // Validate readability score
  if (!isValidReadabilityScore(raw.readabilityScore)) {
    return null;
  }

  // Validate algorithmic approach
  if (!isValidAlgorithmicApproach(raw.algorithmicApproach)) {
    return null;
  }

  // Validate suggestions (must be 3-5 items)
  if (!isValidSuggestions(raw.suggestions)) {
    // Try to normalize suggestions
    raw.suggestions = normalizeSuggestions(raw.suggestions);
    if (!isValidSuggestions(raw.suggestions)) {
      return null;
    }
  }

  // Validate bug analysis
  if (!isValidBugAnalysis(raw.bugAnalysis)) {
    // Provide default if missing
    raw.bugAnalysis = { hasBugs: false, bugs: [] };
  }

  return raw as RawAnalysisResponse;
}

/**
 * Check if complexity analysis is valid
 */
function isValidComplexityAnalysis(obj: any): obj is ComplexityAnalysis {
  return obj && typeof obj === "object" && typeof obj.detected === "string" && typeof obj.optimal === "string" && typeof obj.explanation === "string";
}

/**
 * Check if readability score is valid
 */
function isValidReadabilityScore(obj: any): obj is ReadabilityScore {
  return obj && typeof obj === "object" && typeof obj.score === "number" && obj.score >= 0 && obj.score <= 10 && Array.isArray(obj.strengths) && Array.isArray(obj.improvements);
}

/**
 * Check if algorithmic approach is valid
 */
function isValidAlgorithmicApproach(obj: any): obj is AlgorithmicApproach {
  return obj && typeof obj === "object" && typeof obj.detected === "string" && typeof obj.suggested === "string" && typeof obj.explanation === "string";
}

/**
 * Check if suggestions array is valid (3-5 items)
 * **Feature: ai-code-coach, Property 6: Suggestion count bounds**
 */
export function isValidSuggestions(arr: any): arr is string[] {
  return Array.isArray(arr) && arr.length >= MIN_SUGGESTIONS && arr.length <= MAX_SUGGESTIONS && arr.every((item) => typeof item === "string" && item.length > 0);
}

/**
 * Normalize suggestions to ensure 3-5 items
 */
function normalizeSuggestions(arr: any): string[] {
  if (!Array.isArray(arr)) {
    return ["Review your solution for potential optimizations", "Consider edge cases in your implementation", "Practice similar problems to improve pattern recognition"];
  }

  // Filter to valid strings
  const validSuggestions = arr.filter((item) => typeof item === "string" && item.length > 0);

  // If too few, add generic suggestions
  while (validSuggestions.length < MIN_SUGGESTIONS) {
    const genericSuggestions = ["Review your solution for potential optimizations", "Consider edge cases in your implementation", "Practice similar problems to improve pattern recognition", "Focus on code readability and maintainability", "Consider time-space tradeoffs in your approach"];
    const toAdd = genericSuggestions[validSuggestions.length];
    if (toAdd && !validSuggestions.includes(toAdd)) {
      validSuggestions.push(toAdd);
    } else {
      break;
    }
  }

  // If too many, truncate
  if (validSuggestions.length > MAX_SUGGESTIONS) {
    return validSuggestions.slice(0, MAX_SUGGESTIONS);
  }

  return validSuggestions;
}

/**
 * Check if bug analysis is valid
 */
function isValidBugAnalysis(obj: any): obj is BugAnalysis {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  if (typeof obj.hasBugs !== "boolean") {
    return false;
  }
  if (!Array.isArray(obj.bugs)) {
    return false;
  }
  return obj.bugs.every((bug: any) => bug && typeof bug === "object" && typeof bug.location === "string" && typeof bug.description === "string" && typeof bug.suggestion === "string");
}

/**
 * Generate fallback analysis when AI is unavailable
 */
function generateFallbackAnalysis(context: AnalysisContext): RawAnalysisResponse {
  const { testResults, isWinner } = context;
  const passedTests = testResults.filter((t) => t.passed).length;
  const totalTests = testResults.length;
  const passRate = totalTests > 0 ? passedTests / totalTests : 0;

  const readabilityScore = Math.round(passRate * 7 + 3); // 3-10 based on pass rate

  const suggestions = isWinner ? ["Great job! Consider optimizing your solution for better time complexity", "Review edge cases to ensure robustness", "Practice explaining your approach to improve communication skills"] : ["Review the failing test cases to understand the edge cases", "Consider breaking down the problem into smaller steps", "Practice similar problems to build pattern recognition"];

  const bugs: BugAnalysis["bugs"] = [];
  if (!isWinner && testResults.some((t) => !t.passed)) {
    bugs.push({
      location: "Solution logic",
      description: "Some test cases failed - review your algorithm",
      suggestion: "Check edge cases and boundary conditions",
    });
  }

  return {
    timeComplexity: {
      detected: "Unable to analyze",
      optimal: "Varies by problem",
      explanation: "AI analysis unavailable - review manually",
    },
    spaceComplexity: {
      detected: "Unable to analyze",
      optimal: "Varies by problem",
      explanation: "AI analysis unavailable - review manually",
    },
    readabilityScore: {
      score: readabilityScore,
      strengths: ["Code submitted successfully"],
      improvements: ["Consider adding comments for clarity"],
    },
    algorithmicApproach: {
      detected: "Unable to determine",
      suggested: "Review optimal approaches for this problem type",
      explanation: "AI analysis unavailable - review manually",
    },
    suggestions,
    bugAnalysis: {
      hasBugs: bugs.length > 0,
      bugs,
    },
  };
}

/**
 * Generate post-match analysis using Gemini AI
 * Requirements: 3.1, 3.2, 3.4, 3.5
 * @param context - The analysis context
 * @returns Generated analysis or fallback
 */
export async function generateAnalysisWithAI(context: AnalysisContext): Promise<RawAnalysisResponse> {
  const { userId } = context;

  // Check if API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.log("Gemini API key not configured, using fallback analysis");
    return generateFallbackAnalysis(context);
  }

  // Check rate limit
  const rateLimitResult = await rateLimitService.checkRateLimit(userId, "gemini-api", RATE_LIMITS.CLAUDE_API);
  if (!rateLimitResult.allowed) {
    console.log(`Rate limit exceeded for user ${userId}, using fallback analysis`);
    return generateFallbackAnalysis(context);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = buildAnalysisPrompt(context);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not extract JSON from Gemini response");
      return generateFallbackAnalysis(context);
    }

    const rawAnalysis = JSON.parse(jsonMatch[0]);
    const validated = validateAnalysisResponse(rawAnalysis);

    if (!validated) {
      console.error("Invalid analysis structure from Gemini");
      return generateFallbackAnalysis(context);
    }

    return validated;
  } catch (error) {
    console.error("Gemini API error during analysis generation:", error);
    return generateFallbackAnalysis(context);
  }
}

/**
 * Store analysis in the database
 * **Feature: ai-code-coach, Property 18: Analysis persistence structure**
 * Requirements: 7.1, 7.2
 * @param analysis - The analysis data to store
 * @returns The stored analysis with ID
 */
export async function storeAnalysis(analysis: NewMatchAnalysis): Promise<MatchAnalysis> {
  const result = await pool.query(
    `INSERT INTO match_analyses (
      match_id, user_id, time_complexity, space_complexity, 
      readability_score, algorithmic_approach, suggestions, 
      bug_analysis, hints_used
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [analysis.match_id, analysis.user_id, JSON.stringify(analysis.time_complexity), JSON.stringify(analysis.space_complexity), JSON.stringify(analysis.readability_score), JSON.stringify(analysis.algorithmic_approach), JSON.stringify(analysis.suggestions), JSON.stringify(analysis.bug_analysis), analysis.hints_used]
  );

  return parseAnalysisRow(result.rows[0]);
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
 * Get analysis for a specific match and user
 * @param matchId - The match ID
 * @param userId - The user ID
 * @returns The analysis or null if not found
 */
export async function getAnalysis(matchId: string, userId: string): Promise<MatchAnalysis | null> {
  const result = await pool.query(`SELECT * FROM match_analyses WHERE match_id = $1 AND user_id = $2`, [matchId, userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return parseAnalysisRow(result.rows[0]);
}

/**
 * Pagination result for analysis history
 */
export interface PaginatedAnalysisHistory {
  analyses: MatchAnalysis[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Get analysis history for a user with pagination
 * **Feature: ai-code-coach, Property 19: Pagination correctness**
 * Requirements: 7.3
 * @param userId - The user ID
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of items per page
 * @returns Paginated analysis history
 */
export async function getAnalysisHistory(userId: string, page: number = 1, pageSize: number = 10): Promise<PaginatedAnalysisHistory> {
  // Ensure valid pagination parameters
  const validPage = Math.max(1, page);
  const validPageSize = Math.min(Math.max(1, pageSize), 100); // Cap at 100
  const offset = (validPage - 1) * validPageSize;

  // Get total count
  const countResult = await pool.query(`SELECT COUNT(*) as total FROM match_analyses WHERE user_id = $1`, [userId]);
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results ordered by created_at descending
  const result = await pool.query(
    `SELECT * FROM match_analyses 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [userId, validPageSize, offset]
  );

  return {
    analyses: result.rows.map(parseAnalysisRow),
    total,
    page: validPage,
    pageSize: validPageSize,
  };
}

/**
 * Generate and store post-match analysis
 * This is the main entry point for analysis generation
 * Requirements: 3.1, 3.2, 3.4, 3.5, 7.1, 7.2
 * @param matchId - The match ID
 * @param userId - The user ID
 * @param code - The player's submitted code
 * @param language - The programming language
 * @param challenge - The challenge data
 * @param testResults - The test results
 * @param isWinner - Whether the player won
 * @returns The generated and stored analysis
 */
export async function generateAnalysis(matchId: string, userId: string, code: string, language: string, challenge: Challenge, testResults: TestResult[], isWinner: boolean): Promise<MatchAnalysis> {
  // Check if analysis already exists
  const existing = await getAnalysis(matchId, userId);
  if (existing) {
    return existing;
  }

  // Build context
  const context: AnalysisContext = {
    matchId,
    userId,
    code,
    language,
    challengeDescription: challenge.description,
    testResults,
    isWinner,
  };

  // Generate analysis with AI
  const rawAnalysis = await generateAnalysisWithAI(context);

  // Get hint count for this match
  const hintsUsed = await getHintCount(matchId, userId);

  // Store analysis
  const newAnalysis: NewMatchAnalysis = {
    match_id: matchId,
    user_id: userId,
    time_complexity: rawAnalysis.timeComplexity,
    space_complexity: rawAnalysis.spaceComplexity,
    readability_score: rawAnalysis.readabilityScore,
    algorithmic_approach: rawAnalysis.algorithmicApproach,
    suggestions: rawAnalysis.suggestions,
    bug_analysis: rawAnalysis.bugAnalysis,
    hints_used: hintsUsed,
  };

  return storeAnalysis(newAnalysis);
}

/**
 * Check if an analysis has all required fields
 * **Feature: ai-code-coach, Property 5: Analysis structure completeness**
 * @param analysis - The analysis to check
 * @returns True if all required fields are present and non-null
 */
export function isAnalysisComplete(analysis: MatchAnalysis | null): boolean {
  if (!analysis) {
    return false;
  }

  return analysis.time_complexity !== null && analysis.time_complexity !== undefined && analysis.space_complexity !== null && analysis.space_complexity !== undefined && analysis.readability_score !== null && analysis.readability_score !== undefined && analysis.algorithmic_approach !== null && analysis.algorithmic_approach !== undefined;
}

/**
 * Check if stored analysis has all required persistence fields
 * **Feature: ai-code-coach, Property 18: Analysis persistence structure**
 * @param analysis - The analysis to check
 * @returns True if all required persistence fields are present
 */
export function hasRequiredPersistenceFields(analysis: MatchAnalysis | null): boolean {
  if (!analysis) {
    return false;
  }

  return analysis.created_at !== null && analysis.created_at !== undefined && analysis.match_id !== null && analysis.match_id !== undefined && analysis.user_id !== null && analysis.user_id !== undefined && analysis.hints_used !== null && analysis.hints_used !== undefined && analysis.suggestions !== null && analysis.suggestions !== undefined;
}

// Export constants for testing
export const CONSTANTS = {
  MIN_SUGGESTIONS,
  MAX_SUGGESTIONS,
  ANALYSIS_TIMEOUT_MS,
};

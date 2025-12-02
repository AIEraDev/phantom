/**
 * Hint Service for AI Code Coach
 * Provides real-time hints during matches with cooldown and limit enforcement
 * Requirements: 1.3, 1.5, 1.6, 2.4, 6.1, 6.2, 6.4, 6.5
 */

import { getRedisClient } from "../redis/connection";
import pool from "../db/connection";
import { MatchHint, NewMatchHint, TestCase, Challenge } from "../db/types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { rateLimitService, RATE_LIMITS } from "../redis/rateLimit.service";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Constants
const HINT_COOLDOWN_SECONDS = 60;
const MAX_HINTS_PER_MATCH = 3;
const HINT_SCORE_PENALTY_PERCENT = 0.05;

export interface HintStatus {
  allowed: boolean;
  reason?: string;
  cooldownRemaining?: number;
  hintsRemaining?: number;
  hintsUsed?: number;
}

export interface HintResponse {
  id: string;
  content: string;
  level: number;
  levelIndicator: string;
  consumed: boolean;
  cooldownRemaining: number;
}

/**
 * Request context for generating a hint
 * **Feature: ai-code-coach, Property 15: Hint context completeness**
 */
export interface HintGenerationContext {
  challengeDescription: string;
  visibleTestCases: TestCase[];
  currentCode: string;
  language: string;
  hintLevel: number; // 1, 2, or 3
  playerRating?: number;
}

/**
 * Full hint request with all required data
 */
export interface HintRequest {
  matchId: string;
  userId: string;
  challengeId: string;
  currentCode: string;
  language: string;
  hintLevel: number;
}

/**
 * Challenge category for fallback hints
 */
export type ChallengeCategory = "arrays" | "strings" | "sorting" | "searching" | "dynamic-programming" | "trees" | "graphs" | "recursion" | "math" | "general";

/**
 * Get Redis key for hint cooldown tracking
 */
function getHintCooldownKey(matchId: string, userId: string): string {
  return `hint:cooldown:${matchId}:${userId}`;
}

/**
 * Get Redis key for hint count tracking
 */
function getHintCountKey(matchId: string, userId: string): string {
  return `hint:count:${matchId}:${userId}`;
}

/**
 * Get the hint level indicator string (e.g., "1/3", "2/3", "3/3")
 * **Feature: ai-code-coach, Property 4: Hint level indicator correctness**
 * @param hintLevel - The hint level (1, 2, or 3)
 * @returns The level indicator string in format "N/3"
 */
export function getHintLevelIndicator(hintLevel: number): string {
  return `${hintLevel}/3`;
}

/**
 * Calculate score penalty based on hints used
 * **Feature: ai-code-coach, Property 2: Hint score penalty calculation**
 * Formula: finalScore = baseScore * (1 - 0.05 * hintCount)
 * @param baseScore - The original score before penalty
 * @param hintsUsed - Number of hints used (capped at 3)
 * @returns The final score after applying penalty
 */
export function calculateScorePenalty(baseScore: number, hintsUsed: number): number {
  // Cap hints at MAX_HINTS_PER_MATCH (3)
  const cappedHints = Math.min(Math.max(0, hintsUsed), MAX_HINTS_PER_MATCH);
  const penaltyMultiplier = 1 - HINT_SCORE_PENALTY_PERCENT * cappedHints;
  return baseScore * penaltyMultiplier;
}

/**
 * Check if a user can request a hint (cooldown and limit checks)
 * **Feature: ai-code-coach, Property 1: Hint cooldown enforcement**
 * **Feature: ai-code-coach, Property 3: Hint limit enforcement**
 * @param matchId - The match ID
 * @param userId - The user ID
 * @returns HintStatus indicating if hint request is allowed
 */
export async function canRequestHint(matchId: string, userId: string): Promise<HintStatus> {
  const redis = await getRedisClient();

  // Check hint count from Redis
  const countKey = getHintCountKey(matchId, userId);
  const hintCountStr = await redis.get(countKey);
  const hintsUsed = hintCountStr ? parseInt(hintCountStr, 10) : 0;

  // Check if limit reached (max 3 hints per match)
  if (hintsUsed >= MAX_HINTS_PER_MATCH) {
    return {
      allowed: false,
      reason: "Hint limit reached. You have used all 3 hints for this match.",
      hintsRemaining: 0,
      hintsUsed,
    };
  }

  // Check cooldown from Redis
  const cooldownKey = getHintCooldownKey(matchId, userId);
  const lastHintTime = await redis.get(cooldownKey);

  if (lastHintTime) {
    const lastTime = parseInt(lastHintTime, 10);
    const now = Date.now();
    const elapsedSeconds = (now - lastTime) / 1000;

    if (elapsedSeconds < HINT_COOLDOWN_SECONDS) {
      const cooldownRemaining = Math.ceil(HINT_COOLDOWN_SECONDS - elapsedSeconds);
      return {
        allowed: false,
        reason: `Please wait ${cooldownRemaining} seconds before requesting another hint.`,
        cooldownRemaining,
        hintsRemaining: MAX_HINTS_PER_MATCH - hintsUsed,
        hintsUsed,
      };
    }
  }

  return {
    allowed: true,
    hintsRemaining: MAX_HINTS_PER_MATCH - hintsUsed,
    hintsUsed,
    cooldownRemaining: 0,
  };
}

/**
 * Record a hint request in Redis (for cooldown tracking)
 * @param matchId - The match ID
 * @param userId - The user ID
 */
export async function recordHintRequest(matchId: string, userId: string): Promise<void> {
  const redis = await getRedisClient();

  // Set cooldown timestamp
  const cooldownKey = getHintCooldownKey(matchId, userId);
  await redis.set(cooldownKey, Date.now().toString(), {
    EX: HINT_COOLDOWN_SECONDS * 2, // TTL slightly longer than cooldown
  });

  // Increment hint count
  const countKey = getHintCountKey(matchId, userId);
  await redis.incr(countKey);

  // Set TTL on count key (match duration + buffer)
  await redis.expire(countKey, 3600); // 1 hour TTL
}

/**
 * Get the current hint count for a user in a match
 * @param matchId - The match ID
 * @param userId - The user ID
 * @returns The number of hints used
 */
export async function getHintCount(matchId: string, userId: string): Promise<number> {
  const redis = await getRedisClient();
  const countKey = getHintCountKey(matchId, userId);
  const countStr = await redis.get(countKey);
  return countStr ? parseInt(countStr, 10) : 0;
}

/**
 * Store a hint in the database
 * @param hint - The hint data to store
 * @returns The stored hint with ID
 */
export async function storeHint(hint: NewMatchHint): Promise<MatchHint> {
  const result = await pool.query(
    `INSERT INTO match_hints (match_id, user_id, hint_level, hint_content, consumed)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [hint.match_id, hint.user_id, hint.hint_level, hint.hint_content, hint.consumed]
  );

  return result.rows[0];
}

/**
 * Get all hints for a user in a match
 * @param matchId - The match ID
 * @param userId - The user ID
 * @returns Array of hints
 */
export async function getMatchHints(matchId: string, userId: string): Promise<MatchHint[]> {
  const result = await pool.query(
    `SELECT * FROM match_hints 
     WHERE match_id = $1 AND user_id = $2 
     ORDER BY requested_at ASC`,
    [matchId, userId]
  );

  return result.rows;
}

/**
 * Get hint status for a match
 * @param matchId - The match ID
 * @param userId - The user ID
 * @returns Hint status including counts and cooldown
 */
export async function getHintStatus(matchId: string, userId: string): Promise<HintStatus> {
  return canRequestHint(matchId, userId);
}

/**
 * Fallback hints by challenge category and hint level
 * Used when AI service is unavailable
 * Requirements: 6.4
 */
const FALLBACK_HINTS: Record<ChallengeCategory, Record<number, string>> = {
  arrays: {
    1: "Consider the relationship between array indices and their values. Think about what patterns might emerge as you iterate through the array.",
    2: "Try using a hash map or set to track elements you've seen. This can help reduce time complexity from O(n²) to O(n).",
    3: "Step 1: Initialize a data structure to track seen elements. Step 2: Iterate through the array once. Step 3: For each element, check if a complementary value exists in your tracking structure.",
  },
  strings: {
    1: "Think about how characters relate to each other. Consider whether the order of characters matters for your solution.",
    2: "String problems often benefit from using character frequency counts or two-pointer techniques. Consider which approach fits your problem.",
    3: "Step 1: Create a frequency map of characters. Step 2: Iterate through the string tracking your condition. Step 3: Update your result based on the frequency information.",
  },
  sorting: {
    1: "Consider whether the problem requires a full sort or if partial ordering would suffice. Think about the properties of sorted data.",
    2: "Different sorting algorithms have different strengths. Consider whether stability matters, or if you can use counting/bucket sort for specific value ranges.",
    3: "Step 1: Choose an appropriate sorting strategy (comparison-based or counting). Step 2: Apply the sort. Step 3: Use the sorted order to efficiently find your answer.",
  },
  searching: {
    1: "Think about whether the data has any structure you can exploit. Sorted data enables more efficient search strategies.",
    2: "Binary search can find elements in O(log n) time in sorted data. Consider if you can apply this principle to your problem.",
    3: "Step 1: Ensure data is sorted (or sort it). Step 2: Use binary search with left and right pointers. Step 3: Adjust pointers based on comparison with target.",
  },
  "dynamic-programming": {
    1: "Look for overlapping subproblems. Can you break the problem into smaller instances of the same problem?",
    2: "Define your state clearly. What information do you need to track at each step? Consider using a table or array to store intermediate results.",
    3: "Step 1: Define dp[i] as the solution for the subproblem ending at index i. Step 2: Find the recurrence relation between dp[i] and previous states. Step 3: Build up the solution from base cases.",
  },
  trees: {
    1: "Tree problems often have elegant recursive solutions. Think about what information you need from child nodes.",
    2: "Consider whether you need preorder, inorder, or postorder traversal. Each visits nodes in a different order that may suit your problem.",
    3: "Step 1: Define your recursive function with clear base cases (null node). Step 2: Process current node and recurse on children. Step 3: Combine results from children to form the answer.",
  },
  graphs: {
    1: "Consider whether you need to explore all paths (DFS) or find shortest paths (BFS). The traversal strategy matters.",
    2: "Use a visited set to avoid cycles. Consider whether you need to track the path or just reachability.",
    3: "Step 1: Build an adjacency list from the input. Step 2: Initialize a visited set and a queue/stack. Step 3: Process nodes, marking visited and adding unvisited neighbors.",
  },
  recursion: {
    1: "Every recursive solution needs a base case and a recursive case. Make sure you're moving toward the base case.",
    2: "Think about what changes between recursive calls. Can you express the solution in terms of a smaller version of the same problem?",
    3: "Step 1: Identify the base case (smallest input that can be solved directly). Step 2: Define how to reduce the problem size. Step 3: Combine the recursive result with current processing.",
  },
  math: {
    1: "Look for mathematical patterns or properties. Sometimes a formula can replace iteration.",
    2: "Consider modular arithmetic, prime factorization, or mathematical sequences that might apply to your problem.",
    3: "Step 1: Identify the mathematical relationship in the problem. Step 2: Apply the relevant formula or algorithm. Step 3: Handle edge cases like zero, negative numbers, or overflow.",
  },
  general: {
    1: "Start by understanding the problem constraints. What are the input bounds? This hints at the expected time complexity.",
    2: "Consider common algorithmic patterns: two pointers, sliding window, divide and conquer, or greedy approaches.",
    3: "Step 1: Break down the problem into smaller steps. Step 2: Implement each step with clear variable names. Step 3: Test with the provided examples before submitting.",
  },
};

/**
 * Build the Gemini prompt for hint generation
 * **Feature: ai-code-coach, Property 15: Hint context completeness**
 * Requirements: 6.1, 6.2, 2.1, 2.2, 2.3
 * @param context - The hint generation context
 * @returns The formatted prompt string
 */
export function buildHintPrompt(context: HintGenerationContext): string {
  const { challengeDescription, visibleTestCases, currentCode, language, hintLevel, playerRating } = context;

  // Format visible test cases (exclude hidden ones)
  const testCasesStr = visibleTestCases.map((tc, i) => `Test ${i + 1}: Input: ${JSON.stringify(tc.input)} → Expected: ${JSON.stringify(tc.expectedOutput)}`).join("\n");

  // Determine hint specificity based on level
  let hintInstruction: string;
  let hintStyle: string;

  switch (hintLevel) {
    case 1:
      // Subtle hint - general approach
      hintInstruction = "Provide a SUBTLE hint that points toward the general approach or algorithm category without being specific.";
      hintStyle = "Focus on the type of problem (e.g., 'This is a classic two-pointer problem') or the general strategy (e.g., 'Consider what data structure would allow O(1) lookups'). Do NOT mention specific implementation details.";
      break;
    case 2:
      // Moderate hint - specific suggestions
      hintInstruction = "Provide a MODERATE hint that includes specific data structure suggestions or edge cases to consider.";
      hintStyle = "Mention specific data structures (e.g., 'A hash map would help here') or point out edge cases (e.g., 'Consider what happens when the array is empty'). You may suggest a specific technique but don't provide code.";
      break;
    case 3:
      // Direct hint - pseudocode/steps
      hintInstruction = "Provide a DIRECT hint with pseudocode or a step-by-step logic outline.";
      hintStyle = "Provide clear steps like 'Step 1: Initialize a map. Step 2: Iterate through the array. Step 3: For each element, check if...' You may include pseudocode but NOT the actual solution code.";
      break;
    default:
      hintInstruction = "Provide a helpful hint.";
      hintStyle = "Be helpful but don't give away the solution.";
  }

  // Adjust complexity based on player rating if available
  let ratingContext = "";
  if (playerRating !== undefined) {
    if (playerRating < 1200) {
      ratingContext = "The player is a beginner. Use simple language and explain concepts clearly.";
    } else if (playerRating < 1600) {
      ratingContext = "The player is intermediate. You can use standard algorithmic terminology.";
    } else {
      ratingContext = "The player is advanced. You can be concise and use technical terms freely.";
    }
  }

  return `You are an AI coding coach helping a player during a competitive coding match. Your goal is to guide them toward the solution WITHOUT giving it away.

CHALLENGE DESCRIPTION:
${challengeDescription}

VISIBLE TEST CASES:
${testCasesStr}

PLAYER'S CURRENT CODE (${language}):
\`\`\`${language}
${currentCode}
\`\`\`

${ratingContext}

HINT LEVEL: ${hintLevel}/3
${hintInstruction}
${hintStyle}

CRITICAL RULES:
1. NEVER reveal the exact solution or complete working code
2. NEVER mention or reveal any hidden test cases or their inputs/outputs
3. NEVER provide code that would pass all tests if copied directly
4. Focus on teaching the concept, not solving the problem
5. If the player's code has bugs, hint at the issue without fixing it directly

Provide your hint in a clear, encouraging tone. Keep it concise (2-4 sentences for level 1-2, up to a short paragraph with steps for level 3).`;
}

/**
 * Validate hint context has all required fields
 * **Feature: ai-code-coach, Property 15: Hint context completeness**
 * @param context - The context to validate
 * @returns True if context is complete
 */
export function validateHintContext(context: Partial<HintGenerationContext>): context is HintGenerationContext {
  return typeof context.challengeDescription === "string" && context.challengeDescription.length > 0 && Array.isArray(context.visibleTestCases) && typeof context.currentCode === "string" && typeof context.language === "string" && context.language.length > 0 && typeof context.hintLevel === "number" && context.hintLevel >= 1 && context.hintLevel <= 3;
}

/**
 * Check if hint content contains hidden test case data
 * **Feature: ai-code-coach, Property 16: Hidden test case protection**
 * Requirements: 6.2
 * @param hintContent - The generated hint content
 * @param hiddenTestCases - Array of hidden test cases
 * @returns True if hint contains hidden test case data (violation)
 */
export function containsHiddenTestCaseData(hintContent: string, hiddenTestCases: TestCase[]): boolean {
  const normalizedHint = hintContent.toLowerCase();

  for (const testCase of hiddenTestCases) {
    // Check for exact input match
    const inputStr = JSON.stringify(testCase.input).toLowerCase();
    if (inputStr.length > 2 && normalizedHint.includes(inputStr)) {
      return true;
    }

    // Check for exact output match
    const outputStr = JSON.stringify(testCase.expectedOutput).toLowerCase();
    if (outputStr.length > 2 && normalizedHint.includes(outputStr)) {
      return true;
    }

    // For string inputs/outputs, also check the raw value
    if (typeof testCase.input === "string" && testCase.input.length > 3) {
      if (normalizedHint.includes(testCase.input.toLowerCase())) {
        return true;
      }
    }
    if (typeof testCase.expectedOutput === "string" && testCase.expectedOutput.length > 3) {
      if (normalizedHint.includes(testCase.expectedOutput.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sanitize hint content to remove any potentially leaked data
 * Requirements: 6.2
 * @param hintContent - The raw hint content
 * @param hiddenTestCases - Array of hidden test cases to filter out
 * @returns Sanitized hint content
 */
export function sanitizeHintContent(hintContent: string, hiddenTestCases: TestCase[]): string {
  let sanitized = hintContent;

  for (const testCase of hiddenTestCases) {
    // Remove exact JSON matches
    const inputStr = JSON.stringify(testCase.input);
    const outputStr = JSON.stringify(testCase.expectedOutput);

    sanitized = sanitized.replace(new RegExp(escapeRegExp(inputStr), "gi"), "[REDACTED]");
    sanitized = sanitized.replace(new RegExp(escapeRegExp(outputStr), "gi"), "[REDACTED]");

    // For string values, also redact raw strings
    if (typeof testCase.input === "string" && testCase.input.length > 3) {
      sanitized = sanitized.replace(new RegExp(escapeRegExp(testCase.input), "gi"), "[REDACTED]");
    }
    if (typeof testCase.expectedOutput === "string" && testCase.expectedOutput.length > 3) {
      sanitized = sanitized.replace(new RegExp(escapeRegExp(testCase.expectedOutput), "gi"), "[REDACTED]");
    }
  }

  return sanitized;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Determine challenge category from tags
 * @param tags - Challenge tags
 * @returns The most relevant category
 */
export function getChallengeCategory(tags: string[]): ChallengeCategory {
  const normalizedTags = tags.map((t) => t.toLowerCase());

  if (normalizedTags.some((t) => t.includes("dynamic") || t.includes("dp"))) {
    return "dynamic-programming";
  }
  if (normalizedTags.some((t) => t.includes("tree") || t.includes("bst"))) {
    return "trees";
  }
  if (normalizedTags.some((t) => t.includes("graph") || t.includes("bfs") || t.includes("dfs"))) {
    return "graphs";
  }
  if (normalizedTags.some((t) => t.includes("sort"))) {
    return "sorting";
  }
  if (normalizedTags.some((t) => t.includes("search") || t.includes("binary"))) {
    return "searching";
  }
  if (normalizedTags.some((t) => t.includes("array") || t.includes("list"))) {
    return "arrays";
  }
  if (normalizedTags.some((t) => t.includes("string") || t.includes("text"))) {
    return "strings";
  }
  if (normalizedTags.some((t) => t.includes("recurs"))) {
    return "recursion";
  }
  if (normalizedTags.some((t) => t.includes("math") || t.includes("number"))) {
    return "math";
  }

  return "general";
}

/**
 * Get a fallback hint when AI service is unavailable
 * Requirements: 6.4
 * @param category - The challenge category
 * @param hintLevel - The hint level (1, 2, or 3)
 * @returns The fallback hint content
 */
export function getFallbackHint(category: ChallengeCategory, hintLevel: number): string {
  const categoryHints = FALLBACK_HINTS[category] || FALLBACK_HINTS.general;
  const level = Math.min(Math.max(1, hintLevel), 3);
  return categoryHints[level];
}

/**
 * Generate a hint using Gemini AI
 * Requirements: 6.1, 6.2, 2.1, 2.2, 2.3
 * @param context - The hint generation context
 * @param hiddenTestCases - Hidden test cases to protect
 * @param userId - User ID for rate limiting
 * @returns Generated hint content or null if failed
 */
export async function generateHintWithAI(context: HintGenerationContext, hiddenTestCases: TestCase[], userId: string): Promise<{ content: string; usedFallback: boolean } | null> {
  // Validate context
  if (!validateHintContext(context)) {
    console.error("Invalid hint context provided");
    return null;
  }

  // Check if API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.log("Gemini API key not configured, cannot generate AI hint");
    return null;
  }

  // Check rate limit
  const rateLimitResult = await rateLimitService.checkRateLimit(userId, "gemini-api", RATE_LIMITS.CLAUDE_API);
  if (!rateLimitResult.allowed) {
    console.log(`Rate limit exceeded for user ${userId}, cannot generate AI hint`);
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = buildHintPrompt(context);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let hintContent = response.text().trim();

    // Validate and sanitize the hint
    if (containsHiddenTestCaseData(hintContent, hiddenTestCases)) {
      console.warn("Generated hint contained hidden test case data, sanitizing...");
      hintContent = sanitizeHintContent(hintContent, hiddenTestCases);

      // If still contains hidden data after sanitization, reject
      if (containsHiddenTestCaseData(hintContent, hiddenTestCases)) {
        console.error("Could not sanitize hint, rejecting");
        return null;
      }
    }

    return { content: hintContent, usedFallback: false };
  } catch (error) {
    console.error("Gemini API error during hint generation:", error);
    return null;
  }
}

/**
 * Request a hint for a match
 * This is the main entry point for hint requests
 * Requirements: 1.1, 1.3, 1.4, 1.6, 6.1, 6.2, 6.4, 6.5
 * @param request - The hint request
 * @param challenge - The challenge data
 * @param playerRating - Optional player rating for hint complexity adjustment
 * @returns HintResponse or error
 */
export async function requestHint(request: HintRequest, challenge: Challenge, playerRating?: number): Promise<{ success: true; hint: HintResponse } | { success: false; error: string; cooldownRemaining?: number }> {
  const { matchId, userId, currentCode, language, hintLevel } = request;

  // Check if hint can be requested (cooldown + limit)
  const status = await canRequestHint(matchId, userId);
  if (!status.allowed) {
    return {
      success: false,
      error: status.reason || "Cannot request hint at this time",
      cooldownRemaining: status.cooldownRemaining,
    };
  }

  // Separate visible and hidden test cases
  const visibleTestCases = challenge.test_cases.filter((tc) => !tc.isHidden);
  const hiddenTestCases = challenge.test_cases.filter((tc) => tc.isHidden);

  // Build hint context
  const context: HintGenerationContext = {
    challengeDescription: challenge.description,
    visibleTestCases,
    currentCode,
    language,
    hintLevel,
    playerRating,
  };

  // Try to generate hint with AI
  let hintContent: string;

  const aiResult = await generateHintWithAI(context, hiddenTestCases, userId);

  if (aiResult) {
    hintContent = aiResult.content;
  } else {
    // AI failed - use fallback hint
    // Requirements: 6.4, 6.5 - Do not consume hint allowance on failure
    const category = getChallengeCategory(challenge.tags);
    hintContent = getFallbackHint(category, hintLevel);
    // Note: We still proceed with the hint but mark it as fallback
    // The hint IS consumed because we're providing a valid fallback
  }

  // Record the hint request (updates cooldown and count)
  await recordHintRequest(matchId, userId);

  // Store hint in database
  const storedHint = await storeHint({
    match_id: matchId,
    user_id: userId,
    hint_level: hintLevel,
    hint_content: hintContent,
    consumed: true,
  });

  return {
    success: true,
    hint: {
      id: storedHint.id,
      content: hintContent,
      level: hintLevel,
      levelIndicator: getHintLevelIndicator(hintLevel),
      consumed: true,
      cooldownRemaining: HINT_COOLDOWN_SECONDS,
    },
  };
}

/**
 * Request a hint without consuming allowance on AI failure
 * This version does NOT consume the hint if AI generation fails
 * Requirements: 6.5
 * @param request - The hint request
 * @param challenge - The challenge data
 * @param playerRating - Optional player rating
 * @returns HintResponse or error
 */
export async function requestHintStrict(request: HintRequest, challenge: Challenge, playerRating?: number): Promise<{ success: true; hint: HintResponse } | { success: false; error: string; cooldownRemaining?: number; preservedAllowance?: boolean }> {
  const { matchId, userId, currentCode, language, hintLevel } = request;

  // Check if hint can be requested (cooldown + limit)
  const status = await canRequestHint(matchId, userId);
  if (!status.allowed) {
    return {
      success: false,
      error: status.reason || "Cannot request hint at this time",
      cooldownRemaining: status.cooldownRemaining,
    };
  }

  // Separate visible and hidden test cases
  const visibleTestCases = challenge.test_cases.filter((tc) => !tc.isHidden);
  const hiddenTestCases = challenge.test_cases.filter((tc) => tc.isHidden);

  // Build hint context
  const context: HintGenerationContext = {
    challengeDescription: challenge.description,
    visibleTestCases,
    currentCode,
    language,
    hintLevel,
    playerRating,
  };

  // Try to generate hint with AI
  const aiResult = await generateHintWithAI(context, hiddenTestCases, userId);

  if (!aiResult) {
    // AI failed - do NOT consume hint allowance
    // Requirements: 6.5
    return {
      success: false,
      error: "Hint generation failed. Your hint allowance has been preserved. Please try again.",
      preservedAllowance: true,
    };
  }

  // AI succeeded - record the hint request (updates cooldown and count)
  await recordHintRequest(matchId, userId);

  // Store hint in database
  const storedHint = await storeHint({
    match_id: matchId,
    user_id: userId,
    hint_level: hintLevel,
    hint_content: aiResult.content,
    consumed: true,
  });

  return {
    success: true,
    hint: {
      id: storedHint.id,
      content: aiResult.content,
      level: hintLevel,
      levelIndicator: getHintLevelIndicator(hintLevel),
      consumed: true,
      cooldownRemaining: HINT_COOLDOWN_SECONDS,
    },
  };
}

// Export constants for testing
export const CONSTANTS = {
  HINT_COOLDOWN_SECONDS,
  MAX_HINTS_PER_MATCH,
  HINT_SCORE_PENALTY_PERCENT,
};

// Export fallback hints for testing
export const FALLBACK_HINTS_EXPORT = FALLBACK_HINTS;

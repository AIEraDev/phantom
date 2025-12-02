import { dockerService } from "../execution/docker.service";
import { TestCase } from "../db/types";
import { analyzeCodeQuality } from "./gemini.service";

export interface TestResult {
  testCaseIndex: number;
  passed: boolean;
  input: any;
  expectedOutput: any;
  actualOutput: any;
  executionTime: number;
  error?: string;
}

export interface CorrectnessScore {
  score: number; // 0-10
  passedTests: number;
  totalTests: number;
  testResults: TestResult[];
}

/**
 * Run code against all test cases and calculate correctness score
 */
export async function calculateCorrectnessScore(code: string, language: "javascript" | "python" | "typescript", testCases: TestCase[]): Promise<CorrectnessScore> {
  const testResults: TestResult[] = [];
  let totalWeight = 0;
  let weightedScore = 0;

  console.log(`[CorrectnessScore] Running ${testCases.length} test cases for ${language}`);

  // Execute code against each test case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const weight = testCase.weight || 1;
    totalWeight += weight;

    try {
      // Prepare test input as JSON string
      const testInput = JSON.stringify(testCase.input);
      console.log(`[CorrectnessScore] Test ${i + 1}: Executing...`);

      // Execute code with test input
      const result = await dockerService.executeCode({
        language,
        code,
        testInput,
        timeout: 10000, // Increased timeout for judging
      });
      console.log(`[CorrectnessScore] Test ${i + 1}: exitCode=${result.exitCode}, timedOut=${result.timedOut}, time=${result.executionTime}ms`);

      // Parse output
      let actualOutput: any;
      let passed = false;
      let error: string | undefined;

      if (result.exitCode === 0 && !result.timedOut) {
        try {
          // Try to parse output as JSON
          actualOutput = JSON.parse(result.stdout);

          // Compare with expected output
          passed = deepEqual(actualOutput, testCase.expectedOutput);
        } catch (parseError) {
          // If parsing fails, it might be because of debug logs
          // Try to find the last non-empty line and parse that
          const lines = result.stdout.trim().split("\n");
          const lastLine = lines[lines.length - 1];

          try {
            actualOutput = JSON.parse(lastLine);
            passed = deepEqual(actualOutput, testCase.expectedOutput);
          } catch (retryError) {
            // If that also fails, compare as strings (legacy behavior)
            actualOutput = result.stdout;
            passed = actualOutput === String(testCase.expectedOutput);
          }
        }
      } else {
        actualOutput = result.stdout || null;
        error = result.stderr || (result.timedOut ? "Execution timed out" : "Runtime error");
      }

      // Add weighted score if test passed
      if (passed) {
        weightedScore += weight;
      }

      testResults.push({
        testCaseIndex: i,
        passed,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        executionTime: result.executionTime,
        error,
      });
    } catch (error) {
      // Handle execution errors
      testResults.push({
        testCaseIndex: i,
        passed: false,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: null,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Calculate final score (0-10 scale)
  const score = totalWeight > 0 ? (weightedScore / totalWeight) * 10 : 0;
  const passedTests = testResults.filter((r) => r.passed).length;

  return {
    score,
    passedTests,
    totalTests: testCases.length,
    testResults,
  };
}

export interface EfficiencyScore {
  score: number; // 0-10
  timeScore: number; // 0-10
  memoryScore: number; // 0-10
  avgExecutionTime: number;
  avgMemoryUsage: number;
  optimalExecutionTime?: number;
}

export interface FinalScore {
  totalScore: number; // 0-1000
  correctnessScore: number; // 0-10
  efficiencyScore: number; // 0-10
  qualityScore: number; // 0-10
  creativityScore: number; // 0-10 (placeholder for now)
  breakdown: {
    correctness: number; // 40% weight
    efficiency: number; // 30% weight
    quality: number; // 20% weight
    creativity: number; // 10% weight
  };
}

export interface MatchResult {
  player1Score: FinalScore;
  player2Score: FinalScore;
  winnerId: string | null;
  player1Feedback: string;
  player2Feedback: string;
  submissionTimeDiff?: number; // milliseconds
}

/**
 * Calculate efficiency score based on execution time and memory usage
 */
export function calculateEfficiencyScore(testResults: TestResult[], optimalExecutionTime?: number): EfficiencyScore {
  // Filter only passed tests for efficiency calculation
  const passedTests = testResults.filter((r) => r.passed);

  if (passedTests.length === 0) {
    return {
      score: 0,
      timeScore: 0,
      memoryScore: 0,
      avgExecutionTime: 0,
      avgMemoryUsage: 0,
      optimalExecutionTime,
    };
  }

  // Calculate average execution time
  const avgExecutionTime = passedTests.reduce((sum, r) => sum + r.executionTime, 0) / passedTests.length;

  // Calculate time score
  let timeScore = 10;

  if (optimalExecutionTime && optimalExecutionTime > 0) {
    // Compare against optimal solution
    const ratio = avgExecutionTime / optimalExecutionTime;

    if (ratio <= 1.0) {
      timeScore = 10; // As fast or faster than optimal
    } else if (ratio <= 1.5) {
      timeScore = 9; // Within 50% of optimal
    } else if (ratio <= 2.0) {
      timeScore = 8; // Within 2x of optimal
    } else if (ratio <= 3.0) {
      timeScore = 6; // Within 3x of optimal
    } else if (ratio <= 5.0) {
      timeScore = 4; // Within 5x of optimal
    } else if (ratio <= 10.0) {
      timeScore = 2; // Within 10x of optimal
    } else {
      timeScore = 1; // More than 10x slower
    }
  } else {
    // No optimal time provided, use absolute thresholds
    if (avgExecutionTime < 100) {
      timeScore = 10; // Very fast
    } else if (avgExecutionTime < 250) {
      timeScore = 9; // Fast
    } else if (avgExecutionTime < 500) {
      timeScore = 8; // Good
    } else if (avgExecutionTime < 1000) {
      timeScore = 6; // Acceptable
    } else if (avgExecutionTime < 1500) {
      timeScore = 4; // Slow
    } else if (avgExecutionTime < 2000) {
      timeScore = 2; // Very slow
    } else {
      timeScore = 1; // Extremely slow
    }
  }

  // Calculate average memory usage (not available in test results yet, placeholder)
  const avgMemoryUsage = 0;

  // Calculate memory score based on usage
  // Memory limits: 512MB = 536870912 bytes
  const memoryLimit = 512 * 1024 * 1024;
  let memoryScore = 10;

  if (avgMemoryUsage > 0) {
    const memoryRatio = avgMemoryUsage / memoryLimit;

    if (memoryRatio < 0.1) {
      memoryScore = 10; // < 10% of limit
    } else if (memoryRatio < 0.25) {
      memoryScore = 9; // < 25% of limit
    } else if (memoryRatio < 0.5) {
      memoryScore = 8; // < 50% of limit
    } else if (memoryRatio < 0.75) {
      memoryScore = 6; // < 75% of limit
    } else if (memoryRatio < 0.9) {
      memoryScore = 4; // < 90% of limit
    } else {
      memoryScore = 2; // > 90% of limit
    }
  }

  // Combined efficiency score (70% time, 30% memory)
  const score = timeScore * 0.7 + memoryScore * 0.3;

  return {
    score,
    timeScore,
    memoryScore,
    avgExecutionTime,
    avgMemoryUsage,
    optimalExecutionTime,
  };
}

/**
 * Deep equality comparison for test outputs
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (a == null || b == null) return false;

  if (typeof a !== typeof b) return false;

  if (typeof a !== "object") return a === b;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => deepEqual(a[key], b[key]));
}

/**
 * Calculate final weighted score
 */
export function calculateFinalScore(
  correctnessScore: number,
  efficiencyScore: number,
  qualityScore: number,
  creativityScore: number = 5 // Default creativity score
): FinalScore {
  // Calculate weighted components (0-1000 scale)
  const correctnessWeight = 0.4;
  const efficiencyWeight = 0.3;
  const qualityWeight = 0.2;
  const creativityWeight = 0.1;

  const correctnessPoints = correctnessScore * 100 * correctnessWeight;
  const efficiencyPoints = efficiencyScore * 100 * efficiencyWeight;
  const qualityPoints = qualityScore * 100 * qualityWeight;
  const creativityPoints = creativityScore * 100 * creativityWeight;

  const totalScore = correctnessPoints + efficiencyPoints + qualityPoints + creativityPoints;

  return {
    totalScore,
    correctnessScore,
    efficiencyScore,
    qualityScore,
    creativityScore,
    breakdown: {
      correctness: correctnessPoints,
      efficiency: efficiencyPoints,
      quality: qualityPoints,
      creativity: creativityPoints,
    },
  };
}

/**
 * Determine match winner and generate feedback
 *
 * Real-world competitive coding winner determination (like LeetCode, Codeforces):
 *
 * Priority 1: Correctness (most important)
 *   - Player who passed MORE test cases wins
 *   - Example: Player A passes 8/10, Player B passes 5/10 → Player A wins
 *
 * Priority 2: Speed (tiebreaker when same correctness)
 *   - If both passed same number of tests, faster submission wins
 *   - Example: Both pass 10/10, Player A submitted at 5:00, Player B at 3:00 → Player B wins
 *
 * Priority 3: Total Score (final tiebreaker)
 *   - If same correctness and same/no submission times, use total score
 *   - Considers efficiency, code quality, etc.
 *
 * No Winner (Tie):
 *   - Both passed 0 tests (neither solved the problem)
 *   - Exact same in all criteria
 */
export function determineWinner(player1Id: string, player2Id: string, player1Score: FinalScore, player2Score: FinalScore, player1SubmissionTime?: number, player2SubmissionTime?: number, player1Correctness?: { passedTests: number; totalTests: number }, player2Correctness?: { passedTests: number; totalTests: number }): MatchResult {
  let winnerId: string | null = null;
  let submissionTimeDiff: number | undefined;

  // Get test pass counts
  const player1Passed = player1Correctness?.passedTests ?? 0;
  const player2Passed = player2Correctness?.passedTests ?? 0;
  const totalTests = player1Correctness?.totalTests ?? player2Correctness?.totalTests ?? 0;

  // Calculate submission time difference if both submitted
  if (player1SubmissionTime !== undefined && player2SubmissionTime !== undefined) {
    submissionTimeDiff = Math.abs(player1SubmissionTime - player2SubmissionTime);
  }

  // RULE 1: If both passed 0 tests, it's a tie (neither solved the problem)
  if (player1Passed === 0 && player2Passed === 0) {
    winnerId = null;
  }
  // RULE 2: Player who passed more tests wins (correctness is king)
  else if (player1Passed > player2Passed) {
    winnerId = player1Id;
  } else if (player2Passed > player1Passed) {
    winnerId = player2Id;
  }
  // RULE 3: Same number of tests passed - use submission time as tiebreaker
  else if (player1SubmissionTime !== undefined && player2SubmissionTime !== undefined) {
    if (player1SubmissionTime < player2SubmissionTime) {
      winnerId = player1Id;
    } else if (player2SubmissionTime < player1SubmissionTime) {
      winnerId = player2Id;
    } else {
      // Exact same submission time - use total score
      if (player1Score.totalScore > player2Score.totalScore) {
        winnerId = player1Id;
      } else if (player2Score.totalScore > player1Score.totalScore) {
        winnerId = player2Id;
      }
      // Truly equal - it's a tie
    }
  }
  // RULE 4: No submission times - fall back to total score
  else {
    if (player1Score.totalScore > player2Score.totalScore) {
      winnerId = player1Id;
    } else if (player2Score.totalScore > player1Score.totalScore) {
      winnerId = player2Id;
    }
    // Equal scores - it's a tie
  }

  // Determine correctness status for feedback
  const player1AllCorrect = player1Passed === totalTests && totalTests > 0;
  const player2AllCorrect = player2Passed === totalTests && totalTests > 0;

  // Generate personalized feedback for player 1
  const player1IsWinner = winnerId === null ? null : winnerId === player1Id;
  const player1Feedback = generateFeedback(player1Score, player1IsWinner, player1Passed, totalTests, player1AllCorrect);

  // Generate personalized feedback for player 2
  const player2IsWinner = winnerId === null ? null : winnerId === player2Id;
  const player2Feedback = generateFeedback(player2Score, player2IsWinner, player2Passed, totalTests, player2AllCorrect);

  return {
    player1Score,
    player2Score,
    winnerId,
    player1Feedback,
    player2Feedback,
    submissionTimeDiff,
  };
}

/**
 * Generate personalized feedback for a player
 * Provides honest, actionable feedback based on actual performance
 */
function generateFeedback(score: FinalScore, isWinner: boolean | null, passedTests: number, totalTests: number, allCorrect: boolean): string {
  const feedback: string[] = [];

  // Opening statement based on winner status and test results
  if (isWinner === true) {
    if (allCorrect) {
      feedback.push("🎉 Congratulations! You won with a perfect solution!");
    } else if (passedTests > 0) {
      feedback.push(`🎉 You won! You passed ${passedTests}/${totalTests} test cases.`);
    } else {
      feedback.push("🎉 You won this match! (Your opponent performed worse)");
    }
  } else if (isWinner === false) {
    if (passedTests === 0) {
      feedback.push(`❌ Your solution didn't pass any test cases. Your opponent solved more of the problem.`);
    } else if (allCorrect) {
      feedback.push(`⏱️ Close match! You passed all tests but your opponent submitted faster.`);
    } else {
      feedback.push(`You passed ${passedTests}/${totalTests} tests, but your opponent passed more.`);
    }
  } else {
    // Tie
    if (passedTests === 0) {
      feedback.push("🤝 It's a tie - neither player passed any test cases. Both need more practice!");
    } else if (allCorrect) {
      feedback.push("🤝 It's a tie! Both players solved the problem perfectly at the same time.");
    } else {
      feedback.push(`🤝 It's a tie! Both players passed ${passedTests}/${totalTests} tests.`);
    }
  }

  feedback.push(`\n\n**Final Score: ${Math.round(score.totalScore)}/1000**`);
  feedback.push(`\n**Tests Passed: ${passedTests}/${totalTests}**`);

  // Correctness feedback
  feedback.push(`\n\n**Correctness (${Math.round(score.breakdown.correctness)} points):**`);
  if (allCorrect) {
    feedback.push("✅ Perfect! All test cases passed.");
  } else if (passedTests > totalTests * 0.8) {
    feedback.push(`Almost there! ${passedTests}/${totalTests} tests passed. Check edge cases.`);
  } else if (passedTests > totalTests * 0.5) {
    feedback.push(`${passedTests}/${totalTests} tests passed. Review your logic for edge cases.`);
  } else if (passedTests > 0) {
    feedback.push(`${passedTests}/${totalTests} tests passed. Your solution needs more work.`);
  } else {
    feedback.push("❌ No tests passed. Review the problem requirements carefully.");
  }

  // Efficiency feedback (only relevant if some tests passed)
  feedback.push(`\n\n**Efficiency (${Math.round(score.breakdown.efficiency)} points):**`);
  if (passedTests === 0) {
    feedback.push("N/A - Pass some tests first to measure efficiency.");
  } else if (score.efficiencyScore >= 9) {
    feedback.push("Outstanding! Your solution is highly optimized.");
  } else if (score.efficiencyScore >= 7) {
    feedback.push("Good performance! Your solution runs efficiently.");
  } else if (score.efficiencyScore >= 5) {
    feedback.push("Consider optimizing your algorithm for better time complexity.");
  } else {
    feedback.push("Look for ways to reduce time and space complexity.");
  }

  // Quality feedback (always show AI analysis)
  feedback.push(`\n\n**Code Quality (${Math.round(score.breakdown.quality)} points):**`);
  if (score.qualityScore >= 9) {
    feedback.push("Exceptional! Clean, readable, and well-structured code.");
  } else if (score.qualityScore >= 7) {
    feedback.push("Good code quality. Readable and follows best practices.");
  } else if (score.qualityScore >= 5) {
    feedback.push("Consider improving variable names and code organization.");
  } else if (score.qualityScore > 0) {
    feedback.push("Focus on writing cleaner, more maintainable code.");
  } else {
    feedback.push("Minimal code submitted. Write a complete solution for quality feedback.");
  }

  // Creativity feedback (only if tests passed)
  feedback.push(`\n\n**Creativity (${Math.round(score.breakdown.creativity)} points):**`);
  if (passedTests === 0) {
    feedback.push("N/A - Creativity is only scored for working solutions.");
  } else if (score.creativityScore >= 7) {
    feedback.push("Creative approach! You found an interesting solution.");
  } else if (score.creativityScore >= 4) {
    feedback.push("Solid approach. Try exploring alternative algorithms.");
  } else {
    feedback.push("Basic solution. Consider more advanced techniques.");
  }

  return feedback.join(" ");
}

/**
 * Judge a complete match between two players
 *
 * Scoring Philosophy (Real-world competitive coding):
 * - Correctness is KING - if your code doesn't work, other metrics don't matter
 * - Empty/minimal code = 0 points across the board
 * - Code quality only matters if you passed at least some tests
 * - Creativity is earned, not given by default
 */
export async function judgeMatch(player1Id: string, player2Id: string, player1Code: string, player2Code: string, player1Language: "javascript" | "python" | "typescript", player2Language: "javascript" | "python" | "typescript", testCases: TestCase[], optimalExecutionTime?: number, player1SubmissionTime?: number, player2SubmissionTime?: number): Promise<MatchResult> {
  console.log(`[JudgeMatch] Starting judging for players ${player1Id} vs ${player2Id}`);
  console.log(`[JudgeMatch] Test cases count: ${testCases.length}`);

  // Calculate correctness scores for both players
  console.log(`[JudgeMatch] Calculating correctness for player 1...`);
  const player1Correctness = await calculateCorrectnessScore(player1Code, player1Language, testCases);
  console.log(`[JudgeMatch] Player 1 correctness: ${player1Correctness.passedTests}/${player1Correctness.totalTests}`);

  console.log(`[JudgeMatch] Calculating correctness for player 2...`);
  const player2Correctness = await calculateCorrectnessScore(player2Code, player2Language, testCases);
  console.log(`[JudgeMatch] Player 2 correctness: ${player2Correctness.passedTests}/${player2Correctness.totalTests}`);

  // Calculate efficiency scores (only meaningful if tests passed)
  const player1Efficiency = calculateEfficiencyScore(player1Correctness.testResults, optimalExecutionTime);
  const player2Efficiency = calculateEfficiencyScore(player2Correctness.testResults, optimalExecutionTime);

  // Calculate quality scores - always use AI analysis
  // Even if tests fail (due to test bugs), we still want to evaluate code quality
  console.log(`[JudgeMatch] Analyzing code quality with AI...`);

  const player1Quality = await analyzeCodeQuality(player1Code, player1Language, player1Id);
  const player1QualityScore = player1Quality.score;
  console.log(`[JudgeMatch] Player 1 quality score: ${player1QualityScore}`);

  const player2Quality = await analyzeCodeQuality(player2Code, player2Language, player2Id);
  const player2QualityScore = player2Quality.score;
  console.log(`[JudgeMatch] Player 2 quality score: ${player2QualityScore}`);

  // Creativity scoring - based on actual code effort, not default
  // 0 = no code/minimal, scales up based on solution complexity
  const player1Creativity = calculateCreativityScore(player1Code, player1Correctness.passedTests);
  const player2Creativity = calculateCreativityScore(player2Code, player2Correctness.passedTests);

  // Calculate final scores
  const player1FinalScore = calculateFinalScore(player1Correctness.score, player1Efficiency.score, player1QualityScore, player1Creativity);

  const player2FinalScore = calculateFinalScore(player2Correctness.score, player2Efficiency.score, player2QualityScore, player2Creativity);

  // Determine winner and generate feedback
  return determineWinner(player1Id, player2Id, player1FinalScore, player2FinalScore, player1SubmissionTime, player2SubmissionTime, { passedTests: player1Correctness.passedTests, totalTests: player1Correctness.totalTests }, { passedTests: player2Correctness.passedTests, totalTests: player2Correctness.totalTests });
}

/**
 * Calculate creativity score based on code complexity and effort
 * Only gives points if the code actually works (passed tests)
 */
function calculateCreativityScore(code: string, passedTests: number): number {
  // No creativity points if code doesn't work at all
  if (passedTests === 0) {
    return 0;
  }

  const strippedCode = code.replace(/\/\/.*|\/\*[\s\S]*?\*\/|#.*/g, "").trim();

  // Minimal code = minimal creativity
  if (strippedCode.length < 50) {
    return 1;
  }

  let creativity = 2; // Base score for working code

  // Multiple approaches/functions show creativity
  const functionCount = (code.match(/function\s|def\s|=>/g) || []).length;
  if (functionCount > 1) creativity += 2;
  if (functionCount > 3) creativity += 1;

  // Use of advanced patterns
  if (code.includes("map") || code.includes("filter") || code.includes("reduce")) creativity += 1;
  if (code.includes("recursion") || /\bfunction\s+(\w+)[\s\S]*\1\s*\(/i.test(code)) creativity += 2;

  // Data structures
  if (code.includes("Map") || code.includes("Set") || code.includes("dict")) creativity += 1;

  // Algorithm indicators
  if (code.includes("sort") || code.includes("binary")) creativity += 1;

  return Math.min(creativity, 10);
}

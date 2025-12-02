import { GoogleGenerativeAI } from "@google/generative-ai";
import { rateLimitService, RATE_LIMITS } from "../redis/rateLimit.service";

export interface CodeQualityAnalysis {
  readability: number; // 0-10
  bestPractices: number; // 0-10
  errorHandling: number; // 0-10
  organization: number; // 0-10
  feedback: string;
}

export interface CodeQualityScore {
  score: number; // 0-10 (average of all metrics)
  analysis: CodeQualityAnalysis;
  usedFallback: boolean;
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Analyze code quality using Gemini API
 */
export async function analyzeCodeQuality(code: string, language: string, userId: string): Promise<CodeQualityScore> {
  // CRITICAL: Check for empty/minimal code FIRST - don't waste API calls
  const strippedCode = code.replace(/\/\/.*|\/\*[\s\S]*?\*\/|#.*/g, "").trim();
  if (strippedCode.length < 20) {
    return {
      score: 0,
      analysis: {
        readability: 0,
        bestPractices: 0,
        errorHandling: 0,
        organization: 0,
        feedback: "No meaningful code submitted. Write a solution to receive quality feedback.",
      },
      usedFallback: true,
    };
  }

  // Check rate limit using centralized rate limit service
  const rateLimitResult = await rateLimitService.checkRateLimit(userId, "gemini-api", RATE_LIMITS.CLAUDE_API);

  if (!rateLimitResult.allowed) {
    console.log(`Rate limit exceeded for user ${userId}, using fallback scoring`);
    return fallbackCodeQualityScore(code, language);
  }

  // Check if API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.log("Gemini API key not configured, using fallback scoring");
    return fallbackCodeQualityScore(code, language);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Analyze this ${language} code for quality:

\`\`\`${language}
${code}
\`\`\`

Evaluate the following aspects on a scale of 0-10:
1. Readability and structure (clear variable names, proper formatting, easy to understand)
2. Best practices adherence (follows language conventions, efficient patterns)
3. Error handling (handles edge cases, validates input, manages errors)
4. Code organization (logical structure, separation of concerns, modularity)

Provide a brief feedback summary (2-3 sentences) highlighting strengths and areas for improvement.

Return your analysis ONLY as valid JSON in this exact format (no markdown, no explanation):
{
  "readability": <number 0-10>,
  "bestPractices": <number 0-10>,
  "errorHandling": <number 0-10>,
  "organization": <number 0-10>,
  "feedback": "<string>"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("GEMINI RESPONSE :", response);

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Could not extract JSON from Gemini response");
    }

    const analysis: CodeQualityAnalysis = JSON.parse(jsonMatch[0]);

    // Validate analysis structure
    if (typeof analysis.readability !== "number" || typeof analysis.bestPractices !== "number" || typeof analysis.errorHandling !== "number" || typeof analysis.organization !== "number" || typeof analysis.feedback !== "string") {
      throw new Error("Invalid analysis structure from Gemini");
    }

    // Calculate average score
    const score = (analysis.readability + analysis.bestPractices + analysis.errorHandling + analysis.organization) / 4;

    console.log("GEMINI SCORE: ", score);

    return {
      score,
      analysis,
      usedFallback: false,
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    return fallbackCodeQualityScore(code, language);
  }
}

/**
 * Fallback code quality scoring when Gemini API is unavailable
 * Uses realistic heuristics - empty/minimal code gets 0
 */
export function fallbackCodeQualityScore(code: string, language: string): CodeQualityScore {
  console.log("GEMINI FALLBACK SCORE");

  // Strip whitespace and comments to get actual code content
  const strippedCode = code.replace(/\/\/.*|\/\*[\s\S]*?\*\/|#.*/g, "").trim();
  const lines = strippedCode.split("\n").filter((line) => line.trim().length > 0);
  const codeLength = strippedCode.length;

  // CRITICAL: Empty or minimal code gets 0 across the board
  if (codeLength < 20 || lines.length < 2) {
    return {
      score: 0,
      analysis: {
        readability: 0,
        bestPractices: 0,
        errorHandling: 0,
        organization: 0,
        feedback: "No meaningful code submitted. Write a solution to receive quality feedback.",
      },
      usedFallback: true,
    };
  }

  // Start from 0 and add points based on actual code quality
  let readability = 0;
  let bestPractices = 0;
  let errorHandling = 0;
  let organization = 0;

  // Readability: Check for reasonable length and structure
  if (codeLength > 50) readability += 2;
  if (codeLength > 100) readability += 1;
  if (lines.length > 3) readability += 2;
  if (lines.length > 10) readability += 1;
  // Check for proper indentation
  if (code.includes("  ") || code.includes("\t")) readability += 2;
  // Check for meaningful variable names (not single letters except i,j,k for loops)
  const hasGoodNames = /\b[a-z]{3,}\b/i.test(code);
  if (hasGoodNames) readability += 2;

  // Best practices: Check for functions/methods and proper patterns
  if (language === "javascript" || language === "typescript") {
    if (code.includes("function") || code.includes("=>")) bestPractices += 3;
    if (code.includes("const ") || code.includes("let ")) bestPractices += 2;
    if (!code.includes("var ")) bestPractices += 1; // Avoiding var is good
    if (code.includes("return ")) bestPractices += 2;
    if (code.includes("===") || code.includes("!==")) bestPractices += 1; // Strict equality
  } else if (language === "python") {
    if (code.includes("def ")) bestPractices += 3;
    if (code.includes("return ")) bestPractices += 2;
    if (code.includes("class ")) bestPractices += 2;
    if (code.includes(":")) bestPractices += 1;
  }

  // Error handling: Check for defensive coding
  if (code.includes("try") || code.includes("catch") || code.includes("except")) {
    errorHandling += 4;
  }
  if (code.includes("if") && (code.includes("null") || code.includes("undefined") || code.includes("None"))) {
    errorHandling += 3; // Null checks
  }
  if (code.includes("if") && code.includes("else")) {
    errorHandling += 2;
  }
  if (code.includes("throw") || code.includes("raise")) {
    errorHandling += 1;
  }

  // Organization: Check for comments and logical structure
  if (code.includes("//") || code.includes("#") || code.includes("/*")) {
    organization += 3;
  }
  if (lines.length > 5) organization += 2;
  if (lines.length > 15) organization += 2;
  // Check for multiple functions (good organization)
  const functionCount = (code.match(/function\s|def\s|=>/g) || []).length;
  if (functionCount > 1) organization += 3;

  // Cap scores at 10
  readability = Math.min(readability, 10);
  bestPractices = Math.min(bestPractices, 10);
  errorHandling = Math.min(errorHandling, 10);
  organization = Math.min(organization, 10);

  const score = (readability + bestPractices + errorHandling + organization) / 4;

  let feedback = "";
  if (score >= 8) {
    feedback = "Excellent code quality! Well-structured and follows best practices.";
  } else if (score >= 6) {
    feedback = "Good code quality. Consider adding more error handling and comments.";
  } else if (score >= 4) {
    feedback = "Decent code. Focus on better organization and defensive coding.";
  } else if (score >= 2) {
    feedback = "Basic code structure. Improve readability and add error handling.";
  } else {
    feedback = "Minimal code submitted. Expand your solution for better quality scores.";
  }

  return {
    score,
    analysis: {
      readability,
      bestPractices,
      errorHandling,
      organization,
      feedback,
    },
    usedFallback: true,
  };
}

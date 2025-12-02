/**
 * AI Code Coach API Routes
 * Provides endpoints for hints, analysis, weakness tracking, and coaching dashboard
 * Requirements: 1.1, 1.3, 1.4, 1.6, 3.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 7.3
 */

import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.middleware";
import * as hintService from "../services/hint.service";
import * as analysisService from "../services/analysis.service";
import * as weaknessService from "../services/weakness.service";
import * as coachingService from "../services/coaching.service";
import pool from "../db/connection";
import { Challenge } from "../db/types";

const router = Router();

// ============================================================================
// Hint Routes (/api/coach/hints)
// Requirements: 1.1, 1.3, 1.4, 1.6
// ============================================================================

/**
 * POST /api/coach/hints/request
 * Request a hint during a match
 * Requirements: 1.1, 1.3, 1.4, 1.6
 */
router.post("/hints/request", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { matchId, currentCode, language } = req.body;

    // Validate required fields
    if (!matchId) {
      return res.status(400).json({
        error: "matchId is required",
        code: "MISSING_MATCH_ID",
      });
    }

    if (currentCode === undefined) {
      return res.status(400).json({
        error: "currentCode is required",
        code: "MISSING_CODE",
      });
    }

    if (!language) {
      return res.status(400).json({
        error: "language is required",
        code: "MISSING_LANGUAGE",
      });
    }

    // Get match to verify user is a participant and get challenge
    const matchResult = await pool.query(
      `SELECT m.*, c.description, c.test_cases, c.tags
       FROM matches m
       JOIN challenges c ON m.challenge_id = c.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    const match = matchResult.rows[0];

    // Verify user is a participant
    if (match.player1_id !== userId && match.player2_id !== userId) {
      return res.status(403).json({
        error: "You are not a participant in this match",
        code: "NOT_PARTICIPANT",
      });
    }

    // Verify match is active
    if (match.status !== "active") {
      return res.status(400).json({
        error: "Hints can only be requested during active matches",
        code: "MATCH_NOT_ACTIVE",
      });
    }

    // Get current hint count to determine hint level
    const hintCount = await hintService.getHintCount(matchId, userId);
    const hintLevel = Math.min(hintCount + 1, 3);

    // Build challenge object
    const challenge: Challenge = {
      id: match.challenge_id,
      title: "",
      description: match.description,
      difficulty: "medium",
      time_limit: 0,
      test_cases: typeof match.test_cases === "string" ? JSON.parse(match.test_cases) : match.test_cases,
      starter_code: { javascript: "", python: "", typescript: "" },
      optimal_solution: null,
      tags: typeof match.tags === "string" ? JSON.parse(match.tags) : match.tags || [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Get player rating for hint complexity adjustment
    const userResult = await pool.query(`SELECT rating FROM users WHERE id = $1`, [userId]);
    const playerRating = userResult.rows[0]?.rating;

    // Request hint
    const result = await hintService.requestHint(
      {
        matchId,
        userId,
        challengeId: match.challenge_id,
        currentCode,
        language,
        hintLevel,
      },
      challenge,
      playerRating
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: "HINT_REQUEST_FAILED",
        cooldownRemaining: result.cooldownRemaining,
      });
    }

    res.status(200).json({ hint: result.hint });
  } catch (error) {
    console.error("Request hint error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/hints/status/:matchId
 * Get hint status for a match
 * Requirements: 1.3, 1.6
 */
router.get("/hints/status/:matchId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { matchId } = req.params;

    // Verify user is a participant in the match
    const matchResult = await pool.query(`SELECT player1_id, player2_id FROM matches WHERE id = $1`, [matchId]);

    if (matchResult.rows.length === 0) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    const match = matchResult.rows[0];
    if (match.player1_id !== userId && match.player2_id !== userId) {
      return res.status(403).json({
        error: "You are not a participant in this match",
        code: "NOT_PARTICIPANT",
      });
    }

    const status = await hintService.getHintStatus(matchId, userId);

    res.status(200).json({
      canRequest: status.allowed,
      hintsUsed: status.hintsUsed || 0,
      hintsRemaining: status.hintsRemaining || 0,
      cooldownRemaining: status.cooldownRemaining || 0,
    });
  } catch (error) {
    console.error("Get hint status error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/hints/match/:matchId
 * Get all hints for a match
 * Requirements: 1.4
 */
router.get("/hints/match/:matchId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { matchId } = req.params;

    // Verify user is a participant in the match
    const matchResult = await pool.query(`SELECT player1_id, player2_id FROM matches WHERE id = $1`, [matchId]);

    if (matchResult.rows.length === 0) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    const match = matchResult.rows[0];
    if (match.player1_id !== userId && match.player2_id !== userId) {
      return res.status(403).json({
        error: "You are not a participant in this match",
        code: "NOT_PARTICIPANT",
      });
    }

    const hints = await hintService.getMatchHints(matchId, userId);

    // Transform to response format
    const hintResponses = hints.map((hint) => ({
      id: hint.id,
      content: hint.hint_content,
      level: hint.hint_level,
      levelIndicator: hintService.getHintLevelIndicator(hint.hint_level),
      consumed: hint.consumed,
      requestedAt: hint.requested_at,
    }));

    res.status(200).json({ hints: hintResponses });
  } catch (error) {
    console.error("Get match hints error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// ============================================================================
// Analysis Routes (/api/coach/analysis)
// Requirements: 3.1, 7.3
// ============================================================================

/**
 * POST /api/coach/analysis/generate
 * Generate post-match analysis
 * Requirements: 3.1
 */
router.post("/analysis/generate", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { matchId } = req.body;

    if (!matchId) {
      return res.status(400).json({
        error: "matchId is required",
        code: "MISSING_MATCH_ID",
      });
    }

    // Get match details
    const matchResult = await pool.query(
      `SELECT m.*, c.description, c.test_cases
       FROM matches m
       JOIN challenges c ON m.challenge_id = c.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    const match = matchResult.rows[0];

    // Verify user is a participant
    if (match.player1_id !== userId && match.player2_id !== userId) {
      return res.status(403).json({
        error: "You are not a participant in this match",
        code: "NOT_PARTICIPANT",
      });
    }

    // Verify match is completed
    if (match.status !== "completed") {
      return res.status(400).json({
        error: "Analysis can only be generated for completed matches",
        code: "MATCH_NOT_COMPLETED",
      });
    }

    // Get player's code and determine if winner
    const isPlayer1 = match.player1_id === userId;
    const code = isPlayer1 ? match.player1_code : match.player2_code;
    const language = isPlayer1 ? match.player1_language : match.player2_language;
    const isWinner = match.winner_id === userId;

    if (!code) {
      return res.status(400).json({
        error: "No code found for this player in the match",
        code: "NO_CODE_FOUND",
      });
    }

    // Build challenge object
    const challenge: Challenge = {
      id: match.challenge_id,
      title: "",
      description: match.description,
      difficulty: "medium",
      time_limit: 0,
      test_cases: typeof match.test_cases === "string" ? JSON.parse(match.test_cases) : match.test_cases,
      starter_code: { javascript: "", python: "", typescript: "" },
      optimal_solution: null,
      tags: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Generate test results (simplified - in real implementation would come from match data)
    const testResults: analysisService.TestResult[] = challenge.test_cases.map((tc) => ({
      passed: isWinner, // Simplified assumption
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    }));

    // Generate analysis
    const analysis = await analysisService.generateAnalysis(matchId, userId, code, language, challenge, testResults, isWinner);

    res.status(200).json({ analysis });
  } catch (error) {
    console.error("Generate analysis error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/analysis/:matchId
 * Get analysis for a specific match
 * Requirements: 3.1
 */
router.get("/analysis/:matchId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { matchId } = req.params;

    // Verify user is a participant in the match
    const matchResult = await pool.query(`SELECT player1_id, player2_id FROM matches WHERE id = $1`, [matchId]);

    if (matchResult.rows.length === 0) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    const match = matchResult.rows[0];
    if (match.player1_id !== userId && match.player2_id !== userId) {
      return res.status(403).json({
        error: "You are not a participant in this match",
        code: "NOT_PARTICIPANT",
      });
    }

    const analysis = await analysisService.getAnalysis(matchId, userId);

    if (!analysis) {
      return res.status(404).json({
        error: "Analysis not found for this match",
        code: "ANALYSIS_NOT_FOUND",
      });
    }

    res.status(200).json({ analysis });
  } catch (error) {
    console.error("Get analysis error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/analysis/history
 * Get analysis history with pagination
 * Requirements: 7.3
 */
router.get("/analysis/history", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const result = await analysisService.getAnalysisHistory(userId, page, pageSize);

    res.status(200).json({
      analyses: result.analyses,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    console.error("Get analysis history error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// ============================================================================
// Weakness Routes (/api/coach/weakness)
// Requirements: 4.2, 4.3, 4.4
// ============================================================================

/**
 * GET /api/coach/weakness/profile
 * Get weakness profile for the current user
 * Requirements: 4.2
 */
router.get("/weakness/profile", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const profile = await weaknessService.getWeaknessProfile(userId);

    if (!profile) {
      return res.status(200).json({
        profile: null,
        message: "No weakness profile found. Complete some matches to build your profile.",
      });
    }

    res.status(200).json({ profile });
  } catch (error) {
    console.error("Get weakness profile error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/weakness/summary
 * Get weakness summary for the current user
 * Requirements: 4.3
 */
router.get("/weakness/summary", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if user has enough data
    const detectionResult = await weaknessService.hasEnoughDataForWeaknessDetection(userId);

    if (!detectionResult.hasEnoughData) {
      return res.status(200).json({
        summary: null,
        insufficientData: true,
        matchesAnalyzed: detectionResult.matchesAnalyzed,
        requiredMatches: detectionResult.requiredMatches,
        message: `Complete ${detectionResult.requiredMatches - detectionResult.matchesAnalyzed} more matches to unlock weakness detection.`,
      });
    }

    const summary = await weaknessService.getWeaknessSummary(userId);

    res.status(200).json({ summary });
  } catch (error) {
    console.error("Get weakness summary error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/weakness/tip/:challengeCategory
 * Get pre-match tip based on weaknesses
 * Requirements: 4.4
 */
router.get("/weakness/tip/:challengeCategory", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { challengeCategory } = req.params;

    const tip = await weaknessService.getPreMatchTip(userId, challengeCategory);

    res.status(200).json({ tip });
  } catch (error) {
    console.error("Get pre-match tip error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// ============================================================================
// Dashboard Routes (/api/coach/dashboard)
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
// ============================================================================

/**
 * GET /api/coach/dashboard/summary
 * Get coaching summary for the current user
 * Requirements: 5.1
 */
router.get("/dashboard/summary", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const summary = await coachingService.getSummary(userId);

    res.status(200).json({ summary });
  } catch (error) {
    console.error("Get dashboard summary error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/dashboard/timeline
 * Get skill progression timeline
 * Requirements: 5.2
 */
router.get("/dashboard/timeline", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const timeline = await coachingService.getTimeline(userId);

    res.status(200).json({ timeline });
  } catch (error) {
    console.error("Get timeline error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/dashboard/feedback
 * Get categorized feedback history
 * Requirements: 5.3
 */
router.get("/dashboard/feedback", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const feedback = await coachingService.getCategorizedFeedback(userId);

    res.status(200).json({ feedback });
  } catch (error) {
    console.error("Get categorized feedback error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/dashboard/match/:matchId
 * Get full analysis and hints for a specific match
 * Requirements: 5.4
 */
router.get("/dashboard/match/:matchId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { matchId } = req.params;

    // Verify user is a participant in the match
    const matchResult = await pool.query(`SELECT player1_id, player2_id FROM matches WHERE id = $1`, [matchId]);

    if (matchResult.rows.length === 0) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    const match = matchResult.rows[0];
    if (match.player1_id !== userId && match.player2_id !== userId) {
      return res.status(403).json({
        error: "You are not a participant in this match",
        code: "NOT_PARTICIPANT",
      });
    }

    const detail = await coachingService.getMatchDetail(matchId, userId);

    if (!detail) {
      return res.status(404).json({
        error: "No analysis found for this match",
        code: "ANALYSIS_NOT_FOUND",
      });
    }

    res.status(200).json({
      analysis: detail.analysis,
      hints: detail.hints,
    });
  } catch (error) {
    console.error("Get match detail error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/coach/dashboard/trends
 * Get improvement trends (last 10 matches)
 * Requirements: 5.5
 */
router.get("/dashboard/trends", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const trends = await coachingService.getTrends(userId);

    res.status(200).json({ trends });
  } catch (error) {
    console.error("Get trends error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;

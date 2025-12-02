import { Router, Request, Response } from "express";
import { PracticeService } from "../services/practice.service";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();
const practiceService = new PracticeService();

/**
 * GET /api/practice/challenges
 * Return unlocked challenges for practice
 * Filter by difficulty and category
 * Requirements: 17.1
 */
router.get("/challenges", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { difficulty, category } = req.query;

    // Validate difficulty if provided
    if (difficulty && !["easy", "medium", "hard", "expert"].includes(difficulty as string)) {
      return res.status(400).json({
        error: "Invalid difficulty. Must be one of: easy, medium, hard, expert",
        code: "INVALID_DIFFICULTY",
      });
    }

    // Validate category if provided
    if (category && !["arrays", "strings", "trees", "graphs", "dp"].includes(category as string)) {
      return res.status(400).json({
        error: "Invalid category. Must be one of: arrays, strings, trees, graphs, dp",
        code: "INVALID_CATEGORY",
      });
    }

    const challenges = await practiceService.getUnlockedChallenges(userId, {
      difficulty: difficulty as string | undefined,
      category: category as string | undefined,
    });

    res.json({ challenges });
  } catch (error) {
    console.error("Error fetching practice challenges:", error);
    res.status(500).json({
      error: "Failed to fetch practice challenges",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * POST /api/practice/start
 * Create new practice session
 * Return session ID and challenge data
 * Requirements: 17.2
 */
router.post("/start", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { challengeId, language } = req.body;

    // Validate required fields
    if (!challengeId) {
      return res.status(400).json({
        error: "challengeId is required",
        code: "MISSING_CHALLENGE_ID",
      });
    }

    if (!language) {
      return res.status(400).json({
        error: "language is required",
        code: "MISSING_LANGUAGE",
      });
    }

    // Validate language
    if (!["javascript", "python", "typescript"].includes(language)) {
      return res.status(400).json({
        error: "Invalid language. Must be one of: javascript, python, typescript",
        code: "INVALID_LANGUAGE",
      });
    }

    const result = await practiceService.startSession(userId, challengeId, language);

    res.status(201).json({
      session: result.session,
      challenge: result.challenge,
    });
  } catch (error: any) {
    console.error("Error starting practice session:", error);

    // Handle specific error messages
    if (error.message?.includes("Challenge not found")) {
      return res.status(404).json({
        error: error.message,
        code: "CHALLENGE_NOT_FOUND",
      });
    }

    if (error.message?.includes("Challenge is locked")) {
      return res.status(403).json({
        error: error.message,
        code: "CHALLENGE_LOCKED",
      });
    }

    res.status(500).json({
      error: "Failed to start practice session",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * POST /api/practice/:sessionId/save
 * Save current code progress
 * Requirements: 17.2
 */
router.post("/:sessionId/save", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { code } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId is required",
        code: "MISSING_SESSION_ID",
      });
    }

    if (code === undefined) {
      return res.status(400).json({
        error: "code is required",
        code: "MISSING_CODE",
      });
    }

    // Verify session belongs to user
    const session = await practiceService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: "Session not found",
        code: "SESSION_NOT_FOUND",
      });
    }

    if (session.userId !== req.user!.userId) {
      return res.status(403).json({
        error: "Not authorized to modify this session",
        code: "NOT_AUTHORIZED",
      });
    }

    await practiceService.saveProgress(sessionId, code);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving practice progress:", error);

    if (error.message?.includes("Session not found or already completed")) {
      return res.status(400).json({
        error: error.message,
        code: "SESSION_INVALID",
      });
    }

    res.status(500).json({
      error: "Failed to save practice progress",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * POST /api/practice/:sessionId/submit
 * Submit solution for evaluation
 * Return feedback without rating change
 * Requirements: 17.3, 17.4
 */
router.post("/:sessionId/submit", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { code } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId is required",
        code: "MISSING_SESSION_ID",
      });
    }

    if (code === undefined) {
      return res.status(400).json({
        error: "code is required",
        code: "MISSING_CODE",
      });
    }

    // Verify session belongs to user
    const session = await practiceService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: "Session not found",
        code: "SESSION_NOT_FOUND",
      });
    }

    if (session.userId !== req.user!.userId) {
      return res.status(403).json({
        error: "Not authorized to submit for this session",
        code: "NOT_AUTHORIZED",
      });
    }

    const updatedSession = await practiceService.submitSolution(sessionId, code);

    res.json({
      session: updatedSession,
      feedback: updatedSession.feedback,
    });
  } catch (error: any) {
    console.error("Error submitting practice solution:", error);

    if (error.message?.includes("Session not found")) {
      return res.status(404).json({
        error: error.message,
        code: "SESSION_NOT_FOUND",
      });
    }

    if (error.message?.includes("Session already completed")) {
      return res.status(400).json({
        error: error.message,
        code: "SESSION_ALREADY_COMPLETED",
      });
    }

    if (error.message?.includes("Challenge not found")) {
      return res.status(404).json({
        error: error.message,
        code: "CHALLENGE_NOT_FOUND",
      });
    }

    res.status(500).json({
      error: "Failed to submit practice solution",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * POST /api/practice/:sessionId/hint
 * Return hint at requested level
 * Increment hints_used counter
 * Requirements: 17.6
 */
router.post("/:sessionId/hint", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { level } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId is required",
        code: "MISSING_SESSION_ID",
      });
    }

    if (level === undefined) {
      return res.status(400).json({
        error: "level is required",
        code: "MISSING_LEVEL",
      });
    }

    // Validate level is a number between 1-3
    const hintLevel = parseInt(level, 10);
    if (isNaN(hintLevel) || hintLevel < 1 || hintLevel > 3) {
      return res.status(400).json({
        error: "level must be a number between 1 and 3",
        code: "INVALID_LEVEL",
      });
    }

    // Verify session belongs to user
    const session = await practiceService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: "Session not found",
        code: "SESSION_NOT_FOUND",
      });
    }

    if (session.userId !== req.user!.userId) {
      return res.status(403).json({
        error: "Not authorized to access hints for this session",
        code: "NOT_AUTHORIZED",
      });
    }

    const hint = await practiceService.getHint(sessionId, session.challengeId, hintLevel);

    res.json({ hint });
  } catch (error: any) {
    console.error("Error getting practice hint:", error);

    if (error.message?.includes("Session not found")) {
      return res.status(404).json({
        error: error.message,
        code: "SESSION_NOT_FOUND",
      });
    }

    if (error.message?.includes("Hint level must be between")) {
      return res.status(400).json({
        error: error.message,
        code: "INVALID_LEVEL",
      });
    }

    if (error.message?.includes("Challenge not found")) {
      return res.status(404).json({
        error: error.message,
        code: "CHALLENGE_NOT_FOUND",
      });
    }

    res.status(500).json({
      error: "Failed to get practice hint",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/practice/history
 * Return user's practice history
 * Include improvement metrics
 * Requirements: 17.5
 */
router.get("/history", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const history = await practiceService.getPracticeHistory(userId);

    res.json({
      sessions: history.sessions,
      stats: history.stats,
      trends: history.trends,
    });
  } catch (error) {
    console.error("Error fetching practice history:", error);
    res.status(500).json({
      error: "Failed to fetch practice history",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;

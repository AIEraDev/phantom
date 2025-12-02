import { Router, Request, Response } from "express";
import { ghostService } from "../services/ghost.service";
import { matchService } from "../services/match.service";
import { authenticateToken } from "../middleware/auth.middleware";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * GET /api/ghosts/challenge/:challengeId
 * Get available ghosts for a challenge
 * Returns ghost metadata (username, score, duration)
 * Requirements: 14.1
 */
router.get("/challenge/:challengeId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;

    if (!challengeId) {
      return res.status(400).json({
        error: "challengeId is required",
        code: "MISSING_CHALLENGE_ID",
      });
    }

    const ghosts = await ghostService.getGhostsForChallenge(challengeId);

    // Return ghost metadata without full events for list view
    const ghostMetadata = ghosts.map((ghost) => ({
      id: ghost.id,
      challengeId: ghost.challenge_id,
      userId: ghost.user_id,
      username: ghost.username,
      score: ghost.score,
      durationMs: ghost.duration_ms,
      isAI: ghost.is_ai,
      createdAt: ghost.created_at,
    }));

    res.json({ ghosts: ghostMetadata });
  } catch (error) {
    console.error("Error fetching ghosts for challenge:", error);
    res.status(500).json({
      error: "Failed to fetch ghosts",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * GET /api/ghosts/:ghostId
 * Get full ghost recording with events
 * Requirements: 14.2
 */
router.get("/:ghostId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ghostId } = req.params;

    if (!ghostId) {
      return res.status(400).json({
        error: "ghostId is required",
        code: "MISSING_GHOST_ID",
      });
    }

    const ghost = await ghostService.getGhostById(ghostId);

    if (!ghost) {
      return res.status(404).json({
        error: "Ghost recording not found",
        code: "GHOST_NOT_FOUND",
      });
    }

    // Return full ghost recording with events
    res.json({
      ghost: {
        id: ghost.id,
        challengeId: ghost.challenge_id,
        userId: ghost.user_id,
        username: ghost.username,
        score: ghost.score,
        durationMs: ghost.duration_ms,
        events: ghost.events,
        isAI: ghost.is_ai,
        createdAt: ghost.created_at,
      },
    });
  } catch (error) {
    console.error("Error fetching ghost recording:", error);
    res.status(500).json({
      error: "Failed to fetch ghost recording",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * POST /api/ghosts/from-match
 * Create ghost from completed match
 * Validates user won the match
 * Requirements: 14.5
 */
router.post("/from-match", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { matchId } = req.body;
    const userId = req.user!.userId;

    if (!matchId) {
      return res.status(400).json({
        error: "matchId is required",
        code: "MISSING_MATCH_ID",
      });
    }

    // Get match to validate
    const match = await matchService.getMatchById(matchId);

    if (!match) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    // Validate match is completed
    if (match.status !== "completed") {
      return res.status(400).json({
        error: "Can only create ghost from completed matches",
        code: "MATCH_NOT_COMPLETED",
      });
    }

    // Validate user won the match
    if (match.winner_id !== userId) {
      return res.status(403).json({
        error: "Only match winners can save ghost recordings",
        code: "NOT_WINNER",
      });
    }

    // Create ghost recording
    const ghost = await ghostService.saveGhostFromMatch(matchId, userId);

    res.status(201).json({
      ghost: {
        id: ghost.id,
        challengeId: ghost.challenge_id,
        userId: ghost.user_id,
        username: ghost.username,
        score: ghost.score,
        durationMs: ghost.duration_ms,
        isAI: ghost.is_ai,
        createdAt: ghost.created_at,
      },
    });
  } catch (error: any) {
    console.error("Error creating ghost from match:", error);

    // Handle specific error messages from service
    if (error.message === "Match not found or not completed") {
      return res.status(404).json({
        error: error.message,
        code: "MATCH_NOT_FOUND",
      });
    }

    if (error.message === "Only match winners can save ghost recordings") {
      return res.status(403).json({
        error: error.message,
        code: "NOT_WINNER",
      });
    }

    res.status(500).json({
      error: "Failed to create ghost recording",
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * POST /api/ghosts/race
 * Start ghost race session
 * Returns race ID and ghost data
 * Requirements: 14.1, 14.2
 */
router.post("/race", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { challengeId, ghostId } = req.body;
    const userId = req.user!.userId;

    if (!challengeId) {
      return res.status(400).json({
        error: "challengeId is required",
        code: "MISSING_CHALLENGE_ID",
      });
    }

    let ghost;

    if (ghostId) {
      // Get specific ghost
      ghost = await ghostService.getGhostById(ghostId);

      if (!ghost) {
        return res.status(404).json({
          error: "Ghost recording not found",
          code: "GHOST_NOT_FOUND",
        });
      }

      // Validate ghost is for the correct challenge
      if (ghost.challenge_id !== challengeId) {
        return res.status(400).json({
          error: "Ghost recording is not for the specified challenge",
          code: "GHOST_CHALLENGE_MISMATCH",
        });
      }
    } else {
      // Get top ghost for challenge, or generate AI ghost
      ghost = await ghostService.getTopGhost(challengeId);

      if (!ghost) {
        return res.status(404).json({
          error: "No ghost available for this challenge",
          code: "NO_GHOST_AVAILABLE",
        });
      }
    }

    // Generate unique race ID
    const raceId = uuidv4();

    res.status(201).json({
      raceId,
      ghost: {
        id: ghost.id,
        challengeId: ghost.challenge_id,
        userId: ghost.user_id,
        username: ghost.username,
        score: ghost.score,
        durationMs: ghost.duration_ms,
        events: ghost.events,
        isAI: ghost.is_ai,
        createdAt: ghost.created_at,
      },
    });
  } catch (error) {
    console.error("Error starting ghost race:", error);
    res.status(500).json({
      error: "Failed to start ghost race",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;

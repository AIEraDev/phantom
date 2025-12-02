import { Router, Request, Response } from "express";
import { matchmakingService } from "../redis/matchmaking.service";
import { authenticateToken } from "../middleware/auth.middleware";
import { UserService } from "../services/user.service";

const router = Router();
const userService = new UserService();

// POST /api/matchmaking/queue - Join matchmaking queue
router.post("/queue", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const { difficulty, language } = req.body;
    const userId = req.user.userId;

    // Validate difficulty if provided
    if (difficulty && !["easy", "medium", "hard", "expert", "any"].includes(difficulty)) {
      return res.status(400).json({
        error: "Invalid difficulty. Must be one of: easy, medium, hard, expert, any",
        code: "INVALID_DIFFICULTY",
      });
    }

    // Validate language if provided
    if (language && !["javascript", "python", "typescript", "any"].includes(language)) {
      return res.status(400).json({
        error: "Invalid language. Must be one of: javascript, python, typescript, any",
        code: "INVALID_LANGUAGE",
      });
    }

    // Get user's rating
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Remove user from any existing queues first
    await matchmakingService.removeFromAllQueues(userId);

    // Add user to queue
    const position = await matchmakingService.addToQueue(userId, user.rating, difficulty, language);

    // Get estimated wait time
    const estimatedWait = await matchmakingService.getEstimatedWaitTime(userId, difficulty, language);

    res.status(200).json({
      queueId: `${difficulty || "any"}:${language || "any"}`,
      position,
      estimatedWait,
      message: "Successfully joined matchmaking queue",
    });
  } catch (error) {
    console.error("Join queue error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// DELETE /api/matchmaking/queue - Leave matchmaking queue
router.delete("/queue", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const userId = req.user.userId;

    // Remove user from all queues
    await matchmakingService.removeFromAllQueues(userId);

    res.status(200).json({
      message: "Successfully left matchmaking queue",
    });
  } catch (error) {
    console.error("Leave queue error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// POST /api/matchmaking/custom - Create custom match
router.post("/custom", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const { challengeId, isPrivate } = req.body;
    const userId = req.user.userId;

    // Validate challengeId
    if (!challengeId) {
      return res.status(400).json({
        error: "Challenge ID is required",
        code: "MISSING_CHALLENGE_ID",
      });
    }

    // Validate isPrivate
    if (typeof isPrivate !== "boolean") {
      return res.status(400).json({
        error: "isPrivate must be a boolean",
        code: "INVALID_IS_PRIVATE",
      });
    }

    // Get user's rating
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // TODO: Implement custom match creation logic
    // For now, return a placeholder response
    // This will be fully implemented when we add match creation service

    const matchId = `custom-${Date.now()}`;
    const joinCode = isPrivate ? `JOIN-${Math.random().toString(36).substring(2, 8).toUpperCase()}` : undefined;

    res.status(201).json({
      matchId,
      challengeId,
      isPrivate,
      joinCode,
      message: "Custom match created successfully",
    });
  } catch (error) {
    console.error("Create custom match error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;

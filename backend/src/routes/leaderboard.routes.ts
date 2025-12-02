import { Router, Request, Response } from "express";
import { leaderboardService } from "../services/leaderboard.service";
import { TimePeriod } from "../redis/leaderboard.service";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// GET /api/leaderboard/global - Get global leaderboard
router.get("/global", authenticateToken, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const period = (req.query.period as TimePeriod) || "all-time";
    const search = req.query.search as string;

    // Validate period
    const validPeriods: TimePeriod[] = ["daily", "weekly", "all-time"];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: "Invalid time period. Must be one of: daily, weekly, all-time",
        code: "INVALID_PERIOD",
      });
    }

    // If search query provided, use search functionality
    if (search && search.trim().length > 0) {
      const result = await leaderboardService.searchLeaderboard(search, limit, period);
      return res.status(200).json(result);
    }

    // Otherwise, get top players
    const result = await leaderboardService.getGlobalLeaderboard(limit, period);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Limit") || error.message.includes("search query")) {
        return res.status(400).json({
          error: error.message,
          code: "VALIDATION_ERROR",
        });
      }
    }
    console.error("Get leaderboard error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// GET /api/leaderboard/user/:userId - Get user's leaderboard position
router.get("/user/:userId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const period = (req.query.period as TimePeriod) || "all-time";

    // Validate period
    const validPeriods: TimePeriod[] = ["daily", "weekly", "all-time"];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: "Invalid time period. Must be one of: daily, weekly, all-time",
        code: "INVALID_PERIOD",
      });
    }

    const position = await leaderboardService.getUserLeaderboardPosition(userId, period);

    if (!position) {
      return res.status(404).json({
        error: "User not found on leaderboard",
        code: "USER_NOT_ON_LEADERBOARD",
      });
    }

    res.status(200).json({ player: position });
  } catch (error) {
    console.error("Get user leaderboard position error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;

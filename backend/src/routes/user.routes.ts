import { Router, Request, Response } from "express";
import { UserService } from "../services/user.service";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();
const userService = new UserService();

// Helper to transform snake_case to camelCase for user response
function transformUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    rating: user.rating,
    wins: user.wins,
    losses: user.losses,
    totalMatches: user.total_matches,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

// GET /api/users/:id - Get user profile
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({
        error: "Invalid user ID",
        code: "INVALID_USER_ID",
      });
    }

    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    res.status(200).json({ user: transformUser(user) });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// PATCH /api/users/:id - Update user profile
router.patch("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { displayName, avatarUrl } = req.body;

    // Check if user is updating their own profile
    if (!req.user || req.user.userId !== id) {
      return res.status(403).json({
        error: "You can only update your own profile",
        code: "FORBIDDEN",
      });
    }

    // Check if at least one field is provided
    if (displayName === undefined && avatarUrl === undefined) {
      return res.status(400).json({
        error: "At least one field must be provided",
        code: "NO_FIELDS_PROVIDED",
      });
    }

    const updatedUser = await userService.updateProfile(id, {
      displayName,
      avatarUrl,
    });

    res.status(200).json({ user: transformUser(updatedUser) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "User not found") {
        return res.status(404).json({
          error: error.message,
          code: "USER_NOT_FOUND",
        });
      }
      if (error.message.includes("Invalid") || error.message.includes("must be") || error.message.includes("cannot be") || error.message.includes("contains")) {
        return res.status(400).json({
          error: error.message,
          code: "VALIDATION_ERROR",
        });
      }
    }
    console.error("Update user profile error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// GET /api/users/:id/stats - Get user statistics
router.get("/:id/stats", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({
        error: "Invalid user ID",
        code: "INVALID_USER_ID",
      });
    }

    const stats = await userService.getUserStats(id);

    res.status(200).json({ stats });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "User not found") {
        return res.status(404).json({
          error: error.message,
          code: "USER_NOT_FOUND",
        });
      }
    }
    console.error("Get user stats error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// GET /api/users/:id/matches - Get user match history with pagination
router.get("/:id/matches", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({
        error: "Invalid user ID",
        code: "INVALID_USER_ID",
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await userService.getUserMatches(id, limit, offset);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Limit") || error.message.includes("Offset")) {
        return res.status(400).json({
          error: error.message,
          code: "INVALID_PAGINATION",
        });
      }
    }
    console.error("Get user matches error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;

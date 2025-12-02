import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { authenticateToken } from "../middleware/auth.middleware";
import { authRateLimit } from "../middleware/rateLimit.middleware";
import { isValidEmail, isValidUsername } from "../middleware/security.middleware";

const router = Router();
const authService = new AuthService();

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

// POST /api/auth/register
router.post("/register", authRateLimit, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        error: "Missing required fields",
        fields: {
          email: !email ? "Email is required" : undefined,
          password: !password ? "Password is required" : undefined,
          username: !username ? "Username is required" : undefined,
        },
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        message: "Please provide a valid email address",
      });
    }

    // Validate username format
    if (!isValidUsername(username)) {
      return res.status(400).json({
        error: "Invalid username format",
        message: "Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: "Weak password",
        message: "Password must be at least 8 characters long",
      });
    }

    const result = await authService.register({ email, password, username });

    res.status(201).json({
      token: result.token,
      user: transformUser(result.user),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("already") || error.message.includes("taken")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message.includes("Invalid") || error.message.includes("must be")) {
        return res.status(400).json({ error: error.message });
      }
    }
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", authRateLimit, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        fields: {
          email: !email ? "Email is required" : undefined,
          password: !password ? "Password is required" : undefined,
        },
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        message: "Please provide a valid email address",
      });
    }

    const result = await authService.login({ email, password });

    res.status(200).json({
      token: result.token,
      user: transformUser(result.user),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message });
      }
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me - Get current user (protected route)
router.get("/me", authenticateToken, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch full user from database
    const result = await authService.getUserById(req.user.userId);
    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ user: transformUser(result) });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

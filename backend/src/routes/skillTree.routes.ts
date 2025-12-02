import { Router, Request, Response } from "express";
import { SkillTreeService } from "../services/skillTree.service";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();
const skillTreeService = new SkillTreeService();

/**
 * GET /api/skill-tree
 * Get full skill tree with user progress
 * Returns node positions and edge connections
 * Requirements: 16.3
 */
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const skillTree = await skillTreeService.getSkillTree(userId);

    res.json({
      nodes: skillTree.nodes,
      edges: skillTree.edges,
    });
  } catch (error) {
    console.error("Error fetching skill tree:", error);
    res.status(500).json({ error: "Failed to fetch skill tree" });
  }
});

/**
 * GET /api/skill-tree/progress
 * Get user's progress on all challenges
 * Returns completion status, mastery, and best scores
 * Requirements: 16.2, 16.5
 */
router.get("/progress", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const progress = await skillTreeService.getAllProgress(userId);

    res.json({ progress });
  } catch (error) {
    console.error("Error fetching skill tree progress:", error);
    res.status(500).json({ error: "Failed to fetch skill tree progress" });
  }
});

/**
 * GET /api/skill-tree/unlocked
 * Get list of unlocked challenges for user
 * Query params:
 *   - difficulty: easy | medium | hard | expert (optional)
 *   - category: arrays | strings | trees | graphs | dp (optional)
 * Requirements: 16.1, 17.1
 */
router.get("/unlocked", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { difficulty, category } = req.query;

    // Validate difficulty if provided
    if (difficulty && !["easy", "medium", "hard", "expert"].includes(difficulty as string)) {
      return res.status(400).json({
        error: "Invalid difficulty. Must be one of: easy, medium, hard, expert",
      });
    }

    // Validate category if provided
    if (category && !["arrays", "strings", "trees", "graphs", "dp"].includes(category as string)) {
      return res.status(400).json({
        error: "Invalid category. Must be one of: arrays, strings, trees, graphs, dp",
      });
    }

    let challenges = await skillTreeService.getUnlockedChallenges(userId);

    // Filter by difficulty if provided
    if (difficulty) {
      challenges = challenges.filter((c) => c.difficulty === difficulty);
    }

    // Filter by category if provided - need to get skill tree to check categories
    if (category) {
      const skillTree = await skillTreeService.getSkillTree(userId);
      const categoryNodeChallengeIds = new Set(skillTree.nodes.filter((n) => n.category === category).map((n) => n.challengeId));
      challenges = challenges.filter((c) => categoryNodeChallengeIds.has(c.id));
    }

    res.json({ challenges });
  } catch (error) {
    console.error("Error fetching unlocked challenges:", error);
    res.status(500).json({ error: "Failed to fetch unlocked challenges" });
  }
});

/**
 * POST /api/skill-tree/check-unlock
 * Check if specific challenge is unlocked
 * Returns prerequisites if locked
 * Requirements: 16.4, 16.6
 */
router.post("/check-unlock", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { challengeId } = req.body;

    if (!challengeId) {
      return res.status(400).json({ error: "challengeId is required" });
    }

    const result = await skillTreeService.isChallengeUnlocked(userId, challengeId);

    res.json({
      unlocked: result.unlocked,
      prerequisites: result.missingPrerequisites,
    });
  } catch (error) {
    console.error("Error checking challenge unlock:", error);
    res.status(500).json({ error: "Failed to check challenge unlock status" });
  }
});

export default router;

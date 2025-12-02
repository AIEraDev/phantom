import { Router, Request, Response } from "express";
import { ChallengeService } from "../services/challenge.service";

const router = Router();
const challengeService = new ChallengeService();

/**
 * GET /api/challenges
 * Get all challenges with optional filtering
 * Query params:
 *   - difficulty: easy | medium | hard | expert
 *   - tags: comma-separated list of tags
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { difficulty, tags } = req.query;

    // Validate difficulty if provided
    if (difficulty && !["easy", "medium", "hard", "expert"].includes(difficulty as string)) {
      return res.status(400).json({
        error: "Invalid difficulty. Must be one of: easy, medium, hard, expert",
      });
    }

    // Parse tags if provided
    let parsedTags: string[] | undefined;
    if (tags) {
      parsedTags = (tags as string).split(",").map((tag) => tag.trim());
    }

    const challenges = await challengeService.getAllChallenges({
      difficulty: difficulty as "easy" | "medium" | "hard" | "expert" | undefined,
      tags: parsedTags,
    });

    res.json({ challenges });
  } catch (error) {
    console.error("Error fetching challenges:", error);
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

/**
 * GET /api/challenges/:id
 * Get a specific challenge by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const challenge = await challengeService.getChallengeById(id);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    res.json({ challenge });
  } catch (error) {
    console.error("Error fetching challenge:", error);
    res.status(500).json({ error: "Failed to fetch challenge" });
  }
});

export default router;

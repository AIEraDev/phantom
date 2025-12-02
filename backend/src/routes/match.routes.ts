import { Router, Request, Response } from "express";
import { matchService } from "../services/match.service";
import { authenticateToken } from "../middleware/auth.middleware";
import { spectatorService } from "../redis/spectator.service";
import { matchStateService } from "../redis/matchState.service";
import { chatService } from "../services/chat.service";
import pool from "../db/connection";

const router = Router();

// GET /api/matches/active - Get all active matches for spectating
router.get("/active", authenticateToken, async (req: Request, res: Response) => {
  try {
    // Query for active matches
    const result = await pool.query(
      `SELECT 
        m.id,
        m.challenge_id,
        m.player1_id,
        m.player2_id,
        m.status,
        m.started_at,
        c.title as challenge_title,
        c.difficulty as challenge_difficulty,
        p1.username as player1_username,
        p1.rating as player1_rating,
        p2.username as player2_username,
        p2.rating as player2_rating
      FROM matches m
      JOIN challenges c ON m.challenge_id = c.id
      JOIN users p1 ON m.player1_id = p1.id
      JOIN users p2 ON m.player2_id = p2.id
      WHERE m.status = 'active'
      ORDER BY m.started_at DESC
      LIMIT 20`
    );

    // Get spectator counts for each match
    const matches = await Promise.all(
      result.rows.map(async (row) => {
        const spectatorCount = await spectatorService.getSpectatorCount(row.id);
        return {
          id: row.id,
          player1: {
            id: row.player1_id,
            username: row.player1_username,
            rating: row.player1_rating,
          },
          player2: {
            id: row.player2_id,
            username: row.player2_username,
            rating: row.player2_rating,
          },
          challenge: {
            title: row.challenge_title,
            difficulty: row.challenge_difficulty,
          },
          spectatorCount,
          startedAt: row.started_at,
        };
      })
    );

    res.status(200).json({ matches });
  } catch (error) {
    console.error("Get active matches error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// GET /api/matches/:id - Get match details
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const match = await matchService.getMatchById(id);

    if (!match) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    // Verify user is authorized to view this match
    // Users can view matches they participated in
    if (req.user && (match.player1_id === req.user.userId || match.player2_id === req.user.userId)) {
      // Get challenge details
      const challengeResult = await pool.query(`SELECT id, title, description, difficulty, time_limit, starter_code, test_cases FROM challenges WHERE id = $1`, [match.challenge_id]);

      // Get player details
      const playersResult = await pool.query(`SELECT id, username, rating FROM users WHERE id IN ($1, $2)`, [match.player1_id, match.player2_id]);

      const players = playersResult.rows;
      const player1 = players.find((p) => p.id === match.player1_id);
      const player2 = players.find((p) => p.id === match.player2_id);

      // Get match state from Redis for current code
      const matchState = await matchStateService.getMatch(id);

      // User is a participant, return full match details with challenge
      // Use database started_at as the authoritative source, convert to timestamp
      const dbStartedAt = match.started_at ? new Date(match.started_at).getTime() : null;

      return res.status(200).json({
        match: {
          ...match,
          challenge: challengeResult.rows[0] || null,
          player1,
          player2,
          matchState: matchState
            ? {
                player1Code: matchState.player1Code,
                player2Code: matchState.player2Code,
                player1Language: matchState.player1Language,
                player2Language: matchState.player2Language,
                // Use database started_at as authoritative source
                startedAt: dbStartedAt || matchState.startedAt,
              }
            : {
                // Even without Redis state, provide timing from database
                startedAt: dbStartedAt,
              },
        },
      });
    }

    // For non-participants, only return completed matches with limited info
    if (match.status !== "completed") {
      return res.status(403).json({
        error: "You can only view completed matches you didn't participate in",
        code: "FORBIDDEN",
      });
    }

    // Return match without sensitive data for non-participants
    const publicMatch = {
      id: match.id,
      challenge_id: match.challenge_id,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      winner_id: match.winner_id,
      player1_score: match.player1_score,
      player2_score: match.player2_score,
      duration: match.duration,
      status: match.status,
      completed_at: match.completed_at,
      created_at: match.created_at,
    };

    res.status(200).json({ match: publicMatch });
  } catch (error) {
    console.error("Get match error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// GET /api/matches/:id/replay - Get match replay data
router.get("/:id/replay", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const replayData = await matchService.getMatchReplay(id);

    if (!replayData) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    res.status(200).json(replayData);
  } catch (error: any) {
    console.error("Get match replay error:", error);

    // Handle specific error cases
    if (error.message === "Replay only available for completed matches") {
      return res.status(400).json({
        error: error.message,
        code: "MATCH_NOT_COMPLETED",
      });
    }

    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// POST /api/matches/:id/spectate - Join as spectator
router.post("/:id/spectate", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    // Get match details
    const match = await matchService.getMatchById(id);

    if (!match) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    // Only allow spectating active matches
    if (match.status !== "active") {
      return res.status(400).json({
        error: "Can only spectate active matches",
        code: "MATCH_NOT_ACTIVE",
      });
    }

    // Don't allow players to spectate their own match
    if (match.player1_id === req.user.userId || match.player2_id === req.user.userId) {
      return res.status(400).json({
        error: "Cannot spectate your own match",
        code: "CANNOT_SPECTATE_OWN_MATCH",
      });
    }

    // Get match state from Redis
    const matchState = await matchStateService.getMatch(id);

    if (!matchState) {
      return res.status(404).json({
        error: "Match state not found",
        code: "MATCH_STATE_NOT_FOUND",
      });
    }

    // Add user as spectator
    await spectatorService.addSpectator(id, req.user.userId, req.user.username);

    // Get spectator count
    const spectatorCount = await spectatorService.getSpectatorCount(id);

    // Get challenge details
    const challengeResult = await pool.query(`SELECT id, title, description, difficulty FROM challenges WHERE id = $1`, [matchState.challengeId]);
    const challenge = challengeResult.rows[0] || null;

    // Get player details
    const playersResult = await pool.query(`SELECT id, username, rating FROM users WHERE id IN ($1, $2)`, [matchState.player1Id, matchState.player2Id]);
    const players = playersResult.rows;
    const player1 = players.find((p) => p.id === matchState.player1Id);
    const player2 = players.find((p) => p.id === matchState.player2Id);

    res.status(200).json({
      success: true,
      matchState: {
        matchId: id,
        challenge: challenge
          ? {
              id: challenge.id,
              title: challenge.title,
              description: challenge.description,
              difficulty: challenge.difficulty,
            }
          : null,
        player1: player1
          ? {
              id: player1.id,
              username: player1.username,
              rating: player1.rating,
            }
          : null,
        player2: player2
          ? {
              id: player2.id,
              username: player2.username,
              rating: player2.rating,
            }
          : null,
        player1Code: matchState.player1Code,
        player2Code: matchState.player2Code,
        player1Language: matchState.player1Language,
        player2Language: matchState.player2Language,
        player1Submitted: matchState.player1Submitted || false,
        player2Submitted: matchState.player2Submitted || false,
        status: matchState.status,
        startedAt: matchState.startedAt,
      },
      spectatorCount,
    });
  } catch (error) {
    console.error("Join spectate error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

// GET /api/matches/:id/chat - Get chat history for a match
router.get("/:id/chat", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    // Get match to verify it exists
    const match = await matchService.getMatchById(id);

    if (!match) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    // Get chat history
    const messages = await chatService.getRecentMessages(id, limit);

    res.status(200).json({
      messages: messages.map((msg) => ({
        id: msg.id,
        username: msg.username,
        message: msg.message,
        messageType: msg.messageType,
        timestamp: msg.createdAt.getTime(),
      })),
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;

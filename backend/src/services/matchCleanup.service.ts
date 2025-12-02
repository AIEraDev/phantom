import pool from "../db/connection";

export interface MatchCleanupConfig {
  cleanupInterval: number; // milliseconds
  staleMatchThresholdMinutes: number; // minutes before a match is considered stale
}

/**
 * MatchCleanupService
 * Automatically cleans up stale/abandoned matches that have been active too long
 */
export class MatchCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private config: MatchCleanupConfig;

  constructor(config: Partial<MatchCleanupConfig> = {}) {
    this.config = {
      cleanupInterval: config.cleanupInterval || 10000, // 10 seconds - check frequently for timed-out matches
      staleMatchThresholdMinutes: config.staleMatchThresholdMinutes || 30, // 30 minutes
    };
  }

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.intervalId) {
      console.log("Match cleanup service already running");
      return;
    }

    console.log(`Starting match cleanup service (interval: ${this.config.cleanupInterval}ms, threshold: ${this.config.staleMatchThresholdMinutes} minutes)`);

    // Run immediately on start
    this.cleanup().catch((error) => {
      console.error("Error during initial match cleanup:", error);
    });

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.cleanup().catch((error) => {
        console.error("Error during match cleanup:", error);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Match cleanup service stopped");
    }
  }

  /**
   * Clean up stale matches and auto-complete timed-out matches
   */
  private async cleanup(): Promise<void> {
    if (this.isProcessing) {
      return; // Skip if already processing
    }

    this.isProcessing = true;

    try {
      // First, check for matches that have exceeded their time limit and should be auto-completed
      await this.autoCompleteTimedOutMatches();

      // Mark matches as abandoned if they've been active for too long (safety net)
      const result = await pool.query(
        `UPDATE matches 
         SET status = 'abandoned', 
             completed_at = NOW()
         WHERE status = 'active' 
         AND started_at < NOW() - INTERVAL '${this.config.staleMatchThresholdMinutes} minutes'
         RETURNING id, player1_id, player2_id`
      );

      if (result.rowCount && result.rowCount > 0) {
        console.log(
          `[MatchCleanup] Cleaned up ${result.rowCount} stale match(es):`,
          result.rows.map((r) => r.id)
        );
      }

      // Also clean up lobby matches that never started (older than 10 minutes)
      const lobbyResult = await pool.query(
        `UPDATE matches 
         SET status = 'abandoned', 
             completed_at = NOW()
         WHERE status = 'lobby' 
         AND created_at < NOW() - INTERVAL '10 minutes'
         RETURNING id`
      );

      if (lobbyResult.rowCount && lobbyResult.rowCount > 0) {
        console.log(
          `[MatchCleanup] Abandoned ${lobbyResult.rowCount} stale lobby match(es):`,
          lobbyResult.rows.map((r) => r.id)
        );
      }
    } catch (error) {
      console.error("[MatchCleanup] Error cleaning up matches:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Auto-complete matches that have exceeded their time limit
   */
  private async autoCompleteTimedOutMatches(): Promise<void> {
    try {
      // Find active matches where time has expired
      // Join with challenges to get the time_limit
      const timedOutMatches = await pool.query(
        `SELECT m.id, m.player1_id, m.player2_id, m.challenge_id, c.time_limit,
                EXTRACT(EPOCH FROM (NOW() - m.started_at)) as elapsed_seconds
         FROM matches m
         JOIN challenges c ON m.challenge_id = c.id
         WHERE m.status = 'active'
         AND m.started_at IS NOT NULL
         AND EXTRACT(EPOCH FROM (NOW() - m.started_at)) > c.time_limit + 10` // 10 second grace period
      );

      if (timedOutMatches.rows.length === 0) {
        return;
      }

      console.log(`[MatchCleanup] Found ${timedOutMatches.rows.length} timed-out match(es) to auto-complete`);

      // Import match service for completion
      const { matchService } = await import("./match.service");

      for (const match of timedOutMatches.rows) {
        try {
          console.log(`[MatchCleanup] Auto-completing match ${match.id} (elapsed: ${Math.round(match.elapsed_seconds)}s, limit: ${match.time_limit}s)`);

          // Complete the match - this will judge both players' current code
          const result = await matchService.completeMatch(match.id);

          console.log(`[MatchCleanup] Match ${match.id} auto-completed. Winner: ${result.winnerId || "tie"}`);

          // Notify players via WebSocket
          await this.notifyMatchCompleted(match.id, result);
        } catch (error) {
          console.error(`[MatchCleanup] Failed to auto-complete match ${match.id}:`, error);
        }
      }
    } catch (error) {
      console.error("[MatchCleanup] Error checking for timed-out matches:", error);
    }
  }

  /**
   * Notify players that match has been auto-completed
   */
  private async notifyMatchCompleted(matchId: string, result: { winnerId: string | null; player1Score: number; player2Score: number; matchId: string }): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { io } = await import("../index");
      const { sessionManager } = await import("../websocket/sessionManager");
      const { matchStateService } = await import("../redis/matchState.service");
      const { UserService } = await import("./user.service");

      const match = await matchStateService.getMatch(matchId);
      if (!match) return;

      const userService = new UserService();
      let winner = null;
      if (result.winnerId) {
        winner = await userService.getUserById(result.winnerId);
      }

      const matchResultData = {
        winner: winner
          ? {
              id: winner.id,
              username: winner.username,
              displayName: winner.display_name ?? winner.username,
              avatarUrl: winner.avatar_url ?? undefined,
            }
          : null,
        scores: {
          player1Score: result.player1Score,
          player2Score: result.player2Score,
        },
        feedback: {
          player1Feedback: "Match auto-completed due to time expiration.",
          player2Feedback: "Match auto-completed due to time expiration.",
        },
        duration: 0,
        matchId: result.matchId,
        autoCompleted: true,
      };

      // Emit to both players
      const player1Session = sessionManager.getSessionByUserId(match.player1Id);
      const player2Session = sessionManager.getSessionByUserId(match.player2Id);

      if (player1Session) {
        io.to(player1Session.socketId).emit("match_result", matchResultData);
      }
      if (player2Session) {
        io.to(player2Session.socketId).emit("match_result", matchResultData);
      }

      // Emit to spectators
      io.to(`match:${matchId}:spectators`).emit("match_result", matchResultData);

      // Stop timer sync for this match
      const { stopTimerSync } = await import("../websocket/lobbyHandler");
      stopTimerSync(matchId);
    } catch (error) {
      console.error("[MatchCleanup] Error notifying match completion:", error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    processing: boolean;
    config: MatchCleanupConfig;
  } {
    return {
      running: this.intervalId !== null,
      processing: this.isProcessing,
      config: this.config,
    };
  }
}

// Export singleton instance
export const matchCleanupService = new MatchCleanupService();

/**
 * WebSocket handler for AI Code Coach hint requests
 * Requirements: 1.1, 1.4, 3.1
 */

import { Server } from "socket.io";
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from "./types";
import { matchStateService } from "../redis/matchState.service";
import { sessionManager } from "./sessionManager";
import { requestHint, canRequestHint, getHintCount } from "../services/hint.service";
import { ChallengeService } from "../services/challenge.service";
import { UserService } from "../services/user.service";

// Store reference to io for emitting analysis events
let ioInstance: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

/**
 * Setup coach event handlers for hint requests
 * Requirements: 1.1, 1.4
 */
export function setupCoachHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: AuthenticatedSocket): void {
  if (!socket.userId) {
    return;
  }

  // Store io instance for later use
  ioInstance = io;

  /**
   * Handle request_hint event
   * Requirements: 1.1, 1.4
   * - Handle 'request_hint' event
   * - Emit 'hint_response' or 'hint_error'
   * - Emit 'hint_status_update' after hint consumed
   */
  socket.on("request_hint", async (data: { matchId: string; currentCode: string; language: string }) => {
    try {
      if (!socket.userId) {
        socket.emit("hint_error", { error: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { matchId, currentCode, language } = data;

      // Validate input
      if (!matchId || typeof currentCode !== "string" || !language) {
        socket.emit("hint_error", { error: "Invalid hint request data", code: "INVALID_DATA" });
        return;
      }

      // Get match state
      const match = await matchStateService.getMatch(matchId);

      if (!match) {
        socket.emit("hint_error", { error: "Match not found", code: "MATCH_NOT_FOUND" });
        return;
      }

      // Verify user is a player in this match
      if (match.player1Id !== socket.userId && match.player2Id !== socket.userId) {
        socket.emit("hint_error", { error: "Not a player in this match", code: "UNAUTHORIZED" });
        return;
      }

      // Verify match is active
      if (match.status !== "active") {
        socket.emit("hint_error", { error: "Match is not active", code: "MATCH_NOT_ACTIVE" });
        return;
      }

      // Check if hint can be requested (cooldown + limit)
      const status = await canRequestHint(matchId, socket.userId);
      if (!status.allowed) {
        socket.emit("hint_error", {
          error: status.reason || "Cannot request hint at this time",
          cooldownRemaining: status.cooldownRemaining,
        });
        return;
      }

      // Get challenge data
      const challengeService = new ChallengeService();
      const challenge = await challengeService.getChallengeById(match.challengeId);

      if (!challenge) {
        socket.emit("hint_error", { error: "Challenge not found", code: "CHALLENGE_NOT_FOUND" });
        return;
      }

      // Get player rating for hint complexity adjustment
      const userService = new UserService();
      const user = await userService.getUserById(socket.userId);
      const playerRating = user?.rating;

      // Determine hint level based on hints already used
      const hintsUsed = await getHintCount(matchId, socket.userId);
      const hintLevel = hintsUsed + 1; // Next hint level (1, 2, or 3)

      // Request the hint
      const result = await requestHint(
        {
          matchId,
          userId: socket.userId,
          challengeId: match.challengeId,
          currentCode,
          language,
          hintLevel,
        },
        challenge,
        playerRating
      );

      if (result.success) {
        // Emit hint response
        socket.emit("hint_response", { hint: result.hint });

        // Emit hint status update after hint consumed
        const newHintsUsed = await getHintCount(matchId, socket.userId);
        socket.emit("hint_status_update", {
          hintsUsed: newHintsUsed,
          hintsRemaining: 3 - newHintsUsed,
        });
      } else {
        // Emit hint error
        socket.emit("hint_error", {
          error: result.error,
          cooldownRemaining: result.cooldownRemaining,
        });
      }
    } catch (error) {
      console.error("Error handling request_hint:", error);
      socket.emit("hint_error", {
        error: "Failed to process hint request",
        code: "HINT_REQUEST_FAILED",
      });
    }
  });
}

/**
 * Emit analysis_ready event when post-match analysis completes
 * Requirements: 3.1
 * @param userId - The user ID to notify
 * @param matchId - The match ID
 * @param analysis - The generated analysis
 */
export function emitAnalysisReady(userId: string, matchId: string, analysis: any): void {
  if (!ioInstance) {
    console.error("WebSocket io instance not initialized for coach handler");
    return;
  }

  const session = sessionManager.getSessionByUserId(userId);
  if (session) {
    ioInstance.to(session.socketId).emit("analysis_ready", {
      matchId,
      analysis,
    });
  }
}

/**
 * Emit analysis_error event when post-match analysis fails
 * Requirements: 3.1
 * @param userId - The user ID to notify
 * @param matchId - The match ID
 * @param error - The error message
 */
export function emitAnalysisError(userId: string, matchId: string, error: string): void {
  if (!ioInstance) {
    console.error("WebSocket io instance not initialized for coach handler");
    return;
  }

  const session = sessionManager.getSessionByUserId(userId);
  if (session) {
    ioInstance.to(session.socketId).emit("analysis_error", {
      matchId,
      error,
    });
  }
}

/**
 * Get the io instance for external use
 */
export function getCoachIoInstance(): Server<ClientToServerEvents, ServerToClientEvents> | null {
  return ioInstance;
}

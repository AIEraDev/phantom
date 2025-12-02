import { Server } from "socket.io";
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from "./types";
import { matchStateService } from "../redis/matchState.service";
import { sessionManager } from "./sessionManager";
import { powerUpService } from "../services/powerup.service";
import { PowerUpType } from "../types/powerups";

/**
 * Setup power-up event handlers
 * Requirements: 1.3, 2.4, 3.3, 7.1, 7.2
 */
export function setupPowerUpHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: AuthenticatedSocket): void {
  if (!socket.userId) {
    return;
  }

  /**
   * Handle activate_powerup event
   * Requirements: 1.3, 2.4, 3.3
   */
  socket.on("activate_powerup", async (data: { matchId: string; powerUpType: PowerUpType }) => {
    try {
      if (!socket.userId || !socket.user) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { matchId, powerUpType } = data;

      // Validate input
      if (!matchId || !powerUpType) {
        socket.emit("powerup_error", {
          error: "Invalid power-up activation data",
          code: "INVALID_DATA",
        });
        return;
      }

      // Validate power-up type
      const validTypes: PowerUpType[] = ["time_freeze", "code_peek", "debug_shield"];
      if (!validTypes.includes(powerUpType)) {
        socket.emit("powerup_error", {
          error: "Invalid power-up type",
          code: "INVALID_TYPE",
        });
        return;
      }

      // Get match state to validate participation
      const match = await matchStateService.getMatch(matchId);

      if (!match) {
        socket.emit("powerup_error", {
          error: "Match not found",
          code: "MATCH_NOT_FOUND",
        });
        return;
      }

      // Verify user is a player in this match
      if (match.player1Id !== socket.userId && match.player2Id !== socket.userId) {
        socket.emit("powerup_error", {
          error: "Not a player in this match",
          code: "UNAUTHORIZED",
        });
        return;
      }

      // Verify match is active
      if (match.status !== "active") {
        socket.emit("powerup_error", {
          error: "Match is not active",
          code: "MATCH_NOT_ACTIVE",
        });
        return;
      }

      // Activate the power-up
      const result = await powerUpService.activatePowerUp(matchId, socket.userId, powerUpType);

      if (!result.success) {
        socket.emit("powerup_error", {
          error: result.error || "Failed to activate power-up",
          code: result.errorCode || "ACTIVATION_FAILED",
          cooldownRemaining: result.cooldownRemaining,
        });
        return;
      }

      // Broadcast power-up activation to relevant parties
      broadcastPowerUpActivation(io, socket, matchId, socket.userId, powerUpType, match, result);

      console.log(`Player ${socket.userId} activated ${powerUpType} in match ${matchId}`);
    } catch (error) {
      console.error("Error handling activate_powerup:", error);
      socket.emit("powerup_error", {
        error: "Failed to activate power-up",
        code: "ACTIVATION_FAILED",
      });
    }
  });
}

/**
 * Broadcast power-up activation to relevant parties
 * Requirements: 2.4, 3.3, 7.1, 7.2
 */
function broadcastPowerUpActivation(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: AuthenticatedSocket,
  matchId: string,
  playerId: string,
  powerUpType: PowerUpType,
  match: { player1Id: string; player2Id: string },
  result: {
    newState?: any;
    opponentCode?: string;
    freezeExpiresAt?: number;
    shieldedRunsRemaining?: number;
  }
): void {
  // Determine opponent
  const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;

  // 1. Send full details to requesting player
  socket.emit("powerup_activated", {
    playerId,
    powerUpType,
    opponentCode: powerUpType === "code_peek" ? result.opponentCode : undefined,
    freezeExpiresAt: powerUpType === "time_freeze" ? result.freezeExpiresAt : undefined,
    shieldedRuns: powerUpType === "debug_shield" ? result.shieldedRunsRemaining : undefined,
  });

  // Send updated state to requesting player
  if (result.newState) {
    socket.emit("powerup_state_update", result.newState);
  }

  // 2. Notify opponent with limited info (no code peek content)
  const opponentSession = sessionManager.getSessionByUserId(opponentId);
  if (opponentSession) {
    io.to(opponentSession.socketId).emit("opponent_used_powerup", {
      powerUpType,
    });
  }

  // 3. Broadcast to spectators with player info
  const username = socket.user?.username || "Unknown";
  io.to(`match:${matchId}:spectators`).emit("spectator_powerup_event", {
    playerId,
    username,
    powerUpType,
    timestamp: Date.now(),
  });
}

/**
 * Send power-up state update to a specific player
 * Used for reconnection scenarios
 * Requirements: 8.1
 */
export async function sendPowerUpStateToPlayer(io: Server<ClientToServerEvents, ServerToClientEvents>, socketId: string, matchId: string, playerId: string): Promise<void> {
  const playerState = await powerUpService.getPlayerPowerUps(matchId, playerId);
  if (playerState) {
    io.to(socketId).emit("powerup_state_update", playerState);
  }
}

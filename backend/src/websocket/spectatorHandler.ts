import { Server } from "socket.io";
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from "./types";
import { matchStateService } from "../redis/matchState.service";
import { spectatorService } from "../redis/spectator.service";
import { sessionManager } from "./sessionManager";
import { chatService } from "../services/chat.service";

/**
 * Setup spectator event handlers
 */
export function setupSpectatorHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: AuthenticatedSocket): void {
  if (!socket.userId) {
    return;
  }

  // Track which matches this socket is spectating for cleanup on disconnect
  const spectatingMatches = new Set<string>();

  /**
   * Handle join_spectate event
   */
  socket.on("join_spectate", async (data: { matchId: string }) => {
    try {
      if (!socket.userId || !socket.user) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { matchId } = data;

      if (!matchId) {
        socket.emit("error", { message: "Match ID required", code: "INVALID_DATA" });
        return;
      }

      const match = await matchStateService.getMatch(matchId);

      if (!match) {
        socket.emit("error", { message: "Match not found", code: "MATCH_NOT_FOUND" });
        return;
      }

      if (match.status !== "active") {
        socket.emit("error", { message: "Can only spectate active matches", code: "MATCH_NOT_ACTIVE" });
        return;
      }

      if (match.player1Id === socket.userId || match.player2Id === socket.userId) {
        socket.emit("error", { message: "Cannot spectate your own match", code: "CANNOT_SPECTATE_OWN_MATCH" });
        return;
      }

      // Track this match for cleanup on disconnect
      spectatingMatches.add(matchId);

      await spectatorService.addSpectator(matchId, socket.userId, socket.user.username);
      socket.join(`match:${matchId}:spectators`);

      const spectatorCount = await spectatorService.getSpectatorCount(matchId);

      socket.emit("reconnected", {
        matchState: {
          matchId,
          challengeId: match.challengeId,
          player1Id: match.player1Id,
          player2Id: match.player2Id,
          player1Code: match.player1Code,
          player2Code: match.player2Code,
          player1Cursor: match.player1Cursor,
          player2Cursor: match.player2Cursor,
          player1Language: match.player1Language,
          player2Language: match.player2Language,
          status: match.status,
          startedAt: match.startedAt,
          player1Submitted: match.player1Submitted,
          player2Submitted: match.player2Submitted,
        },
      });

      const player1Session = sessionManager.getSessionByUserId(match.player1Id);
      const player2Session = sessionManager.getSessionByUserId(match.player2Id);

      if (player1Session) {
        io.to(player1Session.socketId).emit("spectator_joined", { count: spectatorCount });
      }
      if (player2Session) {
        io.to(player2Session.socketId).emit("spectator_joined", { count: spectatorCount });
      }

      console.log(`User ${socket.user.username} joined as spectator for match ${matchId}. Total spectators: ${spectatorCount}`);
    } catch (error) {
      console.error("Error handling join_spectate:", error);
      socket.emit("error", { message: "Failed to join as spectator", code: "SPECTATE_FAILED" });
    }
  });

  /**
   * Handle spectator_message event for chat
   */
  socket.on("spectator_message", async (data: { matchId: string; message: string }) => {
    try {
      if (!socket.userId || !socket.user) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { matchId, message } = data;

      if (!matchId || typeof message !== "string") {
        socket.emit("error", { message: "Invalid message data", code: "INVALID_DATA" });
        return;
      }

      const isSpectating = await spectatorService.isSpectating(matchId, socket.userId);

      if (!isSpectating) {
        socket.emit("error", { message: "Not spectating this match", code: "NOT_SPECTATING" });
        return;
      }

      const result = await chatService.sendMessage(matchId, socket.userId, socket.user.username, message);

      if (!result.success) {
        if (result.retryAfter !== undefined) {
          socket.emit("chat_rate_limited", { retryAfter: result.retryAfter });
          return;
        }
        socket.emit("error", { message: result.error || "Failed to send message", code: "MESSAGE_REJECTED" });
        return;
      }

      if (result.message) {
        io.to(`match:${matchId}:spectators`).emit("spectator_message", {
          id: result.message.id,
          username: result.message.username,
          message: result.message.message,
          timestamp: result.message.createdAt.getTime(),
        });
      }

      console.log(`Spectator ${socket.user.username} sent message in match ${matchId}: ${message}`);
    } catch (error) {
      console.error("Error handling spectator_message:", error);
      socket.emit("error", { message: "Failed to send message", code: "MESSAGE_FAILED" });
    }
  });

  /**
   * Handle spectator_reaction event for emoji reactions
   */
  socket.on("spectator_reaction", async (data: { matchId: string; emoji: string }) => {
    try {
      if (!socket.userId || !socket.user) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { matchId, emoji } = data;

      if (!matchId || typeof emoji !== "string") {
        socket.emit("error", { message: "Invalid reaction data", code: "INVALID_DATA" });
        return;
      }

      const isSpectating = await spectatorService.isSpectating(matchId, socket.userId);

      if (!isSpectating) {
        socket.emit("error", { message: "Not spectating this match", code: "NOT_SPECTATING" });
        return;
      }

      const result = await chatService.sendReaction(matchId, socket.userId, socket.user.username, emoji);

      if (!result.success) {
        if (result.error === "Rate limit exceeded") {
          const retryAfter = await chatService.getRateLimitRetryAfter(socket.userId);
          socket.emit("chat_rate_limited", { retryAfter });
          return;
        }
        socket.emit("error", { message: result.error || "Invalid emoji", code: "INVALID_EMOJI" });
        return;
      }

      const position = {
        x: Math.random() * 100,
        y: Math.random() * 30 + 70,
      };

      io.to(`match:${matchId}:spectators`).emit("spectator_reaction", {
        username: socket.user.username,
        emoji,
        position,
      });

      console.log(`Spectator ${socket.user.username} sent reaction in match ${matchId}: ${emoji}`);
    } catch (error) {
      console.error("Error handling spectator_reaction:", error);
      socket.emit("error", { message: "Failed to send reaction", code: "REACTION_FAILED" });
    }
  });

  /**
   * Handle disconnect - cleanup spectator from all matches they were watching
   */
  socket.on("disconnect", async () => {
    if (!socket.userId) {
      return;
    }

    try {
      for (const matchId of spectatingMatches) {
        await spectatorService.removeSpectator(matchId, socket.userId);
        console.log(`Removed spectator ${socket.userId} from match ${matchId}`);
      }
      spectatingMatches.clear();
    } catch (error) {
      console.error("Error cleaning up spectator on disconnect:", error);
    }
  });
}

import { Server } from "socket.io";
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from "./types";
import { matchmakingService } from "../redis/matchmaking.service";
import { sessionManager } from "./sessionManager";

// Store queue position update intervals
const queueUpdateIntervals = new Map<string, NodeJS.Timeout>();

/**
 * Start periodic queue position updates for a user
 */
function startQueuePositionUpdates(socket: AuthenticatedSocket, difficulty?: string, language?: string): void {
  if (!socket.userId) return;

  // Clear any existing interval
  stopQueuePositionUpdates(socket.userId);

  // Update every 3 seconds
  const intervalId = setInterval(async () => {
    if (!socket.userId || !socket.connected) {
      stopQueuePositionUpdates(socket.userId!);
      return;
    }

    try {
      const position = await matchmakingService.getQueuePosition(socket.userId, difficulty, language);

      if (position === null) {
        // User no longer in queue (match found or removed)
        stopQueuePositionUpdates(socket.userId);
        return;
      }

      const estimatedWait = await matchmakingService.getEstimatedWaitTime(socket.userId, difficulty, language);

      socket.emit("queue_position", {
        position,
        estimatedWait,
      });
    } catch (error) {
      console.error("Error updating queue position:", error);
    }
  }, 3000);

  queueUpdateIntervals.set(socket.userId, intervalId);
}

/**
 * Stop queue position updates for a user
 */
function stopQueuePositionUpdates(userId: string): void {
  const intervalId = queueUpdateIntervals.get(userId);
  if (intervalId) {
    clearInterval(intervalId);
    queueUpdateIntervals.delete(userId);
  }
}

/**
 * Setup matchmaking event handlers
 */
export function setupMatchmakingHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: AuthenticatedSocket): void {
  /**
   * Handle join_queue event
   * Adds user to matchmaking queue and emits queue position
   */
  socket.on("join_queue", async (data) => {
    if (!socket.userId || !socket.user) {
      socket.emit("error", {
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    try {
      const { difficulty, language } = data;

      // Get user's rating
      const userRating = socket.user.rating || 1000;

      // Add to queue
      const position = await matchmakingService.addToQueue(socket.userId, userRating, difficulty, language);

      // Get estimated wait time
      const estimatedWait = await matchmakingService.getEstimatedWaitTime(socket.userId, difficulty, language);

      // Emit queue position
      socket.emit("queue_position", {
        position,
        estimatedWait,
      });

      console.log(`User ${socket.user.username} (${socket.userId}) joined queue (difficulty: ${difficulty || "any"}, language: ${language || "any"}, position: ${position}, rating: ${userRating})`);

      // Store queue info in session for cleanup on disconnect
      const session = sessionManager.getSessionByUserId(socket.userId);
      if (session) {
        (session as any).queueInfo = { difficulty, language };
      }

      // Start periodic queue position updates
      startQueuePositionUpdates(socket, difficulty, language);
    } catch (error) {
      console.error("Error joining queue:", error);
      socket.emit("error", {
        message: "Failed to join queue",
        code: "QUEUE_JOIN_FAILED",
      });
    }
  });

  /**
   * Handle leave_queue event
   * Removes user from matchmaking queue
   */
  socket.on("leave_queue", async () => {
    if (!socket.userId || !socket.user) {
      socket.emit("error", {
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    try {
      // Stop queue position updates
      if (socket.userId) {
        stopQueuePositionUpdates(socket.userId);
      }

      // Remove from all queues
      await matchmakingService.removeFromAllQueues(socket.userId);

      console.log(`User ${socket.user.username} left queue`);

      // Clear queue info from session
      const session = sessionManager.getSessionByUserId(socket.userId);
      if (session) {
        delete (session as any).queueInfo;
      }
    } catch (error) {
      console.error("Error leaving queue:", error);
      socket.emit("error", {
        message: "Failed to leave queue",
        code: "QUEUE_LEAVE_FAILED",
      });
    }
  });

  // Clean up queue position updates on disconnect
  socket.on("disconnect", () => {
    if (socket.userId) {
      stopQueuePositionUpdates(socket.userId);
    }
  });
}

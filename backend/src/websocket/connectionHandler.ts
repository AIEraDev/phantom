import { Server } from "socket.io";
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from "./types";
import { authenticateSocket } from "./authHandler";
import { sessionManager } from "./sessionManager";
import { EventEmitter } from "./eventEmitter";
import { setupMatchmakingHandlers } from "./matchmakingHandler";
import { setupLobbyHandlers } from "./lobbyHandler";
import { setupBattleArenaHandlers } from "./battleArenaHandler";
import { setupSpectatorHandlers } from "./spectatorHandler";
import { setupGhostRaceHandlers } from "./ghostRaceHandler";
import { setupCoachHandlers } from "./coachHandler";
import { setupPowerUpHandlers } from "./powerUpHandler";

/**
 * Setup WebSocket connection handlers
 */
export function setupConnectionHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>): EventEmitter {
  const eventEmitter = new EventEmitter(io);

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // If socket was authenticated via middleware, create session
    if (socket.user && socket.userId) {
      sessionManager.addSession({
        userId: socket.userId,
        socketId: socket.id,
        username: socket.user.username,
        email: socket.user.email,
        connectedAt: new Date(),
      });

      // Emit authenticated event
      socket.emit("authenticated", {
        userId: socket.userId,
        username: socket.user.username,
      });

      console.log(`User ${socket.user.username} (${socket.userId}) connected`);

      // Setup matchmaking event handlers
      setupMatchmakingHandlers(io, socket);

      // Setup lobby event handlers
      setupLobbyHandlers(io, socket);

      // Setup battle arena event handlers
      setupBattleArenaHandlers(io, socket);

      // Setup spectator event handlers
      setupSpectatorHandlers(io, socket);

      // Setup ghost race event handlers
      setupGhostRaceHandlers(io, socket);

      // Setup AI Code Coach event handlers
      setupCoachHandlers(io, socket);

      // Setup power-up event handlers
      setupPowerUpHandlers(io, socket);
    }

    // Handle manual authentication (fallback for clients that don't use handshake auth)
    socket.on("authenticate", (data: { token: string }) => {
      const success = authenticateSocket(socket, data.token);

      if (success && socket.user) {
        socket.emit("authenticated", {
          userId: socket.user.userId,
          username: socket.user.username,
        });
      } else {
        socket.emit("error", {
          message: "Authentication failed",
          code: "AUTH_FAILED",
        });
        socket.disconnect(true);
      }
    });

    // Handle disconnect with cleanup
    socket.on("disconnect", async (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);

      // Get session before removing it
      const session = sessionManager.getSessionBySocketId(socket.id);

      if (session) {
        console.log(`User ${session.username} (${session.userId}) disconnected`);

        // Remove session immediately so new connection can create a new one
        sessionManager.removeSession(socket.id);

        // Delay queue cleanup to allow for reconnection (5 second grace period)
        const userId = session.userId;
        const username = session.username;

        setTimeout(async () => {
          // Check if user has reconnected
          const currentSession = sessionManager.getSessionByUserId(userId);
          if (!currentSession) {
            // User hasn't reconnected, clean up queue
            try {
              const { matchmakingService } = await import("../redis/matchmaking.service");
              await matchmakingService.removeFromAllQueues(userId);
              console.log(`Removed user ${userId} from all matchmaking queues (no reconnection)`);
            } catch (error) {
              console.error("Error cleaning up matchmaking queue on disconnect:", error);
            }
          } else {
            console.log(`User ${username} reconnected, keeping in queue`);
          }
        }, 5000);
      }
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return eventEmitter;
}

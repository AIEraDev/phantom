import { Server } from "socket.io";
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from "./types";
import { matchStateService } from "../redis/matchState.service";
import pool from "../db/connection";

/**
 * Setup lobby event handlers
 */
export function setupLobbyHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: AuthenticatedSocket): void {
  /**
   * Handle join_lobby event
   * Sends current lobby state including countdown if in progress
   */
  socket.on("join_lobby", async (data: { matchId: string }) => {
    if (!socket.userId) return;

    const { matchId } = data;
    console.log(`User ${socket.userId} joining lobby for match ${matchId}`);

    try {
      // First check match status in database
      const matchResult = await pool.query("SELECT status, started_at, challenge_id FROM matches WHERE id = $1", [matchId]);
      if (matchResult.rows.length > 0) {
        const match = matchResult.rows[0];

        // If match is already active, redirect to battle
        if (match.status === "active") {
          console.log(`Match ${matchId} is active, sending match_started to rejoining player`);
          const challengeResult = await pool.query("SELECT time_limit FROM challenges WHERE id = $1", [match.challenge_id]);
          const timeLimit = challengeResult.rows.length > 0 ? challengeResult.rows[0].time_limit : 900;
          const startedAt = match.started_at ? new Date(match.started_at).getTime() : Date.now();
          // Calculate remaining time on the server for consistency
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          const remaining = Math.max(0, timeLimit - elapsed);

          socket.emit("match_started", {
            startTime: startedAt,
            timeLimit,
            remaining, // Server-calculated remaining time
          });
          return;
        }
      }

      // Check if countdown is in progress
      const countdownRemaining = getCountdownRemaining(matchId);
      if (countdownRemaining !== null) {
        console.log(`Sending countdown state to rejoining player: ${countdownRemaining}s`);
        socket.emit("match_starting", { countdown: countdownRemaining });
      }

      // Get match state to send ready status
      const matchState = await matchStateService.getMatch(matchId);
      if (matchState) {
        const isPlayer1 = matchState.player1Id === socket.userId;
        const opponentReady = isPlayer1 ? matchState.player2Ready : matchState.player1Ready;
        const playerReady = isPlayer1 ? matchState.player1Ready : matchState.player2Ready;

        // Send opponent ready status
        if (opponentReady) {
          socket.emit("opponent_ready", { isReady: true });
        }

        // If this player was already ready, let them know
        if (playerReady) {
          socket.emit("lobby_state", {
            playerReady: true,
            opponentReady,
            countdownRemaining,
          });
        }

        // If both players are ready but no countdown is running, start it
        if (matchState.player1Ready && matchState.player2Ready && countdownRemaining === null) {
          console.log(`Both players ready but no countdown running for match ${matchId}, starting countdown`);
          await startMatchCountdown(io, matchId, matchState);
        }
      }
    } catch (error) {
      console.error("Error handling join_lobby:", error);
    }
  });

  /**
   * Handle ready_up event
   * Marks player as ready in the lobby and notifies opponent
   */
  socket.on("ready_up", async (data) => {
    console.log("ready_up event received:", data, "from user:", socket.userId);

    if (!socket.userId || !socket.user) {
      socket.emit("error", {
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    try {
      const { matchId } = data;

      // Verify match exists in database
      const matchResult = await pool.query("SELECT * FROM matches WHERE id = $1", [matchId]);

      if (matchResult.rows.length === 0) {
        socket.emit("error", {
          message: "Match not found",
          code: "MATCH_NOT_FOUND",
        });
        return;
      }

      const match = matchResult.rows[0];

      // Verify user is a player in this match
      if (match.player1_id !== socket.userId && match.player2_id !== socket.userId) {
        socket.emit("error", {
          message: "You are not a player in this match",
          code: "UNAUTHORIZED",
        });
        return;
      }

      // Check match status and handle accordingly
      if (match.status === "active") {
        // Match is already active, tell client to redirect to battle
        console.log(`Match ${matchId} is already active, sending redirect to battle`);

        // Get challenge time limit for the redirect
        const challengeResult = await pool.query("SELECT time_limit FROM challenges WHERE id = $1", [match.challenge_id]);
        const timeLimit = challengeResult.rows.length > 0 ? challengeResult.rows[0].time_limit : 900;
        const startedAt = match.started_at ? new Date(match.started_at).getTime() : Date.now();
        // Calculate remaining time on the server for consistency
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(0, timeLimit - elapsed);

        socket.emit("match_started", {
          startTime: startedAt,
          timeLimit,
          remaining, // Server-calculated remaining time
        });
        return;
      }

      if (match.status === "completed") {
        socket.emit("error", {
          message: "Match has already completed",
          code: "MATCH_COMPLETED",
        });
        return;
      }

      if (match.status !== "lobby") {
        socket.emit("error", {
          message: "Match is not in lobby state",
          code: "INVALID_MATCH_STATE",
        });
        return;
      }

      // Check if countdown is already in progress
      const countdownRemaining = getCountdownRemaining(matchId);
      if (countdownRemaining !== null) {
        console.log(`Countdown already in progress for match ${matchId}, sending current state: ${countdownRemaining}s`);
        socket.emit("match_starting", { countdown: countdownRemaining });
        return;
      }

      // Get or create match state in Redis
      let matchState = await matchStateService.getMatch(matchId);

      if (!matchState) {
        // Initialize match state if it doesn't exist
        matchState = {
          player1Id: match.player1_id,
          player2Id: match.player2_id,
          challengeId: match.challenge_id,
          status: "lobby",
          player1Ready: false,
          player2Ready: false,
          player1Code: "",
          player2Code: "",
          player1Cursor: { line: 1, column: 1 },
          player2Cursor: { line: 1, column: 1 },
          player1Language: match.player1_language || "javascript",
          player2Language: match.player2_language || "javascript",
        };
        await matchStateService.createMatch(matchId, matchState);
        console.log(`Created new match state for ${matchId}`);
      }

      // Determine if this user is player1 or player2
      const isPlayer1 = match.player1_id === socket.userId;
      console.log(`User ${socket.userId} is ${isPlayer1 ? "player1" : "player2"} in match ${matchId}`);

      // Update player ready status
      await matchStateService.updatePlayerReady(matchId, socket.userId, true);

      // Get updated match state - add small delay to ensure Redis write is complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      matchState = await matchStateService.getMatch(matchId);

      if (!matchState) {
        throw new Error("Failed to retrieve match state");
      }

      console.log(`Match state after ready: player1Ready=${matchState.player1Ready}, player2Ready=${matchState.player2Ready}`);

      // Determine which player is the opponent (reuse isPlayer1 from above)
      const opponentId = isPlayer1 ? matchState.player2Id : matchState.player1Id;
      const opponentReady = isPlayer1 ? matchState.player2Ready : matchState.player1Ready;

      // Get opponent's socket session
      const { sessionManager } = await import("./sessionManager");
      const opponentSession = sessionManager.getSessionByUserId(opponentId);

      console.log(`Looking for opponent session: ${opponentId}, found: ${opponentSession ? opponentSession.socketId : "NOT FOUND"}`);
      console.log(
        `All sessions:`,
        sessionManager.getAllSessions().map((s) => ({ oderId: s.userId, socketId: s.socketId }))
      );

      // Emit opponent_ready event to opponent
      if (opponentSession) {
        io.to(opponentSession.socketId).emit("opponent_ready", {
          isReady: true,
        });
        console.log(`Sent opponent_ready to ${opponentSession.socketId}`);
      } else {
        console.log(`Could not find opponent session for user ${opponentId}`);
      }

      console.log(`Player ${socket.user.username} is ready in match ${matchId}, matchState:`, matchState);

      // Check if both players are ready
      if (matchState.player1Ready && matchState.player2Ready) {
        console.log(`Both players ready in match ${matchId}, starting countdown`);
        await startMatchCountdown(io, matchId, matchState);
      }
    } catch (error) {
      console.error("Error handling ready_up:", error);
      socket.emit("error", {
        message: "Failed to ready up",
        code: "READY_UP_FAILED",
      });
    }
  });
}

// Store active countdowns (matchId -> countdown end time)
const activeCountdowns = new Map<string, number>();

// Store active timer syncs (matchId -> interval ID)
const activeTimerSyncs = new Map<string, NodeJS.Timeout>();

/**
 * Start periodic timer sync for a match
 * Broadcasts remaining time every 5 seconds to keep both players synchronized
 */
function startTimerSync(io: Server<ClientToServerEvents, ServerToClientEvents>, matchId: string, startTime: number, timeLimit: number, player1Id: string, player2Id: string): void {
  // Clear any existing sync for this match
  const existingSync = activeTimerSyncs.get(matchId);
  if (existingSync) {
    clearInterval(existingSync);
  }

  const syncInterval = setInterval(async () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, timeLimit - elapsed);

    // Stop syncing if match is over
    if (remaining <= 0) {
      clearInterval(syncInterval);
      activeTimerSyncs.delete(matchId);
      return;
    }

    // Get current player sessions
    const { sessionManager } = await import("./sessionManager");
    const player1Session = sessionManager.getSessionByUserId(player1Id);
    const player2Session = sessionManager.getSessionByUserId(player2Id);

    // Emit timer_sync to both players
    if (player1Session) {
      io.to(player1Session.socketId).emit("timer_sync", { remaining });
    }
    if (player2Session) {
      io.to(player2Session.socketId).emit("timer_sync", { remaining });
    }
  }, 5000); // Sync every 5 seconds

  activeTimerSyncs.set(matchId, syncInterval);
}

/**
 * Stop timer sync for a match (call when match ends)
 */
export function stopTimerSync(matchId: string): void {
  const syncInterval = activeTimerSyncs.get(matchId);
  if (syncInterval) {
    clearInterval(syncInterval);
    activeTimerSyncs.delete(matchId);
  }
}

/**
 * Get remaining countdown for a match (if any)
 */
export function getCountdownRemaining(matchId: string): number | null {
  const endTime = activeCountdowns.get(matchId);
  if (!endTime) return null;

  const remaining = Math.ceil((endTime - Date.now()) / 1000);
  return remaining > 0 ? remaining : null;
}

/**
 * Start the 30-second countdown for match start
 */
async function startMatchCountdown(io: Server<ClientToServerEvents, ServerToClientEvents>, matchId: string, matchState: any): Promise<void> {
  const COUNTDOWN_DURATION = 30; // 30 seconds
  const countdownEndTime = Date.now() + COUNTDOWN_DURATION * 1000;

  // Store countdown end time so reconnecting players can get current state
  activeCountdowns.set(matchId, countdownEndTime);

  // Helper to get current sessions (may change if players reconnect)
  const getPlayerSessions = async () => {
    const { sessionManager } = await import("./sessionManager");
    return {
      player1Session: sessionManager.getSessionByUserId(matchState.player1Id),
      player2Session: sessionManager.getSessionByUserId(matchState.player2Id),
    };
  };

  // Emit match_starting event to both players (with fresh session lookup)
  const emitToPlayers = async (event: string, data: any) => {
    const { player1Session, player2Session } = await getPlayerSessions();
    if (player1Session) {
      io.to(player1Session.socketId).emit(event as any, data);
    }
    if (player2Session) {
      io.to(player2Session.socketId).emit(event as any, data);
    }
  };

  // Start countdown
  let countdown = COUNTDOWN_DURATION;

  // Emit initial countdown
  await emitToPlayers("match_starting", { countdown });

  // Create countdown interval
  const countdownInterval = setInterval(async () => {
    countdown--;

    if (countdown > 0) {
      await emitToPlayers("match_starting", { countdown });
    } else {
      clearInterval(countdownInterval);
      activeCountdowns.delete(matchId);
    }
  }, 1000);

  // After countdown completes, start the match
  setTimeout(async () => {
    try {
      // Capture the exact start time ONCE to ensure consistency
      const startTime = Date.now();

      // Update match status to 'active' in database
      await pool.query("UPDATE matches SET status = $1, started_at = $2 WHERE id = $3", ["active", new Date(startTime), matchId]);

      // Update match status in Redis with the SAME startTime
      await matchStateService.updateMatchStatus(matchId, "active");
      await matchStateService.updateMatchField(matchId, "startedAt", startTime);

      // Get challenge details for time limit
      const challengeResult = await pool.query("SELECT time_limit FROM challenges WHERE id = $1", [matchState.challengeId]);

      const timeLimit = challengeResult.rows.length > 0 ? challengeResult.rows[0].time_limit : 900; // Default 15 minutes

      console.log(`Match ${matchId} starting with startTime=${startTime}, timeLimit=${timeLimit}s`);

      // Emit match_started event to both players with the SAME startTime
      // Also send remaining time so both players start with the exact same value
      const { player1Session, player2Session } = await getPlayerSessions();
      console.log(`Emitting match_started to player1: ${player1Session?.socketId || "NOT FOUND"}, player2: ${player2Session?.socketId || "NOT FOUND"}`);

      await emitToPlayers("match_started", {
        startTime,
        timeLimit,
        remaining: timeLimit, // Full time remaining at match start
      });

      console.log(`Match ${matchId} started - emitted to both players`);

      // Start periodic timer sync to keep both players synchronized
      startTimerSync(io, matchId, startTime, timeLimit, matchState.player1Id, matchState.player2Id);
    } catch (error) {
      console.error("Error starting match:", error);

      // Emit error to both players
      emitToPlayers("error", {
        message: "Failed to start match",
        code: "MATCH_START_FAILED",
      });
    }
  }, COUNTDOWN_DURATION * 1000);
}

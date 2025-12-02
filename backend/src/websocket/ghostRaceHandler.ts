import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from "./types";
import { ghostRaceStateService, GhostRaceState } from "../redis/ghostRace.service";
import { ghostService } from "../services/ghost.service";
import { ChallengeService } from "../services/challenge.service";
import { GhostEvent } from "../db/types";

// Map to track active ghost playback timers
const ghostPlaybackTimers = new Map<string, NodeJS.Timeout>();

// Throttle map for code updates
const codeUpdateThrottle = new Map<string, number>();
const THROTTLE_INTERVAL = 100; // 100ms

/**
 * Setup ghost race WebSocket event handlers
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
export function setupGhostRaceHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: AuthenticatedSocket): void {
  if (!socket.userId) {
    return;
  }

  /**
   * Handle start_ghost_race event
   * Requirements: 14.1, 14.2
   */
  socket.on("start_ghost_race" as any, async (data: { challengeId: string; ghostId?: string }) => {
    try {
      if (!socket.userId || !socket.user) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { challengeId, ghostId } = data;

      // Validate input
      if (!challengeId) {
        socket.emit("error", { message: "Challenge ID required", code: "INVALID_DATA" });
        return;
      }

      // Check if player is already in a race
      const existingRaceId = await ghostRaceStateService.getPlayerRaceId(socket.userId);
      if (existingRaceId) {
        socket.emit("error", { message: "Already in a ghost race", code: "ALREADY_IN_RACE" });
        return;
      }

      // Get ghost recording
      let ghost;
      if (ghostId) {
        ghost = await ghostService.getGhostById(ghostId);
        if (!ghost) {
          socket.emit("error", { message: "Ghost not found", code: "GHOST_NOT_FOUND" });
          return;
        }
        if (ghost.challenge_id !== challengeId) {
          socket.emit("error", { message: "Ghost challenge mismatch", code: "GHOST_CHALLENGE_MISMATCH" });
          return;
        }
      } else {
        ghost = await ghostService.getTopGhost(challengeId);
        if (!ghost) {
          socket.emit("error", { message: "No ghost available", code: "NO_GHOST_AVAILABLE" });
          return;
        }
      }

      // Get challenge details
      const challengeService = new ChallengeService();
      const challenge = await challengeService.getChallengeById(challengeId);
      if (!challenge) {
        socket.emit("error", { message: "Challenge not found", code: "CHALLENGE_NOT_FOUND" });
        return;
      }

      // Generate race ID
      const raceId = uuidv4();

      // Create race state in Redis
      const raceState: GhostRaceState = {
        raceId,
        playerId: socket.userId,
        ghostId: ghost.id,
        challengeId,
        status: "active",
        startedAt: Date.now(),
        ghostDurationMs: ghost.duration_ms,
        ghostScore: ghost.score,
        ghostEvents: ghost.events,
        currentGhostEventIndex: 0,
        playerCode: challenge.starter_code.javascript || "",
        playerCursor: { line: 0, column: 0 },
        playerSubmitted: false,
      };

      await ghostRaceStateService.createRace(raceState);

      // Join race room
      socket.join(`ghost_race:${raceId}`);

      // Emit race started event
      socket.emit("ghost_race_started" as any, {
        raceId,
        ghost: {
          id: ghost.id,
          username: ghost.username,
          score: ghost.score,
          durationMs: ghost.duration_ms,
          isAI: ghost.is_ai,
        },
        challenge: {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          difficulty: challenge.difficulty,
          timeLimit: challenge.time_limit,
          starterCode: challenge.starter_code,
          testCases: challenge.test_cases.filter((tc) => !tc.isHidden),
        },
      });

      // Start ghost playback
      startGhostPlayback(io, socket, raceId, raceState);

      console.log(`Ghost race ${raceId} started for user ${socket.user.username} against ghost ${ghost.username}`);
    } catch (error) {
      console.error("Error starting ghost race:", error);
      socket.emit("error", { message: "Failed to start ghost race", code: "RACE_START_FAILED" });
    }
  });

  /**
   * Handle ghost_race_code_update event
   * Requirements: 14.2
   */
  socket.on("ghost_race_code_update" as any, async (data: { raceId: string; code: string; cursor?: { line: number; column: number } }) => {
    try {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { raceId, code, cursor } = data;

      // Validate input
      if (!raceId || typeof code !== "string") {
        socket.emit("error", { message: "Invalid data", code: "INVALID_DATA" });
        return;
      }

      // Validate code length
      if (code.length > 5000) {
        socket.emit("error", { message: "Code too long", code: "CODE_TOO_LONG" });
        return;
      }

      // Throttle updates
      const lastUpdate = codeUpdateThrottle.get(socket.userId) || 0;
      const now = Date.now();
      if (now - lastUpdate < THROTTLE_INTERVAL) {
        return;
      }
      codeUpdateThrottle.set(socket.userId, now);

      // Get race state
      const race = await ghostRaceStateService.getRace(raceId);
      if (!race) {
        socket.emit("error", { message: "Race not found", code: "RACE_NOT_FOUND" });
        return;
      }

      // Verify player owns this race
      if (race.playerId !== socket.userId) {
        socket.emit("error", { message: "Not your race", code: "UNAUTHORIZED" });
        return;
      }

      // Verify race is active
      if (race.status !== "active") {
        socket.emit("error", { message: "Race not active", code: "RACE_NOT_ACTIVE" });
        return;
      }

      // Update player code
      await ghostRaceStateService.updatePlayerCode(raceId, code, cursor || { line: 0, column: 0 });
    } catch (error) {
      console.error("Error updating ghost race code:", error);
      socket.emit("error", { message: "Failed to update code", code: "UPDATE_FAILED" });
    }
  });

  /**
   * Handle ghost_race_run_tests event
   * Requirements: 14.2
   */
  socket.on("ghost_race_run_tests" as any, async (data: { raceId: string; code: string }) => {
    try {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { raceId, code } = data;

      // Validate input
      if (!raceId || typeof code !== "string") {
        socket.emit("error", { message: "Invalid data", code: "INVALID_DATA" });
        return;
      }

      // Get race state
      const race = await ghostRaceStateService.getRace(raceId);
      if (!race) {
        socket.emit("error", { message: "Race not found", code: "RACE_NOT_FOUND" });
        return;
      }

      // Verify player owns this race
      if (race.playerId !== socket.userId) {
        socket.emit("error", { message: "Not your race", code: "UNAUTHORIZED" });
        return;
      }

      // Verify race is active
      if (race.status !== "active") {
        socket.emit("error", { message: "Race not active", code: "RACE_NOT_ACTIVE" });
        return;
      }

      // Get challenge for test cases
      const challengeService = new ChallengeService();
      const challenge = await challengeService.getChallengeById(race.challengeId);
      if (!challenge) {
        socket.emit("error", { message: "Challenge not found", code: "CHALLENGE_NOT_FOUND" });
        return;
      }

      // Execute code against visible test cases
      const { dockerService } = await import("../execution/docker.service");
      const visibleTestCases = challenge.test_cases.filter((tc) => !tc.isHidden);
      const results = [];

      for (const testCase of visibleTestCases) {
        try {
          const result = await dockerService.executeCode({
            language: "javascript",
            code,
            testInput: JSON.stringify(testCase.input),
            timeout: 2000,
          });

          let passed = false;
          let actualOutput = null;

          try {
            actualOutput = result.stdout ? JSON.parse(result.stdout) : null;
            passed = JSON.stringify(actualOutput) === JSON.stringify(testCase.expectedOutput);
          } catch {
            passed = result.stdout.trim() === String(testCase.expectedOutput).trim();
            actualOutput = result.stdout.trim();
          }

          results.push({
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput,
            passed,
            executionTime: result.executionTime,
            stderr: result.stderr,
            timedOut: result.timedOut,
          });
        } catch (error) {
          results.push({
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: null,
            passed: false,
            executionTime: 0,
            stderr: error instanceof Error ? error.message : "Execution failed",
            timedOut: false,
          });
        }
      }

      socket.emit("ghost_race_test_result" as any, { results });
    } catch (error) {
      console.error("Error running ghost race tests:", error);
      socket.emit("error", { message: "Failed to run tests", code: "TEST_FAILED" });
    }
  });

  /**
   * Handle ghost_race_submit event
   * Requirements: 14.4
   */
  socket.on("ghost_race_submit" as any, async (data: { raceId: string; code: string }) => {
    try {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { raceId, code } = data;

      // Validate input
      if (!raceId || typeof code !== "string") {
        socket.emit("error", { message: "Invalid data", code: "INVALID_DATA" });
        return;
      }

      // Get race state
      const race = await ghostRaceStateService.getRace(raceId);
      if (!race) {
        socket.emit("error", { message: "Race not found", code: "RACE_NOT_FOUND" });
        return;
      }

      // Verify player owns this race
      if (race.playerId !== socket.userId) {
        socket.emit("error", { message: "Not your race", code: "UNAUTHORIZED" });
        return;
      }

      // Verify race is active
      if (race.status !== "active") {
        socket.emit("error", { message: "Race not active", code: "RACE_NOT_ACTIVE" });
        return;
      }

      // Check if already submitted
      if (race.playerSubmitted) {
        socket.emit("error", { message: "Already submitted", code: "ALREADY_SUBMITTED" });
        return;
      }

      // Stop ghost playback
      stopGhostPlayback(raceId);

      // Calculate player score
      const playerScore = await calculatePlayerScore(race.challengeId, code);

      // Mark player as submitted
      await ghostRaceStateService.markPlayerSubmitted(raceId, playerScore);

      // Update race status to completed
      await ghostRaceStateService.updateRaceStatus(raceId, "completed");

      // Determine winner
      const playerWon = playerScore > race.ghostScore;
      const isTie = playerScore === race.ghostScore;

      // Calculate completion time
      const completionTime = Date.now() - race.startedAt;

      // Emit race result
      socket.emit("ghost_race_result" as any, {
        raceId,
        playerScore,
        ghostScore: race.ghostScore,
        won: playerWon,
        isTie,
        completionTime,
        ghostDuration: race.ghostDurationMs,
      });

      console.log(`Ghost race ${raceId} completed. Player score: ${playerScore}, Ghost score: ${race.ghostScore}, Won: ${playerWon}`);

      // Clean up race state after a delay
      setTimeout(async () => {
        await ghostRaceStateService.deleteRace(raceId);
      }, 60000); // Keep for 1 minute for potential review
    } catch (error) {
      console.error("Error submitting ghost race:", error);
      socket.emit("error", { message: "Failed to submit", code: "SUBMIT_FAILED" });
    }
  });

  /**
   * Handle ghost_race_abandon event
   */
  socket.on("ghost_race_abandon" as any, async (data: { raceId: string }) => {
    try {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { raceId } = data;

      // Get race state
      const race = await ghostRaceStateService.getRace(raceId);
      if (!race) {
        return; // Already cleaned up
      }

      // Verify player owns this race
      if (race.playerId !== socket.userId) {
        socket.emit("error", { message: "Not your race", code: "UNAUTHORIZED" });
        return;
      }

      // Stop ghost playback
      stopGhostPlayback(raceId);

      // Update race status
      await ghostRaceStateService.updateRaceStatus(raceId, "abandoned");

      // Clean up
      await ghostRaceStateService.deleteRace(raceId);

      console.log(`Ghost race ${raceId} abandoned by user ${socket.userId}`);
    } catch (error) {
      console.error("Error abandoning ghost race:", error);
    }
  });

  /**
   * Handle disconnect - cleanup ghost race
   */
  socket.on("disconnect", async () => {
    if (!socket.userId) {
      return;
    }

    try {
      // Find and clean up any active race for this player
      const raceId = await ghostRaceStateService.getPlayerRaceId(socket.userId);
      if (raceId) {
        stopGhostPlayback(raceId);
        await ghostRaceStateService.updateRaceStatus(raceId, "abandoned");
        await ghostRaceStateService.deleteRace(raceId);
        console.log(`Ghost race ${raceId} cleaned up on disconnect`);
      }
    } catch (error) {
      console.error("Error cleaning up ghost race on disconnect:", error);
    }
  });
}

/**
 * Start ghost playback timer
 * Emits ghost events at recorded timestamps
 * Requirements: 14.2, 14.3
 */
function startGhostPlayback(_io: Server<ClientToServerEvents, ServerToClientEvents>, socket: AuthenticatedSocket, raceId: string, _initialState: GhostRaceState): void {
  const PLAYBACK_INTERVAL = 50; // Check every 50ms for events to emit

  const timer = setInterval(async () => {
    try {
      const race = await ghostRaceStateService.getRace(raceId);
      if (!race || race.status !== "active") {
        stopGhostPlayback(raceId);
        return;
      }

      // Calculate elapsed time since race started
      const elapsedTime = Date.now() - race.startedAt;

      // Get events to playback
      const playbackData = await ghostRaceStateService.getEventsToPlayback(raceId, elapsedTime);
      if (!playbackData) {
        stopGhostPlayback(raceId);
        return;
      }

      const { events, newIndex } = playbackData;

      // Emit each event
      for (const event of events) {
        emitGhostEvent(socket, event);
      }

      // Update index if changed
      if (newIndex !== race.currentGhostEventIndex) {
        await ghostRaceStateService.updateGhostEventIndex(raceId, newIndex);
      }

      // Check if playback is complete
      if (await ghostRaceStateService.isGhostPlaybackComplete(raceId)) {
        stopGhostPlayback(raceId);

        // Emit ghost finished event
        socket.emit("ghost_finished" as any, {
          raceId,
          ghostScore: race.ghostScore,
          ghostDuration: race.ghostDurationMs,
        });
      }
    } catch (error) {
      console.error("Error in ghost playback:", error);
      stopGhostPlayback(raceId);
    }
  }, PLAYBACK_INTERVAL);

  ghostPlaybackTimers.set(raceId, timer);
}

/**
 * Stop ghost playback timer
 */
function stopGhostPlayback(raceId: string): void {
  const timer = ghostPlaybackTimers.get(raceId);
  if (timer) {
    clearInterval(timer);
    ghostPlaybackTimers.delete(raceId);
  }
}

/**
 * Emit ghost event to player
 * Requirements: 14.2, 14.3
 */
function emitGhostEvent(socket: AuthenticatedSocket, event: GhostEvent): void {
  switch (event.event_type) {
    case "code_update":
      socket.emit("ghost_code_update" as any, {
        code: event.data.code,
        cursor: event.data.cursor,
        timestamp: event.timestamp,
      });
      break;

    case "test_run":
      socket.emit("ghost_test_run" as any, {
        results: event.data.results,
        timestamp: event.timestamp,
      });
      break;

    case "submission":
      socket.emit("ghost_submitted" as any, {
        timestamp: event.timestamp,
      });
      break;

    case "cursor_move":
      // Optional: emit cursor movement
      break;
  }
}

/**
 * Calculate player score for ghost race
 * Requirements: 14.4
 */
async function calculatePlayerScore(challengeId: string, code: string): Promise<number> {
  try {
    const challengeService = new ChallengeService();
    const challenge = await challengeService.getChallengeById(challengeId);
    if (!challenge) {
      return 0;
    }

    const { calculateCorrectnessScore, calculateEfficiencyScore, calculateFinalScore } = await import("../services/judging.service");
    const { analyzeCodeQuality } = await import("../services/gemini.service");

    // Calculate correctness
    const correctness = await calculateCorrectnessScore(code, "javascript", challenge.test_cases);

    // Calculate efficiency
    const efficiency = calculateEfficiencyScore(correctness.testResults);

    // Calculate quality (with fallback)
    let qualityScore = 5;
    try {
      const quality = await analyzeCodeQuality(code, "javascript", "ghost_race");
      qualityScore = quality.score;
    } catch {
      // Use default quality score if AI analysis fails
    }

    // Calculate final score
    const finalScore = calculateFinalScore(
      correctness.score,
      efficiency.score,
      qualityScore,
      5 // Default creativity
    );

    return Math.round(finalScore.totalScore);
  } catch (error) {
    console.error("Error calculating player score:", error);
    return 0;
  }
}

export { stopGhostPlayback };

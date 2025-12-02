import { Server } from "socket.io";
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from "./types";
import { matchStateService } from "../redis/matchState.service";
import { sessionManager } from "./sessionManager";
import { replayService } from "../services/replay.service";
import { generateVisualization, VisualizationData } from "../services/visualization.service";
import { powerUpService } from "../services/powerup.service";

// Throttle map to track last code update time per user
const codeUpdateThrottle = new Map<string, number>();
const THROTTLE_INTERVAL = 100; // 100ms

/**
 * Setup battle arena event handlers
 */
export function setupBattleArenaHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: AuthenticatedSocket): void {
  if (!socket.userId) {
    return;
  }

  /**
   * Handle code_update event with throttling
   */
  socket.on("code_update", async (data: { matchId: string; code: string; cursor: { line: number; column: number } }) => {
    try {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { matchId, code, cursor } = data;

      // Validate input
      if (!matchId || typeof code !== "string" || !cursor) {
        socket.emit("error", { message: "Invalid code update data", code: "INVALID_DATA" });
        return;
      }

      // Validate code length
      if (code.length > 5000) {
        socket.emit("error", { message: "Code exceeds maximum length of 5000 characters", code: "CODE_TOO_LONG" });
        return;
      }

      // Throttle code updates to 100ms intervals
      const lastUpdate = codeUpdateThrottle.get(socket.userId) || 0;
      const now = Date.now();

      if (now - lastUpdate < THROTTLE_INTERVAL) {
        // Skip this update, too soon
        return;
      }

      codeUpdateThrottle.set(socket.userId, now);

      // Get match state
      const match = await matchStateService.getMatch(matchId);

      if (!match) {
        socket.emit("error", { message: "Match not found", code: "MATCH_NOT_FOUND" });
        return;
      }

      // Verify user is a player in this match
      if (match.player1Id !== socket.userId && match.player2Id !== socket.userId) {
        socket.emit("error", { message: "Not a player in this match", code: "UNAUTHORIZED" });
        return;
      }

      // Verify match is active
      if (match.status !== "active") {
        socket.emit("error", { message: "Match is not active", code: "MATCH_NOT_ACTIVE" });
        return;
      }

      // Update match state in Redis
      await matchStateService.updatePlayerCode(matchId, socket.userId, code, cursor);

      // Record code update event for replay
      const matchStartTime = match.startedAt || Date.now();
      const eventTimestamp = Date.now() - matchStartTime;
      await replayService.recordCodeUpdate(matchId, socket.userId, eventTimestamp, code, cursor);

      // Determine opponent
      const opponentId = match.player1Id === socket.userId ? match.player2Id : match.player1Id;

      // Get opponent's socket
      const opponentSession = sessionManager.getSessionByUserId(opponentId);

      if (opponentSession) {
        // Emit code update to opponent
        io.to(opponentSession.socketId).emit("opponent_code_update", {
          code,
          cursor,
        });
      }

      // Broadcast code update to spectators
      io.to(`match:${matchId}:spectators`).emit("opponent_code_update", {
        code,
        cursor,
      });
    } catch (error) {
      console.error("Error handling code_update:", error);
      socket.emit("error", { message: "Failed to update code", code: "UPDATE_FAILED" });
    }
  });

  /**
   * Handle run_code event to execute code against test cases
   */
  socket.on("run_code", async (data: { matchId: string; code: string }) => {
    try {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { matchId, code } = data;

      // Validate input
      if (!matchId || typeof code !== "string") {
        socket.emit("error", { message: "Invalid run code data", code: "INVALID_DATA" });
        return;
      }

      // Validate code length
      if (code.length > 5000) {
        socket.emit("error", { message: "Code exceeds maximum length of 5000 characters", code: "CODE_TOO_LONG" });
        return;
      }

      // Get match state
      const match = await matchStateService.getMatch(matchId);

      if (!match) {
        socket.emit("error", { message: "Match not found", code: "MATCH_NOT_FOUND" });
        return;
      }

      // Verify user is a player in this match
      if (match.player1Id !== socket.userId && match.player2Id !== socket.userId) {
        socket.emit("error", { message: "Not a player in this match", code: "UNAUTHORIZED" });
        return;
      }

      // Verify match is active
      if (match.status !== "active") {
        socket.emit("error", { message: "Match is not active", code: "MATCH_NOT_ACTIVE" });
        return;
      }

      // Determine opponent and language
      const opponentId = match.player1Id === socket.userId ? match.player2Id : match.player1Id;
      const language = match.player1Id === socket.userId ? match.player1Language : match.player2Language;

      // Get opponent's socket
      const opponentSession = sessionManager.getSessionByUserId(opponentId);

      // Notify opponent that test is running
      if (opponentSession) {
        io.to(opponentSession.socketId).emit("opponent_test_run", { isRunning: true });
      }

      // Notify spectators that test is running
      io.to(`match:${matchId}:spectators`).emit("opponent_test_run", { isRunning: true });

      // Get challenge to retrieve test cases
      const { ChallengeService } = await import("../services/challenge.service");
      const service = new ChallengeService();
      const challenge = await service.getChallengeById(match.challengeId);

      if (!challenge) {
        socket.emit("error", { message: "Challenge not found", code: "CHALLENGE_NOT_FOUND" });
        return;
      }

      // Filter visible test cases only
      const visibleTestCases = challenge.test_cases.filter((tc) => !tc.isHidden);

      // Execute code against each visible test case with a global timeout
      const { dockerService } = await import("../execution/docker.service");
      const results: any[] = [];

      // Global timeout for all test cases (30 seconds max)
      const GLOBAL_TIMEOUT = 30000;
      const globalTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Test execution timed out")), GLOBAL_TIMEOUT);
      });

      const executeAllTests = async () => {
        for (const testCase of visibleTestCases) {
          try {
            const testInput = JSON.stringify(testCase.input);
            console.log(`[RunCode] Executing test with input: ${testInput}`);

            const result = await dockerService.executeCode({
              language: language as "javascript" | "python" | "typescript",
              code,
              testInput,
              timeout: 15000, // 15 seconds per test case (increased for container startup)
            });

            console.log(`[RunCode] Result: exitCode=${result.exitCode}, stdout="${result.stdout}", stderr="${result.stderr}"`);

            // Parse output and compare with expected
            let passed = false;
            let actualOutput = null;

            if (result.exitCode !== 0) {
              // Code execution failed - show the error
              actualOutput = null;
              passed = false;
              console.log(`[RunCode] Execution failed with exit code ${result.exitCode}`);
            } else {
              try {
                actualOutput = result.stdout ? JSON.parse(result.stdout) : null;
                passed = JSON.stringify(actualOutput) === JSON.stringify(testCase.expectedOutput);
              } catch (e) {
                // If parsing fails, compare as strings
                passed = result.stdout.trim() === String(testCase.expectedOutput).trim();
                actualOutput = result.stdout.trim();
              }
            }

            results.push({
              input: testCase.input,
              expectedOutput: testCase.expectedOutput,
              actualOutput,
              passed,
              executionTime: result.executionTime,
              memoryUsage: result.memoryUsage,
              stderr: result.stderr,
              timedOut: result.timedOut,
            });
          } catch (error) {
            console.error(`[RunCode] Exception during test execution:`, error);
            results.push({
              input: testCase.input,
              expectedOutput: testCase.expectedOutput,
              actualOutput: null,
              passed: false,
              executionTime: 0,
              memoryUsage: 0,
              stderr: error instanceof Error ? error.message : "Execution failed",
              timedOut: false,
            });
          }
        }
        return results;
      };

      // Race between test execution and global timeout
      try {
        await Promise.race([executeAllTests(), globalTimeoutPromise]);
      } catch (timeoutError) {
        // Global timeout hit - return partial results
        console.log("Global test timeout hit, returning partial results");
        if (results.length === 0) {
          results.push({
            input: "Timeout",
            expectedOutput: null,
            actualOutput: null,
            passed: false,
            executionTime: GLOBAL_TIMEOUT,
            memoryUsage: 0,
            stderr: "Test execution timed out. Your code may have an infinite loop.",
            timedOut: true,
          });
        }
      }

      // Check for active Debug Shield and consume a charge (Requirements: 4.2, 4.3)
      let debugShieldActive = false;
      let shieldChargesRemaining = 0;
      const playerPowerUpState = await powerUpService.getPlayerPowerUps(matchId, socket.userId);

      if (playerPowerUpState?.activeEffect?.type === "debug_shield") {
        debugShieldActive = true;
        // Consume a shield charge for this test run
        const shieldStatus = await powerUpService.consumeDebugShieldCharge(matchId, socket.userId);
        shieldChargesRemaining = shieldStatus.remainingCharges;

        // Mark failed tests as "shielded" when Debug Shield is active
        for (const result of results) {
          if (!result.passed) {
            result.shielded = true;
          }
        }

        console.log(`Debug Shield active for player ${socket.userId} in match ${matchId}. Charges remaining: ${shieldChargesRemaining}`);

        // Send updated power-up state to player
        const updatedPowerUpState = await powerUpService.getPlayerPowerUps(matchId, socket.userId);
        if (updatedPowerUpState) {
          socket.emit("powerup_state_update", updatedPowerUpState);
        }
      }

      // Generate visualization data from the first test case
      let visualization: VisualizationData | null = null;
      if (results.length > 0 && results[0].actualOutput !== null) {
        visualization = generateVisualization(results[0].input, results[0].actualOutput, challenge.title);
      }

      // Calculate total execution time and memory
      const totalExecutionTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);
      const maxMemoryUsage = Math.max(...results.map((r) => r.memoryUsage || 0));

      // Emit results to requesting player with visualization
      socket.emit("test_result", {
        results,
        executionTime: totalExecutionTime,
        memoryUsage: maxMemoryUsage,
        stdout: results[0]?.actualOutput ? JSON.stringify(results[0].actualOutput) : "",
        stderr: results.find((r) => r.stderr)?.stderr || "",
        visualization,
        debugShieldActive,
        shieldChargesRemaining,
      });

      // Record test run event for replay
      const matchStartTime = match.startedAt || Date.now();
      const eventTimestamp = Date.now() - matchStartTime;
      await replayService.recordTestRun(matchId, socket.userId, eventTimestamp, results);

      // Notify opponent that test is complete
      if (opponentSession) {
        io.to(opponentSession.socketId).emit("opponent_test_run", { isRunning: false });
      }

      // Notify spectators that test is complete
      io.to(`match:${matchId}:spectators`).emit("opponent_test_run", { isRunning: false });
    } catch (error) {
      console.error("Error handling run_code:", error);

      // Always emit test_result even on error so UI doesn't hang
      socket.emit("test_result", {
        results: [
          {
            input: "Error",
            expectedOutput: null,
            actualOutput: null,
            passed: false,
            executionTime: 0,
            memoryUsage: 0,
            stderr: error instanceof Error ? error.message : "Failed to execute code",
            timedOut: false,
          },
        ],
      });

      // Also notify that test run is complete
      socket.emit("error", { message: "Failed to execute code", code: "EXECUTION_FAILED" });
    }
  });

  /**
   * Handle submit_solution event
   */
  socket.on("submit_solution", async (data: { matchId: string; code: string }) => {
    try {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated", code: "AUTH_REQUIRED" });
        return;
      }

      const { matchId, code } = data;

      // Validate input
      if (!matchId || typeof code !== "string") {
        socket.emit("error", { message: "Invalid submission data", code: "INVALID_DATA" });
        return;
      }

      // Validate code length
      if (code.length > 5000) {
        socket.emit("error", { message: "Code exceeds maximum length of 5000 characters", code: "CODE_TOO_LONG" });
        return;
      }

      // Get match state
      const match = await matchStateService.getMatch(matchId);

      if (!match) {
        socket.emit("error", { message: "Match not found", code: "MATCH_NOT_FOUND" });
        return;
      }

      // Verify user is a player in this match
      if (match.player1Id !== socket.userId && match.player2Id !== socket.userId) {
        socket.emit("error", { message: "Not a player in this match", code: "UNAUTHORIZED" });
        return;
      }

      // Verify match is active
      if (match.status !== "active") {
        socket.emit("error", { message: "Match is not active", code: "MATCH_NOT_ACTIVE" });
        return;
      }

      // Check if player already submitted
      const isPlayer1 = match.player1Id === socket.userId;
      const alreadySubmitted = isPlayer1 ? match.player1Submitted : match.player2Submitted;

      if (alreadySubmitted) {
        socket.emit("error", { message: "Already submitted", code: "ALREADY_SUBMITTED" });
        return;
      }

      // Update player's code in match state
      await matchStateService.updatePlayerCode(matchId, socket.userId, code, isPlayer1 ? match.player1Cursor : match.player2Cursor);

      // Mark player as submitted
      await matchStateService.markPlayerSubmitted(matchId, socket.userId);
      console.log(`Player ${socket.userId} marked as submitted for match ${matchId}`);

      // Record submission event for replay
      const matchStartTime = match.startedAt || Date.now();
      const eventTimestamp = Date.now() - matchStartTime;
      const language = isPlayer1 ? match.player1Language : match.player2Language;
      await replayService.recordSubmission(matchId, socket.userId, eventTimestamp, code, language);

      // Determine opponent
      const opponentId = match.player1Id === socket.userId ? match.player2Id : match.player1Id;

      // Get opponent's socket
      const opponentSession = sessionManager.getSessionByUserId(opponentId);

      // Notify opponent that this player submitted
      if (opponentSession) {
        io.to(opponentSession.socketId).emit("opponent_submitted");
      }

      // Notify spectators that a player submitted
      io.to(`match:${matchId}:spectators`).emit("opponent_submitted");

      // Small delay to ensure Redis write is complete before checking
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if both players have submitted
      const bothSubmitted = await matchStateService.areBothPlayersSubmitted(matchId);
      console.log(`Both players submitted check for match ${matchId}: ${bothSubmitted}`);

      if (bothSubmitted) {
        // Trigger match completion and judging
        console.log(`Both players submitted for match ${matchId}. Triggering AI judging...`);

        // Import match service and complete the match
        const { matchService } = await import("../services/match.service");

        try {
          console.log(`Starting match completion for ${matchId}...`);

          // Add a global timeout for the entire judging process (60 seconds max)
          const JUDGING_TIMEOUT = 60000;
          const judgingPromise = matchService.completeMatch(matchId);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Judging timeout - took longer than 60 seconds")), JUDGING_TIMEOUT);
          });

          const result = await Promise.race([judgingPromise, timeoutPromise]);
          console.log(`Match completion result for ${matchId}:`, result);

          // Get player sessions (refresh to get current socket IDs)
          const player1Session = sessionManager.getSessionByUserId(match.player1Id);
          const player2Session = sessionManager.getSessionByUserId(match.player2Id);
          console.log(`Player sessions - P1: ${player1Session?.socketId || "NOT FOUND"}, P2: ${player2Session?.socketId || "NOT FOUND"}`);

          // Get user details for winner
          const { UserService } = await import("../services/user.service");
          const userService = new UserService();

          let winner = null;
          if (result.winnerId) {
            winner = await userService.getUserById(result.winnerId);
          }

          // Prepare match result data
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
              player1Feedback: result.player1Feedback,
              player2Feedback: result.player2Feedback,
            },
            duration: result.duration,
            matchId: result.matchId,
          };

          console.log(`Emitting match_result for ${matchId}:`, matchResultData);

          // Emit match_result to both players using the io instance passed to this handler
          if (player1Session) {
            io.to(player1Session.socketId).emit("match_result", matchResultData);
            console.log(`Emitted match_result to player1: ${player1Session.socketId}`);
          }

          if (player2Session) {
            io.to(player2Session.socketId).emit("match_result", matchResultData);
            console.log(`Emitted match_result to player2: ${player2Session.socketId}`);
          }

          // Emit match_result to spectators
          io.to(`match:${matchId}:spectators`).emit("match_result", matchResultData);

          // Stop timer sync for this matchTreeNode, GraphNode, GraphEdge,
          const { stopTimerSync } = await import("./lobbyHandler");
          stopTimerSync(matchId);

          console.log(`Match ${matchId} completed successfully. Winner: ${result.winnerId || "tie"}`);
        } catch (error) {
          console.error(`Error completing match ${matchId}:`, error);
          console.error(`Error stack:`, error instanceof Error ? error.stack : "No stack");

          // Notify players of error using the io instance passed to this handler
          const player1Session = sessionManager.getSessionByUserId(match.player1Id);
          const player2Session = sessionManager.getSessionByUserId(match.player2Id);

          const isTimeout = error instanceof Error && error.message.includes("timeout");
          const errorData = {
            message: isTimeout ? "Match judging timed out. Redirecting to results..." : "Failed to complete match judging. Please check results page.",
            code: isTimeout ? "JUDGING_TIMEOUT" : "JUDGING_FAILED",
          };

          // Even on error, try to redirect players to results page
          // The results page can show partial results or an error state
          const fallbackResultData = {
            winner: null,
            scores: { player1Score: 0, player2Score: 0 },
            feedback: { player1Feedback: "Judging failed or timed out.", player2Feedback: "Judging failed or timed out." },
            duration: 0,
            matchId,
          };

          if (player1Session) {
            io.to(player1Session.socketId).emit("error", errorData);
            // Also emit match_result to trigger redirect
            io.to(player1Session.socketId).emit("match_result", fallbackResultData);
          }

          if (player2Session) {
            io.to(player2Session.socketId).emit("error", errorData);
            // Also emit match_result to trigger redirect
            io.to(player2Session.socketId).emit("match_result", fallbackResultData);
          }
        }
      } else {
        console.log(`Match ${matchId}: Waiting for other player to submit. P1: ${match.player1Submitted}, P2: ${match.player2Submitted}`);
      }
    } catch (error) {
      console.error("Error handling submit_solution:", error);
      socket.emit("error", { message: "Failed to submit solution", code: "SUBMISSION_FAILED" });
    }
  });
}

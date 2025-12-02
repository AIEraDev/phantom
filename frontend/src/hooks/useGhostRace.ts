import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";

export interface GhostInfo {
  id: string;
  username: string;
  score: number;
  durationMs: number;
  isAI: boolean;
}

export interface GhostRaceChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  timeLimit: number;
  starterCode: Record<string, string>;
  testCases: Array<{ input: unknown; expectedOutput: unknown }>;
}

export interface GhostRaceResultData {
  raceId: string;
  playerScore: number;
  ghostScore: number;
  won: boolean;
  isTie: boolean;
  completionTime: number;
  ghostDuration: number;
}

export interface GhostCodeUpdate {
  code: string;
  cursor: { line: number; column: number };
  timestamp: number;
}

export interface GhostTestRun {
  results: Array<{ passed: boolean; executionTime: number }>;
  timestamp: number;
}

export interface GhostRaceState {
  raceId: string | null;
  ghost: GhostInfo | null;
  challenge: GhostRaceChallenge | null;
  ghostCode: string;
  ghostCursor: { line: number; column: number } | null;
  ghostTestResults: Array<{ passed: boolean }>;
  ghostSubmitted: boolean;
  ghostFinished: boolean;
  raceResult: GhostRaceResultData | null;
  isStarted: boolean;
  error: string | null;
}

/**
 * Custom hook for managing ghost race WebSocket events
 * Requirements: 14.2, 14.3, 14.4
 */
export function useGhostRace() {
  const { emit, on, off, isConnected } = useWebSocket();

  const [state, setState] = useState<GhostRaceState>({
    raceId: null,
    ghost: null,
    challenge: null,
    ghostCode: "",
    ghostCursor: null,
    ghostTestResults: [],
    ghostSubmitted: false,
    ghostFinished: false,
    raceResult: null,
    isStarted: false,
    error: null,
  });

  const raceStartTimeRef = useRef<number>(0);

  // Start a ghost race
  const startRace = useCallback(
    (challengeId: string, ghostId?: string) => {
      if (!isConnected) {
        setState((prev) => ({ ...prev, error: "Not connected to server" }));
        return;
      }

      emit("start_ghost_race", {
        challengeId,
        ghostId,
      });
    },
    [emit, isConnected]
  );

  // Update player code during race
  const updateCode = useCallback(
    (code: string, cursor?: { line: number; column: number }) => {
      if (state.raceId) {
        emit("ghost_race_code_update", {
          raceId: state.raceId,
          code,
          cursor: cursor || { line: 0, column: 0 },
        });
      }
    },
    [emit, state.raceId]
  );

  // Run tests during race
  const runTests = useCallback(
    (code: string) => {
      if (state.raceId) {
        emit("ghost_race_run_tests", {
          raceId: state.raceId,
          code,
        });
      }
    },
    [emit, state.raceId]
  );

  // Submit solution
  const submitSolution = useCallback(
    (code: string) => {
      if (state.raceId) {
        emit("ghost_race_submit", {
          raceId: state.raceId,
          code,
        });
      }
    },
    [emit, state.raceId]
  );

  // Abandon race
  const abandonRace = useCallback(() => {
    if (state.raceId) {
      emit("ghost_race_abandon", {
        raceId: state.raceId,
      });
      setState((prev) => ({
        ...prev,
        raceId: null,
        isStarted: false,
      }));
    }
  }, [emit, state.raceId]);

  // Reset state for new race
  const resetRace = useCallback(() => {
    setState({
      raceId: null,
      ghost: null,
      challenge: null,
      ghostCode: "",
      ghostCursor: null,
      ghostTestResults: [],
      ghostSubmitted: false,
      ghostFinished: false,
      raceResult: null,
      isStarted: false,
      error: null,
    });
  }, []);

  // Get elapsed time since race started
  const getElapsedTime = useCallback(() => {
    if (!state.isStarted || raceStartTimeRef.current === 0) {
      return 0;
    }
    return Date.now() - raceStartTimeRef.current;
  }, [state.isStarted]);

  // Get ghost progress percentage
  const getGhostProgress = useCallback(() => {
    if (!state.ghost || !state.isStarted || state.ghostFinished) {
      return state.ghostFinished ? 100 : 0;
    }
    const elapsed = getElapsedTime();
    return Math.min(100, (elapsed / state.ghost.durationMs) * 100);
  }, [state.ghost, state.isStarted, state.ghostFinished, getElapsedTime]);

  // Setup WebSocket event listeners
  useEffect(() => {
    // Handle race started
    const handleGhostRaceStarted = (data: { raceId: string; ghost: GhostInfo; challenge: GhostRaceChallenge }) => {
      raceStartTimeRef.current = Date.now();
      setState((prev) => ({
        ...prev,
        raceId: data.raceId,
        ghost: data.ghost,
        challenge: data.challenge,
        ghostCode: data.challenge.starterCode.javascript || "",
        isStarted: true,
        error: null,
      }));
    };

    // Handle ghost code update
    const handleGhostCodeUpdate = (data: GhostCodeUpdate) => {
      setState((prev) => ({
        ...prev,
        ghostCode: data.code,
        ghostCursor: data.cursor,
      }));
    };

    // Handle ghost test run
    const handleGhostTestRun = (data: GhostTestRun) => {
      setState((prev) => ({
        ...prev,
        ghostTestResults: data.results,
      }));
    };

    // Handle ghost submitted
    const handleGhostSubmitted = () => {
      setState((prev) => ({
        ...prev,
        ghostSubmitted: true,
      }));
    };

    // Handle ghost finished
    const handleGhostFinished = () => {
      setState((prev) => ({
        ...prev,
        ghostFinished: true,
      }));
    };

    // Handle race result
    const handleGhostRaceResult = (data: GhostRaceResultData) => {
      setState((prev) => ({
        ...prev,
        raceResult: data,
      }));
    };

    // Handle errors
    const handleError = (data: { message: string; code: string }) => {
      setState((prev) => ({
        ...prev,
        error: data.message,
      }));
    };

    // Register event listeners
    on("ghost_race_started", handleGhostRaceStarted);
    on("ghost_code_update", handleGhostCodeUpdate);
    on("ghost_test_run", handleGhostTestRun);
    on("ghost_submitted", handleGhostSubmitted);
    on("ghost_finished", handleGhostFinished);
    on("ghost_race_result", handleGhostRaceResult);
    on("error", handleError);

    // Cleanup
    return () => {
      off("ghost_race_started", handleGhostRaceStarted);
      off("ghost_code_update", handleGhostCodeUpdate);
      off("ghost_test_run", handleGhostTestRun);
      off("ghost_submitted", handleGhostSubmitted);
      off("ghost_finished", handleGhostFinished);
      off("ghost_race_result", handleGhostRaceResult);
      off("error", handleError);
    };
  }, [on, off]);

  return {
    // State
    ...state,
    isConnected,

    // Actions
    startRace,
    updateCode,
    runTests,
    submitSolution,
    abandonRace,
    resetRace,

    // Helpers
    getElapsedTime,
    getGhostProgress,
  };
}

export default useGhostRace;

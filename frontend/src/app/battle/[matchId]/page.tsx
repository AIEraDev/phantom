"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useWebSocket, useWebSocketConnection } from "@/hooks/useWebSocket";
import { useScreenShake } from "@/hooks/useScreenShake";
import CodeEditor from "@/components/CodeEditor";
import TestCasePanel, { TestCase, TestResult } from "@/components/TestCasePanel";
import ConsoleOutput from "@/components/ConsoleOutput";
import AlgorithmVisualizer from "@/components/AlgorithmVisualizer";
import { VisualizationData } from "@/types/visualization";

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  timeLimit: number;
  starterCode: {
    javascript: string;
    python: string;
    typescript: string;
  };
  testCases?: TestCase[];
}

type Language = "javascript" | "python" | "typescript";

export default function BattleArenaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;
  const { emit, on, off } = useWebSocket();
  const { isConnected } = useWebSocketConnection();
  const { shake } = useScreenShake({ duration: 200 });

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [language, setLanguage] = useState<Language>("javascript");
  const [playerCode, setPlayerCode] = useState("");
  const [opponentCode, setOpponentCode] = useState("");
  const [opponentCursor, setOpponentCursor] = useState<{ line: number; column: number } | undefined>();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | undefined>();
  const [memoryUsage, setMemoryUsage] = useState<number | undefined>();
  const [consoleOutput, setConsoleOutput] = useState({ stdout: "", stderr: "" });

  // Visualization state
  const [showVisualization, setShowVisualization] = useState(false);
  const [visualizationData, setVisualizationData] = useState<VisualizationData | null>(null);
  const [isVisualizationPlaying, setIsVisualizationPlaying] = useState(false);
  const [visualizationSpeed, setVisualizationSpeed] = useState(1);

  // Description modal state
  const [showDescription, setShowDescription] = useState(false);

  // Throttle timer for code updates
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCodeUpdateRef = useRef<string>("");

  // Load match data from API (handles page reload)
  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const { matchApi } = await import("@/lib/api");
        const response = await matchApi.getMatch(matchId);
        const matchData = response.match;

        // If match is completed, redirect to results page
        if (matchData.status === "completed") {
          console.log("Match already completed, redirecting to results");
          router.replace(`/results/${matchId}`);
          return;
        }

        if (matchData.challenge) {
          const challengeData: Challenge = {
            id: matchData.challenge.id,
            title: matchData.challenge.title,
            description: matchData.challenge.description,
            difficulty: matchData.challenge.difficulty as Challenge["difficulty"],
            timeLimit: matchData.challenge.time_limit,
            starterCode: matchData.challenge.starter_code as Challenge["starterCode"],
            testCases: matchData.challenge.test_cases
              ?.filter((tc: any) => !tc.isHidden)
              .map((tc: any, idx: number) => ({
                id: `tc-${idx}`,
                input: JSON.stringify(tc.input),
                expectedOutput: JSON.stringify(tc.expectedOutput),
                isHidden: false,
              })),
          };
          setChallenge(challengeData);

          // ALWAYS use API's startedAt as the authoritative source for timer sync
          // This ensures both players use the same server timestamp
          const apiStartedAt = (matchData as any).matchState?.startedAt;

          if (apiStartedAt) {
            // Use database/Redis startedAt - this is the authoritative source
            serverStartTimeRef.current = apiStartedAt;
            serverTimeLimitRef.current = challengeData.timeLimit;
            timerInitializedRef.current = true; // Mark timer as initialized
            const now = Date.now();
            const elapsed = Math.floor((now - apiStartedAt) / 1000);
            const remaining = Math.max(0, challengeData.timeLimit - elapsed);
            // Store for local countdown
            initialRemainingRef.current = remaining;
            timerStartedAtRef.current = now;
            console.log(`Timer from API (authoritative): startedAt=${apiStartedAt}, elapsed=${elapsed}s, remaining=${remaining}s`);
            setTimeRemaining(remaining);
            // Clear any stale sessionStorage timing data
            sessionStorage.removeItem(`match_timing_${matchId}`);
          } else {
            // Fallback to sessionStorage only if API doesn't have startedAt
            const timingDataStr = sessionStorage.getItem(`match_timing_${matchId}`);
            if (timingDataStr) {
              try {
                const timingData = JSON.parse(timingDataStr);
                serverStartTimeRef.current = timingData.startTime;
                serverTimeLimitRef.current = timingData.timeLimit;
                timerInitializedRef.current = true; // Mark timer as initialized
                const now = Date.now();
                const elapsed = Math.floor((now - timingData.startTime) / 1000);
                const remaining = Math.max(0, timingData.timeLimit - elapsed);
                // Store for local countdown
                initialRemainingRef.current = remaining;
                timerStartedAtRef.current = now;
                console.log(`Timer from sessionStorage (fallback): startTime=${timingData.startTime}, elapsed=${elapsed}s, remaining=${remaining}s`);
                setTimeRemaining(remaining);
                sessionStorage.removeItem(`match_timing_${matchId}`);
              } catch (e) {
                console.error("Failed to parse timing data:", e);
                setTimeRemaining(challengeData.timeLimit);
              }
            } else {
              console.log(`Timer fallback: using full timeLimit=${challengeData.timeLimit}s`);
              setTimeRemaining(challengeData.timeLimit);
            }
          }

          // Restore code from match state if available
          const isPlayer1 = matchData.player1_id === user?.id;
          const savedCode = isPlayer1 ? (matchData as any).matchState?.player1Code : (matchData as any).matchState?.player2Code;
          const savedLanguage = isPlayer1 ? (matchData as any).matchState?.player1Language : (matchData as any).matchState?.player2Language;

          if (savedCode) {
            setPlayerCode(savedCode);
          } else {
            const lang = (savedLanguage || "javascript") as Language;
            setPlayerCode(challengeData.starterCode[lang] || "");
          }

          if (savedLanguage) {
            setLanguage(savedLanguage as Language);
          }

          // Set opponent code
          const opponentCodeFromState = isPlayer1 ? (matchData as any).matchState?.player2Code : (matchData as any).matchState?.player1Code;
          if (opponentCodeFromState) {
            setOpponentCode(opponentCodeFromState);
          }
        }
      } catch (error) {
        console.error("Failed to fetch match data:", error);
        // Fallback to sessionStorage
        const matchDataStr = sessionStorage.getItem(`match_${matchId}`);
        if (matchDataStr) {
          try {
            const matchData = JSON.parse(matchDataStr);
            if (matchData.challenge) {
              setChallenge(matchData.challenge);
              setPlayerCode(matchData.challenge.starterCode?.javascript || "");
              setTimeRemaining(matchData.challenge.timeLimit);
            }
          } catch (e) {
            console.error("Failed to parse session match data:", e);
          }
        }
      }
    };

    fetchMatchData();
  }, [matchId, user?.id]);

  // Auto-submit ref to avoid stale closure
  const autoSubmitRef = useRef(false);

  // Timer countdown - use local elapsed time from when timer was initialized
  // This ensures consistent countdown across different machines
  useEffect(() => {
    if (timeRemaining === null) return;

    const timer = setInterval(() => {
      let remaining: number = 0;

      // Use local elapsed time calculation for consistency across machines
      if (initialRemainingRef.current !== null && timerStartedAtRef.current !== null) {
        // Calculate how many seconds have passed since we initialized the timer locally
        const localElapsed = Math.floor((Date.now() - timerStartedAtRef.current) / 1000);
        remaining = Math.max(0, initialRemainingRef.current - localElapsed);
        setTimeRemaining(remaining);
      } else if (serverStartTimeRef.current && serverTimeLimitRef.current) {
        // Fallback to server time calculation
        const elapsed = Math.floor((Date.now() - serverStartTimeRef.current) / 1000);
        remaining = Math.max(0, serverTimeLimitRef.current - elapsed);
        setTimeRemaining(remaining);
      } else {
        // Final fallback to simple decrement
        setTimeRemaining((prev) => {
          remaining = prev !== null ? Math.max(0, prev - 1) : 0;
          return remaining;
        });
      }

      // Auto-submit when time runs out
      if (remaining <= 0 && !isSubmitted && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        console.log("Timer expired - auto-submitting solution");
        emit("submit_solution", {
          matchId,
          code: playerCode,
        });
        setIsSubmitted(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining === null, isSubmitted, matchId, playerCode, emit]); // Include all dependencies

  // Listen for opponent code updates
  useEffect(() => {
    const handleOpponentCodeUpdate = (data: { code: string; cursor: { line: number; column: number } }) => {
      setOpponentCode(data.code);
      setOpponentCursor(data.cursor);
    };

    on("opponent_code_update", handleOpponentCodeUpdate);

    return () => {
      off("opponent_code_update", handleOpponentCodeUpdate);
    };
  }, [on, off]);

  // Listen for test results
  useEffect(() => {
    const handleTestResult = (data: { results: TestResult[]; executionTime: number; memoryUsage: number; stdout?: string; stderr?: string; visualization?: VisualizationData }) => {
      setTestResults(data.results);
      setExecutionTime(data.executionTime);
      setMemoryUsage(data.memoryUsage);
      setConsoleOutput({
        stdout: data.stdout || "",
        stderr: data.stderr || "",
      });
      setIsRunningTests(false);

      // Update visualization data if available
      if (data.visualization) {
        setVisualizationData(data.visualization);
        setIsVisualizationPlaying(false); // Reset playback state
      }

      // Trigger screen shake if any tests failed or there's an error
      const hasFailedTests = data.results.some((result) => !result.passed);
      const hasError = data.stderr && data.stderr.length > 0;
      if (hasFailedTests || hasError) {
        shake();
      }
    };

    const handleOpponentTestRun = (data: { isRunning: boolean }) => {
      // Could show indicator that opponent is running tests
      console.log("Opponent test run:", data.isRunning);
    };

    on("test_result", handleTestResult);
    on("opponent_test_run", handleOpponentTestRun);

    return () => {
      off("test_result", handleTestResult);
      off("opponent_test_run", handleOpponentTestRun);
    };
  }, [on, off]);

  // Store the server's start time for consistent timer calculation
  const serverStartTimeRef = useRef<number | null>(null);
  const serverTimeLimitRef = useRef<number | null>(null);
  // Track if we've already initialized the timer to prevent resets
  const timerInitializedRef = useRef<boolean>(false);
  // Store the initial remaining time calculated at sync moment
  // This ensures both players count down from the same value
  const initialRemainingRef = useRef<number | null>(null);
  const timerStartedAtRef = useRef<number | null>(null);

  // Listen for match_started event to sync timer
  useEffect(() => {
    const handleMatchStarted = (data: { startTime: number; timeLimit: number; remaining?: number }) => {
      console.log("Match started event received:", data);

      // If timer is already initialized with valid server time, ignore subsequent events
      // This prevents timer resets on WebSocket reconnection
      if (timerInitializedRef.current && serverStartTimeRef.current) {
        console.log("Timer already initialized, ignoring match_started event");
        return;
      }

      // Store server time for consistent calculations
      serverStartTimeRef.current = data.startTime;
      serverTimeLimitRef.current = data.timeLimit;
      timerInitializedRef.current = true;

      // Use server-provided remaining time if available (most accurate)
      // Otherwise calculate from startTime
      const now = Date.now();
      let remaining: number;
      if (data.remaining !== undefined) {
        remaining = data.remaining;
        console.log(`Timer using server-provided remaining: ${remaining}s`);
      } else {
        const elapsed = Math.floor((now - data.startTime) / 1000);
        remaining = Math.max(0, data.timeLimit - elapsed);
        console.log(`Timer calculated from startTime: elapsed=${elapsed}s, remaining=${remaining}s`);
      }

      // Store the initial remaining time and when we started counting
      // This allows us to count down locally without relying on Date.now() accuracy
      initialRemainingRef.current = remaining;
      timerStartedAtRef.current = now;

      setTimeRemaining(remaining);
    };

    on("match_started", handleMatchStarted);

    return () => {
      off("match_started", handleMatchStarted);
    };
  }, [on, off]);

  // Listen for timer_sync events from server to keep timer synchronized
  useEffect(() => {
    const handleTimerSync = (data: { remaining: number }) => {
      console.log(`Timer sync received: remaining=${data.remaining}s`);
      // Update the timer with server-authoritative remaining time
      // Reset local countdown tracking to sync with server
      const now = Date.now();
      initialRemainingRef.current = data.remaining;
      timerStartedAtRef.current = now;
      setTimeRemaining(data.remaining);
    };

    on("timer_sync", handleTimerSync);

    return () => {
      off("timer_sync", handleTimerSync);
    };
  }, [on, off]);

  // Listen for submission events
  useEffect(() => {
    const handleOpponentSubmitted = () => {
      setOpponentSubmitted(true);
    };

    const handleMatchResult = (data: any) => {
      // Redirect to results page
      router.push(`/results/${matchId}`);
    };

    on("opponent_submitted", handleOpponentSubmitted);
    on("match_result", handleMatchResult);

    return () => {
      off("opponent_submitted", handleOpponentSubmitted);
      off("match_result", handleMatchResult);
    };
  }, [on, off, router, matchId]);

  const handleCodeChange = useCallback(
    (code: string) => {
      setPlayerCode(code);

      // Throttle code updates to 100ms intervals
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }

      throttleTimerRef.current = setTimeout(() => {
        // Only emit if code has changed
        if (code !== lastCodeUpdateRef.current) {
          lastCodeUpdateRef.current = code;
          emit("code_update", {
            matchId,
            code,
            cursor: { line: 1, column: 1 }, // Monaco editor cursor position would be tracked separately
          });
        }
      }, 100);
    },
    [matchId, emit]
  );

  const handleRunTests = useCallback(() => {
    if (!isRunningTests && !isSubmitted) {
      setIsRunningTests(true);
      emit("run_code", {
        matchId,
        code: playerCode,
      });
    }
  }, [isRunningTests, isSubmitted, matchId, playerCode, emit]);

  const handleSubmit = useCallback(() => {
    if (!isSubmitted) {
      setIsSubmitted(true);
      emit("submit_solution", {
        matchId,
        code: playerCode,
      });
    }
  }, [isSubmitted, matchId, playerCode, emit]);

  const handleClearConsole = () => {
    setConsoleOutput({ stdout: "", stderr: "" });
  };

  // Visualization handlers
  const handleToggleVisualization = useCallback(() => {
    setShowVisualization((prev) => !prev);
  }, []);

  const handleVisualizationPlayPause = useCallback(() => {
    setIsVisualizationPlaying((prev) => !prev);
  }, []);

  const handleVisualizationSpeedChange = useCallback((speed: number) => {
    setVisualizationSpeed(speed);
  }, []);

  const handleVisualizationStepChange = useCallback((step: number) => {
    // Optional: track current step for UI updates
    console.log("Visualization step:", step);
  }, []);

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getTimerColor = (): string => {
    if (timeRemaining === null || timeRemaining > 60) return "text-accent-lime";
    if (timeRemaining > 30) return "text-accent-yellow";
    return "text-accent-red";
  };

  if (!challenge) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-background-primary flex items-center justify-center relative overflow-hidden">
          {/* Background Grid Pattern */}
          <div
            className="fixed inset-0 z-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
              backgroundSize: '4rem 4rem'
            }}
          />
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="w-16 h-16 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin" />
            <span className="text-accent-cyan font-code animate-pulse">INITIALIZING BATTLEFIELD...</span>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="h-screen bg-background-primary flex flex-col overflow-hidden relative selection:bg-accent-cyan/20 selection:text-accent-cyan">
        {/* Background Grid Pattern */}
        <div
          className="fixed inset-0 z-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
            backgroundSize: '4rem 4rem'
          }}
        />

        {/* Top Bar */}
        <header className="relative z-20 bg-background-secondary/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
              <h1 className="text-lg font-bold text-white tracking-tight">{challenge.title}</h1>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getTimerColor().replace('text-', 'border-').replace('500', '500/30')} ${getTimerColor()}`}>
              {challenge.difficulty}
            </span>
            <button
              onClick={() => setShowDescription(!showDescription)}
              className="p-1.5 rounded-md hover:bg-white/5 text-text-secondary hover:text-white transition-colors"
              title="View Mission Briefing"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-6">
            {/* Timer */}
            <div className={`flex items-center gap-2 font-code font-bold text-xl ${getTimerColor()} tabular-nums`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(timeRemaining)}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleVisualization}
                className={`
                  hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-300
                  ${showVisualization
                    ? "bg-accent-magenta/20 text-accent-magenta border border-accent-magenta/50 shadow-[0_0_15px_rgba(255,0,255,0.2)]"
                    : "bg-white/5 text-text-secondary hover:bg-white/10 border border-white/10"}
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden lg:inline">Visualize</span>
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSubmitted || !isConnected}
                className={`
                  px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-300
                  ${isSubmitted
                    ? "bg-accent-lime/20 text-accent-lime border border-accent-lime/50 cursor-not-allowed"
                    : "bg-accent-cyan text-background-primary hover:bg-accent-cyan/90 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)]"}
                  disabled:opacity-50
                `}
              >
                {isSubmitted ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Submitted
                  </span>
                ) : (
                  "Submit Solution"
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
          {/* Left Side - Player's Editor and Console */}
          <div className="w-full lg:w-[60%] lg:border-r border-white/5 flex flex-col bg-background-primary/50 backdrop-blur-sm">
            {/* Player's Editor */}
            <div className="h-[50%] lg:h-[70%] border-b border-white/5 flex flex-col">
              <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]"></div>
                  <span className="text-white font-bold text-sm tracking-wide">YOUR TERMINAL</span>
                  <span className="text-text-muted text-xs uppercase">[{language}]</span>
                </div>
                {user && <span className="text-text-secondary text-xs font-code">{user.username}</span>}
              </div>
              <div className="flex-1 overflow-hidden relative">
                <CodeEditor language={language} initialCode={playerCode} onChange={handleCodeChange} readOnly={isSubmitted} height="100%" enableParticles={!isSubmitted} particleColor="#00ffff" />
              </div>
            </div>

            {/* Console Output or Visualization */}
            <div className="h-[50%] lg:h-[30%] bg-black/20">
              {showVisualization ? (
                <div className="h-full flex flex-col">
                  <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent-magenta shadow-[0_0_10px_rgba(255,0,255,0.5)]"></div>
                      <span className="text-white font-bold text-sm tracking-wide">VISUALIZER</span>
                    </div>
                    <button onClick={handleToggleVisualization} className="text-text-muted hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <AlgorithmVisualizer data={visualizationData} isPlaying={isVisualizationPlaying} speed={visualizationSpeed} onStepChange={handleVisualizationStepChange} onPlayPauseToggle={handleVisualizationPlayPause} onSpeedChange={handleVisualizationSpeedChange} />
                  </div>
                </div>
              ) : (
                <ConsoleOutput stdout={consoleOutput.stdout} stderr={consoleOutput.stderr} onClear={handleClearConsole} />
              )}
            </div>
          </div>

          {/* Right Side - Opponent's Editor and Test Cases */}
          <div className="hidden lg:flex lg:w-[40%] flex-col bg-background-secondary/30 backdrop-blur-sm">
            {/* Opponent's Editor */}
            <div className="h-[50%] border-b border-white/5 flex flex-col relative">
              <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-magenta shadow-[0_0_10px_rgba(255,0,255,0.5)]"></div>
                  <span className="text-white font-bold text-sm tracking-wide">OPPONENT UPLINK</span>
                </div>
                <div className="flex items-center gap-3">
                  {opponentSubmitted && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-accent-lime uppercase tracking-wider bg-accent-lime/10 px-2 py-0.5 rounded border border-accent-lime/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-lime animate-pulse" />
                      Submitted
                    </span>
                  )}
                  <span className="text-text-muted text-xs uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Live
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                <CodeEditor language={language} initialCode={opponentCode} onChange={() => { }} readOnly={true} showCursor={opponentCursor} height="100%" />
              </div>
              {/* Overlay to discourage cheating/copying */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background-primary/20" />
            </div>

            {/* Test Cases Panel */}
            <div className="h-[50%] bg-black/20">
              <TestCasePanel testCases={challenge.testCases || []} results={testResults} onRunTests={handleRunTests} isRunning={isRunningTests} executionTime={executionTime} memoryUsage={memoryUsage} />
            </div>
          </div>
        </div>

        {/* Mobile Test Cases Panel - Fixed at bottom */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 max-h-[40vh] overflow-hidden bg-background-secondary border-t border-white/10 shadow-2xl">
          <TestCasePanel testCases={challenge.testCases || []} results={testResults} onRunTests={handleRunTests} isRunning={isRunningTests} executionTime={executionTime} memoryUsage={memoryUsage} />
        </div>

        {/* Connection Status Indicator */}
        {!isConnected && (
          <div className="absolute top-20 right-6 px-4 py-2 bg-accent-red/20 border border-accent-red rounded-lg z-50 animate-pulse">
            <p className="text-accent-red text-xs font-bold uppercase tracking-wider">⚠ Connection Lost - Reconnecting...</p>
          </div>
        )}

        {/* Challenge Description Modal */}
        {showDescription && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowDescription(false)}>
            <div className="glass-card-strong border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <h2 className="text-2xl font-header font-bold text-white">MISSION BRIEFING</h2>
                <button onClick={() => setShowDescription(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-secondary hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-8 overflow-y-auto max-h-[60vh]">
                <div className="flex items-center gap-4 mb-6">
                  <h3 className="text-xl font-bold text-accent-cyan">{challenge.title}</h3>
                  <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${getTimerColor().replace('text-', 'border-').replace('500', '500/30')} ${getTimerColor()}`}>
                    {challenge.difficulty}
                  </span>
                </div>
                <div className="prose prose-invert max-w-none">
                  <p className="text-text-secondary whitespace-pre-wrap leading-relaxed text-base">{challenge.description}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

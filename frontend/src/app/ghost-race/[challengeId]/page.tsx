"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useWebSocket, useWebSocketConnection } from "@/hooks/useWebSocket";
import { useScreenShake } from "@/hooks/useScreenShake";
import CodeEditor from "@/components/CodeEditor";
import TestCasePanel, { TestCase, TestResult } from "@/components/TestCasePanel";
import ConsoleOutput from "@/components/ConsoleOutput";
import GhostRaceResult from "@/components/GhostRaceResult";

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

interface GhostInfo {
  id: string;
  username: string;
  score: number;
  durationMs: number;
  isAI: boolean;
}

interface GhostRaceResultData {
  raceId: string;
  playerScore: number;
  ghostScore: number;
  won: boolean;
  isTie: boolean;
  completionTime: number;
  ghostDuration: number;
}

type Language = "javascript" | "python" | "typescript";

/**
 * GhostRacePage Component
 * Split view layout with player (60%) and ghost (40%) editors
 * Requirements: 14.2, 14.3
 */
export default function GhostRacePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const challengeId = params.challengeId as string;
  const ghostId = searchParams.get("ghostId");

  const { emit, on, off } = useWebSocket();
  const { isConnected } = useWebSocketConnection();
  const { shake } = useScreenShake({ duration: 200 });

  // Race state
  const [raceId, setRaceId] = useState<string | null>(null);
  const [raceStarted, setRaceStarted] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [ghost, setGhost] = useState<GhostInfo | null>(null);

  // Code state
  const [language, setLanguage] = useState<Language>("javascript");
  const [playerCode, setPlayerCode] = useState("");
  const [ghostCode, setGhostCode] = useState("");
  const [ghostCursor, setGhostCursor] = useState<{ line: number; column: number } | undefined>();

  // Race progress
  const [elapsedTime, setElapsedTime] = useState(0);
  const [ghostProgress, setGhostProgress] = useState(0);
  const [ghostSubmitted, setGhostSubmitted] = useState(false);
  const [ghostFinished, setGhostFinished] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Test results
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [ghostTestResults, setGhostTestResults] = useState<Array<{ passed: boolean }>>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | undefined>();
  const [memoryUsage, setMemoryUsage] = useState<number | undefined>();
  const [consoleOutput, setConsoleOutput] = useState({ stdout: "", stderr: "" });

  // Race result
  const [raceResult, setRaceResult] = useState<GhostRaceResultData | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Refs
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCodeUpdateRef = useRef<string>("");
  const raceStartTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start ghost race when connected
  useEffect(() => {
    if (isConnected && challengeId && !raceStarted) {
      emit("start_ghost_race", {
        challengeId,
        ghostId: ghostId || undefined,
      });
    }
  }, [isConnected, challengeId, ghostId, raceStarted, emit]);

  // Timer for elapsed time
  useEffect(() => {
    if (raceStarted && !isSubmitted && !showResult) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - raceStartTimeRef.current);
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [raceStarted, isSubmitted, showResult]);

  // Update ghost progress based on elapsed time
  useEffect(() => {
    if (ghost && raceStarted && !ghostFinished) {
      const progress = Math.min(100, (elapsedTime / ghost.durationMs) * 100);
      setGhostProgress(progress);
    }
  }, [elapsedTime, ghost, raceStarted, ghostFinished]);

  // Listen for ghost race events
  useEffect(() => {
    const handleGhostRaceStarted = (data: {
      raceId: string;
      ghost: GhostInfo;
      challenge: {
        id: string;
        title: string;
        description: string;
        difficulty: string;
        timeLimit: number;
        starterCode: Record<string, string>;
        testCases: Array<{ input: unknown; expectedOutput: unknown }>;
      };
    }) => {
      setRaceId(data.raceId);
      setGhost(data.ghost);
      setChallenge({
        id: data.challenge.id,
        title: data.challenge.title,
        description: data.challenge.description,
        difficulty: data.challenge.difficulty as Challenge["difficulty"],
        timeLimit: data.challenge.timeLimit,
        starterCode: data.challenge.starterCode as Challenge["starterCode"],
        testCases: data.challenge.testCases.map((tc, idx) => ({
          id: `tc-${idx}`,
          input: JSON.stringify(tc.input),
          expectedOutput: JSON.stringify(tc.expectedOutput),
          isHidden: false,
        })),
      });
      setPlayerCode(data.challenge.starterCode.javascript || "");
      setGhostCode(data.challenge.starterCode.javascript || "");
      setRaceStarted(true);
      raceStartTimeRef.current = Date.now();
    };

    const handleGhostCodeUpdate = (data: { code: string; cursor: { line: number; column: number }; timestamp: number }) => {
      setGhostCode(data.code);
      setGhostCursor(data.cursor);
    };

    const handleGhostTestRun = (data: { results: Array<{ passed: boolean; executionTime: number }>; timestamp: number }) => {
      setGhostTestResults(data.results);
    };

    const handleGhostSubmitted = () => {
      setGhostSubmitted(true);
    };

    const handleGhostFinished = (data: { raceId: string; ghostScore: number; ghostDuration: number }) => {
      setGhostFinished(true);
      setGhostProgress(100);
    };

    const handleGhostRaceResult = (data: GhostRaceResultData) => {
      setRaceResult(data);
      setShowResult(true);
    };

    const handleGhostRaceTestResult = (data: { results: TestResult[] }) => {
      setTestResults(data.results);
      setIsRunningTests(false);

      const hasFailedTests = data.results.some((result) => !result.passed);
      if (hasFailedTests) {
        shake();
      }
    };

    const handleError = (data: { message: string; code: string }) => {
      console.error("Ghost race error:", data);
      if (data.code === "RACE_NOT_FOUND" || data.code === "RACE_START_FAILED") {
        router.push("/dashboard");
      }
    };

    on("ghost_race_started", handleGhostRaceStarted);
    on("ghost_code_update", handleGhostCodeUpdate);
    on("ghost_test_run", handleGhostTestRun);
    on("ghost_submitted", handleGhostSubmitted);
    on("ghost_finished", handleGhostFinished);
    on("ghost_race_result", handleGhostRaceResult);
    on("ghost_race_test_result", handleGhostRaceTestResult);
    on("error", handleError);

    return () => {
      off("ghost_race_started", handleGhostRaceStarted);
      off("ghost_code_update", handleGhostCodeUpdate);
      off("ghost_test_run", handleGhostTestRun);
      off("ghost_submitted", handleGhostSubmitted);
      off("ghost_finished", handleGhostFinished);
      off("ghost_race_result", handleGhostRaceResult);
      off("ghost_race_test_result", handleGhostRaceTestResult);
      off("error", handleError);
    };
  }, [on, off, router, shake]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (raceId && !showResult) {
        emit("ghost_race_abandon", { raceId });
      }
    };
  }, [raceId, showResult, emit]);

  const handleCodeChange = useCallback(
    (code: string) => {
      setPlayerCode(code);

      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }

      throttleTimerRef.current = setTimeout(() => {
        if (code !== lastCodeUpdateRef.current && raceId) {
          lastCodeUpdateRef.current = code;
          emit("ghost_race_code_update", {
            raceId,
            code,
            cursor: { line: 1, column: 1 },
          });
        }
      }, 100);
    },
    [raceId, emit]
  );

  const handleRunTests = useCallback(() => {
    if (!isRunningTests && !isSubmitted && raceId) {
      setIsRunningTests(true);
      emit("ghost_race_run_tests", {
        raceId,
        code: playerCode,
      });
    }
  }, [isRunningTests, isSubmitted, raceId, playerCode, emit]);

  const handleSubmit = useCallback(() => {
    if (!isSubmitted && raceId) {
      setIsSubmitted(true);
      emit("ghost_race_submit", {
        raceId,
        code: playerCode,
      });
    }
  }, [isSubmitted, raceId, playerCode, emit]);

  const handleClearConsole = () => {
    setConsoleOutput({ stdout: "", stderr: "" });
  };

  const handleAbandon = () => {
    if (raceId) {
      emit("ghost_race_abandon", { raceId });
    }
    router.push("/dashboard");
  };

  const handleSaveGhost = async () => {
    // This would be implemented when we have match ID from the race
    console.log("Save ghost functionality");
  };

  const handlePlayAgain = () => {
    setShowResult(false);
    setRaceResult(null);
    setRaceStarted(false);
    setRaceId(null);
    setIsSubmitted(false);
    setGhostSubmitted(false);
    setGhostFinished(false);
    setElapsedTime(0);
    setGhostProgress(0);
    setTestResults([]);
    setGhostTestResults([]);
    setGhostCode(challenge?.starterCode.javascript || "");
    setPlayerCode(challenge?.starterCode.javascript || "");

    // Restart the race
    if (isConnected && challengeId) {
      emit("start_ghost_race", {
        challengeId,
        ghostId: ghostId || undefined,
      });
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
  };

  // Show result modal
  if (showResult && raceResult) {
    return (
      <ProtectedRoute>
        <GhostRaceResult result={raceResult} ghost={ghost} onPlayAgain={handlePlayAgain} onSaveGhost={raceResult.won ? handleSaveGhost : undefined} onExit={() => router.push("/dashboard")} />
      </ProtectedRoute>
    );
  }

  // Loading state
  if (!challenge || !raceStarted) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-background-primary flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-accent-cyan/20 border-t-accent-cyan mx-auto mb-4"></div>
            <p className="text-text-secondary">Starting ghost race...</p>
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
          className="fixed inset-0 z-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
            backgroundSize: '4rem 4rem'
          }}
        />

        {/* Top Bar */}
        <div className="glass-card-strong border-b border-white/10 px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 relative z-10">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              👻
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-header font-bold text-white tracking-tight">{challenge.title}</h1>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan tracking-wider">Ghost Race</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider ${challenge.difficulty === 'easy' ? 'bg-accent-lime/10 border-accent-lime/30 text-accent-lime' :
                  challenge.difficulty === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' :
                    'bg-accent-red/10 border-accent-red/30 text-accent-red'
                  }`}>
                  {challenge.difficulty}
                </span>
              </div>
            </div>
          </div>

          {/* Timer and Controls */}
          <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 text-xl sm:text-2xl font-code font-bold text-accent-lime drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(elapsedTime)}
            </div>

            <button
              onClick={handleAbandon}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-accent-red transition-colors border border-transparent hover:border-accent-red/30 rounded-lg hover:bg-accent-red/5"
            >
              Abandon
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitted || !isConnected}
              className={`
                px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-300
                ${isSubmitted
                  ? "bg-accent-lime/20 text-accent-lime border border-accent-lime cursor-not-allowed shadow-[0_0_15px_rgba(57,255,20,0.2)]"
                  : "bg-accent-cyan text-background-primary hover:bg-accent-cyan/90 shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)]"} 
                disabled:opacity-50
              `}
            >
              {isSubmitted ? "Submitted ✓" : "Submit Solution"}
            </button>
          </div>
        </div>

        {/* Progress Comparison Widget */}
        <div className="bg-black/40 border-b border-white/5 px-4 py-3 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-6">
            {/* Player Progress */}
            <div className="flex-1 relative group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">You</span>
                </div>
                <span className="text-xs text-accent-cyan font-code font-bold">
                  {testResults.filter((r) => r.passed).length}/{testResults.length || "?"} TESTS
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-accent-cyan/50 to-accent-cyan transition-all duration-500 relative"
                  style={{
                    width: testResults.length > 0 ? `${(testResults.filter((r) => r.passed).length / testResults.length) * 100}%` : "0%",
                  }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
                </div>
              </div>
            </div>

            <div className="text-text-muted font-code text-xs font-bold opacity-50">VS</div>

            {/* Ghost Progress */}
            <div className="flex-1 relative group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-magenta shadow-[0_0_8px_rgba(255,0,60,0.8)]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {ghost?.username || "Ghost"} {ghost?.isAI && <span className="text-accent-magenta text-[10px] border border-accent-magenta/30 px-1 rounded ml-1">AI</span>}
                  </span>
                </div>
                <span className="text-xs text-accent-magenta font-code font-bold">{ghostSubmitted ? "SUBMITTED" : `${Math.round(ghostProgress)}%`}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-accent-magenta/50 to-accent-magenta transition-all duration-300 relative"
                  style={{ width: `${ghostProgress}%` }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          {/* Player's Editor (60%) */}
          <div className="w-[60%] border-r border-white/10 flex flex-col bg-background-primary/50 backdrop-blur-sm">
            <div className="h-[70%] border-b border-white/10 flex flex-col">
              <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_8px_rgba(0,240,255,0.8)]"></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Your Code</span>
                </div>
                {user && <span className="text-text-secondary text-xs font-code opacity-70">{user.username}</span>}
              </div>
              <div className="flex-1 overflow-hidden relative">
                <CodeEditor language={language} initialCode={playerCode} onChange={handleCodeChange} readOnly={isSubmitted} height="100%" enableParticles={!isSubmitted} particleColor="#00ffff" />
              </div>
            </div>

            {/* Console Output */}
            <div className="h-[30%] bg-black/80">
              <ConsoleOutput stdout={consoleOutput.stdout} stderr={consoleOutput.stderr} onClear={handleClearConsole} />
            </div>
          </div>

          {/* Ghost's Editor (40%) */}
          <div className="w-[40%] flex flex-col bg-background-secondary/30 backdrop-blur-sm">
            <div className="h-[50%] border-b border-white/10 flex flex-col">
              <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-magenta animate-pulse shadow-[0_0_8px_rgba(255,0,60,0.8)]"></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {ghost?.username || "Ghost"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {ghostSubmitted && (
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent-lime bg-accent-lime/10 px-2 py-0.5 rounded border border-accent-lime/20">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Done
                    </span>
                  )}
                  <span className="text-text-muted text-xs font-code">SCORE: <span className="text-white">{ghost?.score}</span></span>
                </div>
              </div>
              {/* Ghost editor with semi-transparent styling */}
              <div className="flex-1 overflow-hidden opacity-80 grayscale-[30%] hover:grayscale-0 transition-all duration-500">
                <CodeEditor language={language} initialCode={ghostCode} onChange={() => { }} readOnly={true} showCursor={ghostCursor} height="100%" />
              </div>
            </div>

            {/* Test Cases Panel */}
            <div className="h-[50%] bg-background-primary/50">
              <TestCasePanel testCases={challenge.testCases || []} results={testResults} onRunTests={handleRunTests} isRunning={isRunningTests} executionTime={executionTime} memoryUsage={memoryUsage} />
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="absolute top-24 right-6 px-4 py-3 bg-accent-red/10 border border-accent-red/50 rounded-xl backdrop-blur-md shadow-lg flex items-center gap-3 animate-pulse z-50">
            <div className="w-2 h-2 rounded-full bg-accent-red"></div>
            <p className="text-accent-red text-xs font-bold uppercase tracking-wider">Reconnecting to Server...</p>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

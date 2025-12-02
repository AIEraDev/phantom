"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CodeEditor from "@/components/CodeEditor";
import TestCasePanel, { TestCase, TestResult } from "@/components/TestCasePanel";
import ConsoleOutput from "@/components/ConsoleOutput";
import { HintPanel } from "@/components/HintPanel";
import { PracticeFeedbackPanel } from "@/components/PracticeFeedbackPanel";
import { practiceApi, PracticeSession, PracticeChallenge, PracticeHint, PracticeFeedback } from "@/lib/api";

type Language = "javascript" | "python" | "typescript";

const languages: { value: Language; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "typescript", label: "TypeScript" },
];

const difficultyColors: Record<string, string> = {
  easy: "text-accent-lime border-accent-lime",
  medium: "text-yellow-400 border-yellow-400",
  hard: "text-accent-magenta border-accent-magenta",
  expert: "text-accent-red border-accent-red",
};

/**
 * PracticeModePage Component
 * Code editor without timer, no opponent view, relaxed UI styling
 * Requirements: 17.2
 */
export default function PracticeModePage() {
  const router = useRouter();
  const params = useParams();
  const challengeId = params.challengeId as string;

  // Session state
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [challenge, setChallenge] = useState<PracticeChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Code state
  const [language, setLanguage] = useState<Language>("javascript");
  const [code, setCode] = useState("");

  // Test state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState({ stdout: "", stderr: "" });

  // Hint state
  const [hints, setHints] = useState<PracticeHint[]>([]);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);
  const [isLoadingHint, setIsLoadingHint] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedCodeRef = useRef<string>("");

  // Start session on mount
  useEffect(() => {
    const startSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await practiceApi.startSession(challengeId, language);
        setSession(response.session);
        setChallenge(response.challenge);
        setCode(response.session.code);
        lastSavedCodeRef.current = response.session.code;
      } catch (err: any) {
        console.error("Failed to start practice session:", err);
        setError(err.message || "Failed to start practice session");
      } finally {
        setIsLoading(false);
      }
    };

    if (challengeId) {
      startSession();
    }
  }, [challengeId, language]);

  // Auto-save functionality (Requirements: 17.2)
  useEffect(() => {
    if (!session || isCompleted) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set up new auto-save timer (30 seconds)
    autoSaveTimerRef.current = setTimeout(async () => {
      if (code !== lastSavedCodeRef.current && session) {
        try {
          setIsSaving(true);
          await practiceApi.saveProgress(session.id, code);
          lastSavedCodeRef.current = code;
          setLastSaved(new Date());
        } catch (err) {
          console.error("Auto-save failed:", err);
        } finally {
          setIsSaving(false);
        }
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [code, session, isCompleted]);

  // Manual save
  const handleSave = useCallback(async () => {
    if (!session || code === lastSavedCodeRef.current) return;

    try {
      setIsSaving(true);
      await practiceApi.saveProgress(session.id, code);
      lastSavedCodeRef.current = code;
      setLastSaved(new Date());
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [session, code]);

  // Handle code change
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  // Run tests (simulated - would need backend integration)
  const handleRunTests = useCallback(async () => {
    if (!challenge) return;

    setIsRunningTests(true);
    setConsoleOutput({ stdout: "", stderr: "" });

    // Simulate test execution
    // In a real implementation, this would call the backend
    setTimeout(() => {
      const results: TestResult[] = challenge.test_cases
        .filter((tc) => !tc.isHidden)
        .map((tc, index) => ({
          passed: Math.random() > 0.3, // Simulated
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: tc.expectedOutput, // Simulated
          executionTime: Math.floor(Math.random() * 100),
        }));

      setTestResults(results);
      setIsRunningTests(false);
      setConsoleOutput({
        stdout: `Ran ${results.length} tests\n${results.filter((r) => r.passed).length} passed, ${results.filter((r) => !r.passed).length} failed`,
        stderr: "",
      });
    }, 1500);
  }, [challenge]);

  // Request hint
  const handleRequestHint = useCallback(
    async (level: number) => {
      if (!session) return;

      try {
        setIsLoadingHint(true);
        const response = await practiceApi.getHint(session.id, level);
        setHints((prev) => [...prev, response.hint]);
        setCurrentHintLevel(level);
      } catch (err) {
        console.error("Failed to get hint:", err);
      } finally {
        setIsLoadingHint(false);
      }
    },
    [session]
  );

  // Submit solution
  const handleSubmit = useCallback(async () => {
    if (!session) return;

    try {
      setIsSubmitting(true);
      const response = await practiceApi.submitSolution(session.id, code);
      setFeedback(response.feedback);
      setFinalScore(response.session.score);
      setIsCompleted(true);
      setSession(response.session);
    } catch (err: any) {
      console.error("Failed to submit solution:", err);
      setError(err.message || "Failed to submit solution");
    } finally {
      setIsSubmitting(false);
    }
  }, [session, code]);

  // Clear console
  const handleClearConsole = () => {
    setConsoleOutput({ stdout: "", stderr: "" });
  };

  // Format test cases for TestCasePanel
  const testCases: TestCase[] =
    challenge?.test_cases.map((tc) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden || false,
    })) || [];

  // Loading state
  if (isLoading) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-background-primary flex items-center justify-center">
          <div className="text-center">
            <motion.div className="w-16 h-16 border-4 border-accent-cyan/30 border-t-accent-cyan rounded-full mx-auto" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
            <p className="text-text-secondary mt-4">Starting practice session...</p>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  // Error state
  if (error && !challenge) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-background-primary flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-accent-red text-lg mb-4">{error}</p>
            <button onClick={() => router.push("/practice")} className="px-6 py-2 bg-accent-cyan text-background-primary font-semibold rounded-lg hover:bg-accent-cyan/90 transition-colors">
              Back to Practice
            </button>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="h-screen bg-background-primary flex flex-col overflow-hidden">
        {/* Top Bar - Relaxed styling without timer */}
        <div className="glass-card border-b border-border-default px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl">🧘</span>
            <h1 className="text-lg sm:text-xl font-header font-bold text-text-primary">{challenge?.title}</h1>
            {challenge && <span className={`px-2 py-0.5 text-xs border rounded capitalize ${difficultyColors[challenge.difficulty]}`}>{challenge.difficulty}</span>}
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan">Practice Mode</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Save indicator */}
            <div className="flex items-center gap-2 text-sm text-text-muted">
              {isSaving ? (
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
                  Saving...
                </span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1 text-accent-lime">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Saved
                </span>
              ) : null}
            </div>

            {/* Language selector */}
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} disabled={isCompleted} className="px-3 py-1.5 bg-background-secondary border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan disabled:opacity-50">
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>

            <button onClick={() => router.push("/practice")} className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
              Exit
            </button>

            <button onClick={handleSubmit} disabled={isSubmitting || isCompleted} className={`px-4 sm:px-6 py-2 rounded-lg font-bold text-sm sm:text-base transition-all duration-300 ${isCompleted ? "bg-accent-lime/20 text-accent-lime border-2 border-accent-lime cursor-not-allowed" : "bg-accent-cyan text-background-primary hover:bg-accent-cyan/90 neon-glow"} disabled:opacity-50`}>
              {isSubmitting ? "Submitting..." : isCompleted ? "Submitted ✓" : "Submit"}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Code Editor */}
          <div className="w-[60%] border-r border-border-default flex flex-col">
            {/* Challenge Description */}
            <div className="bg-background-secondary border-b border-border-default p-4 max-h-32 overflow-y-auto">
              <p className="text-sm text-text-secondary">{challenge?.description}</p>
            </div>

            {/* Code Editor */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor language={language} initialCode={code} onChange={handleCodeChange} readOnly={isCompleted} height="100%" enableParticles={!isCompleted} particleColor="#00ffff" />
            </div>

            {/* Console Output */}
            <div className="h-[25%] border-t border-border-default">
              <ConsoleOutput stdout={consoleOutput.stdout} stderr={consoleOutput.stderr} onClear={handleClearConsole} />
            </div>
          </div>

          {/* Right Panel - Tests, Hints, Feedback */}
          <div className="w-[40%] flex flex-col overflow-hidden">
            {/* Test Cases */}
            <div className="h-[45%] border-b border-border-default">
              <TestCasePanel testCases={testCases} results={testResults} onRunTests={handleRunTests} isRunning={isRunningTests} />
            </div>

            {/* Hints and Feedback */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Hint Panel */}
              <HintPanel currentHintLevel={currentHintLevel} hints={hints} onRequestHint={handleRequestHint} isLoading={isLoadingHint} disabled={isCompleted} />

              {/* Feedback Panel */}
              <PracticeFeedbackPanel feedback={feedback} score={finalScore} isLoading={isSubmitting} />

              {/* Try Again Button (after completion) */}
              {isCompleted && (
                <div className="flex gap-3">
                  <button onClick={() => router.push("/practice")} className="flex-1 px-4 py-3 bg-background-secondary text-text-primary font-semibold rounded-lg border border-border-default hover:border-accent-cyan hover:text-accent-cyan transition-all duration-300">
                    Choose Another
                  </button>
                  <button onClick={() => window.location.reload()} className="flex-1 px-4 py-3 bg-accent-cyan text-background-primary font-semibold rounded-lg hover:bg-accent-cyan/90 transition-all duration-300">
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

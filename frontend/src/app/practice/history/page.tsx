"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { practiceApi, PracticeSession, PracticeStats, PracticeTrends } from "@/lib/api";

/**
 * PracticeHistoryPage Component
 * Display past practice sessions with scores and improvement trends
 * Requirements: 17.5
 */
export default function PracticeHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [stats, setStats] = useState<PracticeStats | null>(null);
  const [trends, setTrends] = useState<PracticeTrends | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await practiceApi.getHistory();
      setSessions(response.sessions);
      setStats(response.stats);
      setTrends(response.trends);
    } catch (err) {
      console.error("Failed to fetch practice history:", err);
      setError("Failed to load practice history. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreColor = (score: number | null): string => {
    if (score === null) return "text-text-muted";
    if (score >= 80) return "text-accent-lime";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-accent-magenta";
    return "text-accent-red";
  };

  const getTrendIcon = (trend: string): { icon: string; color: string } => {
    switch (trend) {
      case "improving":
        return { icon: "📈", color: "text-accent-lime" };
      case "declining":
        return { icon: "📉", color: "text-accent-red" };
      default:
        return { icon: "➡️", color: "text-text-muted" };
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-background-primary">
        {/* Header */}
        <div className="border-b border-border-default bg-background-secondary/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-header font-bold text-accent-cyan flex items-center gap-3">
                  <span>📊</span>
                  <span>Practice History</span>
                </h1>
                <p className="text-text-secondary text-sm mt-1">Track your progress and improvement over time</p>
              </div>
              <button onClick={() => router.push("/practice")} className="px-4 py-2 bg-background-secondary text-text-primary font-semibold rounded-lg border border-border-default hover:border-accent-cyan hover:text-accent-cyan transition-all duration-300 text-sm">
                ← Back to Practice
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <motion.div className="w-16 h-16 border-4 border-accent-cyan/30 border-t-accent-cyan rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
              <p className="text-text-secondary mt-4">Loading history...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-accent-red/20 border border-accent-red rounded-lg flex items-center justify-between">
              <p className="text-accent-red">{error}</p>
              <button onClick={fetchHistory} className="px-4 py-2 bg-accent-red text-white rounded-lg hover:bg-accent-red/90 transition-colors text-sm">
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Stats Overview */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                  <div className="bg-background-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-accent-cyan">{stats.totalSessions}</div>
                    <div className="text-sm text-text-muted">Total Sessions</div>
                  </div>
                  <div className="bg-background-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-accent-lime">{stats.completedSessions}</div>
                    <div className="text-sm text-text-muted">Completed</div>
                  </div>
                  <div className="bg-background-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>{stats.averageScore}</div>
                    <div className="text-sm text-text-muted">Avg Score</div>
                  </div>
                  <div className="bg-background-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-400">{stats.highestScore}</div>
                    <div className="text-sm text-text-muted">Best Score</div>
                  </div>
                  <div className="bg-background-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-accent-magenta">{stats.totalHintsUsed}</div>
                    <div className="text-sm text-text-muted">Hints Used</div>
                  </div>
                  <div className="bg-background-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-text-primary">{stats.uniqueChallenges}</div>
                    <div className="text-sm text-text-muted">Challenges</div>
                  </div>
                </div>
              )}

              {/* Improvement Trend */}
              {trends && (
                <div className="bg-background-secondary border border-border-default rounded-lg p-6 mb-8">
                  <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span>📈</span>
                    <span>Improvement Trend</span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getTrendIcon(trends.trend).icon}</span>
                      <div>
                        <div className={`text-xl font-bold ${getTrendIcon(trends.trend).color}`}>{trends.trend === "improving" ? "Improving!" : trends.trend === "declining" ? "Needs Work" : "Steady"}</div>
                        <div className="text-sm text-text-muted">
                          {trends.scoreImprovement > 0 ? "+" : ""}
                          {trends.scoreImprovement} points from previous
                        </div>
                      </div>
                    </div>
                    <div className="h-12 w-px bg-border-default hidden sm:block" />
                    <div className="flex gap-6">
                      <div>
                        <div className="text-sm text-text-muted">Recent Avg</div>
                        <div className={`text-lg font-bold ${getScoreColor(trends.recentAverage)}`}>{trends.recentAverage}</div>
                      </div>
                      <div>
                        <div className="text-sm text-text-muted">Previous Avg</div>
                        <div className={`text-lg font-bold ${getScoreColor(trends.previousAverage)}`}>{trends.previousAverage}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Session List */}
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-4">Practice Sessions</h2>

                {sessions.length === 0 ? (
                  <div className="text-center py-12 bg-background-secondary border border-border-default rounded-lg">
                    <div className="text-4xl mb-4">🧘</div>
                    <p className="text-text-secondary mb-4">No practice sessions yet. Start practicing to track your progress!</p>
                    <button onClick={() => router.push("/practice")} className="px-6 py-2 bg-accent-cyan text-background-primary font-semibold rounded-lg hover:bg-accent-cyan/90 transition-colors">
                      Start Practicing
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session, index) => (
                      <motion.div key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-background-secondary border border-border-default rounded-lg p-4 hover:border-accent-cyan/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-semibold text-text-primary">Challenge: {session.challengeId.slice(0, 8)}...</span>
                              <span className="px-2 py-0.5 text-xs bg-background-primary rounded text-text-muted capitalize">{session.language}</span>
                              {session.completedAt ? <span className="px-2 py-0.5 text-xs bg-accent-lime/20 text-accent-lime rounded">Completed</span> : <span className="px-2 py-0.5 text-xs bg-yellow-400/20 text-yellow-400 rounded">In Progress</span>}
                            </div>
                            <div className="text-sm text-text-muted">
                              Started: {formatDate(session.startedAt)}
                              {session.completedAt && <span className="ml-3">Completed: {formatDate(session.completedAt)}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {session.hintsUsed > 0 && <div className="text-sm text-text-muted">💡 {session.hintsUsed} hints</div>}
                            {session.score !== null && <div className={`text-2xl font-bold ${getScoreColor(session.score)}`}>{session.score}</div>}
                            <button onClick={() => router.push(`/practice/${session.challengeId}`)} className="px-4 py-2 bg-accent-cyan/20 text-accent-cyan rounded-lg hover:bg-accent-cyan/30 transition-colors text-sm font-semibold">
                              Retry
                            </button>
                          </div>
                        </div>

                        {/* Feedback summary if available */}
                        {session.feedback && (
                          <div className="mt-3 pt-3 border-t border-border-default">
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div>
                                <span className="text-text-muted">Correctness: </span>
                                <span className={getScoreColor(session.feedback.correctness * 10)}>{session.feedback.correctness.toFixed(1)}</span>
                              </div>
                              <div>
                                <span className="text-text-muted">Efficiency: </span>
                                <span className={getScoreColor(session.feedback.efficiency * 10)}>{session.feedback.efficiency.toFixed(1)}</span>
                              </div>
                              <div>
                                <span className="text-text-muted">Quality: </span>
                                <span className={getScoreColor(session.feedback.quality * 10)}>{session.feedback.quality.toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}

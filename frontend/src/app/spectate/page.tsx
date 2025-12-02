"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface ActiveMatch {
  id: string;
  player1: { id: string; username: string; rating: number };
  player2: { id: string; username: string; rating: number };
  challenge: { title: string; difficulty: string };
  spectatorCount: number;
  startedAt: string;
}

export default function SpectatePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<ActiveMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveMatches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/matches/active`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      } else {
        // If no active matches endpoint, show empty state
        setMatches([]);
      }
    } catch (err) {
      console.error("Failed to fetch active matches:", err);
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveMatches();
    // Refresh every 10 seconds
    const interval = setInterval(fetchActiveMatches, 10000);
    return () => clearInterval(interval);
  }, [fetchActiveMatches]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "text-accent-lime";
      case "medium":
        return "text-yellow-400";
      case "hard":
        return "text-accent-magenta";
      case "expert":
        return "text-accent-red";
      default:
        return "text-text-secondary";
    }
  };

  const formatTime = (startedAt: string) => {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just started";
    return `${diffMins}m ago`;
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-background-primary relative overflow-hidden selection:bg-accent-cyan/20 selection:text-accent-cyan">
        {/* Background Grid Pattern */}
        <div
          className="fixed inset-0 z-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
            backgroundSize: '4rem 4rem'
          }}
        />

        {/* Ambient Glows */}
        <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-accent-cyan/5 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-accent-magenta/5 blur-[120px] rounded-full pointer-events-none z-0" />

        <div className="relative z-10">
          {/* Header */}
          <div className="border-b border-white/5 bg-background-secondary/50 backdrop-blur-xl sticky top-0 z-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-header font-bold text-white tracking-tight flex items-center gap-3">
                    <span className="text-4xl">👁️</span>
                    <span>SPECTATOR <span className="text-accent-cyan">MODE</span></span>
                  </h1>
                  <p className="text-text-secondary text-sm mt-1 font-code">LIVE OPERATIONS // OBSERVATION DECK</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={fetchActiveMatches}
                    className="px-4 py-2 bg-white/5 text-white font-bold rounded-lg border border-white/10 hover:border-accent-cyan/50 hover:bg-white/10 transition-all duration-300 text-sm uppercase tracking-wider flex items-center gap-2 group"
                  >
                    <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="px-4 py-2 bg-white/5 text-white font-bold rounded-lg border border-white/10 hover:border-accent-cyan/50 hover:bg-white/10 transition-all duration-300 text-sm uppercase tracking-wider flex items-center gap-2 group"
                  >
                    <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-accent-cyan/20 rounded-full animate-pulse" />
                  </div>
                </div>
                <p className="text-accent-cyan mt-6 font-code tracking-widest animate-pulse">SCANNING FOR SIGNALS...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="mb-8 p-4 bg-accent-red/10 border border-accent-red/30 rounded-xl flex items-center justify-between backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-accent-red font-bold">{error}</p>
                </div>
                <button
                  onClick={fetchActiveMatches}
                  className="px-4 py-2 bg-accent-red text-white rounded-lg hover:bg-accent-red/90 transition-colors text-sm font-bold uppercase tracking-wider shadow-lg shadow-accent-red/20"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && matches.length === 0 && (
              <div className="text-center py-20 animate-fade-in-up">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                  <span className="text-5xl grayscale opacity-50">🎮</span>
                </div>
                <h2 className="text-3xl font-header font-bold text-white mb-3 tracking-tight">NO ACTIVE SIGNALS</h2>
                <p className="text-text-secondary mb-8 max-w-md mx-auto text-lg">There are no live battles happening right now. Check back later or initiate your own operation.</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => router.push("/matchmaking")}
                    className="px-8 py-3 bg-accent-cyan text-background-primary font-bold rounded-lg hover:bg-accent-cyan/90 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all duration-300 uppercase tracking-wider"
                  >
                    Start a Match
                  </button>
                  <button
                    onClick={() => router.push("/practice")}
                    className="px-8 py-3 bg-white/5 text-white font-bold rounded-lg border border-white/10 hover:border-accent-cyan/50 hover:bg-white/10 transition-all duration-300 uppercase tracking-wider"
                  >
                    Practice Mode
                  </button>
                </div>
              </div>
            )}

            {/* Active Matches Grid */}
            {!isLoading && matches.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {matches.map((match, index) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <button
                      onClick={() => router.push(`/spectate/${match.id}`)}
                      className="w-full text-left p-0 bg-background-secondary/50 border border-white/5 rounded-xl hover:border-accent-cyan/50 transition-all duration-300 group overflow-hidden relative hover:shadow-[0_0_30px_rgba(0,240,255,0.1)]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="p-5 relative z-10">
                        {/* Challenge Info */}
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-bold text-white group-hover:text-accent-cyan transition-colors truncate pr-2">{match.challenge.title}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider ${match.challenge.difficulty === 'easy' ? 'bg-accent-lime/10 border-accent-lime/30 text-accent-lime' :
                              match.challenge.difficulty === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' :
                                'bg-accent-red/10 border-accent-red/30 text-accent-red'
                            }`}>
                            {match.challenge.difficulty}
                          </span>
                        </div>

                        {/* Players */}
                        <div className="flex items-center justify-between mb-4 text-sm bg-black/20 p-3 rounded-lg border border-white/5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_5px_rgba(0,240,255,0.5)]" />
                            <span className="text-white font-medium">{match.player1.username}</span>
                            <span className="text-text-muted text-xs font-code">({match.player1.rating})</span>
                          </div>
                          <span className="text-text-muted font-bold text-xs">VS</span>
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted text-xs font-code">({match.player2.rating})</span>
                            <span className="text-white font-medium">{match.player2.username}</span>
                            <div className="w-2 h-2 rounded-full bg-accent-magenta shadow-[0_0_5px_rgba(255,0,60,0.5)]" />
                          </div>
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center justify-between text-xs text-text-muted font-code">
                          <span className="flex items-center gap-1.5 text-accent-cyan">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan"></span>
                            </span>
                            {match.spectatorCount} WATCHING
                          </span>
                          <span>{formatTime(match.startedAt)}</span>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Info Section */}
            <div className="mt-16 glass-card-strong p-8 rounded-xl border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent-cyan/5 blur-[80px] rounded-full pointer-events-none" />

              <h3 className="text-xl font-header font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-accent-cyan">ℹ️</span> INTELLIGENCE BRIEFING
              </h3>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center text-accent-cyan mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm mb-1">Real-time Surveillance</h4>
                    <p className="text-text-secondary text-xs leading-relaxed">Observe live code execution and problem-solving strategies from top operatives in the field.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-magenta/10 flex items-center justify-center text-accent-magenta mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm mb-1">Encrypted Comms</h4>
                    <p className="text-text-secondary text-xs leading-relaxed">Engage in secure chat channels with other observers to analyze tactics and outcomes.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-lime/10 flex items-center justify-center text-accent-lime mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm mb-1">Live Reactions</h4>
                    <p className="text-text-secondary text-xs leading-relaxed">Deploy emoji reactions to signal approval or shock during critical mission moments.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm mb-1">Skill Acquisition</h4>
                    <p className="text-text-secondary text-xs leading-relaxed">Analyze high-level gameplay to enhance your own coding efficiency and algorithm knowledge.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

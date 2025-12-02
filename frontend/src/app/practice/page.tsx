"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PracticeChallengeBrowser } from "@/components/PracticeChallengeBrowser";
import { practiceApi, PracticeChallenge } from "@/lib/api";

/**
 * Practice Mode Landing Page
 * Display unlocked challenges for practice
 * Requirements: 17.1
 */
export default function PracticePage() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<PracticeChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenges = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await practiceApi.getChallenges();
      setChallenges(response.challenges);
    } catch (err) {
      console.error("Failed to fetch practice challenges:", err);
      setError("Failed to load challenges. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const handleSelectChallenge = (challenge: PracticeChallenge) => {
    router.push(`/practice/${challenge.id}`);
  };

  const handleGhostRace = (challenge: PracticeChallenge) => {
    router.push(`/ghost-race/${challenge.id}`);
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
                    <span className="text-4xl">🧘</span>
                    <span>PRACTICE <span className="text-accent-cyan">MODE</span></span>
                  </h1>
                  <p className="text-text-secondary text-sm mt-1 font-code">SIMULATION ENVIRONMENT // NO PRESSURE</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push("/practice/history")}
                    className="px-4 py-2 bg-white/5 text-white font-bold rounded-lg border border-white/10 hover:border-accent-cyan/50 hover:bg-white/10 transition-all duration-300 text-sm uppercase tracking-wider flex items-center gap-2 group"
                  >
                    <span className="group-hover:scale-110 transition-transform">📊</span> History
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

          {/* Info Banner */}
          <div className="bg-accent-cyan/5 border-b border-accent-cyan/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
              <div className="flex items-center gap-3 text-sm font-medium text-accent-cyan/80">
                <span className="animate-pulse">✨</span>
                <span>Practice mode doesn&apos;t affect your rating. Take your time, use hints, and learn!</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
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
                  onClick={fetchChallenges}
                  className="px-4 py-2 bg-accent-red text-white rounded-lg hover:bg-accent-red/90 transition-colors text-sm font-bold uppercase tracking-wider shadow-lg shadow-accent-red/20"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-accent-cyan/20 rounded-full animate-pulse" />
                  </div>
                </div>
                <p className="text-accent-cyan mt-6 font-code tracking-widest animate-pulse">LOADING CHALLENGES...</p>
              </div>
            )}

            {/* Challenge Browser */}
            {!isLoading && !error && (
              <div className="animate-fade-in-up">
                <PracticeChallengeBrowser challenges={challenges} onSelectChallenge={handleSelectChallenge} onGhostRace={handleGhostRace} isLoading={isLoading} />
              </div>
            )}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

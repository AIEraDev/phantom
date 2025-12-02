"use client";

import React, { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { UserStats } from "@/components/UserStats";
import { MatchHistory } from "@/components/MatchHistory";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { userApi } from "@/lib/api";
import { UserStats as UserStatsType } from "@/types/match";
import { Match } from "@/types/match";
import { PageLayout } from "@/components/PageLayout";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStatsType | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    }
  }, [user?.id]);

  const fetchUserData = async () => {
    if (!user?.id) return;

    try {
      setIsLoadingStats(true);
      setIsLoadingMatches(true);
      setError(null);

      // Fetch stats
      const statsResponse = await userApi.getUserStats(user.id);
      setStats(statsResponse.stats);
      setIsLoadingStats(false);

      // Fetch recent matches
      const matchesResponse = await userApi.getUserMatches(user.id, 10, 0);
      setMatches(matchesResponse.matches);
      setIsLoadingMatches(false);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
      setError("Failed to load dashboard data");
      setIsLoadingStats(false);
      setIsLoadingMatches(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleQuickMatch = () => {
    router.push("/matchmaking");
  };

  return (
    <ProtectedRoute>
      <PageLayout>
        <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-8">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
                <span className="text-xs font-code text-accent-cyan tracking-wider">OPERATOR DASHBOARD</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-header font-bold text-white tracking-tight">
                WELCOME BACK, <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-magenta">{user?.username}</span>
              </h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => router.push(`/profile/${user?.id}`)} className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-lg transition-all backdrop-blur-sm">
                View Profile
              </button>
              <button onClick={handleLogout} className="px-6 py-3 bg-transparent border border-accent-red/30 text-accent-red hover:bg-accent-red/10 font-medium rounded-lg transition-all backdrop-blur-sm">
                Logout
              </button>
              <button onClick={handleQuickMatch} className="px-8 py-3 bg-accent-cyan text-background-primary font-bold rounded-lg hover:bg-accent-cyan/90 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all">
                QUICK MATCH
              </button>
            </div>
          </header>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                title: "Skill Tree",
                subtitle: "Upgrade Capabilities",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                ),
                path: "/skill-tree",
                color: "cyan",
              },
              {
                title: "Practice",
                subtitle: "Hone Your Skills",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                path: "/practice",
                color: "lime",
              },
              {
                title: "Leaderboard",
                subtitle: "Global Rankings",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                path: "/leaderboard",
                color: "magenta",
              },
              {
                title: "Spectate",
                subtitle: "Watch Live Battles",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ),
                path: "/spectate",
                color: "yellow",
              },
            ].map((item, i) => (
              <button key={i} onClick={() => router.push(item.path)} className="group relative p-6 glass-card rounded-xl border border-white/5 hover:border-white/20 transition-all duration-300 text-left overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br from-accent-${item.color}/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />

                <div className={`w-10 h-10 mb-4 rounded-lg bg-accent-${item.color}/20 flex items-center justify-center text-accent-${item.color} group-hover:scale-110 transition-transform`}>{item.icon}</div>

                <h3 className="text-lg font-bold text-white mb-1 relative z-10">{item.title}</h3>
                <p className="text-xs text-text-muted uppercase tracking-wider relative z-10">{item.subtitle}</p>
              </button>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg flex items-center gap-3">
              <svg className="w-5 h-5 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-accent-red text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* User Stats */}
            <div className="lg:col-span-1 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-header font-bold text-white">PERFORMANCE</h2>
                <div className="px-2 py-1 rounded bg-white/5 text-xs font-code text-text-muted">LAST 30 DAYS</div>
              </div>

              {stats ? <UserStats stats={stats} isLoading={isLoadingStats} layout="compact" /> : <UserStats stats={{ rating: 0, wins: 0, losses: 0, totalMatches: 0, winRate: 0 }} isLoading={isLoadingStats} layout="compact" />}
            </div>

            {/* Match History */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-header font-bold text-white">BATTLE LOG</h2>
                <button className="text-xs font-code text-accent-cyan hover:text-white transition-colors">VIEW ALL</button>
              </div>

              <div className="!bg-none glass-card !border-none !shadow-none overflow-hidden min-h-[400px]">
                <MatchHistory matches={matches} currentUserId={user?.id || ""} isLoading={isLoadingMatches} />
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    </ProtectedRoute>
  );
}

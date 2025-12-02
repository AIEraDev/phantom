"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { leaderboardApi, LeaderboardPlayer } from "@/lib/api";
import { useRouter } from "next/navigation";

type TimePeriod = "daily" | "weekly" | "all-time";

export default function LeaderboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>("all-time");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!isAuthenticated) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await leaderboardApi.getGlobalLeaderboard(100, period, searchQuery);
        setPlayers(result.players);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [period, searchQuery, isAuthenticated]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  const topThree = players.slice(0, 3);
  const restOfPlayers = players.slice(3);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center relative overflow-hidden">
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
          <span className="text-accent-cyan font-code animate-pulse">AUTHENTICATING...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary text-white relative overflow-hidden selection:bg-accent-cyan/20 selection:text-accent-cyan">
      {/* Background Grid Pattern */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem'
        }}
      />

      {/* Ambient Glows */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-accent-cyan/5 blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-accent-magenta/5 blur-[100px] rounded-full pointer-events-none z-0" />

      <div className="container mx-auto px-4 py-8 max-w-7xl relative z-10">
        {/* Header */}
        <div className="mb-12 text-center animate-slide-in-up">
          <h1 className="text-4xl sm:text-6xl font-header font-bold mb-4 text-white tracking-tight">
            GLOBAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-magenta">LEADERBOARD</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Elite operatives ranked by combat efficiency and code superiority.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-12 flex flex-col md:flex-row gap-6 items-center justify-between glass-card p-4 rounded-xl border border-white/5">
          {/* Period Filter */}
          <div className="flex gap-2 w-full md:w-auto p-1 bg-black/20 rounded-lg">
            {(["daily", "weekly", "all-time"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`
                  flex-1 md:flex-none px-6 py-2 rounded-md transition-all duration-300 text-sm font-bold uppercase tracking-wider
                  ${period === p
                    ? "bg-accent-cyan text-background-primary shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                    : "text-text-secondary hover:text-white hover:bg-white/5"}
                `}
              >
                {p.replace("-", " ")}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-text-muted group-focus-within:text-accent-cyan transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search operative..."
              className="pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/50 text-white placeholder-text-muted w-full md:w-64 text-sm font-code transition-all"
            />
            <button
              type="submit"
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-sm font-bold uppercase tracking-wider text-accent-cyan"
            >
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-2.5 bg-accent-red/10 hover:bg-accent-red/20 border border-accent-red/30 rounded-lg transition-colors text-accent-red"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </form>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-20">
            <div className="inline-block w-16 h-16 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin mb-4"></div>
            <p className="text-accent-cyan font-code animate-pulse">RETRIEVING RANKINGS...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-6 mb-8 text-center">
            <p className="text-accent-red font-bold mb-2">ERROR RETRIEVING DATA</p>
            <p className="text-text-secondary">{error}</p>
          </div>
        )}

        {/* Top 3 Spotlight */}
        {!isLoading && !error && topThree.length > 0 && !searchQuery && (
          <div className="mb-16 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {/* Second Place */}
            {topThree[1] && (
              <div className="order-2 md:order-1 relative group">
                <div className="absolute inset-0 bg-accent-cyan/5 blur-xl rounded-xl group-hover:bg-accent-cyan/10 transition-all duration-500" />
                <div className="relative glass-card p-6 rounded-xl border border-accent-cyan/30 flex flex-col items-center transform group-hover:-translate-y-2 transition-transform duration-300">
                  <div className="absolute -top-4 w-8 h-8 bg-background-primary border border-accent-cyan text-accent-cyan rounded-full flex items-center justify-center font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]">2</div>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-cyan/20 to-transparent border-2 border-accent-cyan mb-4 flex items-center justify-center text-2xl font-bold text-accent-cyan">
                    {topThree[1].username.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{topThree[1].username}</h3>
                  <p className="text-text-secondary text-sm mb-4">{topThree[1].displayName}</p>
                  <div className="text-3xl font-header font-bold text-accent-cyan mb-4">{topThree[1].rating}</div>
                  <div className="w-full grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white/5 rounded p-2">
                      <div className="text-text-muted mb-1">W</div>
                      <div className="font-bold text-accent-lime">{topThree[1].wins}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <div className="text-text-muted mb-1">L</div>
                      <div className="font-bold text-accent-red">{topThree[1].losses}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <div className="text-text-muted mb-1">%</div>
                      <div className="font-bold text-white">{topThree[1].winRate.toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* First Place */}
            {topThree[0] && (
              <div className="order-1 md:order-2 relative group z-10">
                <div className="absolute inset-0 bg-accent-yellow/10 blur-2xl rounded-xl group-hover:bg-accent-yellow/20 transition-all duration-500" />
                <div className="relative glass-card-strong p-8 rounded-xl border border-accent-yellow/50 flex flex-col items-center transform scale-110 group-hover:-translate-y-2 transition-transform duration-300 shadow-[0_0_30px_rgba(252,238,10,0.1)]">
                  <div className="absolute -top-6 text-4xl animate-bounce">👑</div>
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-yellow/20 to-transparent border-2 border-accent-yellow mb-4 flex items-center justify-center text-3xl font-bold text-accent-yellow shadow-[0_0_20px_rgba(252,238,10,0.3)]">
                    {topThree[0].username.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{topThree[0].username}</h3>
                  <p className="text-text-secondary text-sm mb-6">{topThree[0].displayName}</p>
                  <div className="text-4xl font-header font-bold text-accent-yellow mb-6">{topThree[0].rating}</div>
                  <div className="w-full grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded p-2">
                      <div className="text-accent-yellow/70 mb-1">WINS</div>
                      <div className="font-bold text-accent-yellow">{topThree[0].wins}</div>
                    </div>
                    <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded p-2">
                      <div className="text-accent-yellow/70 mb-1">LOSS</div>
                      <div className="font-bold text-accent-yellow">{topThree[0].losses}</div>
                    </div>
                    <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded p-2">
                      <div className="text-accent-yellow/70 mb-1">RATE</div>
                      <div className="font-bold text-accent-yellow">{topThree[0].winRate.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Third Place */}
            {topThree[2] && (
              <div className="order-3 relative group">
                <div className="absolute inset-0 bg-accent-magenta/5 blur-xl rounded-xl group-hover:bg-accent-magenta/10 transition-all duration-500" />
                <div className="relative glass-card p-6 rounded-xl border border-accent-magenta/30 flex flex-col items-center transform group-hover:-translate-y-2 transition-transform duration-300">
                  <div className="absolute -top-4 w-8 h-8 bg-background-primary border border-accent-magenta text-accent-magenta rounded-full flex items-center justify-center font-bold shadow-[0_0_10px_rgba(255,0,60,0.3)]">3</div>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-magenta/20 to-transparent border-2 border-accent-magenta mb-4 flex items-center justify-center text-2xl font-bold text-accent-magenta">
                    {topThree[2].username.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{topThree[2].username}</h3>
                  <p className="text-text-secondary text-sm mb-4">{topThree[2].displayName}</p>
                  <div className="text-3xl font-header font-bold text-accent-magenta mb-4">{topThree[2].rating}</div>
                  <div className="w-full grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white/5 rounded p-2">
                      <div className="text-text-muted mb-1">W</div>
                      <div className="font-bold text-accent-lime">{topThree[2].wins}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <div className="text-text-muted mb-1">L</div>
                      <div className="font-bold text-accent-red">{topThree[2].losses}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <div className="text-text-muted mb-1">%</div>
                      <div className="font-bold text-white">{topThree[2].winRate.toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Table */}
        {!isLoading && !error && players.length > 0 && (
          <div className="glass-card rounded-xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Operative</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-text-secondary uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-text-secondary uppercase tracking-wider">Wins</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-text-secondary uppercase tracking-wider">Losses</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-text-secondary uppercase tracking-wider">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(searchQuery ? players : restOfPlayers).map((player) => {
                    const isCurrentUser = user?.id === player.id;
                    return (
                      <tr
                        key={player.id}
                        className={`
                          transition-colors hover:bg-white/5
                          ${isCurrentUser ? "bg-accent-cyan/5 hover:bg-accent-cyan/10" : ""}
                        `}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-bold font-header ${player.rank <= 3 ? "text-accent-yellow" : "text-white"}`}>
                              #{player.rank}
                            </span>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent-cyan text-background-primary">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white">
                              {player.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className={`font-bold ${isCurrentUser ? "text-accent-cyan" : "text-white"}`}>{player.username}</div>
                              <div className="text-xs text-text-secondary">{player.displayName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-lg font-bold font-header text-white">{player.rating}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-accent-lime font-bold">{player.wins}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-accent-red font-bold">{player.losses}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-accent-cyan to-accent-magenta"
                                style={{ width: `${player.winRate}%` }}
                              />
                            </div>
                            <span className="text-sm font-code text-text-secondary">{player.winRate.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && players.length === 0 && (
          <div className="text-center py-20 glass-card rounded-xl border border-white/10">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">NO OPERATIVES FOUND</h3>
            <p className="text-text-secondary">
              {searchQuery ? "Adjust your search parameters." : "The leaderboard is currently empty."}
            </p>
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-12 text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-8 py-3 bg-transparent border border-white/10 hover:bg-white/5 text-text-secondary hover:text-white rounded-lg transition-all duration-300 font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return to Base
          </button>
        </div>
      </div>
    </div>
  );
}


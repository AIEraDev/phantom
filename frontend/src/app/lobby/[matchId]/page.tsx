"use client";

import React, { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useWebSocket, useWebSocketEvent, useWebSocketConnection } from "@/hooks/useWebSocket";

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  timeLimit: number;
}

interface Opponent {
  id: string;
  username: string;
  rating: number;
}

interface MatchFoundData {
  matchId: string;
  opponent: Opponent;
  challenge: Challenge;
}

type Language = "javascript" | "python" | "typescript";

export default function LobbyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;
  const { emit } = useWebSocket();
  const { isConnected } = useWebSocketConnection();

  const [selectedLanguage, setSelectedLanguage] = useState<Language>("javascript");
  const [isReady, setIsReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [opponent, setOpponent] = useState<Opponent | null>(null);

  // Fetch match status from API and handle reconnection scenarios
  useEffect(() => {
    const fetchMatchStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const response = await fetch(`${apiUrl}/api/matches/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const match = data.match;

          // If match is already active, redirect to battle page
          if (match.status === "active") {
            console.log("Match is already active, redirecting to battle...");
            router.push(`/battle/${matchId}`);
            return;
          }

          // If match is completed, redirect to results
          if (match.status === "completed") {
            console.log("Match is completed, redirecting to results...");
            router.push(`/results/${matchId}`);
            return;
          }

          // Set challenge and opponent from API if not in sessionStorage
          if (match.challenge && !challenge) {
            setChallenge({
              id: match.challenge.id,
              title: match.challenge.title,
              description: match.challenge.description,
              difficulty: match.challenge.difficulty,
              timeLimit: match.challenge.time_limit,
            });
          }

          // Determine opponent
          const isPlayer1 = match.player1_id === user?.id;
          const opponentData = isPlayer1 ? match.player2 : match.player1;
          if (opponentData && !opponent) {
            setOpponent({
              id: opponentData.id,
              username: opponentData.username,
              rating: opponentData.rating,
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch match status:", error);
      }
    };

    fetchMatchStatus();

    // Also check sessionStorage for match data (set by matchmaking page)
    const matchDataStr = sessionStorage.getItem(`match_${matchId}`);
    if (matchDataStr) {
      try {
        const matchData: MatchFoundData = JSON.parse(matchDataStr);
        if (!challenge) setChallenge(matchData.challenge);
        if (!opponent) setOpponent(matchData.opponent);
      } catch (error) {
        console.error("Failed to parse match data:", error);
      }
    }
  }, [matchId, router, user?.id, challenge, opponent]);

  // Join lobby when WebSocket connects to get current state
  useEffect(() => {
    if (isConnected && matchId) {
      emit("join_lobby", { matchId });
    }
  }, [isConnected, matchId, emit]);

  // Listen for lobby state (when rejoining)
  useWebSocketEvent<{ playerReady: boolean; opponentReady: boolean; countdownRemaining: number | null }>("lobby_state", (data) => {
    if (data.playerReady) setIsReady(true);
    if (data.opponentReady) setOpponentReady(true);
    if (data.countdownRemaining) setCountdown(data.countdownRemaining);
  });

  // Listen for opponent ready event
  useWebSocketEvent<{ isReady: boolean }>("opponent_ready", (data) => {
    setOpponentReady(data.isReady);
  });

  // Listen for match starting event
  useWebSocketEvent<{ countdown: number }>("match_starting", (data) => {
    console.log("match_starting event received:", data);
    setCountdown(data.countdown);
    // If we receive countdown, both players must be ready
    setIsReady(true);
    setOpponentReady(true);
  });

  // Listen for match started event
  useWebSocketEvent<{ startTime: number; timeLimit: number }>("match_started", (data) => {
    console.log("match_started event received:", data);
    // Store match timing data for the battle page
    sessionStorage.setItem(
      `match_timing_${matchId}`,
      JSON.stringify({
        startTime: data.startTime,
        timeLimit: data.timeLimit,
      })
    );
    router.push(`/battle/${matchId}`);
  });

  // Handle countdown timer
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Countdown finished but we didn't receive match_started event
      // This can happen if WebSocket reconnected during countdown
      // Check match status from API as fallback
      const checkMatchStatus = async () => {
        try {
          const token = localStorage.getItem("token");
          if (!token) return;

          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
          const response = await fetch(`${apiUrl}/api/matches/${matchId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.match.status === "active") {
              console.log("Match is active, redirecting to battle...");
              router.push(`/battle/${matchId}`);
            }
          }
        } catch (error) {
          console.error("Failed to check match status:", error);
        }
      };

      // Wait a moment for the server to update, then check
      setTimeout(checkMatchStatus, 1000);
    }
  }, [countdown, matchId, router]);

  // Handle ready button click
  const handleReadyClick = () => {
    if (!isReady) {
      emit("ready_up", { matchId });
      setIsReady(true);
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case "easy":
        return "text-accent-lime";
      case "medium":
        return "text-accent-yellow";
      case "hard":
        return "text-accent-magenta";
      case "expert":
        return "text-accent-red";
      default:
        return "text-text-secondary";
    }
  };

  const getDifficultyBgColor = (difficulty: string): string => {
    switch (difficulty) {
      case "easy":
        return "bg-accent-lime/10 border-accent-lime/30";
      case "medium":
        return "bg-accent-yellow/10 border-accent-yellow/30";
      case "hard":
        return "bg-accent-magenta/10 border-accent-magenta/30";
      case "expert":
        return "bg-accent-red/10 border-accent-red/30";
      default:
        return "bg-background-secondary border-border-default";
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
        <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-accent-cyan/5 blur-[100px] rounded-full pointer-events-none z-0" />
        <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-accent-magenta/5 blur-[100px] rounded-full pointer-events-none z-0" />

        <div className="relative z-10 max-w-6xl mx-auto p-4 sm:p-6">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-medium tracking-wide uppercase mb-4 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-accent-cyan" />
              Lobby Active
            </div>
            <h1 className="text-4xl sm:text-6xl font-header font-bold text-white tracking-tight mb-2">
              PREPARE FOR <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-magenta">BATTLE</span>
            </h1>
            <p className="text-text-secondary text-lg">Configure your environment and synchronize.</p>
          </div>

          {/* Countdown Overlay */}
          {countdown !== null && countdown > 0 && (
            <div className="fixed inset-0 bg-background-primary/90 backdrop-blur-md z-50 flex items-center justify-center px-4">
              <div className="text-center animate-scale-in">
                <div className="text-9xl font-header font-bold text-transparent bg-clip-text bg-gradient-to-br from-accent-cyan to-accent-magenta mb-4 animate-pulse">
                  {countdown}
                </div>
                <p className="text-2xl text-white font-bold tracking-widest uppercase">Match Starting</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Challenge Preview */}
            <div className="glass-card-strong rounded-2xl p-6 sm:p-8 border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-cyan to-transparent opacity-50" />

              <h2 className="text-xl font-header font-bold text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center text-accent-cyan">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                MISSION OBJECTIVE
              </h2>

              {challenge ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-3">{challenge.title}</h3>
                    <div className="flex flex-wrap gap-3">
                      <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${getDifficultyBgColor(challenge.difficulty)} ${getDifficultyColor(challenge.difficulty)}`}>
                        {challenge.difficulty}
                      </span>
                      <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-text-secondary flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatTime(challenge.timeLimit)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <p className="text-text-secondary leading-relaxed text-sm">{challenge.description}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-code text-accent-cyan animate-pulse">DECRYPTING MISSION DATA...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Opponent Profile */}
            <div className="glass-card-strong rounded-2xl p-6 sm:p-8 border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-magenta to-transparent opacity-50" />

              <h2 className="text-xl font-header font-bold text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-magenta/10 flex items-center justify-center text-accent-magenta">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                OPPONENT INTEL
              </h2>

              {opponent ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-accent-magenta to-purple-600 p-[2px]">
                      <div className="w-full h-full bg-background-primary rounded-[10px] flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">{opponent.username.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">{opponent.username}</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-accent-magenta font-bold">{opponent.rating}</span>
                        <span className="text-text-muted">ELO RATING</span>
                      </div>
                    </div>
                  </div>

                  {/* Ready Status */}
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex items-center justify-between">
                    <span className="text-text-secondary text-sm font-medium">CONNECTION STATUS</span>
                    {opponentReady ? (
                      <span className="flex items-center gap-2 text-accent-lime font-bold text-sm bg-accent-lime/10 px-3 py-1 rounded-full border border-accent-lime/20">
                        <span className="w-2 h-2 rounded-full bg-accent-lime animate-pulse" />
                        READY
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-text-muted font-bold text-sm bg-white/5 px-3 py-1 rounded-full border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-text-muted animate-pulse" />
                        WAITING
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-accent-magenta border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-code text-accent-magenta animate-pulse">SCANNING NETWORK...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Language Selection and Ready Button */}
          <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/10">
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Language Selector */}
              <div>
                <label className="block text-white font-bold mb-4 text-center text-lg">SELECT WEAPON</label>
                <div className="grid grid-cols-3 gap-4">
                  {(["javascript", "python", "typescript"] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => !isReady && setSelectedLanguage(lang)}
                      disabled={isReady}
                      className={`
                        group relative p-4 rounded-xl border transition-all duration-300 overflow-hidden
                        ${selectedLanguage === lang
                          ? "border-accent-cyan bg-accent-cyan/10 shadow-[0_0_20px_rgba(0,240,255,0.1)]"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"}
                        ${isReady ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="text-3xl transition-transform group-hover:scale-110">
                          {lang === "javascript" && "🟨"}
                          {lang === "python" && "🐍"}
                          {lang === "typescript" && "🔷"}
                        </div>
                        <div className={`font-bold uppercase text-sm tracking-wider ${selectedLanguage === lang ? "text-accent-cyan" : "text-text-secondary group-hover:text-white"}`}>
                          {lang}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ready Button */}
              <div className="text-center pt-4">
                {!isReady ? (
                  <button
                    onClick={handleReadyClick}
                    disabled={!isConnected}
                    className="
                      relative px-12 py-5 bg-accent-cyan text-background-primary font-bold text-xl rounded-xl 
                      hover:bg-accent-cyan/90 transition-all duration-300 shadow-[0_0_30px_rgba(0,240,255,0.3)] 
                      hover:shadow-[0_0_50px_rgba(0,240,255,0.5)] hover:scale-105
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                    "
                  >
                    <span className="relative z-10">INITIATE LAUNCH SEQUENCE</span>
                  </button>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-accent-lime/10 border border-accent-lime/30 text-accent-lime text-xl font-bold">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      SYSTEMS READY
                    </div>

                    {!opponentReady && (
                      <p className="text-text-secondary animate-pulse">
                        Waiting for opponent synchronization...
                      </p>
                    )}

                    {opponentReady && (
                      <p className="text-accent-cyan font-bold animate-pulse">
                        ALL SYSTEMS GO. PREPARING FOR DEPLOYMENT...
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Connection Status */}
              {!isConnected && (
                <div className="mt-4 px-4 py-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg text-center">
                  <p className="text-accent-yellow text-xs font-bold tracking-wider uppercase animate-pulse">Establishing Secure Connection...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

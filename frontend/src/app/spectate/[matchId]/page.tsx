"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket, useWebSocketConnection } from "@/hooks/useWebSocket";
import CodeEditor from "@/components/CodeEditor";
import SpectatorChat, { ChatMessage } from "@/components/SpectatorChat";
import FloatingReaction, { useFloatingReactions, Reaction } from "@/components/FloatingReaction";

interface Player {
  id: string;
  username: string;
  rating: number;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
}

interface MatchState {
  matchId: string;
  challenge: Challenge;
  player1: Player;
  player2: Player;
  player1Code: string;
  player2Code: string;
  player1Language: string;
  player2Language: string;
  player1Cursor?: { line: number; column: number };
  player2Cursor?: { line: number; column: number };
  player1Submitted: boolean;
  player2Submitted: boolean;
  status: string;
  timeRemaining?: number;
}

export default function SpectatorViewPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  const { emit, on, off } = useWebSocket();
  const { isConnected } = useWebSocketConnection(); // Auto-connect to WebSocket

  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Floating reactions hook
  const { reactions, addReaction, removeReaction } = useFloatingReactions();

  // Fetch initial match state and chat history
  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

        // Fetch match state and chat history in parallel
        const [matchResponse, chatResponse] = await Promise.all([
          fetch(`${apiUrl}/api/matches/${matchId}/spectate`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }),
          fetch(`${apiUrl}/api/matches/${matchId}/chat`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (!matchResponse.ok) {
          throw new Error("Failed to join spectator mode");
        }

        const matchData = await matchResponse.json();
        setMatchState(matchData.matchState);

        // Load chat history if available
        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          if (chatData.messages && Array.isArray(chatData.messages)) {
            setChatMessages(chatData.messages);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching match data:", err);
        setError(err instanceof Error ? err.message : "Failed to load match");
        setIsLoading(false);
      }
    };

    fetchMatchData();
  }, [matchId, router]);

  // Join spectate via WebSocket
  useEffect(() => {
    if (isConnected && matchId) {
      emit("join_spectate", { matchId });
    }
  }, [isConnected, matchId, emit]);

  // Listen for spectator events
  useEffect(() => {
    const handleSpectatorJoined = (data: { count: number }) => {
      setSpectatorCount(data.count);
    };

    const handleOpponentCodeUpdate = (data: { playerId: string; code: string; cursor: { line: number; column: number } }) => {
      setMatchState((prev) => {
        if (!prev) return prev;
        if (data.playerId === prev.player1.id) {
          return {
            ...prev,
            player1Code: data.code,
            player1Cursor: data.cursor,
          };
        } else if (data.playerId === prev.player2.id) {
          return {
            ...prev,
            player2Code: data.code,
            player2Cursor: data.cursor,
          };
        }
        return prev;
      });
    };

    const handleOpponentSubmitted = (data: { playerId: string }) => {
      setMatchState((prev) => {
        if (!prev) return prev;
        if (data.playerId === prev.player1.id) {
          return { ...prev, player1Submitted: true };
        } else if (data.playerId === prev.player2.id) {
          return { ...prev, player2Submitted: true };
        }
        return prev;
      });
    };

    const handleSpectatorMessage = (data: { id: string; username: string; message: string; timestamp: number }) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: data.id,
          username: data.username,
          message: data.message,
          timestamp: data.timestamp,
          messageType: "text",
        },
      ]);
    };

    const handleSpectatorReaction = (data: { username: string; emoji: string; position: { x: number; y: number } }) => {
      addReaction(data.emoji, data.username, data.position);
    };

    const handleChatRateLimited = (data: { retryAfter: number }) => {
      setRateLimitedUntil(Date.now() + data.retryAfter);
    };

    const handleMatchResult = () => {
      router.push(`/results/${matchId}`);
    };

    on("spectator_joined", handleSpectatorJoined);
    on("opponent_code_update", handleOpponentCodeUpdate);
    on("opponent_submitted", handleOpponentSubmitted);
    on("spectator_message", handleSpectatorMessage);
    on("spectator_reaction", handleSpectatorReaction);
    on("chat_rate_limited", handleChatRateLimited);
    on("match_result", handleMatchResult);

    return () => {
      off("spectator_joined", handleSpectatorJoined);
      off("opponent_code_update", handleOpponentCodeUpdate);
      off("opponent_submitted", handleOpponentSubmitted);
      off("spectator_message", handleSpectatorMessage);
      off("spectator_reaction", handleSpectatorReaction);
      off("chat_rate_limited", handleChatRateLimited);
      off("match_result", handleMatchResult);
    };
  }, [on, off, router, matchId, addReaction]);

  const handleSendMessage = useCallback(
    (message: string) => {
      if (isConnected) {
        emit("spectator_message", { matchId, message });
      }
    },
    [matchId, emit, isConnected]
  );

  const handleSendReaction = useCallback(
    (emoji: string) => {
      if (isConnected) {
        emit("spectator_reaction", { matchId, emoji });
      }
    },
    [matchId, emit, isConnected]
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-accent-cyan/20 border-t-accent-cyan"></div>
      </main>
    );
  }

  if (error || !matchState) {
    return (
      <main className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-accent-red mb-4">Error</h1>
          <p className="text-text-secondary mb-6">{error || "Match not found"}</p>
          <button onClick={() => router.push("/dashboard")} className="px-6 py-2 bg-accent-cyan text-background-primary rounded-lg font-semibold hover:bg-accent-cyan/90 transition-colors">
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-background-primary flex flex-col overflow-hidden relative selection:bg-accent-cyan/20 selection:text-accent-cyan">
      {/* Background Grid Pattern */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem'
        }}
      />

      {/* Floating Reactions Overlay */}
      <div className="absolute inset-0 z-50 pointer-events-none">
        <FloatingReaction reactions={reactions} onReactionComplete={removeReaction} />
      </div>

      {/* Top Bar */}
      <div className="glass-card-strong border-b border-white/10 px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white transition-all duration-300 border border-white/5 hover:border-white/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 animate-pulse-slow">
              <div className="w-2 h-2 rounded-full bg-accent-cyan animate-ping" />
              <span className="text-accent-cyan font-bold text-xs uppercase tracking-wider">Live Spectating</span>
            </div>

            <div>
              <h1 className="text-xl font-header font-bold text-white tracking-tight">{matchState.challenge?.title || "Loading..."}</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${matchState.challenge?.difficulty === 'easy' ? 'bg-accent-lime/10 border-accent-lime/30 text-accent-lime' :
                  matchState.challenge?.difficulty === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' :
                    'bg-accent-red/10 border-accent-red/30 text-accent-red'
                }`}>
                {matchState.challenge?.difficulty || "..."}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan"></span>
            </span>
            <span className="font-bold text-white text-sm">{spectatorCount}</span>
            <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Watching</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Side - Player 1 (45%) */}
        <div className="w-[45%] border-r border-white/10 flex flex-col bg-background-primary/50 backdrop-blur-sm">
          {/* Player 1 Info */}
          <div className="bg-white/5 px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 border border-accent-cyan/50 flex items-center justify-center text-accent-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                  {matchState.player1?.username.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-white font-bold text-sm tracking-wide">{matchState.player1?.username || "Player 1"}</p>
                  <p className="text-accent-cyan text-xs font-code">RATING: {matchState.player1?.rating || "..."}</p>
                </div>
              </div>
              {matchState.player1Submitted && (
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent-lime bg-accent-lime/10 px-2 py-1 rounded border border-accent-lime/20 shadow-[0_0_10px_rgba(57,255,20,0.2)] animate-bounce-subtle">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Submitted
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Language:</span>
              <span className="text-xs text-white font-code bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{matchState.player1Language}</span>
            </div>
          </div>

          {/* Player 1 Editor */}
          <div className="flex-1 overflow-hidden relative">
            <CodeEditor language={matchState.player1Language as any} initialCode={matchState.player1Code} onChange={() => { }} readOnly={true} showCursor={matchState.player1Cursor} height="100%" />
          </div>
        </div>

        {/* Right Side - Player 2 and Chat (55%) */}
        <div className="w-[55%] flex flex-col bg-background-secondary/30 backdrop-blur-sm">
          {/* Player 2 Section (65%) */}
          <div className="h-[65%] border-b border-white/10 flex flex-col">
            {/* Player 2 Info */}
            <div className="bg-white/5 px-4 py-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-magenta/20 border border-accent-magenta/50 flex items-center justify-center text-accent-magenta font-bold shadow-[0_0_10px_rgba(255,0,60,0.2)]">
                    {matchState.player2?.username.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm tracking-wide">{matchState.player2?.username || "Player 2"}</p>
                    <p className="text-accent-magenta text-xs font-code">RATING: {matchState.player2?.rating || "..."}</p>
                  </div>
                </div>
                {matchState.player2Submitted && (
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent-lime bg-accent-lime/10 px-2 py-1 rounded border border-accent-lime/20 shadow-[0_0_10px_rgba(57,255,20,0.2)] animate-bounce-subtle">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Submitted
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Language:</span>
                <span className="text-xs text-white font-code bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{matchState.player2Language}</span>
              </div>
            </div>

            {/* Player 2 Editor */}
            <div className="flex-1 overflow-hidden relative">
              <CodeEditor language={matchState.player2Language as any} initialCode={matchState.player2Code} onChange={() => { }} readOnly={true} showCursor={matchState.player2Cursor} height="100%" />
            </div>
          </div>

          {/* Chat Section (35%) */}
          <div className="h-[35%] bg-black/40 backdrop-blur-md relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <SpectatorChat matchId={matchId} messages={chatMessages} onSendMessage={handleSendMessage} onSendReaction={handleSendReaction} isConnected={isConnected} rateLimitedUntil={rateLimitedUntil} />
          </div>
        </div>
      </div>

      {/* Connection Status Indicator */}
      {!isConnected && (
        <div className="absolute top-24 right-6 px-4 py-3 bg-accent-red/10 border border-accent-red/50 rounded-xl backdrop-blur-md shadow-lg flex items-center gap-3 animate-pulse z-50">
          <div className="w-2 h-2 rounded-full bg-accent-red"></div>
          <p className="text-accent-red text-xs font-bold uppercase tracking-wider">Reconnecting to Server...</p>
        </div>
      )}
    </main>
  );
}

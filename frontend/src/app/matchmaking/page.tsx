"use client";

import React, { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useWebSocket, useWebSocketEvent, useWebSocketConnection } from "@/hooks/useWebSocket";

interface QueuePosition {
  position: number;
  estimatedWait: number;
}

interface MatchFound {
  matchId: string;
  opponent: {
    id: string;
    username: string;
    rating: number;
  };
  challenge: {
    id: string;
    title: string;
    difficulty: string;
  };
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
}

const PRACTICE_CHALLENGES: Challenge[] = [
  {
    id: "practice-1",
    title: "Two Sum",
    description: "Find two numbers in an array that add up to a target sum",
    difficulty: "easy",
  },
  {
    id: "practice-2",
    title: "Reverse String",
    description: "Reverse a string in-place with O(1) extra space",
    difficulty: "easy",
  },
  {
    id: "practice-3",
    title: "Valid Palindrome",
    description: "Check if a string is a valid palindrome",
    difficulty: "easy",
  },
  {
    id: "practice-4",
    title: "Binary Search",
    description: "Implement binary search on a sorted array",
    difficulty: "medium",
  },
  {
    id: "practice-5",
    title: "Merge Intervals",
    description: "Merge overlapping intervals in an array",
    difficulty: "medium",
  },
];

export default function MatchmakingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { emit } = useWebSocket();
  const { isConnected } = useWebSocketConnection(); // This auto-connects
  const [queuePosition, setQueuePosition] = useState<QueuePosition | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);

  // Join queue on mount
  useEffect(() => {
    if (isConnected && !isInQueue) {
      emit("join_queue", {});
      setIsInQueue(true);
    }
  }, [isConnected, emit, isInQueue]);

  // Listen for queue position updates
  useWebSocketEvent<QueuePosition>("queue_position", (data) => {
    setQueuePosition(data);
  });

  // Listen for match found
  useWebSocketEvent<MatchFound>("match_found", (data) => {
    // Store match data in sessionStorage for lobby page
    sessionStorage.setItem(`match_${data.matchId}`, JSON.stringify(data));
    router.push(`/lobby/${data.matchId}`);
  });

  // Handle cancel
  const handleCancel = () => {
    emit("leave_queue", {});
    router.push("/dashboard");
  };

  const formatWaitTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
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

        <div className="relative z-10 max-w-4xl mx-auto p-4 sm:p-6">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-6xl font-header font-bold text-white tracking-tight mb-3">
              SEARCHING FOR <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-magenta">OPPONENT</span>
            </h1>
            <p className="text-text-secondary text-lg">Scanning global network for a worthy adversary...</p>
          </div>

          {/* Loading Animation */}
          <div className="glass-card-strong rounded-2xl p-8 sm:p-12 mb-12 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-cyan to-transparent opacity-50 animate-pulse" />

            <div className="flex flex-col items-center">
              {/* Animated Spinner */}
              <div className="relative w-32 h-32 mb-8">
                <div className="absolute inset-0 border-4 border-white/5 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-accent-cyan rounded-full animate-spin"></div>
                <div className="absolute inset-4 border-4 border-transparent border-t-accent-magenta rounded-full animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                </div>
              </div>

              {/* Queue Status */}
              {queuePosition && (
                <div className="text-center space-y-4 animate-fade-in">
                  <div className="inline-flex flex-col items-center p-4 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">QUEUE POSITION</span>
                    <span className="text-4xl font-header font-bold text-white">{queuePosition.position}</span>
                  </div>

                  <div className="flex items-center gap-2 text-text-secondary justify-center">
                    <svg className="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Estimated Wait: <span className="text-accent-cyan font-bold">{formatWaitTime(queuePosition.estimatedWait)}</span></span>
                  </div>
                </div>
              )}

              {!queuePosition && (
                <div className="text-center">
                  <p className="text-text-primary text-xl font-code animate-pulse">ESTABLISHING UPLINK...</p>
                </div>
              )}

              {/* Connection Status */}
              {!isConnected && (
                <div className="mt-6 px-4 py-2 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
                  <p className="text-accent-yellow text-xs font-bold tracking-wider uppercase animate-pulse">Connecting to server...</p>
                </div>
              )}
            </div>
          </div>

          {/* Cancel Button */}
          <div className="text-center mb-16">
            <button
              onClick={handleCancel}
              className="px-8 py-3 bg-transparent border border-accent-red/30 text-accent-red hover:bg-accent-red/10 hover:border-accent-red/50 font-bold rounded-lg transition-all duration-300 uppercase tracking-wider text-sm"
            >
              Abort Search
            </button>
          </div>

          {/* Practice Challenges */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-header font-bold text-white">WARMUP PROTOCOLS</h2>
              <span className="text-xs font-code text-text-muted">OPTIONAL TRAINING</span>
            </div>

            <div className="grid gap-4">
              {PRACTICE_CHALLENGES.map((challenge) => (
                <div key={challenge.id} className="glass-card p-6 rounded-xl border border-white/5 hover:border-accent-cyan/30 transition-all duration-300 group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-accent-cyan transition-colors">{challenge.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getDifficultyColor(challenge.difficulty).replace('text-', 'border-').replace('500', '500/30')} ${getDifficultyColor(challenge.difficulty)}`}>
                          {challenge.difficulty}
                        </span>
                      </div>
                      <p className="text-text-secondary text-sm mb-4">{challenge.description}</p>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => router.push(`/practice/${challenge.id}`)}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan rounded-lg hover:bg-accent-cyan/20 transition-colors flex items-center gap-2"
                        >
                          <span>🧘</span> Practice Mode
                        </button>
                        <button
                          onClick={() => router.push(`/ghost-race/${challenge.id}`)}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-accent-magenta/10 border border-accent-magenta/30 text-accent-magenta rounded-lg hover:bg-accent-magenta/20 transition-colors flex items-center gap-2"
                        >
                          <span>👻</span> Ghost Race
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

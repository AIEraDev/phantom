"use client";

import React from "react";
import { Match } from "@/types/match";
import { useRouter } from "next/navigation";

interface MatchHistoryProps {
  matches: Match[];
  currentUserId: string;
  isLoading?: boolean;
}

export function MatchHistory({ matches, currentUserId, isLoading = false }: MatchHistoryProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-background-secondary p-4 rounded-lg border border-border-default animate-pulse">
            <div className="h-4 bg-border-default rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-border-default rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-background-secondary p-8 rounded-lg border border-border-default text-center">
        <p className="text-text-muted text-lg mb-2">No matches yet</p>
        <p className="text-text-muted text-sm">Start your first battle to see your match history!</p>
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
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

  const getResultBadge = (match: Match) => {
    if (match.status !== "completed") {
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent-yellow/20 text-accent-yellow">{match.status}</span>;
    }

    const isWinner = match.winnerId === currentUserId;
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isWinner ? "bg-accent-lime/20 text-accent-lime" : "bg-accent-red/20 text-accent-red"}`}>{isWinner ? "Victory" : "Defeat"}</span>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleReplayClick = (e: React.MouseEvent, matchId: string) => {
    e.stopPropagation();
    router.push(`/replay/${matchId}`);
  };

  return (
    <div className="space-y-3">
      {matches.map((match) => (
        <div key={match.id} onClick={() => router.push(`/results/${match.id}`)} className="bg-background-secondary p-4 rounded-lg border border-border-default hover:border-accent-cyan cursor-pointer transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h3 className="text-text-primary font-semibold group-hover:text-accent-cyan transition-colors">{match.challenge?.title || "Challenge"}</h3>
              <span className={`text-xs font-semibold uppercase ${getDifficultyColor(match.challenge?.difficulty || "")}`}>{match.challenge?.difficulty}</span>
            </div>
            <div className="flex items-center gap-2">
              {match.status === "completed" && (
                <button onClick={(e) => handleReplayClick(e, match.id)} className="px-3 py-1 rounded-full text-xs font-semibold bg-accent-magenta/20 text-accent-magenta hover:bg-accent-magenta/30 transition-colors flex items-center gap-1" title="Watch Replay">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Replay
                </button>
              )}
              {getResultBadge(match)}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-text-muted">
              <span>vs {match.opponent?.username || "Unknown"}</span>
              {match.player1Score !== undefined && match.player2Score !== undefined && (
                <span className="text-text-secondary font-mono">
                  {match.player1Id === currentUserId ? match.player1Score : match.player2Score} - {match.player1Id === currentUserId ? match.player2Score : match.player1Score}
                </span>
              )}
              <span className="text-accent-cyan">{match.player1Id === currentUserId ? match.player1Language : match.player2Language}</span>
            </div>
            <span className="text-text-muted text-xs">{formatDate(match.completedAt || match.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

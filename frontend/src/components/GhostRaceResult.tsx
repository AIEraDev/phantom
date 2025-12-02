"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import VictoryConfetti from "./VictoryConfetti";

interface GhostRaceResultData {
  raceId: string;
  playerScore: number;
  ghostScore: number;
  won: boolean;
  isTie: boolean;
  completionTime: number;
  ghostDuration: number;
}

interface GhostInfo {
  id: string;
  username: string;
  score: number;
  durationMs: number;
  isAI: boolean;
}

interface GhostRaceResultProps {
  result: GhostRaceResultData;
  ghost: GhostInfo | null;
  onPlayAgain: () => void;
  onSaveGhost?: () => void;
  onExit: () => void;
}

/**
 * GhostRaceResult Component
 * Displays comparison of scores with win/lose animation
 * Requirements: 14.4, 14.5
 */
export function GhostRaceResult({ result, ghost, onPlayAgain, onSaveGhost, onExit }: GhostRaceResultProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [savingGhost, setSavingGhost] = useState(false);
  const [ghostSaved, setGhostSaved] = useState(false);

  useEffect(() => {
    if (result.won) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [result.won]);

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleSaveGhost = async () => {
    if (onSaveGhost && !ghostSaved) {
      setSavingGhost(true);
      try {
        await onSaveGhost();
        setGhostSaved(true);
      } catch (error) {
        console.error("Failed to save ghost:", error);
      } finally {
        setSavingGhost(false);
      }
    }
  };

  const getResultMessage = () => {
    if (result.isTie) {
      return { text: "It's a Tie!", color: "text-accent-yellow", emoji: "🤝" };
    }
    if (result.won) {
      return { text: "Victory!", color: "text-accent-lime", emoji: "🏆" };
    }
    return { text: "Defeated", color: "text-accent-red", emoji: "💀" };
  };

  const resultMessage = getResultMessage();

  return (
    <main className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <VictoryConfetti active={showConfetti} />

      <motion.div className="w-full max-w-2xl glass-card-strong rounded-xl p-8" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20, stiffness: 200 }}>
        {/* Result Header */}
        <motion.div className="text-center mb-8" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <span className="text-6xl mb-4 block">{resultMessage.emoji}</span>
          <h1 className={`text-4xl font-header font-bold ${resultMessage.color}`}>{resultMessage.text}</h1>
          <p className="text-text-secondary mt-2">
            Ghost Race vs {ghost?.username || "Ghost"}
            {ghost?.isAI && " (AI)"}
          </p>
        </motion.div>

        {/* Score Comparison */}
        <motion.div className="grid grid-cols-3 gap-4 mb-8" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          {/* Player Score */}
          <div className="text-center p-4 bg-background-secondary rounded-lg border border-accent-cyan/30">
            <div className="text-sm text-text-muted mb-1">Your Score</div>
            <div className={`text-3xl font-bold ${result.won ? "text-accent-lime" : "text-accent-cyan"}`}>{result.playerScore}</div>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center">
            <span className="text-2xl text-text-muted font-bold">VS</span>
          </div>

          {/* Ghost Score */}
          <div className="text-center p-4 bg-background-secondary rounded-lg border border-accent-magenta/30">
            <div className="text-sm text-text-muted mb-1">Ghost Score</div>
            <div className={`text-3xl font-bold ${!result.won && !result.isTie ? "text-accent-lime" : "text-accent-magenta"}`}>{result.ghostScore}</div>
          </div>
        </motion.div>

        {/* Time Comparison */}
        <motion.div className="grid grid-cols-2 gap-4 mb-8" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          <div className="p-4 bg-background-secondary rounded-lg border border-border-default">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-text-muted">Your Time</span>
            </div>
            <div className="text-xl font-mono text-text-primary">{formatTime(result.completionTime)}</div>
          </div>

          <div className="p-4 bg-background-secondary rounded-lg border border-border-default">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">👻</span>
              <span className="text-sm text-text-muted">Ghost Time</span>
            </div>
            <div className="text-xl font-mono text-text-primary">{formatTime(result.ghostDuration)}</div>
          </div>
        </motion.div>

        {/* Score Difference */}
        <motion.div className="text-center mb-8 p-4 bg-background-secondary rounded-lg" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
          <div className="text-sm text-text-muted mb-1">Score Difference</div>
          <div className={`text-2xl font-bold ${result.playerScore > result.ghostScore ? "text-accent-lime" : result.playerScore < result.ghostScore ? "text-accent-red" : "text-accent-yellow"}`}>
            {result.playerScore > result.ghostScore ? "+" : ""}
            {result.playerScore - result.ghostScore} points
          </div>
        </motion.div>

        {/* Save Ghost Option (if won) */}
        {result.won && onSaveGhost && (
          <motion.div className="mb-6 p-4 bg-accent-lime/10 border border-accent-lime/30 rounded-lg" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-accent-lime">Save Your Ghost</h3>
                <p className="text-sm text-text-secondary">Let others race against your winning performance!</p>
              </div>
              <button onClick={handleSaveGhost} disabled={savingGhost || ghostSaved} className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${ghostSaved ? "bg-accent-lime/20 text-accent-lime border border-accent-lime" : "bg-accent-lime text-background-primary hover:bg-accent-lime/90"} disabled:opacity-50`}>
                {ghostSaved ? "Saved ✓" : savingGhost ? "Saving..." : "Save Ghost 👻"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div className="flex gap-4" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }}>
          <button onClick={onExit} className="flex-1 px-4 py-3 bg-background-secondary text-text-primary font-semibold rounded-lg border border-border-default hover:border-accent-cyan hover:text-accent-cyan transition-all duration-300">
            Exit
          </button>
          <button onClick={onPlayAgain} className="flex-1 px-4 py-3 bg-accent-cyan text-background-primary font-semibold rounded-lg hover:bg-accent-cyan/90 neon-glow transition-all duration-300">
            Race Again 👻
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}

export default GhostRaceResult;

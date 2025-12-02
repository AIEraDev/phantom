"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ghostApi, GhostMetadata } from "@/lib/api";

interface GhostSelectionModalProps {
  challengeId: string;
  challengeTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectGhost: (ghostId: string | null) => void;
}

/**
 * GhostSelectionModal Component
 * Displays available ghosts for a challenge with stats
 * Requirements: 14.1
 */
export function GhostSelectionModal({ challengeId, challengeTitle, isOpen, onClose, onSelectGhost }: GhostSelectionModalProps) {
  const [ghosts, setGhosts] = useState<GhostMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGhostId, setSelectedGhostId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && challengeId) {
      fetchGhosts();
    }
  }, [isOpen, challengeId]);

  const fetchGhosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ghostApi.getGhostsForChallenge(challengeId);
      setGhosts(response.ghosts);
    } catch (err) {
      console.error("Failed to fetch ghosts:", err);
      setError("Failed to load ghost recordings");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleStartRace = () => {
    onSelectGhost(selectedGhostId);
  };

  const handleRaceAgainstAI = () => {
    onSelectGhost(null); // null means use AI ghost
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {/* Backdrop */}
        <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

        {/* Modal */}
        <motion.div className="relative w-full max-w-2xl glass-card-strong rounded-xl p-6 z-10 max-h-[80vh] overflow-hidden flex flex-col" initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
          {/* Close button */}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-background-secondary border border-border-default text-text-secondary hover:text-text-primary hover:border-accent-cyan transition-colors flex items-center justify-center">
            ✕
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">👻</span>
              <h2 className="text-2xl font-header font-bold text-text-primary">Ghost Mode</h2>
            </div>
            <p className="text-text-secondary text-sm">
              Race against recordings of previous winners for <span className="text-accent-cyan">{challengeTitle}</span>
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-cyan/20 border-t-accent-cyan"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-accent-red mb-4">{error}</p>
                <button onClick={fetchGhosts} className="px-4 py-2 bg-background-secondary border border-border-default rounded-lg text-text-primary hover:border-accent-cyan transition-colors">
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* AI Ghost Option */}
                <button onClick={() => setSelectedGhostId(null)} className={`w-full p-4 rounded-lg border transition-all duration-300 text-left ${selectedGhostId === null ? "border-accent-magenta bg-accent-magenta/10" : "border-border-default bg-background-secondary hover:border-accent-magenta/50"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent-magenta/20 flex items-center justify-center">
                        <span className="text-xl">🤖</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary">AI Ghost</h3>
                        <p className="text-sm text-text-muted">Race against an AI-generated optimal solution</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-accent-magenta font-bold">95</div>
                      <div className="text-xs text-text-muted">Score</div>
                    </div>
                  </div>
                </button>

                {/* Divider */}
                {ghosts.length > 0 && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-border-default"></div>
                    <span className="text-xs text-text-muted uppercase">Player Ghosts</span>
                    <div className="flex-1 h-px bg-border-default"></div>
                  </div>
                )}

                {/* Player Ghosts */}
                {ghosts.map((ghost) => (
                  <button key={ghost.id} onClick={() => setSelectedGhostId(ghost.id)} className={`w-full p-4 rounded-lg border transition-all duration-300 text-left ${selectedGhostId === ghost.id ? "border-accent-cyan bg-accent-cyan/10" : "border-border-default bg-background-secondary hover:border-accent-cyan/50"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-cyan/20 flex items-center justify-center">
                          <span className="text-lg">👤</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-text-primary">
                            {ghost.username}
                            {ghost.isAI && <span className="ml-2 text-xs text-accent-magenta">(AI)</span>}
                          </h3>
                          <p className="text-sm text-text-muted">Duration: {formatDuration(ghost.durationMs)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-accent-lime font-bold">{ghost.score}</div>
                        <div className="text-xs text-text-muted">Score</div>
                      </div>
                    </div>
                  </button>
                ))}

                {ghosts.length === 0 && <p className="text-center text-text-muted py-4">No player ghosts available yet. Be the first to create one!</p>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-3 bg-background-secondary text-text-primary font-semibold rounded-lg border border-border-default hover:border-accent-cyan hover:text-accent-cyan transition-all duration-300">
              Cancel
            </button>
            <button onClick={handleStartRace} disabled={loading} className="flex-1 px-4 py-3 bg-accent-cyan text-background-primary font-semibold rounded-lg hover:bg-accent-cyan/90 neon-glow transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
              Start Race 👻
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default GhostSelectionModal;

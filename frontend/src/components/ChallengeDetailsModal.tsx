"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { SkillTreeNode } from "@/lib/api";

interface ChallengeDetailsModalProps {
  node: SkillTreeNode | null;
  onClose: () => void;
  allNodes: SkillTreeNode[];
}

const difficultyColors: Record<string, string> = {
  easy: "text-accent-lime border-accent-lime",
  medium: "text-accent-yellow border-accent-yellow",
  hard: "text-accent-magenta border-accent-magenta",
  expert: "text-accent-red border-accent-red",
};

export function ChallengeDetailsModal({ node, onClose, allNodes }: ChallengeDetailsModalProps) {
  const router = useRouter();

  if (!node) return null;

  const challenge = node.challenge;
  const isLocked = !node.isUnlocked;

  // Get prerequisite challenge names
  const prerequisiteNodes = node.prerequisites.map((prereqId) => allNodes.find((n) => n.id === prereqId)).filter(Boolean) as SkillTreeNode[];

  const handlePractice = () => {
    if (challenge && !isLocked) {
      router.push(`/practice/${challenge.id}`);
    }
  };

  const handleBattle = () => {
    if (challenge && !isLocked) {
      router.push(`/matchmaking?challengeId=${challenge.id}`);
    }
  };

  const handleGhostRace = () => {
    if (challenge && !isLocked) {
      router.push(`/ghost-race/${challenge.id}`);
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {/* Backdrop */}
        <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

        {/* Modal */}
        <motion.div className="relative w-full max-w-lg glass-card-strong rounded-xl p-6 z-10" initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
          {/* Close button */}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-background-secondary border border-border-default text-text-secondary hover:text-text-primary hover:border-accent-cyan transition-colors flex items-center justify-center">
            ✕
          </button>

          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              {isLocked && <span className="text-2xl">🔒</span>}
              {node.isMastered && <span className="text-2xl">⭐</span>}
              {node.isCompleted && !node.isMastered && <span className="text-2xl">✓</span>}
              <h2 className="text-2xl font-header font-bold text-text-primary">{challenge?.title || "Unknown Challenge"}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 text-sm border rounded capitalize ${difficultyColors[challenge?.difficulty || "easy"]}`}>{challenge?.difficulty || "N/A"}</span>
              <span className="text-sm text-text-muted capitalize">{node.category}</span>
              <span className="text-sm text-text-muted">Tier {node.tier}</span>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <p className="text-text-secondary text-sm leading-relaxed">{challenge?.description || "No description available."}</p>
          </div>

          {/* Time limit */}
          {challenge?.time_limit && (
            <div className="mb-4 flex items-center gap-2 text-sm text-text-muted">
              <span>⏱️</span>
              <span>Time limit: {challenge.time_limit} seconds</span>
            </div>
          )}

          {/* Prerequisites (for locked challenges) */}
          {isLocked && prerequisiteNodes.length > 0 && (
            <div className="mb-6 p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg">
              <h3 className="text-sm font-semibold text-accent-red mb-2">Prerequisites Required</h3>
              <p className="text-xs text-text-secondary mb-3">Complete these challenges to unlock:</p>
              <ul className="space-y-2">
                {prerequisiteNodes.map((prereq) => (
                  <li key={prereq.id} className="flex items-center gap-2 text-sm">
                    {prereq.isCompleted ? <span className="text-accent-lime">✓</span> : <span className="text-text-muted">○</span>}
                    <span className={prereq.isCompleted ? "text-text-muted line-through" : "text-text-primary"}>{prereq.challenge?.title || "Unknown"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Progress info (for completed/mastered) */}
          {node.isCompleted && (
            <div className="mb-6 p-4 bg-accent-lime/10 border border-accent-lime/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Status</span>
                <span className="text-sm font-semibold text-accent-lime">{node.isMastered ? "Mastered ⭐" : "Completed ✓"}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {isLocked ? (
              <button disabled className="flex-1 px-4 py-3 bg-gray-700 text-gray-400 font-semibold rounded-lg cursor-not-allowed">
                🔒 Locked
              </button>
            ) : (
              <>
                <div className="flex gap-3">
                  <button onClick={handlePractice} className="flex-1 px-4 py-3 bg-background-secondary text-text-primary font-semibold rounded-lg border border-border-default hover:border-accent-cyan hover:text-accent-cyan transition-all duration-300">
                    🧘 Practice
                  </button>
                  <button onClick={handleBattle} className="flex-1 px-4 py-3 bg-accent-cyan text-background-primary font-semibold rounded-lg hover:bg-accent-cyan/90 neon-glow transition-all duration-300">
                    ⚔️ Battle
                  </button>
                </div>
                <button onClick={handleGhostRace} className="w-full px-4 py-3 bg-accent-magenta/10 text-accent-magenta font-semibold rounded-lg border border-accent-magenta/30 hover:bg-accent-magenta/20 transition-all duration-300">
                  👻 Ghost Race
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ChallengeDetailsModal;

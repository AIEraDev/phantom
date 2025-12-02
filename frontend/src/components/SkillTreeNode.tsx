"use client";

import React from "react";
import { motion } from "framer-motion";
import { SkillTreeNode as SkillTreeNodeType } from "@/lib/api";

type NodeState = "locked" | "unlocked" | "completed" | "mastered";

function getNodeState(node: SkillTreeNodeType): NodeState {
  if (node.isMastered) return "mastered";
  if (node.isCompleted) return "completed";
  if (node.isUnlocked) return "unlocked";
  return "locked";
}

interface SkillTreeNodeProps {
  node: SkillTreeNodeType;
  onClick: (node: SkillTreeNodeType) => void;
  isSelected?: boolean;
}

const nodeStyles: Record<NodeState, { bg: string; border: string; glow: string; icon: string }> = {
  locked: {
    bg: "bg-gray-800/60",
    border: "border-gray-600",
    glow: "",
    icon: "🔒",
  },
  unlocked: {
    bg: "bg-background-secondary/80",
    border: "border-accent-cyan",
    glow: "shadow-[0_0_15px_rgba(0,255,255,0.3)]",
    icon: "",
  },
  completed: {
    bg: "bg-accent-lime/20",
    border: "border-accent-lime",
    glow: "shadow-[0_0_15px_rgba(0,255,0,0.3)]",
    icon: "✓",
  },
  mastered: {
    bg: "bg-yellow-500/20",
    border: "border-yellow-400",
    glow: "shadow-[0_0_20px_rgba(255,215,0,0.4)]",
    icon: "⭐",
  },
};

const difficultyColors: Record<string, string> = {
  easy: "text-accent-lime",
  medium: "text-accent-yellow",
  hard: "text-accent-magenta",
  expert: "text-accent-red",
};

export function SkillTreeNodeComponent({ node, onClick, isSelected }: SkillTreeNodeProps) {
  const state = getNodeState(node);
  const styles = nodeStyles[state];
  const challenge = node.challenge;

  return (
    <motion.div
      className={`
        relative w-32 h-24 rounded-lg cursor-pointer
        ${styles.bg} ${styles.glow}
        border-2 ${styles.border}
        transition-all duration-300
        ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-background-primary" : ""}
        ${state === "locked" ? "opacity-60 cursor-not-allowed" : "hover:scale-105"}
      `}
      onClick={() => onClick(node)}
      whileHover={state !== "locked" ? { scale: 1.05 } : {}}
      whileTap={state !== "locked" ? { scale: 0.98 } : {}}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* State icon */}
      {styles.icon && <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background-primary flex items-center justify-center text-sm">{styles.icon}</div>}

      {/* Content */}
      <div className="p-2 h-full flex flex-col justify-between">
        <div className="text-xs font-semibold text-text-primary truncate">{challenge?.title || "Unknown Challenge"}</div>

        <div className="flex items-center justify-between">
          <span className={`text-xs ${difficultyColors[challenge?.difficulty || "easy"]}`}>{challenge?.difficulty || "N/A"}</span>
          <span className="text-xs text-text-muted">T{node.tier}</span>
        </div>

        {/* Category badge */}
        <div className="text-[10px] text-text-secondary bg-background-primary/50 rounded px-1 py-0.5 text-center capitalize">{node.category}</div>
      </div>

      {/* Mastered particle effect */}
      {state === "mastered" && (
        <motion.div className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
          <div className="absolute top-1 left-1 w-1 h-1 bg-yellow-400 rounded-full" />
          <div className="absolute top-2 right-3 w-1 h-1 bg-yellow-400 rounded-full" />
          <div className="absolute bottom-3 left-2 w-1 h-1 bg-yellow-400 rounded-full" />
        </motion.div>
      )}

      {/* Unlocked pulse animation */}
      {state === "unlocked" && <motion.div className="absolute inset-0 rounded-lg border-2 border-accent-cyan pointer-events-none" initial={{ opacity: 0.5, scale: 1 }} animate={{ opacity: 0, scale: 1.1 }} transition={{ duration: 1.5, repeat: Infinity }} />}
    </motion.div>
  );
}

export default SkillTreeNodeComponent;

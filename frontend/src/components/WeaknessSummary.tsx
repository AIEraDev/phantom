"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { coachApi, WeaknessSummary as WeaknessSummaryType, WeaknessPattern } from "@/lib/api";

interface WeaknessSummaryProps {
  className?: string;
}

/**
 * WeaknessSummary Component
 * Displays top 3 weakness cards, strongest area highlight, and improvement trend indicator
 * Requirements: 4.3
 */
export function WeaknessSummary({ className = "" }: WeaknessSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WeaknessSummaryType | null>(null);
  const [insufficientData, setInsufficientData] = useState(false);

  useEffect(() => {
    const fetchWeaknessSummary = async () => {
      try {
        setLoading(true);
        const response = await coachApi.getWeaknessSummary();
        setSummary(response.summary);
      } catch (err: any) {
        if (err.message?.includes("insufficient") || err.status === 400) {
          setInsufficientData(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load weakness data");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchWeaknessSummary();
  }, []);

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      time_complexity: "⏱️",
      space_complexity: "💾",
      readability: "📖",
      patterns: "🔄",
    };
    return icons[category] || "📊";
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      time_complexity: "Time Complexity",
      space_complexity: "Space Complexity",
      readability: "Readability",
      patterns: "Patterns",
    };
    return labels[category] || category;
  };

  const getTrendIcon = (trend: "improving" | "stable" | "declining"): string => {
    switch (trend) {
      case "improving":
        return "📈";
      case "declining":
        return "📉";
      default:
        return "➡️";
    }
  };

  const getTrendColor = (trend: "improving" | "stable" | "declining"): string => {
    switch (trend) {
      case "improving":
        return "text-accent-lime";
      case "declining":
        return "text-accent-red";
      default:
        return "text-accent-yellow";
    }
  };

  const getTrendLabel = (trend: "improving" | "stable" | "declining"): string => {
    switch (trend) {
      case "improving":
        return "Improving";
      case "declining":
        return "Needs Work";
      default:
        return "Stable";
    }
  };

  if (loading) {
    return (
      <div className={`glass-card rounded-2xl border border-white/10 p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-magenta/20 flex items-center justify-center">
            <span className="text-xl">🎯</span>
          </div>
          <h2 className="text-xl font-bold text-white">Weakness Analysis</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass-card rounded-2xl border border-white/10 p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-magenta/20 flex items-center justify-center">
            <span className="text-xl">🎯</span>
          </div>
          <h2 className="text-xl font-bold text-white">Weakness Analysis</h2>
        </div>
        <div className="text-center py-4">
          <p className="text-accent-red text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (insufficientData) {
    return (
      <div className={`glass-card rounded-2xl border border-white/10 p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-magenta/20 flex items-center justify-center">
            <span className="text-xl">🎯</span>
          </div>
          <h2 className="text-xl font-bold text-white">Weakness Analysis</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📊</span>
          </div>
          <h3 className="font-bold text-white mb-2">Not Enough Data</h3>
          <p className="text-sm text-text-secondary mb-4">Complete at least 5 matches to unlock weakness detection and personalized insights.</p>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${i <= 2 ? "bg-accent-cyan" : "bg-white/20"}`} />
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">2/5 matches completed</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className={`glass-card rounded-2xl border border-white/10 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-accent-magenta/20 to-accent-cyan/20 px-6 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-magenta/20 flex items-center justify-center">
              <span className="text-xl">🎯</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Weakness Analysis</h2>
              <p className="text-xs text-text-secondary">Based on your recent matches</p>
            </div>
          </div>
          {/* Improvement Trend Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${summary.improvementTrend === "improving" ? "bg-accent-lime/20 border border-accent-lime/30" : summary.improvementTrend === "declining" ? "bg-accent-red/20 border border-accent-red/30" : "bg-accent-yellow/20 border border-accent-yellow/30"}`}>
            <span className="text-lg">{getTrendIcon(summary.improvementTrend)}</span>
            <span className={`text-sm font-bold ${getTrendColor(summary.improvementTrend)}`}>{getTrendLabel(summary.improvementTrend)}</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Strongest Area Highlight */}
        <div className="bg-gradient-to-r from-accent-lime/20 to-accent-cyan/20 rounded-xl p-4 border border-accent-lime/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent-lime/20 flex items-center justify-center">
              <span className="text-2xl">💪</span>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Strongest Area</p>
              <p className="text-lg font-bold text-accent-lime">{getCategoryLabel(summary.strongestArea)}</p>
            </div>
          </div>
        </div>

        {/* Top 3 Weakness Cards */}
        <div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Areas to Improve</h3>
          <div className="space-y-3">
            {summary.topWeaknesses.length > 0 ? (
              summary.topWeaknesses.map((weakness, index) => <WeaknessCard key={index} weakness={weakness} rank={index + 1} />)
            ) : (
              <div className="text-center py-4 text-text-muted">
                <p>No significant weaknesses detected!</p>
                <p className="text-sm mt-1">Keep up the great work! 🎉</p>
              </div>
            )}
          </div>
        </div>

        {/* Tips based on weaknesses */}
        {summary.topWeaknesses.length > 0 && (
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-sm font-bold text-white mb-1">Pro Tip</p>
                <p className="text-sm text-text-secondary">{getWeaknessTip(summary.topWeaknesses[0]?.category)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface WeaknessCardProps {
  weakness: WeaknessPattern;
  rank: number;
}

function WeaknessCard({ weakness, rank }: WeaknessCardProps) {
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      time_complexity: "⏱️",
      space_complexity: "💾",
      readability: "📖",
      patterns: "🔄",
    };
    return icons[category] || "📊";
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      time_complexity: "Time Complexity",
      space_complexity: "Space Complexity",
      readability: "Readability",
      patterns: "Patterns",
    };
    return labels[category] || category;
  };

  const getRankColor = (r: number): string => {
    switch (r) {
      case 1:
        return "bg-accent-red/20 text-accent-red border-accent-red/30";
      case 2:
        return "bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30";
      case 3:
        return "bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30";
      default:
        return "bg-white/10 text-white border-white/20";
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: rank * 0.1 }} className="bg-black/20 rounded-xl p-4 border border-white/5 flex items-start gap-4">
      {/* Rank badge */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border ${getRankColor(rank)}`}>#{rank}</div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span>{getCategoryIcon(weakness.category)}</span>
          <span className="font-bold text-white text-sm">{getCategoryLabel(weakness.category)}</span>
        </div>
        <p className="text-sm text-text-secondary mb-2">{weakness.pattern}</p>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>Frequency: {weakness.frequency}x</span>
          <span>Last seen: {new Date(weakness.lastSeen).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Frequency indicator */}
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{weakness.frequency}</span>
        </div>
        <span className="text-xs text-text-muted mt-1">times</span>
      </div>
    </motion.div>
  );
}

function getWeaknessTip(category: string): string {
  const tips: Record<string, string> = {
    time_complexity: "Focus on understanding Big O notation and practice identifying nested loops. Consider using hash maps to reduce time complexity.",
    space_complexity: "Try to solve problems in-place when possible. Be mindful of creating unnecessary data structures.",
    readability: "Use meaningful variable names and add comments for complex logic. Break down large functions into smaller, focused ones.",
    patterns: "Study common algorithm patterns like sliding window, two pointers, and dynamic programming. Practice recognizing when to apply each pattern.",
  };
  return tips[category] || "Keep practicing and reviewing your solutions to improve!";
}

export default WeaknessSummary;

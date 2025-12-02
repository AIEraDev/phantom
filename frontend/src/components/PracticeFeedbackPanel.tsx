"use client";

import React from "react";
import { motion } from "framer-motion";
import { PracticeFeedback } from "@/lib/api";

interface PracticeFeedbackPanelProps {
  feedback: PracticeFeedback | null;
  score: number | null;
  isLoading?: boolean;
}

/**
 * PracticeFeedbackPanel Component
 * Display AI feedback after submission with scores and suggestions
 * Requirements: 17.4
 */
export function PracticeFeedbackPanel({ feedback, score, isLoading = false }: PracticeFeedbackPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-background-secondary border border-border-default rounded-lg p-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
          <span className="text-text-secondary">Analyzing your solution...</span>
        </div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="bg-background-secondary border border-border-default rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">📝</div>
        <p className="text-text-secondary">Submit your solution to receive AI feedback</p>
        <p className="text-sm text-text-muted mt-1">Your rating won&apos;t be affected in practice mode</p>
      </div>
    );
  }

  const getScoreColor = (value: number): string => {
    if (value >= 8) return "text-accent-lime";
    if (value >= 6) return "text-yellow-400";
    if (value >= 4) return "text-accent-magenta";
    return "text-accent-red";
  };

  const getScoreLabel = (value: number): string => {
    if (value >= 9) return "Excellent";
    if (value >= 7) return "Good";
    if (value >= 5) return "Fair";
    if (value >= 3) return "Needs Work";
    return "Poor";
  };

  const getOverallGrade = (totalScore: number): { grade: string; color: string } => {
    if (totalScore >= 90) return { grade: "A+", color: "text-accent-lime" };
    if (totalScore >= 80) return { grade: "A", color: "text-accent-lime" };
    if (totalScore >= 70) return { grade: "B", color: "text-yellow-400" };
    if (totalScore >= 60) return { grade: "C", color: "text-yellow-400" };
    if (totalScore >= 50) return { grade: "D", color: "text-accent-magenta" };
    return { grade: "F", color: "text-accent-red" };
  };

  const overallGrade = score !== null ? getOverallGrade(score) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-background-secondary border border-border-default rounded-lg overflow-hidden">
      {/* Header with Overall Score */}
      <div className="bg-background-primary/50 px-6 py-4 border-b border-border-default">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <h3 className="font-semibold text-text-primary text-lg">AI Feedback</h3>
          </div>
          {score !== null && overallGrade && (
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${overallGrade.color}`}>{overallGrade.grade}</span>
              <div className="text-right">
                <div className={`text-2xl font-bold ${overallGrade.color}`}>{score}</div>
                <div className="text-xs text-text-muted">out of 100</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {/* Correctness */}
          <div className="text-center">
            <div className="text-sm text-text-muted mb-2">Correctness</div>
            <div className={`text-2xl font-bold ${getScoreColor(feedback.correctness)}`}>{feedback.correctness.toFixed(1)}</div>
            <div className="text-xs text-text-muted">{getScoreLabel(feedback.correctness)}</div>
            <div className="mt-2 h-1.5 bg-background-primary rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${feedback.correctness * 10}%` }} transition={{ duration: 0.5, delay: 0.1 }} className={`h-full ${feedback.correctness >= 8 ? "bg-accent-lime" : feedback.correctness >= 6 ? "bg-yellow-400" : "bg-accent-red"}`} />
            </div>
          </div>

          {/* Efficiency */}
          <div className="text-center">
            <div className="text-sm text-text-muted mb-2">Efficiency</div>
            <div className={`text-2xl font-bold ${getScoreColor(feedback.efficiency)}`}>{feedback.efficiency.toFixed(1)}</div>
            <div className="text-xs text-text-muted">{getScoreLabel(feedback.efficiency)}</div>
            <div className="mt-2 h-1.5 bg-background-primary rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${feedback.efficiency * 10}%` }} transition={{ duration: 0.5, delay: 0.2 }} className={`h-full ${feedback.efficiency >= 8 ? "bg-accent-lime" : feedback.efficiency >= 6 ? "bg-yellow-400" : "bg-accent-red"}`} />
            </div>
          </div>

          {/* Quality */}
          <div className="text-center">
            <div className="text-sm text-text-muted mb-2">Code Quality</div>
            <div className={`text-2xl font-bold ${getScoreColor(feedback.quality)}`}>{feedback.quality.toFixed(1)}</div>
            <div className="text-xs text-text-muted">{getScoreLabel(feedback.quality)}</div>
            <div className="mt-2 h-1.5 bg-background-primary rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${feedback.quality * 10}%` }} transition={{ duration: 0.5, delay: 0.3 }} className={`h-full ${feedback.quality >= 8 ? "bg-accent-lime" : feedback.quality >= 6 ? "bg-yellow-400" : "bg-accent-red"}`} />
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {feedback.suggestions.length > 0 && (
          <div className="border-t border-border-default pt-4">
            <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span>💡</span>
              <span>Improvement Suggestions</span>
            </h4>
            <ul className="space-y-2">
              {feedback.suggestions.map((suggestion, index) => (
                <motion.li key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + index * 0.1 }} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-accent-cyan mt-0.5">•</span>
                  <span>{suggestion}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* No Rating Impact Notice */}
        <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-3 text-center">
          <p className="text-sm text-accent-cyan">✨ Practice mode - your rating is not affected</p>
        </div>
      </div>
    </motion.div>
  );
}

export default PracticeFeedbackPanel;

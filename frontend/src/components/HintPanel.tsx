"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PracticeHint } from "@/lib/api";

interface HintPanelProps {
  currentHintLevel: number;
  hints: PracticeHint[];
  onRequestHint: (level: number) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * HintPanel Component
 * Display hint button with level indicator and progressive reveal
 * Requirements: 17.6
 */
export function HintPanel({ currentHintLevel, hints, onRequestHint, isLoading = false, disabled = false }: HintPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxHintLevel = 3;

  const nextHintLevel = currentHintLevel + 1;
  const canRequestMoreHints = nextHintLevel <= maxHintLevel && !disabled;

  const getHintLevelLabel = (level: number): string => {
    switch (level) {
      case 1:
        return "General Approach";
      case 2:
        return "Algorithm Hint";
      case 3:
        return "Partial Solution";
      default:
        return `Hint ${level}`;
    }
  };

  const getHintLevelIcon = (level: number): string => {
    switch (level) {
      case 1:
        return "💡";
      case 2:
        return "🔧";
      case 3:
        return "📝";
      default:
        return "💡";
    }
  };

  return (
    <div className="bg-background-secondary border border-border-default rounded-lg overflow-hidden">
      {/* Header */}
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-background-primary/50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-xl">💡</span>
          <span className="font-semibold text-text-primary">Hints</span>
          {/* Progress indicator */}
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((level) => (
              <div key={level} className={`w-2 h-2 rounded-full transition-colors ${level <= currentHintLevel ? "bg-accent-cyan" : "bg-background-primary border border-border-default"}`} />
            ))}
          </div>
          <span className="text-sm text-text-muted">
            {currentHintLevel}/{maxHintLevel}
          </span>
        </div>
        <motion.svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4">
              {/* Request Hint Button */}
              {canRequestMoreHints && (
                <button onClick={() => onRequestHint(nextHintLevel)} disabled={isLoading || disabled} className={`w-full px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${isLoading || disabled ? "bg-background-primary text-text-muted cursor-not-allowed" : "bg-accent-cyan/20 border border-accent-cyan text-accent-cyan hover:bg-accent-cyan/30"}`}>
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
                      <span>Loading hint...</span>
                    </>
                  ) : (
                    <>
                      <span>{getHintLevelIcon(nextHintLevel)}</span>
                      <span>Get {getHintLevelLabel(nextHintLevel)}</span>
                      <span className="text-sm opacity-70">({nextHintLevel}/3)</span>
                    </>
                  )}
                </button>
              )}

              {currentHintLevel === maxHintLevel && <div className="text-center py-2 text-text-muted text-sm">All hints revealed</div>}

              {/* Hint List */}
              {hints.length > 0 && (
                <div className="space-y-3">
                  {hints.map((hint) => (
                    <motion.div key={hint.level} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-background-primary border border-border-default rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{getHintLevelIcon(hint.level)}</span>
                        <span className="font-semibold text-text-primary text-sm">{getHintLevelLabel(hint.level)}</span>
                        <span className="text-xs text-text-muted">Level {hint.level}</span>
                      </div>
                      <div className="text-sm text-text-secondary whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
                        {hint.content.split("\n").map((line, i) => {
                          // Handle markdown-style formatting
                          if (line.startsWith("**") && line.endsWith("**")) {
                            return (
                              <p key={i} className="font-semibold text-text-primary mt-2 mb-1">
                                {line.replace(/\*\*/g, "")}
                              </p>
                            );
                          }
                          if (line.startsWith("```")) {
                            return null; // Skip code fence markers
                          }
                          if (line.startsWith("•") || line.startsWith("-")) {
                            return (
                              <p key={i} className="ml-2 text-text-secondary">
                                {line}
                              </p>
                            );
                          }
                          if (line.trim() === "") {
                            return <br key={i} />;
                          }
                          return (
                            <p key={i} className="text-text-secondary">
                              {line}
                            </p>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* No hints yet message */}
              {hints.length === 0 && currentHintLevel === 0 && (
                <div className="text-center py-4 text-text-muted text-sm">
                  <p>Need help? Request a hint to get started.</p>
                  <p className="text-xs mt-1 opacity-70">Hints progress from general to specific.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HintPanel;

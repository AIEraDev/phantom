"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface HintResponse {
  id: string;
  content: string;
  level: number;
  levelIndicator: string;
  consumed: boolean;
  cooldownRemaining: number;
}

export interface HintStatus {
  canRequest: boolean;
  hintsUsed: number;
  hintsRemaining: number;
  cooldownRemaining: number;
}

interface HintOverlayProps {
  matchId: string;
  hintStatus: HintStatus;
  currentHint: HintResponse | null;
  hints: HintResponse[];
  onRequestHint: () => void;
  onClose: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * HintOverlay Component
 * Non-intrusive overlay positioned at top-right of editor
 * Shows hint level indicator, cooldown countdown, and hint content with syntax highlighting
 * Requirements: 1.4, 2.4
 */
export function HintOverlay({ matchId, hintStatus, currentHint, hints, onRequestHint, onClose, isLoading = false, error = null }: HintOverlayProps) {
  const [cooldown, setCooldown] = useState(hintStatus.cooldownRemaining);
  const [isExpanded, setIsExpanded] = useState(true);

  // Update cooldown countdown
  useEffect(() => {
    setCooldown(hintStatus.cooldownRemaining);
  }, [hintStatus.cooldownRemaining]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const canRequestHint = hintStatus.canRequest && cooldown === 0 && !isLoading;
  const maxHints = 3;

  const getHintLevelLabel = (level: number): string => {
    switch (level) {
      case 1:
        return "Subtle Hint";
      case 2:
        return "Moderate Hint";
      case 3:
        return "Direct Hint";
      default:
        return `Hint ${level}`;
    }
  };

  const getHintLevelDescription = (level: number): string => {
    switch (level) {
      case 1:
        return "General approach or algorithm category";
      case 2:
        return "Specific data structure suggestions or edge cases";
      case 3:
        return "Pseudocode or step-by-step logic outline";
      default:
        return "";
    }
  };

  const formatCooldown = (seconds: number): string => {
    return `${seconds}s`;
  };

  // Render code blocks with syntax highlighting
  const renderHintContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        // Code block
        const codeContent = part.slice(3, -3);
        const firstNewline = codeContent.indexOf("\n");
        const language = firstNewline > 0 ? codeContent.slice(0, firstNewline).trim() : "";
        const code = firstNewline > 0 ? codeContent.slice(firstNewline + 1) : codeContent;

        return (
          <pre key={index} className="bg-black/40 border border-white/10 rounded-lg p-4 my-3 overflow-x-auto font-code text-sm">
            {language && <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">{language}</div>}
            <code className="text-accent-lime">{code}</code>
          </pre>
        );
      }

      // Regular text with markdown-style formatting
      return (
        <div key={index} className="text-text-secondary leading-relaxed">
          {part.split("\n").map((line, lineIndex) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return (
                <p key={lineIndex} className="font-semibold text-white mt-3 mb-1">
                  {line.replace(/\*\*/g, "")}
                </p>
              );
            }
            if (line.startsWith("- ") || line.startsWith("• ")) {
              return (
                <p key={lineIndex} className="ml-4 text-text-secondary flex items-start gap-2">
                  <span className="text-accent-cyan">•</span>
                  <span>{line.slice(2)}</span>
                </p>
              );
            }
            if (line.trim() === "") {
              return <br key={lineIndex} />;
            }
            // Inline code
            const inlineCodeParts = line.split(/(`[^`]+`)/g);
            return (
              <p key={lineIndex}>
                {inlineCodeParts.map((codePart, codeIndex) => {
                  if (codePart.startsWith("`") && codePart.endsWith("`")) {
                    return (
                      <code key={codeIndex} className="bg-black/30 px-1.5 py-0.5 rounded text-accent-cyan font-code text-sm">
                        {codePart.slice(1, -1)}
                      </code>
                    );
                  }
                  return <span key={codeIndex}>{codePart}</span>;
                })}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute top-4 right-4 z-50 w-80 max-w-[calc(100%-2rem)]">
      <div className="glass-card-strong rounded-xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent-cyan/20 to-accent-magenta/20 px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
                <span className="text-lg">💡</span>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">AI Coach</h3>
                <div className="flex items-center gap-2">
                  {/* Hint level indicator - Requirements 2.4 */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((level) => (
                      <div key={level} className={`w-2 h-2 rounded-full transition-all duration-300 ${level <= hintStatus.hintsUsed ? "bg-accent-cyan shadow-[0_0_6px_rgba(0,240,255,0.6)]" : "bg-white/20"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-text-muted font-code">
                    {hintStatus.hintsUsed}/{maxHints}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <motion.svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <svg className="w-4 h-4 text-text-muted hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* Error message */}
                {error && (
                  <div className="bg-accent-red/20 border border-accent-red/30 rounded-lg p-3">
                    <p className="text-accent-red text-sm">{error}</p>
                  </div>
                )}

                {/* Request hint button */}
                {hintStatus.hintsRemaining > 0 && (
                  <div className="space-y-2">
                    <button onClick={onRequestHint} disabled={!canRequestHint} className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${canRequestHint ? "bg-accent-cyan/20 border border-accent-cyan text-accent-cyan hover:bg-accent-cyan/30 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]" : "bg-white/5 border border-white/10 text-text-muted cursor-not-allowed"}`}>
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
                          <span>Generating hint...</span>
                        </>
                      ) : cooldown > 0 ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Cooldown: {formatCooldown(cooldown)}</span>
                        </>
                      ) : (
                        <>
                          <span>💡</span>
                          <span>Get {getHintLevelLabel(hintStatus.hintsUsed + 1)}</span>
                          <span className="text-xs opacity-70">({hintStatus.hintsUsed + 1}/3)</span>
                        </>
                      )}
                    </button>
                    {hintStatus.hintsRemaining > 0 && !isLoading && cooldown === 0 && <p className="text-xs text-text-muted text-center">{getHintLevelDescription(hintStatus.hintsUsed + 1)}</p>}
                    <p className="text-xs text-accent-yellow/80 text-center">⚠️ Each hint applies a 5% score penalty</p>
                  </div>
                )}

                {/* Hint limit reached */}
                {hintStatus.hintsRemaining === 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                    <p className="text-text-muted text-sm">All hints used (3/3)</p>
                  </div>
                )}

                {/* Display hints */}
                {hints.length > 0 && (
                  <div className="space-y-3">
                    {hints.map((hint, index) => (
                      <motion.div key={hint.id || index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="bg-black/20 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${hint.level === 1 ? "bg-accent-cyan/20 text-accent-cyan" : hint.level === 2 ? "bg-accent-yellow/20 text-accent-yellow" : "bg-accent-magenta/20 text-accent-magenta"}`}>{hint.level}</div>
                          <span className="font-semibold text-white text-sm">{getHintLevelLabel(hint.level)}</span>
                          <span className="text-xs text-text-muted ml-auto">{hint.levelIndicator}</span>
                        </div>
                        <div className="text-sm">{renderHintContent(hint.content)}</div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* No hints yet */}
                {hints.length === 0 && hintStatus.hintsUsed === 0 && !error && (
                  <div className="text-center py-4">
                    <p className="text-text-muted text-sm">Stuck? Request a hint to get guidance.</p>
                    <p className="text-xs text-text-muted mt-1 opacity-70">Hints progress from subtle to direct.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default HintOverlay;

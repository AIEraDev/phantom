"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface MatchAnalysis {
  id: string;
  matchId: string;
  userId: string;
  timeComplexity: {
    detected: string;
    optimal: string;
    explanation: string;
  };
  spaceComplexity: {
    detected: string;
    optimal: string;
    explanation: string;
  };
  readabilityScore: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
  algorithmicApproach: {
    detected: string;
    suggested: string;
    explanation: string;
  };
  suggestions: string[];
  bugAnalysis: {
    hasBugs: boolean;
    bugs: Array<{
      location: string;
      description: string;
      suggestion: string;
    }>;
  };
  hintsUsed: number;
  createdAt: Date | string;
}

interface PostMatchAnalysisProps {
  analysis: MatchAnalysis;
  isWinner: boolean;
  onViewDashboard?: () => void;
}

/**
 * PostMatchAnalysis Component
 * Displays comprehensive post-match code analysis with expandable sections
 * Requirements: 3.2, 3.4, 3.5, 3.6
 */
export function PostMatchAnalysis({ analysis, isWinner, onViewDashboard }: PostMatchAnalysisProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["complexity", "suggestions"]));

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getComplexityColor = (detected: string, optimal: string): string => {
    if (detected === optimal) return "text-accent-lime";
    // Simple heuristic: if detected has higher order, it's worse
    const order = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(n³)", "O(2^n)"];
    const detectedIndex = order.findIndex((o) => detected.includes(o.replace("²", "^2").replace("³", "^3")));
    const optimalIndex = order.findIndex((o) => optimal.includes(o.replace("²", "^2").replace("³", "^3")));
    if (detectedIndex <= optimalIndex) return "text-accent-lime";
    if (detectedIndex <= optimalIndex + 1) return "text-accent-yellow";
    return "text-accent-red";
  };

  const getReadabilityColor = (score: number): string => {
    if (score >= 8) return "text-accent-lime";
    if (score >= 6) return "text-accent-yellow";
    return "text-accent-red";
  };

  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent-cyan/20 to-accent-magenta/20 px-6 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Code Analysis</h2>
              <p className="text-sm text-text-secondary">{isWinner ? "Great job! Here's how you can improve further." : "Here's what you can learn from this match."}</p>
            </div>
          </div>
          {analysis.hintsUsed > 0 && (
            <div className="px-3 py-1 bg-accent-yellow/20 border border-accent-yellow/30 rounded-lg">
              <span className="text-xs text-accent-yellow font-bold">
                {analysis.hintsUsed} hint{analysis.hintsUsed > 1 ? "s" : ""} used
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Complexity Section - Requirements 3.2 */}
        <ExpandableSection title="Complexity Analysis" icon="📊" isExpanded={expandedSections.has("complexity")} onToggle={() => toggleSection("complexity")}>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Time Complexity */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white">Time Complexity</span>
                <div className="flex items-center gap-2">
                  <span className={`font-code font-bold ${getComplexityColor(analysis.timeComplexity.detected, analysis.timeComplexity.optimal)}`}>{analysis.timeComplexity.detected}</span>
                </div>
              </div>
              {/* Visual comparison */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-xs text-text-muted mb-1">Your Solution</div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${analysis.timeComplexity.detected === analysis.timeComplexity.optimal ? "bg-accent-lime" : "bg-accent-yellow"}`} style={{ width: "70%" }} />
                  </div>
                </div>
                <div className="text-text-muted">vs</div>
                <div className="flex-1">
                  <div className="text-xs text-text-muted mb-1">Optimal</div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-lime rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>
              </div>
              <div className="text-xs text-text-muted">
                Optimal: <span className="text-accent-lime font-code">{analysis.timeComplexity.optimal}</span>
              </div>
              <p className="text-sm text-text-secondary mt-2">{analysis.timeComplexity.explanation}</p>
            </div>

            {/* Space Complexity */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white">Space Complexity</span>
                <div className="flex items-center gap-2">
                  <span className={`font-code font-bold ${getComplexityColor(analysis.spaceComplexity.detected, analysis.spaceComplexity.optimal)}`}>{analysis.spaceComplexity.detected}</span>
                </div>
              </div>
              {/* Visual comparison */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-xs text-text-muted mb-1">Your Solution</div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${analysis.spaceComplexity.detected === analysis.spaceComplexity.optimal ? "bg-accent-lime" : "bg-accent-yellow"}`} style={{ width: "70%" }} />
                  </div>
                </div>
                <div className="text-text-muted">vs</div>
                <div className="flex-1">
                  <div className="text-xs text-text-muted mb-1">Optimal</div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-lime rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>
              </div>
              <div className="text-xs text-text-muted">
                Optimal: <span className="text-accent-lime font-code">{analysis.spaceComplexity.optimal}</span>
              </div>
              <p className="text-sm text-text-secondary mt-2">{analysis.spaceComplexity.explanation}</p>
            </div>
          </div>
        </ExpandableSection>

        {/* Algorithmic Approach Section */}
        <ExpandableSection title="Algorithmic Approach" icon="🧠" isExpanded={expandedSections.has("approach")} onToggle={() => toggleSection("approach")}>
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <div className="text-xs text-text-muted mb-1">Your Approach</div>
                <div className="px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                  <span className="font-bold text-white">{analysis.algorithmicApproach.detected}</span>
                </div>
              </div>
              <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="flex-1">
                <div className="text-xs text-text-muted mb-1">Suggested Approach</div>
                <div className="px-3 py-2 bg-accent-cyan/10 rounded-lg border border-accent-cyan/30">
                  <span className="font-bold text-accent-cyan">{analysis.algorithmicApproach.suggested}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-text-secondary">{analysis.algorithmicApproach.explanation}</p>
          </div>
        </ExpandableSection>

        {/* Readability Section */}
        <ExpandableSection title="Code Readability" icon="📖" isExpanded={expandedSections.has("readability")} onToggle={() => toggleSection("readability")} badge={<span className={`font-bold ${getReadabilityColor(analysis.readabilityScore.score)}`}>{analysis.readabilityScore.score}/10</span>}>
          <div className="space-y-4">
            {/* Score bar */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">Readability Score</span>
                <span className={`text-2xl font-bold ${getReadabilityColor(analysis.readabilityScore.score)}`}>{analysis.readabilityScore.score}</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${analysis.readabilityScore.score >= 8 ? "bg-accent-lime" : analysis.readabilityScore.score >= 6 ? "bg-accent-yellow" : "bg-accent-red"}`} style={{ width: `${analysis.readabilityScore.score * 10}%` }} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Strengths */}
              {analysis.readabilityScore.strengths.length > 0 && (
                <div className="bg-accent-lime/10 rounded-xl p-4 border border-accent-lime/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-accent-lime">✓</span>
                    <span className="font-bold text-accent-lime text-sm">Strengths</span>
                  </div>
                  <ul className="space-y-2">
                    {analysis.readabilityScore.strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-text-secondary flex items-start gap-2">
                        <span className="text-accent-lime mt-1">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {analysis.readabilityScore.improvements.length > 0 && (
                <div className="bg-accent-yellow/10 rounded-xl p-4 border border-accent-yellow/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-accent-yellow">↑</span>
                    <span className="font-bold text-accent-yellow text-sm">Areas to Improve</span>
                  </div>
                  <ul className="space-y-2">
                    {analysis.readabilityScore.improvements.map((improvement, index) => (
                      <li key={index} className="text-sm text-text-secondary flex items-start gap-2">
                        <span className="text-accent-yellow mt-1">•</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </ExpandableSection>

        {/* Suggestions Section - Requirements 3.4 */}
        <ExpandableSection title="Improvement Suggestions" icon="💡" isExpanded={expandedSections.has("suggestions")} onToggle={() => toggleSection("suggestions")} badge={<span className="text-xs text-text-muted">{analysis.suggestions.length} tips</span>}>
          <div className="space-y-3">
            {analysis.suggestions.map((suggestion, index) => (
              <motion.div key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="bg-black/20 rounded-xl p-4 border border-white/5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent-cyan font-bold text-sm">{index + 1}</span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{suggestion}</p>
              </motion.div>
            ))}
          </div>
        </ExpandableSection>

        {/* Bug Analysis Section - Requirements 3.5 */}
        {analysis.bugAnalysis.hasBugs && (
          <ExpandableSection
            title="Bug Analysis"
            icon="🐛"
            isExpanded={expandedSections.has("bugs")}
            onToggle={() => toggleSection("bugs")}
            badge={
              <span className="px-2 py-0.5 bg-accent-red/20 text-accent-red text-xs font-bold rounded">
                {analysis.bugAnalysis.bugs.length} issue{analysis.bugAnalysis.bugs.length > 1 ? "s" : ""}
              </span>
            }
          >
            <div className="space-y-3">
              {analysis.bugAnalysis.bugs.map((bug, index) => (
                <div key={index} className="bg-accent-red/10 rounded-xl p-4 border border-accent-red/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-accent-red">⚠️</span>
                    <span className="font-bold text-white text-sm">{bug.location}</span>
                  </div>
                  <p className="text-sm text-text-secondary mb-3">{bug.description}</p>
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-accent-lime mb-1 font-bold">Suggestion:</div>
                    <p className="text-sm text-text-secondary">{bug.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </ExpandableSection>
        )}

        {/* Winner highlight - Requirements 3.6 */}
        {isWinner && (
          <div className="bg-gradient-to-r from-accent-lime/20 to-accent-cyan/20 rounded-xl p-4 border border-accent-lime/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <h4 className="font-bold text-white">Victory!</h4>
                <p className="text-sm text-text-secondary">Great performance! Keep practicing to maintain your edge.</p>
              </div>
            </div>
          </div>
        )}

        {/* View Dashboard Link */}
        {onViewDashboard && (
          <button onClick={onViewDashboard} className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all duration-300 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Full Coaching Dashboard
          </button>
        )}
      </div>
    </div>
  );
}

interface ExpandableSectionProps {
  title: string;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function ExpandableSection({ title, icon, isExpanded, onToggle, badge, children }: ExpandableSectionProps) {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <span className="font-bold text-white">{title}</span>
          {badge}
        </div>
        <motion.svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PostMatchAnalysis;

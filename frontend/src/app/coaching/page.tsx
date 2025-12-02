"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { coachApi, CoachingSummary, SkillTimeline, CategoryFeedback, TrendData, MatchAnalysis } from "@/lib/api";
import { WeaknessSummary } from "@/components/WeaknessSummary";
import { PostMatchAnalysis } from "@/components/PostMatchAnalysis";

type CategoryFilter = "all" | "time_complexity" | "space_complexity" | "readability" | "patterns";

/**
 * CoachingDashboard Page
 * Displays coaching summary, timeline, feedback, and trends
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export default function CoachingDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CoachingSummary | null>(null);
  const [timeline, setTimeline] = useState<SkillTimeline | null>(null);
  const [feedback, setFeedback] = useState<CategoryFeedback[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<{ analysis: MatchAnalysis; hints: any[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [summaryRes, timelineRes, feedbackRes, trendsRes] = await Promise.all([coachApi.getDashboardSummary(), coachApi.getTimeline(), coachApi.getCategorizedFeedback(), coachApi.getTrends()]);

        setSummary(summaryRes.summary);
        setTimeline(timelineRes.timeline);
        setFeedback(feedbackRes.feedback);
        setTrends(trendsRes.trends);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleViewMatchDetail = async (matchId: string) => {
    try {
      setLoadingDetail(true);
      setSelectedMatchId(matchId);
      const detail = await coachApi.getMatchDetail(matchId);
      setMatchDetail(detail);
    } catch (err) {
      console.error("Failed to load match detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeMatchDetail = () => {
    setSelectedMatchId(null);
    setMatchDetail(null);
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

  const filteredFeedback = selectedCategory === "all" ? feedback : feedback.filter((f) => f.category === selectedCategory);

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-background-primary flex items-center justify-center relative overflow-hidden">
          <div
            className="fixed inset-0 z-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
              backgroundSize: "4rem 4rem",
            }}
          />
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="w-16 h-16 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin" />
            <span className="text-accent-cyan font-code animate-pulse">LOADING COACHING DATA...</span>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-background-primary flex items-center justify-center relative overflow-hidden">
          <div className="text-center relative z-10">
            <div className="text-accent-red text-xl mb-4 font-bold">{error}</div>
            <button onClick={() => router.push("/dashboard")} className="px-6 py-3 bg-accent-cyan text-background-primary font-bold rounded-lg hover:bg-accent-cyan/90 transition-colors">
              Return to Dashboard
            </button>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-background-primary text-white p-4 sm:p-8 relative overflow-hidden selection:bg-accent-cyan/20 selection:text-accent-cyan">
        {/* Background Grid Pattern */}
        <div
          className="fixed inset-0 z-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
            backgroundSize: "4rem 4rem",
          }}
        />

        {/* Ambient Glow */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] blur-[120px] rounded-full pointer-events-none z-0 opacity-20 bg-accent-cyan" />

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header */}
          <div className="mb-8">
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-4xl sm:text-5xl font-header font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-magenta">AI Coaching Dashboard</h1>
            <p className="text-text-secondary mt-2">Track your progress and improve your coding skills</p>
          </div>

          {/* Summary Cards - Requirements 5.1 */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard icon="💡" label="Hints Used" value={summary.totalHintsUsed} color="cyan" />
              <SummaryCard icon="📊" label="Matches Analyzed" value={summary.totalMatchesAnalyzed} color="magenta" />
              <SummaryCard icon="📈" label="Improvement Score" value={`${summary.improvementScore}%`} color="lime" />
              <SummaryCard icon="⭐" label="Avg Analysis Score" value={summary.averageAnalysisScore.toFixed(1)} color="yellow" />
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Timeline and Trends */}
            <div className="lg:col-span-2 space-y-8">
              {/* Timeline Chart - Requirements 5.2 */}
              {timeline && timeline.entries.length > 0 && (
                <div className="glass-card rounded-2xl border border-white/10 p-6">
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-2xl">📈</span>
                    Skill Progression Timeline
                  </h2>
                  <TimelineChart entries={timeline.entries} />
                </div>
              )}

              {/* Trend Charts - Requirements 5.5 */}
              {trends.length > 0 && (
                <div className="glass-card rounded-2xl border border-white/10 p-6">
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    Improvement Trends (Last 10 Matches)
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {trends.map((trend) => (
                      <TrendCard key={trend.category} trend={trend} />
                    ))}
                  </div>
                </div>
              )}

              {/* Category Feedback - Requirements 5.3 */}
              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="text-2xl">💬</span>
                  Categorized Feedback
                </h2>

                {/* Category Filter Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {["all", "time_complexity", "space_complexity", "readability", "patterns"].map((category) => (
                    <button key={category} onClick={() => setSelectedCategory(category as CategoryFilter)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${selectedCategory === category ? "bg-accent-cyan text-background-primary" : "bg-white/5 text-text-secondary hover:bg-white/10"}`}>
                      {category === "all" ? "All" : getCategoryLabel(category)}
                    </button>
                  ))}
                </div>

                {/* Feedback List */}
                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {filteredFeedback.map((categoryFeedback) => (
                    <div key={categoryFeedback.category}>
                      {selectedCategory === "all" && <h3 className="text-sm font-bold text-accent-cyan mb-2">{getCategoryLabel(categoryFeedback.category)}</h3>}
                      {categoryFeedback.feedbackItems.map((item, index) => (
                        <div key={`${categoryFeedback.category}-${index}`} className="bg-black/20 rounded-lg p-4 border border-white/5 mb-2">
                          <div className="flex items-center justify-between mb-2">
                            <button onClick={() => handleViewMatchDetail(item.matchId)} className="text-xs text-accent-cyan hover:underline">
                              View Match
                            </button>
                            <span className="text-xs text-text-muted">{new Date(item.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-text-secondary">{item.feedback}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                  {filteredFeedback.length === 0 && <div className="text-center py-8 text-text-muted">No feedback available for this category</div>}
                </div>
              </div>
            </div>

            {/* Right Column - Weakness Summary */}
            <div className="space-y-8">
              <WeaknessSummary />

              {/* Quick Stats */}
              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  Quick Tips
                </h2>
                <div className="space-y-3">
                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <p className="text-sm text-text-secondary">💡 Focus on your weakest areas first for maximum improvement</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <p className="text-sm text-text-secondary">📊 Review your past matches to identify recurring patterns</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <p className="text-sm text-text-secondary">🎮 Practice mode helps you improve without rating pressure</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Match Detail Modal - Requirements 5.4 */}
        {selectedMatchId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={closeMatchDetail}>
            <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
              {loadingDetail ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-text-secondary">Loading match details...</p>
                </div>
              ) : matchDetail ? (
                <div className="relative">
                  <button onClick={closeMatchDetail} className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <PostMatchAnalysis analysis={matchDetail.analysis} isWinner={false} />
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <p className="text-accent-red">Failed to load match details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

interface SummaryCardProps {
  icon: string;
  label: string;
  value: string | number;
  color: "cyan" | "magenta" | "lime" | "yellow";
}

function SummaryCard({ icon, label, value, color }: SummaryCardProps) {
  const colorClasses = {
    cyan: "from-accent-cyan/20 to-accent-cyan/5 border-accent-cyan/30",
    magenta: "from-accent-magenta/20 to-accent-magenta/5 border-accent-magenta/30",
    lime: "from-accent-lime/20 to-accent-lime/5 border-accent-lime/30",
    yellow: "from-accent-yellow/20 to-accent-yellow/5 border-accent-yellow/30",
  };

  return (
    <div className={`glass-card rounded-xl p-4 border bg-gradient-to-br ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

interface TimelineChartProps {
  entries: Array<{
    matchId: string;
    date: string;
    scores: {
      time_complexity: number;
      space_complexity: number;
      readability: number;
      patterns: number;
    };
  }>;
}

function TimelineChart({ entries }: TimelineChartProps) {
  if (entries.length === 0) {
    return <div className="text-center py-8 text-text-muted">No timeline data available yet</div>;
  }

  const maxScore = 100;
  const chartHeight = 200;

  // Calculate average score for each entry
  const dataPoints = entries.map((entry) => {
    const avg = (entry.scores.time_complexity + entry.scores.space_complexity + entry.scores.readability + entry.scores.patterns) / 4;
    return {
      date: new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: avg,
    };
  });

  return (
    <div className="relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-text-muted">
        <span>100</span>
        <span>50</span>
        <span>0</span>
      </div>

      {/* Chart area */}
      <div className="ml-10 relative" style={{ height: chartHeight }}>
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-t border-white/5" />
          ))}
        </div>

        {/* Data points and line */}
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          {/* Line */}
          <polyline
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="2"
            points={dataPoints
              .map((point, index) => {
                const x = (index / (dataPoints.length - 1 || 1)) * 100;
                const y = 100 - (point.score / maxScore) * 100;
                return `${x}%,${y}%`;
              })
              .join(" ")}
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00f0ff" />
              <stop offset="100%" stopColor="#ff003c" />
            </linearGradient>
          </defs>
          {/* Data points */}
          {dataPoints.map((point, index) => {
            const x = (index / (dataPoints.length - 1 || 1)) * 100;
            const y = 100 - (point.score / maxScore) * 100;
            return <circle key={index} cx={`${x}%`} cy={`${y}%`} r="4" fill="#00f0ff" className="hover:r-6 transition-all cursor-pointer" />;
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="ml-10 flex justify-between mt-2 text-xs text-text-muted">
        {dataPoints.map((point, index) => (
          <span key={index}>{point.date}</span>
        ))}
      </div>
    </div>
  );
}

interface TrendCardProps {
  trend: TrendData;
}

function TrendCard({ trend }: TrendCardProps) {
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      time_complexity: "Time Complexity",
      space_complexity: "Space Complexity",
      readability: "Readability",
      patterns: "Patterns",
    };
    return labels[category] || category;
  };

  const getTrendIcon = (t: "improving" | "stable" | "declining"): string => {
    switch (t) {
      case "improving":
        return "📈";
      case "declining":
        return "📉";
      default:
        return "➡️";
    }
  };

  const getTrendColor = (t: "improving" | "stable" | "declining"): string => {
    switch (t) {
      case "improving":
        return "text-accent-lime";
      case "declining":
        return "text-accent-red";
      default:
        return "text-accent-yellow";
    }
  };

  // Calculate trend percentage
  const firstScore = trend.dataPoints[0]?.score || 0;
  const lastScore = trend.dataPoints[trend.dataPoints.length - 1]?.score || 0;
  const change = lastScore - firstScore;
  const changePercent = firstScore > 0 ? ((change / firstScore) * 100).toFixed(1) : "0";

  return (
    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-white text-sm">{getCategoryLabel(trend.category)}</span>
        <div className={`flex items-center gap-1 ${getTrendColor(trend.trend)}`}>
          <span>{getTrendIcon(trend.trend)}</span>
          <span className="text-sm font-bold">
            {change >= 0 ? "+" : ""}
            {changePercent}%
          </span>
        </div>
      </div>

      {/* Mini chart */}
      <div className="h-12 relative">
        <svg className="w-full h-full overflow-visible">
          <polyline
            fill="none"
            stroke={trend.trend === "improving" ? "#39ff14" : trend.trend === "declining" ? "#ff003c" : "#fcee0a"}
            strokeWidth="2"
            points={trend.dataPoints
              .map((point, index) => {
                const x = (index / (trend.dataPoints.length - 1 || 1)) * 100;
                const y = 100 - point.score;
                return `${x}%,${y}%`;
              })
              .join(" ")}
          />
        </svg>
      </div>

      <div className="flex justify-between text-xs text-text-muted mt-2">
        <span>Match 1</span>
        <span>Match {trend.dataPoints.length}</span>
      </div>
    </div>
  );
}

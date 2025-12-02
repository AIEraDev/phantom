"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import VictoryConfetti from "@/components/VictoryConfetti";
import { PostMatchAnalysis, MatchAnalysis } from "@/components/PostMatchAnalysis";
import { coachApi } from "@/lib/api";

interface ScoreBreakdown {
  correctness: number;
  efficiency: number;
  quality: number;
  creativity: number;
}

interface PlayerScore {
  totalScore: number;
  correctnessScore: number;
  efficiencyScore: number;
  qualityScore: number;
  creativityScore: number;
  breakdown: ScoreBreakdown;
}

interface Player {
  id: string;
  username: string;
  rating: number;
}

interface Challenge {
  id: string;
  title: string;
  difficulty: string;
}

interface MatchResult {
  id: string;
  player1: Player;
  player2: Player;
  player1Score: PlayerScore;
  player2Score: PlayerScore;
  player1Code: string;
  player2Code: string;
  player1Language: string;
  player2Language: string;
  player1Feedback: string;
  player2Feedback: string;
  winnerId: string | null;
  challenge: Challenge;
  duration: number;
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const matchId = params.matchId as string;

  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCodeComparison, setShowCodeComparison] = useState(false);
  const [animateScores, setAnimateScores] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // AI Analysis state - Requirements 3.1
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    const fetchMatchResult = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/${matchId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch match results");
        }

        const data = await response.json();
        const match = data.match;

        // Parse score breakdown from feedback text
        const parseScoreBreakdown = (feedback: string, totalScore: number) => {
          const breakdown = { correctness: 0, efficiency: 0, quality: 0, creativity: 0 };

          // Parse patterns like "**Correctness (140 points):**" or "Correctness (140 points):"
          const correctnessMatch = feedback.match(/Correctness\s*\((\d+)\s*points?\)/i);
          const efficiencyMatch = feedback.match(/Efficiency\s*\((\d+)\s*points?\)/i);
          const qualityMatch = feedback.match(/(?:Code\s*)?Quality\s*\((\d+)\s*points?\)/i);
          const creativityMatch = feedback.match(/Creativity\s*\((\d+)\s*points?\)/i);

          if (correctnessMatch) breakdown.correctness = parseInt(correctnessMatch[1]);
          if (efficiencyMatch) breakdown.efficiency = parseInt(efficiencyMatch[1]);
          if (qualityMatch) breakdown.quality = parseInt(qualityMatch[1]);
          if (creativityMatch) breakdown.creativity = parseInt(creativityMatch[1]);

          // Convert points to 0-10 scale (correctness: 400 max, efficiency: 300 max, quality: 200 max, creativity: 100 max)
          return {
            totalScore,
            correctnessScore: (breakdown.correctness / 400) * 10,
            efficiencyScore: (breakdown.efficiency / 300) * 10,
            qualityScore: (breakdown.quality / 200) * 10,
            creativityScore: (breakdown.creativity / 100) * 10,
            breakdown,
          };
        };

        const player1Feedback = match.player1_feedback || "No feedback available yet.";
        const player2Feedback = match.player2_feedback || "No feedback available yet.";

        // Transform API response to expected format
        const transformedResult: MatchResult = {
          id: match.id,
          player1: match.player1,
          player2: match.player2,
          player1Score: parseScoreBreakdown(player1Feedback, match.player1_score || 0),
          player2Score: parseScoreBreakdown(player2Feedback, match.player2_score || 0),
          player1Code: match.player1_code || "",
          player2Code: match.player2_code || "",
          player1Language: match.player1_language || "javascript",
          player2Language: match.player2_language || "javascript",
          player1Feedback: player1Feedback,
          player2Feedback: player2Feedback,
          winnerId: match.winner_id,
          challenge: match.challenge || { id: "", title: "Unknown", difficulty: "medium" },
          duration: match.duration || 0,
        };

        setMatchResult(transformedResult);

        // Trigger score animations after a short delay
        setTimeout(() => setAnimateScores(true), 300);

        // Trigger confetti if user won
        if (match.winner_id === user?.id) {
          setTimeout(() => setShowConfetti(true), 500);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchMatchResult();
  }, [matchId, user?.id]);

  // Fetch AI analysis - Requirements 3.1
  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!matchId) return;

      setAnalysisLoading(true);
      try {
        const response = await coachApi.getAnalysis(matchId);
        setAnalysis(response.analysis);
      } catch (err) {
        // Analysis might not be available yet, that's okay
        console.log("Analysis not available yet:", err);
      } finally {
        setAnalysisLoading(false);
      }
    };

    fetchAnalysis();
  }, [matchId]);

  const handleViewCoachingDashboard = () => {
    router.push("/coaching");
  };

  const handleRematch = () => {
    // Navigate to matchmaking queue
    router.push("/matchmaking");
  };

  const handleDashboard = () => {
    router.push("/dashboard");
  };

  const handleWatchReplay = () => {
    router.push(`/replay/${matchId}`);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/results/${matchId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Phantom Code Battle Results",
          text: `Check out my code battle results!`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        console.error("Share failed:", err);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      alert("Results link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center relative overflow-hidden">
        {/* Background Grid Pattern */}
        <div
          className="fixed inset-0 z-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
            backgroundSize: "4rem 4rem",
          }}
        />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-16 h-16 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin" />
          <span className="text-accent-cyan font-code animate-pulse">ANALYZING BATTLE DATA...</span>
        </div>
      </div>
    );
  }

  if (error || !matchResult || !matchResult.player1 || !matchResult.player2) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center relative overflow-hidden">
        <div className="text-center relative z-10">
          <div className="text-accent-red text-xl mb-4 font-bold">{error || "Match results not available yet"}</div>
          <button onClick={() => router.push("/dashboard")} className="px-6 py-3 bg-accent-cyan text-background-primary font-bold rounded-lg hover:bg-accent-cyan/90 transition-colors">
            Return to Base
          </button>
        </div>
      </div>
    );
  }

  const isPlayer1 = user?.id === matchResult.player1?.id;
  const currentPlayer = isPlayer1 ? matchResult.player1 : matchResult.player2;
  const opponent = isPlayer1 ? matchResult.player2 : matchResult.player1;

  // Default score object for when scores aren't available yet
  const defaultScore: PlayerScore = {
    totalScore: 0,
    correctnessScore: 0,
    efficiencyScore: 0,
    qualityScore: 0,
    creativityScore: 0,
    breakdown: { correctness: 0, efficiency: 0, quality: 0, creativity: 0 },
  };

  const currentPlayerScore = (isPlayer1 ? matchResult.player1Score : matchResult.player2Score) || defaultScore;
  const opponentScore = (isPlayer1 ? matchResult.player2Score : matchResult.player1Score) || defaultScore;
  const currentPlayerCode = isPlayer1 ? matchResult.player1Code : matchResult.player2Code;
  const opponentCode = isPlayer1 ? matchResult.player2Code : matchResult.player1Code;
  const currentPlayerLanguage = isPlayer1 ? matchResult.player1Language : matchResult.player2Language;
  const opponentLanguage = isPlayer1 ? matchResult.player2Language : matchResult.player1Language;
  const currentPlayerFeedback = (isPlayer1 ? matchResult.player1Feedback : matchResult.player2Feedback) || "No feedback available yet.";

  const isWinner = matchResult.winnerId === currentPlayer.id;
  const isDraw = matchResult.winnerId === null;

  return (
    <div className="min-h-screen bg-background-primary text-white p-4 sm:p-8 relative overflow-hidden selection:bg-accent-cyan/20 selection:text-accent-cyan">
      {/* Background Grid Pattern */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: "4rem 4rem",
        }}
      />

      {/* Ambient Glows */}
      <div className={`fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] blur-[120px] rounded-full pointer-events-none z-0 opacity-20 ${isWinner ? "bg-accent-lime" : isDraw ? "bg-accent-yellow" : "bg-accent-red"}`} />

      {/* Victory Confetti */}
      <VictoryConfetti active={showConfetti} duration={5000} particleCount={150} />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Winner Announcement */}
        <div className="text-center mb-12 sm:mb-16 animate-slide-in-up">
          <div className="inline-block mb-4">{isDraw ? <h1 className="text-6xl sm:text-8xl font-header font-bold text-transparent bg-clip-text bg-gradient-to-b from-accent-yellow to-accent-yellow/50 tracking-tighter filter drop-shadow-[0_0_20px_rgba(255,255,0,0.5)]">DRAW</h1> : isWinner ? <h1 className="text-6xl sm:text-8xl font-header font-bold text-transparent bg-clip-text bg-gradient-to-b from-accent-lime to-accent-lime/50 tracking-tighter filter drop-shadow-[0_0_20px_rgba(57,255,20,0.5)]">VICTORY</h1> : <h1 className="text-6xl sm:text-8xl font-header font-bold text-transparent bg-clip-text bg-gradient-to-b from-accent-red to-accent-red/50 tracking-tighter filter drop-shadow-[0_0_20px_rgba(255,0,60,0.5)]">DEFEAT</h1>}</div>
          <p className="text-2xl sm:text-3xl text-white font-bold mb-2">{matchResult.challenge.title}</p>
          <div className="flex items-center justify-center gap-4 text-text-secondary">
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm uppercase tracking-wider font-bold">{matchResult.challenge.difficulty}</span>
            <span className="flex items-center gap-2 text-sm font-code">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {Math.floor(matchResult.duration / 60)}:{(matchResult.duration % 60).toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Score Comparison */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-12 mb-12 sm:mb-16">
          {/* Current Player */}
          <div className={`glass-card-strong p-8 rounded-2xl border-2 transition-all duration-500 transform hover:scale-[1.02] ${isWinner ? "border-accent-lime shadow-[0_0_30px_rgba(57,255,20,0.2)]" : "border-white/10"}`}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{currentPlayer.username}</h2>
                <div className="text-sm text-text-secondary font-code">RATING: {currentPlayer.rating}</div>
              </div>
              {isWinner && <div className="text-4xl">👑</div>}
            </div>
            <div className="text-center mb-8">
              <div className="text-7xl font-header font-bold text-white mb-2 tracking-tighter">{Math.round(currentPlayerScore.totalScore)}</div>
              <div className="text-sm font-bold uppercase tracking-widest text-text-muted">Total Score</div>
            </div>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-accent-cyan font-bold text-xl">{Math.round(currentPlayerScore.correctnessScore * 10)}%</div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary">Correctness</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-accent-magenta font-bold text-xl">{Math.round(currentPlayerScore.efficiencyScore * 10)}%</div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary">Efficiency</div>
              </div>
            </div>
          </div>

          {/* Opponent */}
          <div className={`glass-card p-8 rounded-2xl border-2 transition-all duration-500 transform hover:scale-[1.02] ${!isWinner && !isDraw ? "border-accent-red shadow-[0_0_30px_rgba(255,0,60,0.2)]" : "border-white/10"}`}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{opponent.username}</h2>
                <div className="text-sm text-text-secondary font-code">RATING: {opponent.rating}</div>
              </div>
              {!isWinner && !isDraw && <div className="text-4xl">👑</div>}
            </div>
            <div className="text-center mb-8">
              <div className="text-7xl font-header font-bold text-white mb-2 tracking-tighter">{Math.round(opponentScore.totalScore)}</div>
              <div className="text-sm font-bold uppercase tracking-widest text-text-muted">Total Score</div>
            </div>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-accent-cyan font-bold text-xl">{Math.round(opponentScore.correctnessScore * 10)}%</div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary">Correctness</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-accent-magenta font-bold text-xl">{Math.round(opponentScore.efficiencyScore * 10)}%</div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary">Efficiency</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Analysis Section */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Score Breakdown */}
          <div className="lg:col-span-2 glass-card p-8 rounded-2xl border border-white/10">
            <h2 className="text-2xl font-header font-bold mb-8 flex items-center gap-3">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              PERFORMANCE METRICS
            </h2>

            <div className="space-y-8">
              <ScoreBar label="Correctness" playerScore={currentPlayerScore.correctnessScore} opponentScore={opponentScore.correctnessScore} maxScore={10} weight={40} animate={animateScores} color="cyan" description="Measures how many test cases your solution passed. This is the most important metric." />
              <ScoreBar label="Efficiency" playerScore={currentPlayerScore.efficiencyScore} opponentScore={opponentScore.efficiencyScore} maxScore={10} weight={30} animate={animateScores} color="magenta" description="Evaluates the time and space complexity of your solution compared to optimal solutions." />
              <ScoreBar label="Code Quality" playerScore={currentPlayerScore.qualityScore} opponentScore={opponentScore.qualityScore} maxScore={10} weight={20} animate={animateScores} color="purple" description="Analyzes code readability, structure, variable naming, and adherence to best practices." />
              <ScoreBar label="Creativity" playerScore={currentPlayerScore.creativityScore} opponentScore={opponentScore.creativityScore} maxScore={10} weight={10} animate={animateScores} color="yellow" description="Rewards unique approaches, advanced algorithms, and clever use of language features." />
            </div>
          </div>

          {/* AI Feedback */}
          <div className="glass-card p-8 rounded-2xl border border-white/10 flex flex-col">
            <h2 className="text-2xl font-header font-bold mb-6 flex items-center gap-3">
              <svg className="w-6 h-6 text-accent-magenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI ANALYSIS
            </h2>
            <div className="flex-1 bg-black/20 rounded-xl p-6 border border-white/5 overflow-y-auto custom-scrollbar max-h-[400px] relative group">
              <FormattedFeedback feedback={currentPlayerFeedback} />
              <button onClick={() => navigator.clipboard.writeText(currentPlayerFeedback)} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" title="Copy Feedback">
                <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* AI Code Coach Analysis Toggle - Requirements 3.1 */}
        <div className="mb-8">
          <button onClick={() => setShowAnalysis(!showAnalysis)} className="w-full glass-card p-6 rounded-xl border border-white/10 hover:border-accent-magenta/50 transition-all duration-300 group flex items-center justify-center gap-3">
            <span className="text-2xl">🤖</span>
            <span className="text-xl font-bold text-white group-hover:text-accent-magenta transition-colors">{showAnalysis ? "HIDE" : "VIEW"} AI CODE COACH ANALYSIS</span>
            {analysisLoading && <div className="w-5 h-5 border-2 border-accent-magenta/30 border-t-accent-magenta rounded-full animate-spin" />}
            <svg className={`w-6 h-6 text-text-secondary group-hover:text-accent-magenta transition-all duration-300 ${showAnalysis ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* AI Code Coach Analysis Section */}
        {showAnalysis && (
          <div className="mb-12 animate-fade-in">
            {analysis ? (
              <PostMatchAnalysis analysis={analysis} isWinner={isWinner} onViewDashboard={handleViewCoachingDashboard} />
            ) : analysisLoading ? (
              <div className="glass-card rounded-2xl p-8 text-center border border-white/10">
                <div className="w-12 h-12 border-4 border-accent-magenta/20 border-t-accent-magenta rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-secondary">Generating AI analysis...</p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-8 text-center border border-white/10">
                <span className="text-4xl mb-4 block">📊</span>
                <h3 className="text-xl font-bold text-white mb-2">Analysis Not Available</h3>
                <p className="text-text-secondary mb-4">The AI analysis for this match is not available yet.</p>
                <button onClick={handleViewCoachingDashboard} className="px-6 py-3 bg-accent-magenta text-white font-bold rounded-lg hover:bg-accent-magenta/90 transition-colors">
                  View Coaching Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* Code Comparison Toggle */}
        <div className="mb-12">
          <button onClick={() => setShowCodeComparison(!showCodeComparison)} className="w-full glass-card p-6 rounded-xl border border-white/10 hover:border-accent-cyan/50 transition-all duration-300 group flex items-center justify-center gap-3">
            <span className="text-xl font-bold text-white group-hover:text-accent-cyan transition-colors">{showCodeComparison ? "HIDE" : "REVEAL"} SOURCE CODE</span>
            <svg className={`w-6 h-6 text-text-secondary group-hover:text-accent-cyan transition-all duration-300 ${showCodeComparison ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Code Comparison */}
        {showCodeComparison && (
          <div className="glass-card p-8 rounded-2xl mb-12 border border-white/10 animate-fade-in">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Current Player Code */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-accent-cyan flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-cyan" />
                    {currentPlayer.username}
                  </h3>
                  <span className="text-xs font-code text-text-muted uppercase">{currentPlayerLanguage}</span>
                </div>
                <div className="bg-[#0a0a12] p-6 rounded-xl overflow-x-auto border border-white/10 shadow-inner h-[500px] custom-scrollbar">
                  <pre className="text-sm font-code text-gray-300">
                    <code>{currentPlayerCode}</code>
                  </pre>
                </div>
              </div>

              {/* Opponent Code */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-accent-magenta flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-magenta" />
                    {opponent.username}
                  </h3>
                  <span className="text-xs font-code text-text-muted uppercase">{opponentLanguage}</span>
                </div>
                <div className="bg-[#0a0a12] p-6 rounded-xl overflow-x-auto border border-white/10 shadow-inner h-[500px] custom-scrollbar">
                  <pre className="text-sm font-code text-gray-300">
                    <code>{opponentCode}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button onClick={handleRematch} className="w-full sm:w-auto px-8 py-4 bg-accent-cyan text-background-primary hover:bg-accent-cyan/90 rounded-xl font-bold text-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] flex items-center justify-center gap-2 uppercase tracking-wider">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find New Match
          </button>
          <button onClick={handleWatchReplay} className="w-full sm:w-auto px-8 py-4 bg-accent-magenta text-white hover:bg-accent-magenta/90 rounded-xl font-bold text-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,0,255,0.4)] flex items-center justify-center gap-2 uppercase tracking-wider">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Watch Replay
          </button>
          <button onClick={handleShare} className="w-full sm:w-auto px-8 py-4 bg-background-secondary text-white border border-white/10 hover:bg-white/5 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-wider">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Results
          </button>
          <button onClick={handleDashboard} className="w-full sm:w-auto px-8 py-4 bg-transparent text-text-secondary hover:text-white rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-wider">
            Return to Base
          </button>
        </div>
      </div>
    </div>
  );
}

interface ScoreBarProps {
  label: string;
  playerScore: number;
  opponentScore: number;
  maxScore: number;
  weight: number;
  animate: boolean;
  color: string;
  description?: string;
}

function ScoreBar({ label, playerScore, opponentScore, maxScore, weight, animate, color, description }: ScoreBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const playerPercentage = (playerScore / maxScore) * 100;
  const opponentPercentage = (opponentScore / maxScore) * 100;

  const colorClasses = {
    cyan: "bg-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]",
    magenta: "bg-accent-magenta shadow-[0_0_10px_rgba(255,0,255,0.5)]",
    purple: "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]",
    yellow: "bg-accent-yellow shadow-[0_0_10px_rgba(255,255,0,0.5)]",
  };

  const barColor = colorClasses[color as keyof typeof colorClasses] || colorClasses.cyan;

  return (
    <div>
      <div className="flex justify-between mb-3 relative">
        <div className="flex items-center gap-2 cursor-help" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
          <span className="font-bold text-white tracking-wide">{label}</span>
          <svg className="w-4 h-4 text-text-muted hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>

          {showTooltip && description && (
            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-background-secondary border border-white/10 rounded-lg shadow-xl z-50 animate-fade-in">
              <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
              <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-background-secondary border-r border-b border-white/10"></div>
            </div>
          )}
        </div>
        <span className="text-xs font-code text-text-muted bg-white/5 px-2 py-0.5 rounded border border-white/5">{weight}% WEIGHT</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {/* Player Score */}
        <div>
          <div className="flex justify-between text-xs mb-2 text-text-secondary">
            <span>YOU</span>
            <span className="font-bold text-white">
              {playerScore.toFixed(1)} <span className="text-text-muted">/ {maxScore}</span>
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} transition-all duration-1000 ease-out rounded-full`} style={{ width: animate ? `${playerPercentage}%` : "0%" }} />
          </div>
        </div>

        {/* Opponent Score */}
        <div>
          <div className="flex justify-between text-xs mb-2 text-text-secondary">
            <span>OPPONENT</span>
            <span className="font-bold text-white">
              {opponentScore.toFixed(1)} <span className="text-text-muted">/ {maxScore}</span>
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-text-muted transition-all duration-1000 ease-out rounded-full opacity-50" style={{ width: animate ? `${opponentPercentage}%` : "0%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Component to format AI feedback with proper styling
 * Converts markdown-style **text** to bold and handles line breaks
 */
function FormattedFeedback({ feedback }: { feedback: string }) {
  // Split feedback into sections based on double newlines or section headers
  const formatText = (text: string) => {
    // Replace **text** with styled spans
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        // Bold text - extract content and style it
        const content = part.slice(2, -2);
        return (
          <span key={index} className="font-bold text-accent-cyan">
            {content}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Split by newlines and render each line
  const lines = feedback.split("\n");

  return (
    <div className="space-y-3 text-sm">
      {lines.map((line, index) => {
        if (!line.trim()) return null;

        // Check if it's a score line (starts with emoji or "Final Score")
        const isScoreLine = line.includes("Final Score:") || /^[🎉✨]/.test(line);
        const isSectionHeader = line.startsWith("**") && line.includes("points");

        return (
          <p key={index} className={`leading-relaxed ${isScoreLine ? "text-lg font-bold text-white mt-4 mb-2" : isSectionHeader ? "text-base font-bold text-white mt-4" : "text-text-secondary"}`}>
            {formatText(line)}
          </p>
        );
      })}
    </div>
  );
}

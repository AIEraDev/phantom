import { AuthResponse, LoginCredentials, RegisterCredentials, User } from "@/types/auth";
import { Match, UserStats } from "@/types/match";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options?.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "An error occurred" }));
      throw new ApiError(response.status, error.error || error.message || "An error occurred", error.code);
    }

    return response.json();
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new ApiError(0, "Network error. Please check your connection.", "NETWORK_ERROR");
    }
    throw error;
  }
}

export const authApi = {
  register: (credentials: RegisterCredentials): Promise<AuthResponse> =>
    fetchApi("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  login: (credentials: LoginCredentials): Promise<AuthResponse> =>
    fetchApi("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  getCurrentUser: (): Promise<{ user: User }> =>
    fetchApi("/api/auth/me", {
      method: "GET",
    }),
};

export const userApi = {
  getUser: (userId: string): Promise<{ user: User }> =>
    fetchApi(`/api/users/${userId}`, {
      method: "GET",
    }),

  getUserStats: (userId: string): Promise<{ stats: UserStats }> =>
    fetchApi(`/api/users/${userId}/stats`, {
      method: "GET",
    }),

  getUserMatches: (userId: string, limit = 10, offset = 0): Promise<{ matches: Match[]; total: number }> =>
    fetchApi(`/api/users/${userId}/matches?limit=${limit}&offset=${offset}`, {
      method: "GET",
    }),

  updateUser: (userId: string, data: { displayName?: string; avatarUrl?: string }): Promise<{ user: User }> =>
    fetchApi(`/api/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

export interface LeaderboardPlayer {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  rating: number;
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
  rank: number;
}

export interface LeaderboardResult {
  players: LeaderboardPlayer[];
  total: number;
  period: "daily" | "weekly" | "all-time";
}

export const leaderboardApi = {
  getGlobalLeaderboard: (limit = 100, period: "daily" | "weekly" | "all-time" = "all-time", search?: string): Promise<LeaderboardResult> => {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("period", period);
    if (search && search.trim()) {
      params.append("search", search.trim());
    }

    return fetchApi(`/api/leaderboard/global?${params.toString()}`, {
      method: "GET",
    });
  },
};

export interface MatchState {
  id: string;
  challenge_id: string;
  player1_id: string;
  player2_id: string;
  status: string;
  started_at: string | null;
  time_limit: number;
  challenge: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    time_limit: number;
    starter_code: Record<string, string>;
    test_cases: Array<{ input: unknown; expectedOutput: unknown; isHidden: boolean }>;
  };
  player1: { id: string; username: string; rating: number };
  player2: { id: string; username: string; rating: number };
}

export const matchApi = {
  getMatch: (matchId: string): Promise<{ match: MatchState }> =>
    fetchApi(`/api/matches/${matchId}`, {
      method: "GET",
    }),
};

// Skill Tree Types
export interface SkillTreeNode {
  id: string;
  challengeId: string;
  tier: number;
  positionX: number;
  positionY: number;
  category: "arrays" | "strings" | "trees" | "graphs" | "dp";
  challenge: {
    id: string;
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard" | "expert";
    time_limit: number;
    test_cases: Array<{ input: unknown; expectedOutput: unknown; isHidden: boolean }>;
    starter_code: Record<string, string>;
  } | null;
  prerequisites: string[];
  isUnlocked: boolean;
  isCompleted: boolean;
  isMastered: boolean;
}

export interface SkillTreeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface SkillTreeResponse {
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
}

export interface UserProgressItem {
  id: string;
  userId: string;
  challengeId: string;
  completed: boolean;
  mastered: boolean;
  bestScore: number;
  attempts: number;
  completedAt: string | null;
}

export interface UnlockCheckResponse {
  unlocked: boolean;
  prerequisites: string[];
}

export const skillTreeApi = {
  getSkillTree: (): Promise<SkillTreeResponse> =>
    fetchApi("/api/skill-tree", {
      method: "GET",
    }),

  getProgress: (): Promise<{ progress: UserProgressItem[] }> =>
    fetchApi("/api/skill-tree/progress", {
      method: "GET",
    }),

  getUnlockedChallenges: (difficulty?: string, category?: string): Promise<{ challenges: SkillTreeNode["challenge"][] }> => {
    const params = new URLSearchParams();
    if (difficulty) params.append("difficulty", difficulty);
    if (category) params.append("category", category);
    const queryString = params.toString();
    return fetchApi(`/api/skill-tree/unlocked${queryString ? `?${queryString}` : ""}`, {
      method: "GET",
    });
  },

  checkUnlock: (challengeId: string): Promise<UnlockCheckResponse> =>
    fetchApi("/api/skill-tree/check-unlock", {
      method: "POST",
      body: JSON.stringify({ challengeId }),
    }),
};

// Ghost Mode Types
export interface GhostMetadata {
  id: string;
  challengeId: string;
  userId: string;
  username: string;
  score: number;
  durationMs: number;
  isAI: boolean;
  createdAt: string;
}

export interface GhostEvent {
  event_type: "code_update" | "test_run" | "submission" | "cursor_move";
  timestamp: number;
  data: {
    code?: string;
    cursor?: { line: number; column: number };
    results?: Array<{ passed: boolean; executionTime: number }>;
    language?: string;
  };
}

export interface GhostRecording extends GhostMetadata {
  events: GhostEvent[];
}

export interface GhostRaceStartResponse {
  raceId: string;
  ghost: GhostRecording;
}

export const ghostApi = {
  getGhostsForChallenge: (challengeId: string): Promise<{ ghosts: GhostMetadata[] }> =>
    fetchApi(`/api/ghosts/challenge/${challengeId}`, {
      method: "GET",
    }),

  getGhost: (ghostId: string): Promise<{ ghost: GhostRecording }> =>
    fetchApi(`/api/ghosts/${ghostId}`, {
      method: "GET",
    }),

  createGhostFromMatch: (matchId: string): Promise<{ ghost: GhostMetadata }> =>
    fetchApi("/api/ghosts/from-match", {
      method: "POST",
      body: JSON.stringify({ matchId }),
    }),

  startGhostRace: (challengeId: string, ghostId?: string): Promise<GhostRaceStartResponse> =>
    fetchApi("/api/ghosts/race", {
      method: "POST",
      body: JSON.stringify({ challengeId, ghostId }),
    }),
};

// Practice Mode Types
export interface PracticeFeedback {
  correctness: number;
  efficiency: number;
  quality: number;
  suggestions: string[];
}

export interface PracticeSession {
  id: string;
  userId: string;
  challengeId: string;
  code: string;
  language: "javascript" | "python" | "typescript";
  score: number | null;
  feedback: PracticeFeedback | null;
  hintsUsed: number;
  startedAt: string;
  completedAt: string | null;
}

export interface PracticeHint {
  level: number;
  content: string;
}

export interface PracticeStats {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  highestScore: number;
  totalHintsUsed: number;
  uniqueChallenges: number;
}

export interface PracticeTrends {
  scoreImprovement: number;
  recentAverage: number;
  previousAverage: number;
  trend: "improving" | "declining" | "neutral";
}

export interface PracticeChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  time_limit: number;
  test_cases: Array<{ input: unknown; expectedOutput: unknown; isHidden?: boolean }>;
  starter_code: Record<string, string>;
  tags: string[];
}

export interface PracticeHistoryResponse {
  sessions: PracticeSession[];
  stats: PracticeStats;
  trends: PracticeTrends;
}

export const practiceApi = {
  getChallenges: (difficulty?: string, category?: string): Promise<{ challenges: PracticeChallenge[] }> => {
    const params = new URLSearchParams();
    if (difficulty) params.append("difficulty", difficulty);
    if (category) params.append("category", category);
    const queryString = params.toString();
    return fetchApi(`/api/practice/challenges${queryString ? `?${queryString}` : ""}`, {
      method: "GET",
    });
  },

  startSession: (challengeId: string, language: string): Promise<{ session: PracticeSession; challenge: PracticeChallenge }> =>
    fetchApi("/api/practice/start", {
      method: "POST",
      body: JSON.stringify({ challengeId, language }),
    }),

  saveProgress: (sessionId: string, code: string): Promise<{ success: boolean }> =>
    fetchApi(`/api/practice/${sessionId}/save`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  submitSolution: (sessionId: string, code: string): Promise<{ session: PracticeSession; feedback: PracticeFeedback }> =>
    fetchApi(`/api/practice/${sessionId}/submit`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  getHint: (sessionId: string, level: number): Promise<{ hint: PracticeHint }> =>
    fetchApi(`/api/practice/${sessionId}/hint`, {
      method: "POST",
      body: JSON.stringify({ level }),
    }),

  getHistory: (): Promise<PracticeHistoryResponse> =>
    fetchApi("/api/practice/history", {
      method: "GET",
    }),
};

export { ApiError };

// AI Code Coach Types
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
  createdAt: string;
}

export interface WeaknessPattern {
  category: "time_complexity" | "space_complexity" | "readability" | "patterns";
  pattern: string;
  frequency: number;
  lastSeen: string;
}

export interface WeaknessProfile {
  id: string;
  userId: string;
  patterns: WeaknessPattern[];
  categoryScores: {
    time_complexity: number;
    space_complexity: number;
    readability: number;
    patterns: number;
  };
  matchesAnalyzed: number;
  lastUpdated: string;
}

export interface WeaknessSummary {
  topWeaknesses: WeaknessPattern[];
  strongestArea: string;
  improvementTrend: "improving" | "stable" | "declining";
}

export interface CoachingSummary {
  totalHintsUsed: number;
  totalMatchesAnalyzed: number;
  improvementScore: number;
  averageAnalysisScore: number;
}

export interface SkillTimelineEntry {
  matchId: string;
  date: string;
  scores: {
    time_complexity: number;
    space_complexity: number;
    readability: number;
    patterns: number;
  };
}

export interface SkillTimeline {
  entries: SkillTimelineEntry[];
}

export interface CategoryFeedback {
  category: string;
  feedbackItems: Array<{
    matchId: string;
    date: string;
    feedback: string;
  }>;
}

export interface TrendData {
  category: string;
  dataPoints: Array<{
    matchNumber: number;
    score: number;
  }>;
  trend: "improving" | "stable" | "declining";
}

// Transform snake_case analysis from backend to camelCase for frontend
function transformAnalysis(data: any): MatchAnalysis {
  return {
    id: data.id,
    matchId: data.match_id || data.matchId,
    userId: data.user_id || data.userId,
    timeComplexity: data.time_complexity || data.timeComplexity || { detected: "Unknown", optimal: "Unknown", explanation: "" },
    spaceComplexity: data.space_complexity || data.spaceComplexity || { detected: "Unknown", optimal: "Unknown", explanation: "" },
    readabilityScore: data.readability_score || data.readabilityScore || { score: 0, strengths: [], improvements: [] },
    algorithmicApproach: data.algorithmic_approach || data.algorithmicApproach || { detected: "Unknown", suggested: "Unknown", explanation: "" },
    suggestions: data.suggestions || [],
    bugAnalysis: data.bug_analysis || data.bugAnalysis || { hasBugs: false, bugs: [] },
    hintsUsed: data.hints_used ?? data.hintsUsed ?? 0,
    createdAt: data.created_at || data.createdAt || new Date().toISOString(),
  };
}

export const coachApi = {
  // Hint endpoints
  requestHint: (matchId: string, currentCode: string, language: string): Promise<{ hint: HintResponse }> =>
    fetchApi("/api/coach/hints/request", {
      method: "POST",
      body: JSON.stringify({ matchId, currentCode, language }),
    }),

  getHintStatus: (matchId: string): Promise<HintStatus> =>
    fetchApi(`/api/coach/hints/status/${matchId}`, {
      method: "GET",
    }),

  getMatchHints: (matchId: string): Promise<{ hints: HintResponse[] }> =>
    fetchApi(`/api/coach/hints/match/${matchId}`, {
      method: "GET",
    }),

  // Analysis endpoints
  generateAnalysis: (matchId: string): Promise<{ analysis: MatchAnalysis }> =>
    fetchApi<{ analysis: any }>("/api/coach/analysis/generate", {
      method: "POST",
      body: JSON.stringify({ matchId }),
    }).then((res) => ({ analysis: transformAnalysis(res.analysis) })),

  getAnalysis: (matchId: string): Promise<{ analysis: MatchAnalysis }> =>
    fetchApi<{ analysis: any }>(`/api/coach/analysis/${matchId}`, {
      method: "GET",
    }).then((res) => ({ analysis: transformAnalysis(res.analysis) })),

  getAnalysisHistory: (page = 1, pageSize = 10): Promise<{ analyses: MatchAnalysis[]; total: number; page: number }> =>
    fetchApi<{ analyses: any[]; total: number; page: number }>(`/api/coach/analysis/history?page=${page}&pageSize=${pageSize}`, {
      method: "GET",
    }).then((res) => ({ ...res, analyses: res.analyses.map(transformAnalysis) })),

  // Weakness endpoints
  getWeaknessProfile: (): Promise<{ profile: WeaknessProfile }> =>
    fetchApi("/api/coach/weakness/profile", {
      method: "GET",
    }),

  getWeaknessSummary: (): Promise<{ summary: WeaknessSummary }> =>
    fetchApi("/api/coach/weakness/summary", {
      method: "GET",
    }),

  getPreMatchTip: (challengeCategory: string): Promise<{ tip: string | null }> =>
    fetchApi(`/api/coach/weakness/tip/${challengeCategory}`, {
      method: "GET",
    }),

  // Dashboard endpoints
  getDashboardSummary: (): Promise<{ summary: CoachingSummary }> =>
    fetchApi("/api/coach/dashboard/summary", {
      method: "GET",
    }),

  getTimeline: (): Promise<{ timeline: SkillTimeline }> =>
    fetchApi("/api/coach/dashboard/timeline", {
      method: "GET",
    }),

  getCategorizedFeedback: (): Promise<{ feedback: CategoryFeedback[] }> =>
    fetchApi("/api/coach/dashboard/feedback", {
      method: "GET",
    }),

  getMatchDetail: (matchId: string): Promise<{ analysis: MatchAnalysis; hints: HintResponse[] }> =>
    fetchApi(`/api/coach/dashboard/match/${matchId}`, {
      method: "GET",
    }),

  getTrends: (): Promise<{ trends: TrendData[] }> =>
    fetchApi("/api/coach/dashboard/trends", {
      method: "GET",
    }),
};

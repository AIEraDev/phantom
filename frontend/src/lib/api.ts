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

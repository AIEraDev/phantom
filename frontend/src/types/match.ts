export interface Match {
  id: string;
  challengeId: string;
  player1Id: string;
  player2Id: string;
  winnerId?: string;
  player1Score?: number;
  player2Score?: number;
  player1Language: string;
  player2Language: string;
  duration?: number;
  status: "waiting" | "lobby" | "active" | "completed" | "abandoned";
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  // Populated fields
  challenge?: {
    id: string;
    title: string;
    difficulty: "easy" | "medium" | "hard" | "expert";
  };
  opponent?: {
    id: string;
    username: string;
    rating: number;
  };
}

export interface UserStats {
  rating: number;
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
}

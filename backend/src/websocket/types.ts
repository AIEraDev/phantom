import { Socket } from "socket.io";
import { JWTPayload } from "../utils/jwt";
import { StarterCode } from "../db/types";
import { PowerUpType, PlayerPowerUpState } from "../types/powerups";

// Extend Socket type to include authenticated user data
export interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
  userId?: string;
}

// User session data stored in memory
export interface UserSession {
  userId: string;
  socketId: string;
  username: string;
  email: string;
  connectedAt: Date;
}

// Optimized user data for WebSocket messages (minimal payload)
export interface MinimalUser {
  id: string;
  username: string;
  displayName?: string;
  rating?: number;
  avatarUrl?: string;
}

// Optimized challenge data for WebSocket messages
export interface MinimalChallenge {
  id: string;
  title: string;
  description?: string;
  difficulty: string;
  timeLimit: number;
  starterCode?: StarterCode;
}

// Optimized cursor position
export interface CursorPosition {
  l: number; // line (shortened key)
  c: number; // column (shortened key)
}

// Hint response structure for WebSocket
export interface HintResponseData {
  id: string;
  content: string;
  level: number;
  levelIndicator: string;
  consumed: boolean;
  cooldownRemaining: number;
}

// WebSocket event types with optimized payloads
export interface ServerToClientEvents {
  // Matchmaking
  match_found: (data: { matchId: string; opponent: MinimalUser; challenge: MinimalChallenge }) => void;
  queue_position: (data: { pos: number; wait: number }) => void; // Shortened keys

  // Lobby
  opponent_joined: (data: { opponent: MinimalUser }) => void;
  opponent_ready: (data: { isReady: boolean }) => void;
  match_starting: (data: { countdown: number }) => void;
  lobby_state: (data: { playerReady: boolean; opponentReady: boolean; countdownRemaining: number | null }) => void;

  // Battle
  match_started: (data: { startTime: number; timeLimit: number; remaining?: number }) => void;
  timer_sync: (data: { remaining: number }) => void; // Periodic timer sync to keep players synchronized
  opponent_code_update: (data: { code: string; cursor: { line: number; column: number } }) => void;
  opponent_test_run: (data: { isRunning: boolean }) => void;
  test_result: (data: { results: any[] }) => void;
  opponent_submitted: () => void;
  match_result: (data: { winner: MinimalUser | null; scores: any; feedback: any; duration?: number; matchId?: string }) => void;

  // Spectator
  spectator_joined: (data: { count: number }) => void;
  spectator_message: (data: { id: string; username: string; message: string; timestamp: number }) => void;
  spectator_reaction: (data: { username: string; emoji: string; position: { x: number; y: number } }) => void;
  chat_rate_limited: (data: { retryAfter: number }) => void;

  // AI Code Coach - Hints (Requirements: 1.1, 1.4)
  hint_response: (data: { hint: HintResponseData }) => void;
  hint_error: (data: { error: string; code?: string; cooldownRemaining?: number }) => void;
  hint_status_update: (data: { hintsUsed: number; hintsRemaining: number }) => void;

  // AI Code Coach - Analysis (Requirements: 3.1)
  analysis_ready: (data: { matchId: string; analysis: any }) => void;
  analysis_error: (data: { matchId: string; error: string }) => void;

  // Power-Ups (Requirements: 1.3, 2.4, 3.3, 7.1, 7.2)
  powerup_activated: (data: {
    playerId: string;
    powerUpType: PowerUpType;
    opponentCode?: string; // For code_peek (only to requester)
    freezeExpiresAt?: number; // For time_freeze
    shieldedRuns?: number; // For debug_shield
  }) => void;
  powerup_state_update: (data: PlayerPowerUpState) => void;
  powerup_error: (data: { error: string; code: string; cooldownRemaining?: number }) => void;
  powerup_effect_expired: (data: { playerId: string; powerUpType: PowerUpType }) => void;
  opponent_used_powerup: (data: { powerUpType: PowerUpType }) => void;
  spectator_powerup_event: (data: { playerId: string; username: string; powerUpType: PowerUpType; timestamp: number }) => void;

  // Connection
  reconnected: (data: { matchState: any }) => void;
  error: (data: { message: string; code: string }) => void;
  authenticated: (data: { userId: string; username: string }) => void;
}

export interface ClientToServerEvents {
  // Authentication
  authenticate: (data: { token: string }) => void;

  // Matchmaking
  join_queue: (data: { difficulty?: string; language?: string }) => void;
  leave_queue: () => void;

  // Lobby
  join_lobby: (data: { matchId: string }) => void;
  ready_up: (data: { matchId: string }) => void;

  // Battle (optimized with shortened keys)
  code_update: (data: { mid: string; code: string; cursor: CursorPosition }) => void; // matchId -> mid
  run_code: (data: { mid: string; code: string }) => void;
  submit_solution: (data: { mid: string; code: string }) => void;

  // Spectator
  join_spectate: (data: { matchId: string }) => void;
  spectator_message: (data: { matchId: string; message: string }) => void;
  spectator_reaction: (data: { matchId: string; emoji: string }) => void;

  // AI Code Coach - Hints (Requirements: 1.1)
  request_hint: (data: { matchId: string; currentCode: string; language: string }) => void;

  // Power-Ups (Requirements: 1.3)
  activate_powerup: (data: { matchId: string; powerUpType: PowerUpType }) => void;
}

/**
 * Utility functions for payload optimization
 */
export class PayloadOptimizer {
  /**
   * Convert full user object to minimal user for WebSocket transmission
   */
  static toMinimalUser(user: any): MinimalUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name || user.displayName,
      rating: user.rating,
      avatarUrl: user.avatar_url || user.avatarUrl,
    };
  }

  /**
   * Convert full challenge object to minimal challenge for WebSocket transmission
   */
  static toMinimalChallenge(challenge: any): MinimalChallenge {
    return {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      difficulty: challenge.difficulty,
      timeLimit: challenge.time_limit || challenge.timeLimit,
      starterCode: challenge.starter_code || challenge.starterCode,
    };
  }

  /**
   * Convert cursor position to optimized format
   */
  static toOptimizedCursor(cursor: { line: number; column: number }): CursorPosition {
    return {
      l: cursor.line,
      c: cursor.column,
    };
  }

  /**
   * Convert optimized cursor back to standard format
   */
  static fromOptimizedCursor(cursor: CursorPosition): { line: number; column: number } {
    return {
      line: cursor.l,
      column: cursor.c,
    };
  }
}

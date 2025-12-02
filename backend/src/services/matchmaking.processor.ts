import { matchmakingService } from "../redis/matchmaking.service";
import pool from "../db/connection";
import { Match } from "../db/types";
import { v4 as uuidv4 } from "uuid";
import { Server } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "../websocket/types";

export interface MatchmakingConfig {
  ratingRange: number;
  processingInterval: number; // milliseconds
}

export class MatchmakingProcessor {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private config: MatchmakingConfig;
  private io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

  constructor(config: Partial<MatchmakingConfig> = {}) {
    this.config = {
      ratingRange: config.ratingRange || 100,
      processingInterval: config.processingInterval || 2000, // 2 seconds
    };
  }

  /**
   * Set the Socket.IO server instance for emitting events
   */
  setIO(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
    this.io = io;
  }

  /**
   * Start the matchmaking processor
   */
  start(): void {
    if (this.intervalId) {
      console.log("Matchmaking processor already running");
      return;
    }

    console.log(`Starting matchmaking processor (interval: ${this.config.processingInterval}ms, rating range: ±${this.config.ratingRange})`);

    this.intervalId = setInterval(() => {
      this.processQueues().catch((error) => {
        console.error("Error processing matchmaking queues:", error);
      });
    }, this.config.processingInterval);
  }

  /**
   * Stop the matchmaking processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Matchmaking processor stopped");
    }
  }

  /**
   * Process all matchmaking queues
   */
  private async processQueues(): Promise<void> {
    if (this.isProcessing) {
      return; // Skip if already processing
    }

    this.isProcessing = true;

    try {
      // Process different queue combinations
      const queueConfigs = [
        { difficulty: undefined, language: undefined }, // any:any
        { difficulty: "easy", language: undefined },
        { difficulty: "medium", language: undefined },
        { difficulty: "hard", language: undefined },
        { difficulty: "expert", language: undefined },
        { difficulty: undefined, language: "javascript" },
        { difficulty: undefined, language: "python" },
        { difficulty: undefined, language: "typescript" },
      ];

      for (const config of queueConfigs) {
        await this.processQueue(config.difficulty, config.language);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a specific queue
   */
  private async processQueue(difficulty?: string, language?: string): Promise<void> {
    const queueSize = await matchmakingService.getQueueSize(difficulty, language);
    const queueKey = `queue:${difficulty || "any"}:${language || "any"}`;

    if (queueSize > 0) {
      console.log(`[Matchmaking] Queue ${queueKey} has ${queueSize} player(s)`);
    }

    if (queueSize < 2) {
      return; // Need at least 2 players
    }

    // Find a match
    const pair = await matchmakingService.findMatch(difficulty, language, this.config.ratingRange);

    if (!pair) {
      console.log(`[Matchmaking] No suitable match found in ${queueKey} (rating range: ±${this.config.ratingRange})`);
      return;
    }

    console.log(`[Matchmaking] Found match: ${pair[0].userId} (rating: ${pair[0].rating}) vs ${pair[1].userId} (rating: ${pair[1].rating})`);

    try {
      // Create match in database
      const match = await this.createMatch(pair[0].userId, pair[1].userId, difficulty, language);

      // Remove matched users from queue
      await matchmakingService.removePairFromQueue(pair, difficulty, language);

      console.log(`Match created: ${match.id} (${pair[0].userId} vs ${pair[1].userId})`);

      // Emit WebSocket event to notify players
      await this.notifyMatchFound(match, pair[0].userId, pair[1].userId);
    } catch (error) {
      console.error("Error creating match:", error);
      // Don't remove from queue if match creation failed
    }
  }

  /**
   * Notify players that a match has been found
   */
  private async notifyMatchFound(match: Match, player1Id: string, player2Id: string): Promise<void> {
    if (!this.io) {
      console.warn("Socket.IO instance not set, cannot emit match_found event");
      return;
    }

    try {
      // Import services dynamically to avoid circular dependencies
      const { UserService } = await import("./user.service");
      const { ChallengeService } = await import("./challenge.service");

      const userService = new UserService();
      const challengeService = new ChallengeService();

      // Fetch user and challenge data
      const [player1, player2, challenge] = await Promise.all([userService.getUserById(player1Id), userService.getUserById(player2Id), challengeService.getChallengeById(match.challenge_id)]);

      if (!player1 || !player2 || !challenge) {
        console.error("Failed to fetch match data for notification");
        return;
      }

      // Get socket sessions
      const { sessionManager } = await import("../websocket/sessionManager");
      const player1Session = sessionManager.getSessionByUserId(player1Id);
      const player2Session = sessionManager.getSessionByUserId(player2Id);

      console.log(`[Matchmaking] Player1 session: ${player1Session ? player1Session.socketId : "NOT FOUND"}`);
      console.log(`[Matchmaking] Player2 session: ${player2Session ? player2Session.socketId : "NOT FOUND"}`);

      // Emit to player 1
      if (player1Session) {
        this.io.to(player1Session.socketId).emit("match_found", {
          matchId: match.id,
          opponent: {
            id: player2.id,
            username: player2.username,
            displayName: player2.display_name ?? player2.username,
            avatarUrl: player2.avatar_url ?? undefined,
            rating: player2.rating,
          },
          challenge: {
            id: challenge.id,
            title: challenge.title,
            description: challenge.description,
            difficulty: challenge.difficulty,
            timeLimit: challenge.time_limit,
            starterCode: challenge.starter_code,
          },
        });
      }

      // Emit to player 2
      if (player2Session) {
        this.io.to(player2Session.socketId).emit("match_found", {
          matchId: match.id,
          opponent: {
            id: player1.id,
            username: player1.username,
            displayName: player1.display_name ?? player1.username,
            avatarUrl: player1.avatar_url ?? undefined,
            rating: player1.rating,
          },
          challenge: {
            id: challenge.id,
            title: challenge.title,
            description: challenge.description,
            difficulty: challenge.difficulty,
            timeLimit: challenge.time_limit,
            starterCode: challenge.starter_code,
          },
        });
      }

      console.log(`Match found notification sent to players ${player1.username} and ${player2.username}`);
    } catch (error) {
      console.error("Error notifying players of match:", error);
    }
  }

  /**
   * Create a match record in the database
   */
  private async createMatch(player1Id: string, player2Id: string, difficulty?: string, language?: string): Promise<Match> {
    // Get a random challenge based on difficulty
    const challengeId = await this.getRandomChallenge(difficulty);

    const matchId = uuidv4();
    const defaultLanguage = language || "javascript";

    const result = await pool.query<Match>(
      `INSERT INTO matches (
        id, challenge_id, player1_id, player2_id, 
        player1_language, player2_language, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [matchId, challengeId, player1Id, player2Id, defaultLanguage, defaultLanguage, "lobby"]
    );

    return result.rows[0];
  }

  /**
   * Get a random challenge ID based on difficulty
   */
  private async getRandomChallenge(difficulty?: string): Promise<string> {
    let query = "SELECT id FROM challenges";
    const params: any[] = [];

    if (difficulty && difficulty !== "any") {
      query += " WHERE difficulty = $1";
      params.push(difficulty);
    }

    query += " ORDER BY RANDOM() LIMIT 1";

    const result = await pool.query<{ id: string }>(query, params);

    if (result.rows.length === 0) {
      throw new Error("No challenges available");
    }

    return result.rows[0].id;
  }

  /**
   * Get processor status
   */
  getStatus(): { running: boolean; processing: boolean; config: MatchmakingConfig } {
    return {
      running: this.intervalId !== null,
      processing: this.isProcessing,
      config: this.config,
    };
  }
}

// Export singleton instance
export const matchmakingProcessor = new MatchmakingProcessor();

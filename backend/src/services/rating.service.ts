import pool from "../db/connection";
import { leaderboardService } from "../redis/leaderboard.service";

export interface EloResult {
  player1NewRating: number;
  player2NewRating: number;
  player1RatingChange: number;
  player2RatingChange: number;
}

export interface MatchResult {
  player1Id: string;
  player2Id: string;
  player1Rating: number;
  player2Rating: number;
  winnerId: string | null; // null for draw
}

export class RatingService {
  private readonly K_FACTOR = 32;

  /**
   * Calculate expected score for a player based on rating difference
   * @param playerRating - The player's current rating
   * @param opponentRating - The opponent's current rating
   * @returns Expected score (probability of winning) between 0 and 1
   */
  private calculateExpectedScore(playerRating: number, opponentRating: number): number {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }

  /**
   * Calculate new ELO ratings for both players after a match
   * @param matchResult - Match result with player IDs, ratings, and winner
   * @returns New ratings and rating changes for both players
   */
  calculateEloRatings(matchResult: MatchResult): EloResult {
    const { player1Rating, player2Rating, winnerId, player1Id } = matchResult;

    // Calculate expected scores
    const player1Expected = this.calculateExpectedScore(player1Rating, player2Rating);
    const player2Expected = this.calculateExpectedScore(player2Rating, player1Rating);

    // Determine actual scores (1 for win, 0.5 for draw, 0 for loss)
    let player1Score: number;
    let player2Score: number;

    if (winnerId === null) {
      // Draw
      player1Score = 0.5;
      player2Score = 0.5;
    } else if (winnerId === player1Id) {
      // Player 1 wins
      player1Score = 1;
      player2Score = 0;
    } else {
      // Player 2 wins
      player1Score = 0;
      player2Score = 1;
    }

    // Calculate rating changes
    const player1RatingChange = Math.round(this.K_FACTOR * (player1Score - player1Expected));
    const player2RatingChange = Math.round(this.K_FACTOR * (player2Score - player2Expected));

    // Calculate new ratings
    const player1NewRating = player1Rating + player1RatingChange;
    const player2NewRating = player2Rating + player2RatingChange;

    return {
      player1NewRating,
      player2NewRating,
      player1RatingChange,
      player2RatingChange,
    };
  }

  /**
   * Update player ratings in database and leaderboard after match completion
   * @param matchId - The match ID
   * @param matchResult - Match result with player IDs, ratings, and winner
   * @returns Updated ratings for both players
   */
  async updatePlayerRatings(matchId: string, matchResult: MatchResult): Promise<EloResult> {
    console.log(matchId);
    const { player1Id, player2Id, winnerId } = matchResult;

    // Calculate new ratings
    const eloResult = this.calculateEloRatings(matchResult);

    // Start transaction
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Update player 1
      await client.query(
        `UPDATE users
         SET rating = $1,
             wins = wins + $2,
             losses = losses + $3,
             total_matches = total_matches + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [eloResult.player1NewRating, winnerId === player1Id ? 1 : 0, winnerId === player2Id ? 1 : 0, player1Id]
      );

      // Update player 2
      await client.query(
        `UPDATE users
         SET rating = $1,
             wins = wins + $2,
             losses = losses + $3,
             total_matches = total_matches + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [eloResult.player2NewRating, winnerId === player2Id ? 1 : 0, winnerId === player1Id ? 1 : 0, player2Id]
      );

      await client.query("COMMIT");

      // Update Redis leaderboard (all-time)
      await leaderboardService.updateUserRating(player1Id, eloResult.player1NewRating, "all-time");
      await leaderboardService.updateUserRating(player2Id, eloResult.player2NewRating, "all-time");

      // Update time-based leaderboards
      await leaderboardService.updateUserRating(player1Id, eloResult.player1NewRating, "daily");
      await leaderboardService.updateUserRating(player2Id, eloResult.player2NewRating, "daily");
      await leaderboardService.updateUserRating(player1Id, eloResult.player1NewRating, "weekly");
      await leaderboardService.updateUserRating(player2Id, eloResult.player2NewRating, "weekly");

      return eloResult;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current ratings for both players from database
   * @param player1Id - Player 1 ID
   * @param player2Id - Player 2 ID
   * @returns Current ratings for both players
   */
  async getPlayerRatings(player1Id: string, player2Id: string): Promise<{ player1Rating: number; player2Rating: number }> {
    const result = await pool.query(
      `SELECT id, rating
       FROM users
       WHERE id = ANY($1)`,
      [[player1Id, player2Id]]
    );

    if (result.rows.length !== 2) {
      throw new Error("One or both players not found");
    }

    const player1 = result.rows.find((row) => row.id === player1Id);
    const player2 = result.rows.find((row) => row.id === player2Id);

    if (!player1 || !player2) {
      throw new Error("One or both players not found");
    }

    return {
      player1Rating: player1.rating,
      player2Rating: player2.rating,
    };
  }
}

export const ratingService = new RatingService();

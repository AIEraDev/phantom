/**
 * Example usage of the Rating Service
 *
 * This file demonstrates how to integrate the ELO rating system
 * into the match completion workflow.
 */

import { ratingService } from "./rating.service";
import { pool } from "../db/connection";

/**
 * Example: Complete match and update player ratings
 */
export async function completeMatchWithRatings(matchId: string, player1Id: string, player2Id: string, winnerId: string | null): Promise<void> {
  try {
    // 1. Get current player ratings from database
    const ratings = await ratingService.getPlayerRatings(player1Id, player2Id);

    console.log("Current ratings:");
    console.log(`  Player 1: ${ratings.player1Rating}`);
    console.log(`  Player 2: ${ratings.player2Rating}`);

    // 2. Calculate and update new ratings
    const eloResult = await ratingService.updatePlayerRatings(matchId, {
      player1Id,
      player2Id,
      player1Rating: ratings.player1Rating,
      player2Rating: ratings.player2Rating,
      winnerId,
    });

    // 3. Log rating changes
    console.log("\nRating changes:");
    console.log(`  Player 1: ${ratings.player1Rating} → ${eloResult.player1NewRating} (${eloResult.player1RatingChange > 0 ? "+" : ""}${eloResult.player1RatingChange})`);
    console.log(`  Player 2: ${ratings.player2Rating} → ${eloResult.player2NewRating} (${eloResult.player2RatingChange > 0 ? "+" : ""}${eloResult.player2RatingChange})`);

    // 4. Update match record with winner (if not already done)
    await pool.query(
      `UPDATE matches
       SET winner_id = $1,
           status = 'completed',
           completed_at = NOW()
       WHERE id = $2`,
      [winnerId, matchId]
    );

    console.log("\nMatch completed successfully!");
  } catch (error) {
    console.error("Error completing match:", error);
    throw error;
  }
}

/**
 * Example: Calculate rating change preview without updating
 */
export function previewRatingChange(player1Rating: number, player2Rating: number, winnerId: "player1" | "player2" | "draw"): void {
  const matchResult = {
    player1Id: "player1",
    player2Id: "player2",
    player1Rating,
    player2Rating,
    winnerId: winnerId === "draw" ? null : winnerId,
  };

  const result = ratingService.calculateEloRatings(matchResult);

  console.log("Rating Preview:");
  console.log(`  Player 1: ${player1Rating} → ${result.player1NewRating} (${result.player1RatingChange > 0 ? "+" : ""}${result.player1RatingChange})`);
  console.log(`  Player 2: ${player2Rating} → ${result.player2NewRating} (${result.player2RatingChange > 0 ? "+" : ""}${result.player2RatingChange})`);
}

/**
 * Example scenarios
 */
if (require.main === module) {
  console.log("=== ELO Rating Examples ===\n");

  console.log("Scenario 1: Equal ratings, Player 1 wins");
  previewRatingChange(1000, 1000, "player1");

  console.log("\nScenario 2: Higher-rated player wins (expected)");
  previewRatingChange(1200, 1000, "player1");

  console.log("\nScenario 3: Lower-rated player wins (upset!)");
  previewRatingChange(1000, 1200, "player1");

  console.log("\nScenario 4: Draw between equal players");
  previewRatingChange(1000, 1000, "draw");

  console.log("\nScenario 5: Large rating difference, underdog wins");
  previewRatingChange(1000, 1600, "player1");
}

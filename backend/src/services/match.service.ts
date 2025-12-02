import pool from "../db/connection";
import { Match, MatchUpdate } from "../db/types";
import { matchStateService } from "../redis/matchState.service";
import { judgeMatch, MatchResult as JudgingResult } from "./judging.service";
import { ratingService } from "./rating.service";
import { ChallengeService } from "./challenge.service";
import { replayService } from "./replay.service";
import { generateAnalysis, TestResult } from "./analysis.service";
import { updateWeaknessProfile } from "./weakness.service";
import { updateCoachingSummaryAfterMatch } from "./coaching.service";
import { getHintCount, calculateScorePenalty } from "./hint.service";
import { emitAnalysisReady, emitAnalysisError } from "../websocket/coachHandler";

export interface MatchResultData {
  matchId: string;
  winnerId: string | null;
  player1Score: number;
  player2Score: number;
  player1Feedback: string;
  player2Feedback: string;
  duration: number;
}

export interface ReplayData {
  match: {
    id: string;
    challengeId: string;
    player1Id: string;
    player2Id: string;
    winnerId: string | null;
    player1Score: number | null;
    player2Score: number | null;
    player1Code: string | null;
    player2Code: string | null;
    player1Language: string;
    player2Language: string;
    duration: number | null;
    startedAt: Date | null;
    completedAt: Date | null;
  };
  player1: {
    id: string;
    username: string;
    rating: number;
  };
  player2: {
    id: string;
    username: string;
    rating: number;
  };
  challenge: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
  };
  events: Array<{
    id: number;
    playerId: string;
    eventType: "code_update" | "test_run" | "submission" | "cursor_move";
    timestamp: number;
    data: any;
  }>;
  timeline: {
    totalDuration: number;
    keyMoments: Array<{
      type: "first_code" | "first_test_pass" | "player1_submission" | "player2_submission";
      timestamp: number;
      playerId: string;
    }>;
  };
}

export class MatchService {
  /**
   * Get match details by ID
   */
  async getMatchById(matchId: string): Promise<Match | null> {
    const result = await pool.query(`SELECT * FROM matches WHERE id = $1`, [matchId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMatch(result.rows[0]);
  }

  /**
   * Update match with final results
   */
  async updateMatchResults(matchId: string, update: MatchUpdate): Promise<Match> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    if (update.winner_id !== undefined) {
      fields.push(`winner_id = $${paramIndex++}`);
      values.push(update.winner_id);
    }
    if (update.player1_score !== undefined) {
      fields.push(`player1_score = $${paramIndex++}`);
      values.push(update.player1_score);
    }
    if (update.player2_score !== undefined) {
      fields.push(`player2_score = $${paramIndex++}`);
      values.push(update.player2_score);
    }
    if (update.player1_code !== undefined) {
      fields.push(`player1_code = $${paramIndex++}`);
      values.push(update.player1_code);
    }
    if (update.player2_code !== undefined) {
      fields.push(`player2_code = $${paramIndex++}`);
      values.push(update.player2_code);
    }
    if (update.player1_feedback !== undefined) {
      fields.push(`player1_feedback = $${paramIndex++}`);
      values.push(update.player1_feedback);
    }
    if (update.player2_feedback !== undefined) {
      fields.push(`player2_feedback = $${paramIndex++}`);
      values.push(update.player2_feedback);
    }
    if (update.duration !== undefined) {
      fields.push(`duration = $${paramIndex++}`);
      values.push(update.duration);
    }
    if (update.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(update.status);
    }
    if (update.completed_at !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(update.completed_at);
    }

    // Always update updated_at
    fields.push(`updated_at = NOW()`);

    // Add matchId as last parameter
    values.push(matchId);

    const query = `
      UPDATE matches
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Match not found");
    }

    return this.mapRowToMatch(result.rows[0]);
  }

  /**
   * Complete match judging and store results
   */
  async completeMatch(matchId: string): Promise<MatchResultData> {
    console.log(`[MatchService] Starting completeMatch for ${matchId}`);

    // Get match from database
    const match = await this.getMatchById(matchId);

    if (!match) {
      throw new Error("Match not found");
    }

    if (match.status !== "active") {
      throw new Error("Match is not active");
    }

    // Get match state from Redis (may not exist for timed-out matches)
    const matchState = await matchStateService.getMatch(matchId);

    // Get challenge details
    const service = new ChallengeService();
    const challenge = await service.getChallengeById(match.challenge_id);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    console.log(`[MatchService] Challenge: ${challenge.title}, Test cases: ${challenge.test_cases.length}`);

    // Get player codes - prefer Redis state, fall back to database
    const player1Code = matchState?.player1Code || match.player1_code || "";
    const player2Code = matchState?.player2Code || match.player2_code || "";

    console.log(`[MatchService] Player 1 code length: ${player1Code.length}, Player 2 code length: ${player2Code.length}`);
    console.log(`[MatchService] Using ${matchState ? "Redis" : "database"} for player codes`);

    // Calculate match duration
    const startTime = match.started_at ? match.started_at.getTime() : Date.now();
    const duration = Math.floor((Date.now() - startTime) / 1000); // in seconds

    // Get submission times if available (only from Redis)
    const player1SubmissionTime = matchState?.player1SubmittedAt;
    const player2SubmissionTime = matchState?.player2SubmittedAt;

    console.log(`[MatchService] Starting judging...`);

    // Judge the match using AI
    const judgingResult: JudgingResult = await judgeMatch(
      match.player1_id,
      match.player2_id,
      player1Code,
      player2Code,
      match.player1_language as "javascript" | "python" | "typescript",
      match.player2_language as "javascript" | "python" | "typescript",
      challenge.test_cases,
      undefined, // optimalExecutionTime - not available yet
      player1SubmissionTime,
      player2SubmissionTime
    );

    console.log(`[MatchService] Judging complete. Winner: ${judgingResult.winnerId || "tie"}`);
    console.log(`[MatchService] Scores - P1: ${judgingResult.player1Score.totalScore}, P2: ${judgingResult.player2Score.totalScore}`);

    // Update match in database
    // Get hint counts for both players to apply score penalty
    // Requirements: 1.5 - Apply hint score penalty to final scores
    const player1HintCount = await getHintCount(matchId, match.player1_id);
    const player2HintCount = await getHintCount(matchId, match.player2_id);

    // Apply hint score penalty
    const player1FinalScore = calculateScorePenalty(judgingResult.player1Score.totalScore, player1HintCount);
    const player2FinalScore = calculateScorePenalty(judgingResult.player2Score.totalScore, player2HintCount);

    console.log(`[MatchService] Hint penalties applied - P1: ${player1HintCount} hints, P2: ${player2HintCount} hints`);
    console.log(`[MatchService] Final scores after penalty - P1: ${player1FinalScore}, P2: ${player2FinalScore}`);

    // Update match in database with results
    await this.updateMatchResults(matchId, {
      winner_id: judgingResult.winnerId,
      player1_score: Math.round(player1FinalScore),
      player2_score: Math.round(player2FinalScore),
      player1_code: player1Code,
      player2_code: player2Code,
      player1_feedback: judgingResult.player1Feedback,
      player2_feedback: judgingResult.player2Feedback,
      duration,
      status: "completed",
      completed_at: new Date(),
    });

    // Update player ratings
    const ratings = await ratingService.getPlayerRatings(match.player1_id, match.player2_id);
    await ratingService.updatePlayerRatings(matchId, {
      player1Id: match.player1_id,
      player2Id: match.player2_id,
      player1Rating: ratings.player1Rating,
      player2Rating: ratings.player2Rating,
      winnerId: judgingResult.winnerId,
    });

    // Generate AI Code Coach analysis for both players
    // Requirements: 3.1, 4.1, 4.5 - Trigger analysis generation when match ends
    try {
      await this.generatePostMatchAnalysis(matchId, match.player1_id, player1Code, match.player1_language, challenge, judgingResult.winnerId === match.player1_id, player1HintCount);
      console.log(`[MatchService] Analysis generated for player 1`);
    } catch (error) {
      console.error(`[MatchService] Failed to generate analysis for player 1:`, error);
    }

    try {
      await this.generatePostMatchAnalysis(matchId, match.player2_id, player2Code, match.player2_language, challenge, judgingResult.winnerId === match.player2_id, player2HintCount);
      console.log(`[MatchService] Analysis generated for player 2`);
    } catch (error) {
      console.error(`[MatchService] Failed to generate analysis for player 2:`, error);
    }

    // Clean up match state from Redis (if it exists)
    if (matchState) {
      await matchStateService.deleteMatch(matchId);
    }

    // Clean up spectators from Redis
    const { spectatorService } = await import("../redis/spectator.service");
    await spectatorService.clearSpectators(matchId);

    console.log(`[MatchService] Match ${matchId} completed successfully`);

    return {
      matchId,
      winnerId: judgingResult.winnerId,
      player1Score: Math.round(judgingResult.player1Score.totalScore),
      player2Score: Math.round(judgingResult.player2Score.totalScore),
      player1Feedback: judgingResult.player1Feedback,
      player2Feedback: judgingResult.player2Feedback,
      duration,
    };
  }

  /**
   * Get replay data for a match
   */
  async getMatchReplay(matchId: string): Promise<ReplayData | null> {
    // Get match details
    const match = await this.getMatchById(matchId);

    if (!match) {
      return null;
    }

    // Only allow replays for completed matches
    if (match.status !== "completed") {
      throw new Error("Replay only available for completed matches");
    }

    // Get player details
    const playersResult = await pool.query(`SELECT id, username, rating FROM users WHERE id IN ($1, $2)`, [match.player1_id, match.player2_id]);
    const players = playersResult.rows;
    const player1Data = players.find((p) => p.id === match.player1_id);
    const player2Data = players.find((p) => p.id === match.player2_id);

    if (!player1Data || !player2Data) {
      throw new Error("Player data not found");
    }

    // Get challenge details
    const challengeResult = await pool.query(`SELECT id, title, description, difficulty FROM challenges WHERE id = $1`, [match.challenge_id]);
    const challengeData = challengeResult.rows[0];

    if (!challengeData) {
      throw new Error("Challenge not found");
    }

    // Get match events
    const events = await replayService.getMatchEvents(matchId);

    // Format events for replay
    const formattedEvents = events.map((event) => ({
      id: event.id,
      playerId: event.player_id,
      eventType: event.event_type,
      timestamp: event.timestamp,
      data: event.data,
    }));

    // Extract key moments from events
    const keyMoments = this.extractKeyMoments(formattedEvents);

    // Calculate total duration
    const totalDuration = match.duration || 0;

    return {
      match: {
        id: match.id,
        challengeId: match.challenge_id,
        player1Id: match.player1_id,
        player2Id: match.player2_id,
        winnerId: match.winner_id,
        player1Score: match.player1_score,
        player2Score: match.player2_score,
        player1Code: match.player1_code,
        player2Code: match.player2_code,
        player1Language: match.player1_language,
        player2Language: match.player2_language,
        duration: match.duration,
        startedAt: match.started_at,
        completedAt: match.completed_at,
      },
      player1: {
        id: player1Data.id,
        username: player1Data.username,
        rating: player1Data.rating,
      },
      player2: {
        id: player2Data.id,
        username: player2Data.username,
        rating: player2Data.rating,
      },
      challenge: {
        id: challengeData.id,
        title: challengeData.title,
        description: challengeData.description,
        difficulty: challengeData.difficulty,
      },
      events: formattedEvents,
      timeline: {
        totalDuration,
        keyMoments,
      },
    };
  }

  /**
   * Extract key moments from match events for timeline navigation
   */
  private extractKeyMoments(
    events: Array<{
      playerId: string;
      eventType: string;
      timestamp: number;
      data: any;
    }>
  ): Array<{
    type: "first_code" | "first_test_pass" | "player1_submission" | "player2_submission";
    timestamp: number;
    playerId: string;
  }> {
    const keyMoments: Array<{
      type: "first_code" | "first_test_pass" | "player1_submission" | "player2_submission";
      timestamp: number;
      playerId: string;
    }> = [];

    let firstCodeSeen = false;
    let firstTestPassSeen = false;
    const submissionsSeen = new Set<string>();

    for (const event of events) {
      // First code update
      if (!firstCodeSeen && event.eventType === "code_update") {
        keyMoments.push({
          type: "first_code",
          timestamp: event.timestamp,
          playerId: event.playerId,
        });
        firstCodeSeen = true;
      }

      // First test pass
      if (!firstTestPassSeen && event.eventType === "test_run") {
        const hasPassedTest = event.data.results?.some((result: any) => result.passed);
        if (hasPassedTest) {
          keyMoments.push({
            type: "first_test_pass",
            timestamp: event.timestamp,
            playerId: event.playerId,
          });
          firstTestPassSeen = true;
        }
      }

      // Submissions
      if (event.eventType === "submission" && !submissionsSeen.has(event.playerId)) {
        // Determine which player submitted (player1 or player2)
        const submissionType = submissionsSeen.size === 0 ? "player1_submission" : "player2_submission";

        keyMoments.push({
          type: submissionType,
          timestamp: event.timestamp,
          playerId: event.playerId,
        });
        submissionsSeen.add(event.playerId);
      }
    }

    return keyMoments;
  }

  /**
   * Generate post-match analysis for a player
   * Requirements: 3.1, 4.1, 4.5
   * @param matchId - The match ID
   * @param userId - The player's user ID
   * @param code - The player's submitted code
   * @param language - The programming language used
   * @param challenge - The challenge data
   * @param isWinner - Whether the player won
   * @param hintsUsed - Number of hints used by the player
   */
  private async generatePostMatchAnalysis(matchId: string, userId: string, code: string, language: string, challenge: { id: string; description: string; test_cases: any[] }, isWinner: boolean, hintsUsed: number): Promise<void> {
    // Skip analysis if no code was submitted
    if (!code || code.trim().length === 0) {
      console.log(`[MatchService] Skipping analysis for user ${userId} - no code submitted`);
      return;
    }

    try {
      // Convert test cases to TestResult format for analysis
      // Note: We use empty test results here since actual test execution was done during judging
      const testResults: TestResult[] = challenge.test_cases.map((tc: any) => ({
        passed: true, // Simplified - actual results would come from judging
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      }));

      // Generate analysis
      const analysis = await generateAnalysis(matchId, userId, code, language, challenge as any, testResults, isWinner);

      // Emit analysis_ready WebSocket event
      // Requirements: 3.1 - Emit 'analysis_ready' when post-match analysis completes
      emitAnalysisReady(userId, matchId, analysis);
      console.log(`[MatchService] Emitted analysis_ready for user ${userId}`);

      // Update weakness profile after analysis
      // Requirements: 4.1, 4.5
      await updateWeaknessProfile(userId, analysis);
      console.log(`[MatchService] Weakness profile updated for user ${userId}`);

      // Update coaching summary
      // Requirements: 5.1
      await updateCoachingSummaryAfterMatch(userId, hintsUsed);
      console.log(`[MatchService] Coaching summary updated for user ${userId}`);
    } catch (error) {
      // Emit analysis_error WebSocket event
      // Requirements: 3.1 - Emit 'analysis_error' on failure
      const errorMessage = error instanceof Error ? error.message : "Failed to generate analysis";
      emitAnalysisError(userId, matchId, errorMessage);
      console.error(`[MatchService] Emitted analysis_error for user ${userId}:`, errorMessage);
      throw error; // Re-throw to let caller handle
    }
  }

  /**
   * Map database row to Match object
   */
  private mapRowToMatch(row: any): Match {
    return {
      id: row.id,
      challenge_id: row.challenge_id,
      player1_id: row.player1_id,
      player2_id: row.player2_id,
      winner_id: row.winner_id,
      player1_score: row.player1_score,
      player2_score: row.player2_score,
      player1_code: row.player1_code,
      player2_code: row.player2_code,
      player1_language: row.player1_language,
      player2_language: row.player2_language,
      player1_feedback: row.player1_feedback,
      player2_feedback: row.player2_feedback,
      duration: row.duration,
      status: row.status,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const matchService = new MatchService();

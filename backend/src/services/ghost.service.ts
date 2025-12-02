import pool from "../db/connection";
import { GhostRecording, GhostEvent } from "../db/types";
import { ChallengeService } from "./challenge.service";

/**
 * Ghost Service
 * Handles ghost recordings for ghost mode racing feature
 * Requirements: 14.1, 14.2, 14.5, 14.6
 */
export class GhostService {
  private challengeService: ChallengeService;

  constructor() {
    this.challengeService = new ChallengeService();
  }

  /**
   * Map database row to GhostRecording object
   */
  private mapRowToGhostRecording(row: any): GhostRecording {
    return {
      id: row.id,
      challenge_id: row.challenge_id,
      user_id: row.user_id,
      username: row.username,
      score: row.score,
      duration_ms: row.duration_ms,
      events: typeof row.events === "string" ? JSON.parse(row.events) : row.events,
      is_ai: row.is_ai,
      created_at: row.created_at,
    };
  }

  /**
   * Get ghost recording by ID
   */
  async getGhostById(ghostId: string): Promise<GhostRecording | null> {
    const query = `
      SELECT id, challenge_id, user_id, username, score, duration_ms, events, is_ai, created_at
      FROM ghost_recordings
      WHERE id = $1
    `;

    const result = await pool.query(query, [ghostId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToGhostRecording(result.rows[0]);
  }

  /**
   * Get available ghosts for a challenge
   * Returns top 10 ghosts sorted by score descending
   * Requirements: 14.1
   */
  async getGhostsForChallenge(challengeId: string): Promise<GhostRecording[]> {
    const query = `
      SELECT id, challenge_id, user_id, username, score, duration_ms, events, is_ai, created_at
      FROM ghost_recordings
      WHERE challenge_id = $1
      ORDER BY score DESC
      LIMIT 10
    `;

    const result = await pool.query(query, [challengeId]);

    return result.rows.map((row) => this.mapRowToGhostRecording(row));
  }

  /**
   * Save a new ghost recording from a winning match
   * Requirements: 14.5
   */
  async saveGhostFromMatch(matchId: string, playerId: string): Promise<GhostRecording> {
    // Get match details
    const matchQuery = `
      SELECT m.*, u.username
      FROM matches m
      JOIN users u ON u.id = $2
      WHERE m.id = $1 AND m.status = 'completed'
    `;
    const matchResult = await pool.query(matchQuery, [matchId, playerId]);

    if (matchResult.rows.length === 0) {
      throw new Error("Match not found or not completed");
    }

    const match = matchResult.rows[0];

    // Verify player won the match
    if (match.winner_id !== playerId) {
      throw new Error("Only match winners can save ghost recordings");
    }

    // Get match events for the player
    const eventsQuery = `
      SELECT event_type, timestamp, data
      FROM match_events
      WHERE match_id = $1 AND player_id = $2
      ORDER BY timestamp ASC
    `;
    const eventsResult = await pool.query(eventsQuery, [matchId, playerId]);

    const events: GhostEvent[] = eventsResult.rows.map((row) => ({
      event_type: row.event_type,
      timestamp: row.timestamp,
      data: row.data,
    }));

    // Calculate duration from events
    const durationMs = events.length > 0 ? events[events.length - 1].timestamp - events[0].timestamp : 0;

    // Get player score
    const score = match.player1_id === playerId ? match.player1_score : match.player2_score;

    // Save ghost recording
    const insertQuery = `
      INSERT INTO ghost_recordings (challenge_id, user_id, username, score, duration_ms, events, is_ai)
      VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING id, challenge_id, user_id, username, score, duration_ms, events, is_ai, created_at
    `;

    const insertResult = await pool.query(insertQuery, [match.challenge_id, playerId, match.username, score, durationMs, JSON.stringify(events)]);

    return this.mapRowToGhostRecording(insertResult.rows[0]);
  }

  /**
   * Generate an AI ghost for a challenge
   * Creates ghost from optimal solution with realistic timing
   * Requirements: 14.6
   */
  async generateAIGhost(challengeId: string): Promise<GhostRecording> {
    // Get challenge details
    const challenge = await this.challengeService.getChallengeById(challengeId);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    // Use optimal solution if available, otherwise use starter code
    const optimalCode = challenge.optimal_solution || challenge.starter_code.javascript;

    // Generate realistic typing events with simulated delays
    const events = this.generateTypingEvents(optimalCode);

    // Calculate duration (simulate realistic typing speed)
    const durationMs = events.length > 0 ? events[events.length - 1].timestamp : 0;

    // AI ghost gets a high score (95)
    const score = 95;

    // Save AI ghost recording
    const insertQuery = `
      INSERT INTO ghost_recordings (challenge_id, user_id, username, score, duration_ms, events, is_ai)
      VALUES ($1, '00000000-0000-0000-0000-000000000000', 'AI Ghost', $2, $3, $4, true)
      RETURNING id, challenge_id, user_id, username, score, duration_ms, events, is_ai, created_at
    `;

    const result = await pool.query(insertQuery, [challengeId, score, durationMs, JSON.stringify(events)]);

    return this.mapRowToGhostRecording(result.rows[0]);
  }

  /**
   * Generate realistic typing events from code
   * Simulates human-like typing with variable delays
   */
  private generateTypingEvents(code: string): GhostEvent[] {
    const events: GhostEvent[] = [];
    let currentCode = "";
    let timestamp = 0;

    // Base typing speed: 50-150ms per character
    const baseDelay = 80;
    const variability = 50;

    // Split code into lines for more realistic simulation
    const lines = code.split("\n");
    let lineNumber = 0;

    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        currentCode += line[i];

        // Add variable delay for realistic typing
        const delay = baseDelay + Math.floor(Math.random() * variability);
        timestamp += delay;

        // Add code update event every few characters (batch updates)
        if (i % 5 === 0 || i === line.length - 1) {
          events.push({
            event_type: "code_update",
            timestamp,
            data: {
              code: currentCode + "\n".repeat(lines.length - lineNumber - 1),
              cursor: { line: lineNumber, column: i + 1 },
            },
          });
        }
      }

      // Add newline
      currentCode += "\n";
      lineNumber++;

      // Longer pause at end of lines
      timestamp += 200 + Math.floor(Math.random() * 300);
    }

    // Add test run events at intervals
    const testRunTimestamps = [Math.floor(timestamp * 0.3), Math.floor(timestamp * 0.6), Math.floor(timestamp * 0.85)];

    for (const testTimestamp of testRunTimestamps) {
      events.push({
        event_type: "test_run",
        timestamp: testTimestamp,
        data: {
          results: [
            { passed: true, executionTime: 50 },
            { passed: true, executionTime: 45 },
          ],
        },
      });
    }

    // Add final submission event
    events.push({
      event_type: "submission",
      timestamp,
      data: {
        code,
        language: "javascript",
      },
    });

    // Sort events by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);

    return events;
  }

  /**
   * Get the top ghost (highest scoring) for a challenge
   * Falls back to AI ghost if none exist
   * Requirements: 14.1
   */
  async getTopGhost(challengeId: string): Promise<GhostRecording | null> {
    const query = `
      SELECT id, challenge_id, user_id, username, score, duration_ms, events, is_ai, created_at
      FROM ghost_recordings
      WHERE challenge_id = $1
      ORDER BY score DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [challengeId]);

    if (result.rows.length > 0) {
      return this.mapRowToGhostRecording(result.rows[0]);
    }

    // No ghost exists, generate AI ghost
    return this.generateAIGhost(challengeId);
  }

  /**
   * Delete a ghost recording
   */
  async deleteGhost(ghostId: string): Promise<boolean> {
    const query = `DELETE FROM ghost_recordings WHERE id = $1`;
    const result = await pool.query(query, [ghostId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get ghost count for a challenge
   */
  async getGhostCount(challengeId: string): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ghost_recordings WHERE challenge_id = $1`;
    const result = await pool.query(query, [challengeId]);
    return parseInt(result.rows[0].count, 10);
  }
}

// Export singleton instance
export const ghostService = new GhostService();

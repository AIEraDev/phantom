import pool from "../db/connection";
import { MatchEvent } from "../db/types";

export interface RecordEventData {
  matchId: string;
  playerId: string;
  eventType: "code_update" | "test_run" | "submission" | "cursor_move";
  timestamp: number;
  data: any;
}

export interface TestRunEventData {
  results: Array<{
    input: any;
    expectedOutput: any;
    actualOutput: any;
    passed: boolean;
    executionTime: number;
    memoryUsage: number;
    stderr?: string;
    timedOut?: boolean;
  }>;
}

export interface CodeUpdateEventData {
  code: string;
  cursor: {
    line: number;
    column: number;
  };
}

export interface SubmissionEventData {
  code: string;
  language: string;
}

/**
 * Service for recording match events for replay functionality
 */
export class ReplayService {
  private eventBuffer: RecordEventData[] = [];
  private readonly BATCH_SIZE = 10;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Record a code update event
   */
  async recordCodeUpdate(matchId: string, playerId: string, timestamp: number, code: string, cursor: { line: number; column: number }): Promise<void> {
    const eventData: CodeUpdateEventData = {
      code,
      cursor,
    };

    await this.recordEvent({
      matchId,
      playerId,
      eventType: "code_update",
      timestamp,
      data: eventData,
    });
  }

  /**
   * Record a test run event
   */
  async recordTestRun(matchId: string, playerId: string, timestamp: number, results: TestRunEventData["results"]): Promise<void> {
    const eventData: TestRunEventData = {
      results,
    };

    await this.recordEvent({
      matchId,
      playerId,
      eventType: "test_run",
      timestamp,
      data: eventData,
    });
  }

  /**
   * Record a submission event
   */
  async recordSubmission(matchId: string, playerId: string, timestamp: number, code: string, language: string): Promise<void> {
    const eventData: SubmissionEventData = {
      code,
      language,
    };

    await this.recordEvent({
      matchId,
      playerId,
      eventType: "submission",
      timestamp,
      data: eventData,
    });
  }

  /**
   * Record a cursor move event
   */
  async recordCursorMove(matchId: string, playerId: string, timestamp: number, cursor: { line: number; column: number }): Promise<void> {
    await this.recordEvent({
      matchId,
      playerId,
      eventType: "cursor_move",
      timestamp,
      data: { cursor },
    });
  }

  /**
   * Record a generic event and add to buffer
   */
  private async recordEvent(event: RecordEventData): Promise<void> {
    this.eventBuffer.push(event);

    // Flush if buffer reaches batch size
    if (this.eventBuffer.length >= this.BATCH_SIZE) {
      await this.flushEvents();
    }
  }

  /**
   * Flush buffered events to database
   */
  async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.batchInsertEvents(eventsToFlush);
    } catch (error) {
      console.error("Error flushing events to database:", error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...eventsToFlush);
    }
  }

  /**
   * Batch insert events to database
   */
  private async batchInsertEvents(events: RecordEventData[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const values: any[] = [];
    const placeholders: string[] = [];

    events.forEach((event, index) => {
      const offset = index * 5;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      values.push(event.matchId, event.playerId, event.eventType, event.timestamp, JSON.stringify(event.data));
    });

    const query = `
      INSERT INTO match_events (match_id, player_id, event_type, timestamp, data)
      VALUES ${placeholders.join(", ")}
    `;

    await pool.query(query, values);
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushEvents().catch((error) => {
        console.error("Error in periodic flush:", error);
      });
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop periodic flush timer
   */
  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Get all events for a match (for replay)
   */
  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    const query = `
      SELECT id, match_id, player_id, event_type, timestamp, data, created_at
      FROM match_events
      WHERE match_id = $1
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query, [matchId]);

    return result.rows.map((row) => ({
      id: row.id,
      match_id: row.match_id,
      player_id: row.player_id,
      event_type: row.event_type,
      timestamp: row.timestamp,
      data: row.data,
      created_at: row.created_at,
    }));
  }

  /**
   * Delete all events for a match
   */
  async deleteMatchEvents(matchId: string): Promise<void> {
    const query = "DELETE FROM match_events WHERE match_id = $1";
    await pool.query(query, [matchId]);
  }

  /**
   * Cleanup - flush remaining events and stop timer
   */
  async cleanup(): Promise<void> {
    this.stopPeriodicFlush();
    await this.flushEvents();
  }
}

// Export singleton instance
export const replayService = new ReplayService();

// Cleanup on process exit
process.on("SIGINT", async () => {
  await replayService.cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await replayService.cleanup();
  process.exit(0);
});

import pool from "../db/connection";
import { Challenge } from "../db/types";

export interface ChallengeFilters {
  difficulty?: "easy" | "medium" | "hard" | "expert";
  tags?: string[];
}

export class ChallengeService {
  async getAllChallenges(filters?: ChallengeFilters): Promise<Challenge[]> {
    let query = `SELECT * FROM challenges WHERE 1=1`;
    const values: any[] = [];
    let paramCount = 1;

    // Apply difficulty filter
    if (filters?.difficulty) {
      query += ` AND difficulty = $${paramCount}`;
      values.push(filters.difficulty);
      paramCount++;
    }

    // Apply tags filter (challenges must have ALL specified tags)
    if (filters?.tags && filters.tags.length > 0) {
      query += ` AND tags @> $${paramCount}`;
      values.push(filters.tags);
      paramCount++;
    }

    query += ` ORDER BY difficulty, title`;

    const result = await pool.query<Challenge>(query, values);
    return result.rows.map((row) => this.formatChallenge(row));
  }

  async getChallengeById(challengeId: string): Promise<Challenge | null> {
    const result = await pool.query<Challenge>(`SELECT * FROM challenges WHERE id = $1`, [challengeId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatChallenge(result.rows[0]);
  }

  /**
   * Format challenge data from database
   * Ensures test_cases and starter_code are properly parsed from JSON
   */
  private formatChallenge(row: any): Challenge {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      time_limit: row.time_limit,
      test_cases: typeof row.test_cases === "string" ? JSON.parse(row.test_cases) : row.test_cases,
      starter_code: typeof row.starter_code === "string" ? JSON.parse(row.starter_code) : row.starter_code,
      optimal_solution: row.optimal_solution,
      tags: row.tags,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

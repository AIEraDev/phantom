import { getRedisClient } from "./connection";

export interface Position {
  line: number;
  column: number;
}

export interface MatchState {
  player1Id: string;
  player2Id: string;
  challengeId: string;
  status: "waiting" | "lobby" | "active" | "completed" | "abandoned";
  startedAt?: number;
  player1Ready: boolean;
  player2Ready: boolean;
  player1Code: string;
  player2Code: string;
  player1Cursor: Position;
  player2Cursor: Position;
  player1Language: string;
  player2Language: string;
  player1Submitted?: boolean;
  player2Submitted?: boolean;
  player1SubmittedAt?: number;
  player2SubmittedAt?: number;
}

const MATCH_TTL = 3600; // 1 hour in seconds

export class MatchStateService {
  private getMatchKey(matchId: string): string {
    return `match:${matchId}`;
  }

  async createMatch(matchId: string, state: MatchState): Promise<void> {
    const client = await getRedisClient();
    const key = this.getMatchKey(matchId);

    await client.hSet(key, {
      player1Id: state.player1Id,
      player2Id: state.player2Id,
      challengeId: state.challengeId,
      status: state.status,
      startedAt: state.startedAt?.toString() || "",
      player1Ready: state.player1Ready.toString(),
      player2Ready: state.player2Ready.toString(),
      player1Code: state.player1Code,
      player2Code: state.player2Code,
      player1Cursor: JSON.stringify(state.player1Cursor),
      player2Cursor: JSON.stringify(state.player2Cursor),
      player1Language: state.player1Language,
      player2Language: state.player2Language,
      player1Submitted: (state.player1Submitted || false).toString(),
      player2Submitted: (state.player2Submitted || false).toString(),
      player1SubmittedAt: state.player1SubmittedAt?.toString() || "",
      player2SubmittedAt: state.player2SubmittedAt?.toString() || "",
    });

    await client.expire(key, MATCH_TTL);
  }

  async getMatch(matchId: string): Promise<MatchState | null> {
    const client = await getRedisClient();
    const key = this.getMatchKey(matchId);

    const data = await client.hGetAll(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      player1Id: data.player1Id,
      player2Id: data.player2Id,
      challengeId: data.challengeId,
      status: data.status as MatchState["status"],
      startedAt: data.startedAt ? parseInt(data.startedAt) : undefined,
      player1Ready: data.player1Ready === "true",
      player2Ready: data.player2Ready === "true",
      player1Code: data.player1Code,
      player2Code: data.player2Code,
      player1Cursor: JSON.parse(data.player1Cursor),
      player2Cursor: JSON.parse(data.player2Cursor),
      player1Language: data.player1Language,
      player2Language: data.player2Language,
      player1Submitted: data.player1Submitted === "true",
      player2Submitted: data.player2Submitted === "true",
      player1SubmittedAt: data.player1SubmittedAt ? parseInt(data.player1SubmittedAt) : undefined,
      player2SubmittedAt: data.player2SubmittedAt ? parseInt(data.player2SubmittedAt) : undefined,
    };
  }

  async updateMatchField(matchId: string, field: string, value: string | number | boolean): Promise<void> {
    const client = await getRedisClient();
    const key = this.getMatchKey(matchId);

    await client.hSet(key, field, value.toString());
  }

  async updatePlayerCode(matchId: string, playerId: string, code: string, cursor: Position): Promise<void> {
    const client = await getRedisClient();
    const key = this.getMatchKey(matchId);

    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    const isPlayer1 = match.player1Id === playerId;
    const codeField = isPlayer1 ? "player1Code" : "player2Code";
    const cursorField = isPlayer1 ? "player1Cursor" : "player2Cursor";

    await client.hSet(key, {
      [codeField]: code,
      [cursorField]: JSON.stringify(cursor),
    });
  }

  async updatePlayerReady(matchId: string, playerId: string, ready: boolean): Promise<void> {
    const client = await getRedisClient();
    const key = this.getMatchKey(matchId);

    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    const isPlayer1 = match.player1Id === playerId;
    const readyField = isPlayer1 ? "player1Ready" : "player2Ready";

    await client.hSet(key, readyField, ready.toString());
  }

  async updateMatchStatus(matchId: string, status: MatchState["status"]): Promise<void> {
    await this.updateMatchField(matchId, "status", status);
  }

  async deleteMatch(matchId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getMatchKey(matchId);

    await client.del(key);
  }

  async extendMatchTTL(matchId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getMatchKey(matchId);

    await client.expire(key, MATCH_TTL);
  }

  async markPlayerSubmitted(matchId: string, playerId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getMatchKey(matchId);

    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    const isPlayer1 = match.player1Id === playerId;
    const submittedField = isPlayer1 ? "player1Submitted" : "player2Submitted";
    const submittedAtField = isPlayer1 ? "player1SubmittedAt" : "player2SubmittedAt";

    await client.hSet(key, {
      [submittedField]: "true",
      [submittedAtField]: Date.now().toString(),
    });
  }

  async areBothPlayersSubmitted(matchId: string): Promise<boolean> {
    const match = await this.getMatch(matchId);
    if (!match) {
      console.log(`[areBothPlayersSubmitted] Match ${matchId} not found in Redis`);
      return false;
    }

    console.log(`[areBothPlayersSubmitted] Match ${matchId}: P1=${match.player1Submitted}, P2=${match.player2Submitted}`);
    return match.player1Submitted === true && match.player2Submitted === true;
  }
}

export const matchStateService = new MatchStateService();

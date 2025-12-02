/**
 * Unit Tests for PowerUpStateManager
 * Tests serialization/deserialization and CRUD operations on power-up state
 * Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MatchPowerUpState, PlayerPowerUpState, PowerUpInventory, ActivePowerUpEffect, createDefaultMatchPowerUpState, createDefaultPlayerPowerUpState } from "../types/powerups";

// Mock Redis client - must be defined before vi.mock
vi.mock("./connection", () => {
  const mockClient = {
    hSet: vi.fn().mockResolvedValue(1),
    hGetAll: vi.fn().mockResolvedValue({}),
    del: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
  };
  return {
    getRedisClient: vi.fn().mockResolvedValue(mockClient),
    __mockClient: mockClient,
  };
});

// Import after mocking
import { PowerUpStateManager } from "./powerUpState.service";
import * as connectionModule from "./connection";

// Get the mock client for assertions
const getMockClient = () =>
  (
    connectionModule as unknown as {
      __mockClient: {
        hSet: ReturnType<typeof vi.fn>;
        hGetAll: ReturnType<typeof vi.fn>;
        del: ReturnType<typeof vi.fn>;
        expire: ReturnType<typeof vi.fn>;
      };
    }
  ).__mockClient;

describe("PowerUpStateManager", () => {
  let manager: PowerUpStateManager;
  let mockRedisClient: ReturnType<typeof getMockClient>;

  beforeEach(() => {
    manager = new PowerUpStateManager();
    mockRedisClient = getMockClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("setPowerUpState", () => {
    it("should serialize and store power-up state in Redis", async () => {
      const matchId = "test-match-123";
      const state = createDefaultMatchPowerUpState(matchId, "player1", "player2");

      await manager.setPowerUpState(matchId, state);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        `match:${matchId}:powerups`,
        expect.objectContaining({
          player1State: expect.any(String),
          player2State: expect.any(String),
          matchId: matchId,
          createdAt: state.createdAt.toString(),
          updatedAt: expect.any(String),
        })
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(`match:${matchId}:powerups`, 3600);
    });

    it("should serialize player state as JSON strings", async () => {
      const matchId = "test-match-456";
      const state = createDefaultMatchPowerUpState(matchId, "p1", "p2");

      await manager.setPowerUpState(matchId, state);

      const call = mockRedisClient.hSet.mock.calls[0];
      const storedData = call[1] as Record<string, string>;

      // Verify JSON serialization
      const player1Parsed = JSON.parse(storedData.player1State);
      const player2Parsed = JSON.parse(storedData.player2State);

      expect(player1Parsed.playerId).toBe("p1");
      expect(player2Parsed.playerId).toBe("p2");
      expect(player1Parsed.inventory.timeFreeze).toBe(1);
      expect(player2Parsed.inventory.codePeek).toBe(1);
    });
  });

  describe("getPowerUpState", () => {
    it("should return null when no state exists", async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({});

      const result = await manager.getPowerUpState("nonexistent-match");

      expect(result).toBeNull();
    });

    it("should deserialize and return power-up state from Redis", async () => {
      const matchId = "test-match-789";
      const player1State: PlayerPowerUpState = {
        playerId: "player1",
        inventory: { timeFreeze: 1, codePeek: 0, debugShield: 1 },
        cooldownUntil: null,
        activeEffect: null,
      };
      const player2State: PlayerPowerUpState = {
        playerId: "player2",
        inventory: { timeFreeze: 0, codePeek: 1, debugShield: 0 },
        cooldownUntil: Date.now() + 30000,
        activeEffect: {
          type: "time_freeze",
          activatedAt: Date.now(),
          expiresAt: Date.now() + 30000,
        },
      };

      mockRedisClient.hGetAll.mockResolvedValueOnce({
        matchId,
        player1State: JSON.stringify(player1State),
        player2State: JSON.stringify(player2State),
        createdAt: "1700000000000",
        updatedAt: "1700000001000",
      });

      const result = await manager.getPowerUpState(matchId);

      expect(result).not.toBeNull();
      expect(result!.matchId).toBe(matchId);
      expect(result!.player1.playerId).toBe("player1");
      expect(result!.player2.playerId).toBe("player2");
      expect(result!.player1.inventory.codePeek).toBe(0);
      expect(result!.player2.cooldownUntil).toBeGreaterThan(0);
      expect(result!.player2.activeEffect?.type).toBe("time_freeze");
    });

    it("should correctly deserialize active effects with remainingCharges", async () => {
      const matchId = "test-match-shield";
      const playerState: PlayerPowerUpState = {
        playerId: "player1",
        inventory: { timeFreeze: 1, codePeek: 1, debugShield: 0 },
        cooldownUntil: null,
        activeEffect: {
          type: "debug_shield",
          activatedAt: Date.now(),
          expiresAt: Date.now() + 60000,
          remainingCharges: 2,
        },
      };

      mockRedisClient.hGetAll.mockResolvedValueOnce({
        matchId,
        player1State: JSON.stringify(playerState),
        player2State: JSON.stringify(createDefaultPlayerPowerUpState("player2")),
        createdAt: "1700000000000",
        updatedAt: "1700000001000",
      });

      const result = await manager.getPowerUpState(matchId);

      expect(result!.player1.activeEffect?.type).toBe("debug_shield");
      expect(result!.player1.activeEffect?.remainingCharges).toBe(2);
    });
  });

  describe("updatePlayerInventory", () => {
    it("should update player1 inventory correctly", async () => {
      const matchId = "test-match-inv";
      const existingState = createDefaultMatchPowerUpState(matchId, "p1", "p2");

      mockRedisClient.hGetAll.mockResolvedValueOnce({
        matchId,
        player1State: JSON.stringify(existingState.player1),
        player2State: JSON.stringify(existingState.player2),
        createdAt: existingState.createdAt.toString(),
        updatedAt: existingState.updatedAt.toString(),
      });

      const newInventory: PowerUpInventory = {
        timeFreeze: 0,
        codePeek: 1,
        debugShield: 1,
      };

      await manager.updatePlayerInventory(matchId, "p1", newInventory);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        `match:${matchId}:powerups`,
        expect.objectContaining({
          player1State: expect.any(String),
          updatedAt: expect.any(String),
        })
      );

      const call = mockRedisClient.hSet.mock.calls[0];
      const updatedPlayer1 = JSON.parse((call[1] as Record<string, string>).player1State);
      expect(updatedPlayer1.inventory.timeFreeze).toBe(0);
    });

    it("should throw error when state not found", async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({});

      await expect(
        manager.updatePlayerInventory("nonexistent", "p1", {
          timeFreeze: 0,
          codePeek: 0,
          debugShield: 0,
        })
      ).rejects.toThrow("Power-up state not found for match");
    });
  });

  describe("updateCooldown", () => {
    it("should update player cooldown timestamp", async () => {
      const matchId = "test-match-cd";
      const existingState = createDefaultMatchPowerUpState(matchId, "p1", "p2");
      const cooldownUntil = Date.now() + 60000;

      mockRedisClient.hGetAll.mockResolvedValueOnce({
        matchId,
        player1State: JSON.stringify(existingState.player1),
        player2State: JSON.stringify(existingState.player2),
        createdAt: existingState.createdAt.toString(),
        updatedAt: existingState.updatedAt.toString(),
      });

      await manager.updateCooldown(matchId, "p1", cooldownUntil);

      const call = mockRedisClient.hSet.mock.calls[0];
      const updatedPlayer1 = JSON.parse((call[1] as Record<string, string>).player1State);
      expect(updatedPlayer1.cooldownUntil).toBe(cooldownUntil);
    });

    it("should clear cooldown when set to null", async () => {
      const matchId = "test-match-cd-clear";
      const existingState = createDefaultMatchPowerUpState(matchId, "p1", "p2");
      existingState.player1.cooldownUntil = Date.now() + 30000;

      mockRedisClient.hGetAll.mockResolvedValueOnce({
        matchId,
        player1State: JSON.stringify(existingState.player1),
        player2State: JSON.stringify(existingState.player2),
        createdAt: existingState.createdAt.toString(),
        updatedAt: existingState.updatedAt.toString(),
      });

      await manager.updateCooldown(matchId, "p1", null);

      const call = mockRedisClient.hSet.mock.calls[0];
      const updatedPlayer1 = JSON.parse((call[1] as Record<string, string>).player1State);
      expect(updatedPlayer1.cooldownUntil).toBeNull();
    });

    it("should throw error when state not found", async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({});

      await expect(manager.updateCooldown("nonexistent", "p1", Date.now())).rejects.toThrow("Power-up state not found for match");
    });
  });

  describe("updateActiveEffect", () => {
    it("should set active effect for player", async () => {
      const matchId = "test-match-effect";
      const existingState = createDefaultMatchPowerUpState(matchId, "p1", "p2");
      const effect: ActivePowerUpEffect = {
        type: "time_freeze",
        activatedAt: Date.now(),
        expiresAt: Date.now() + 30000,
      };

      mockRedisClient.hGetAll.mockResolvedValueOnce({
        matchId,
        player1State: JSON.stringify(existingState.player1),
        player2State: JSON.stringify(existingState.player2),
        createdAt: existingState.createdAt.toString(),
        updatedAt: existingState.updatedAt.toString(),
      });

      await manager.updateActiveEffect(matchId, "p1", effect);

      const call = mockRedisClient.hSet.mock.calls[0];
      const updatedPlayer1 = JSON.parse((call[1] as Record<string, string>).player1State);
      expect(updatedPlayer1.activeEffect.type).toBe("time_freeze");
      expect(updatedPlayer1.activeEffect.expiresAt).toBe(effect.expiresAt);
    });

    it("should clear active effect when set to null", async () => {
      const matchId = "test-match-effect-clear";
      const existingState = createDefaultMatchPowerUpState(matchId, "p1", "p2");
      existingState.player1.activeEffect = {
        type: "debug_shield",
        activatedAt: Date.now(),
        expiresAt: Date.now() + 60000,
        remainingCharges: 1,
      };

      mockRedisClient.hGetAll.mockResolvedValueOnce({
        matchId,
        player1State: JSON.stringify(existingState.player1),
        player2State: JSON.stringify(existingState.player2),
        createdAt: existingState.createdAt.toString(),
        updatedAt: existingState.updatedAt.toString(),
      });

      await manager.updateActiveEffect(matchId, "p1", null);

      const call = mockRedisClient.hSet.mock.calls[0];
      const updatedPlayer1 = JSON.parse((call[1] as Record<string, string>).player1State);
      expect(updatedPlayer1.activeEffect).toBeNull();
    });

    it("should update player2 effect correctly", async () => {
      const matchId = "test-match-p2-effect";
      const existingState = createDefaultMatchPowerUpState(matchId, "p1", "p2");
      const effect: ActivePowerUpEffect = {
        type: "debug_shield",
        activatedAt: Date.now(),
        expiresAt: Date.now() + 60000,
        remainingCharges: 3,
      };

      mockRedisClient.hGetAll.mockResolvedValueOnce({
        matchId,
        player1State: JSON.stringify(existingState.player1),
        player2State: JSON.stringify(existingState.player2),
        createdAt: existingState.createdAt.toString(),
        updatedAt: existingState.updatedAt.toString(),
      });

      await manager.updateActiveEffect(matchId, "p2", effect);

      const call = mockRedisClient.hSet.mock.calls[0];
      expect((call[1] as Record<string, string>).player2State).toBeDefined();
      const updatedPlayer2 = JSON.parse((call[1] as Record<string, string>).player2State);
      expect(updatedPlayer2.activeEffect.type).toBe("debug_shield");
      expect(updatedPlayer2.activeEffect.remainingCharges).toBe(3);
    });

    it("should throw error when state not found", async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({});

      await expect(manager.updateActiveEffect("nonexistent", "p1", null)).rejects.toThrow("Power-up state not found for match");
    });
  });

  describe("deletePowerUpState", () => {
    it("should delete power-up state from Redis", async () => {
      const matchId = "test-match-delete";

      await manager.deletePowerUpState(matchId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`match:${matchId}:powerups`);
    });
  });

  describe("extendPowerUpStateTTL", () => {
    it("should extend TTL for power-up state", async () => {
      const matchId = "test-match-ttl";

      await manager.extendPowerUpStateTTL(matchId);

      expect(mockRedisClient.expire).toHaveBeenCalledWith(`match:${matchId}:powerups`, 3600);
    });
  });

  describe("Serialization round-trip (Requirements 9.1, 9.2, 9.3)", () => {
    it("should preserve all fields through set/get cycle", async () => {
      const matchId = "test-roundtrip";
      const originalState: MatchPowerUpState = {
        matchId,
        player1: {
          playerId: "player1",
          inventory: { timeFreeze: 0, codePeek: 1, debugShield: 0 },
          cooldownUntil: Date.now() + 45000,
          activeEffect: {
            type: "code_peek",
            activatedAt: Date.now() - 2000,
            expiresAt: Date.now() + 3000,
          },
        },
        player2: {
          playerId: "player2",
          inventory: { timeFreeze: 1, codePeek: 0, debugShield: 1 },
          cooldownUntil: null,
          activeEffect: null,
        },
        createdAt: Date.now() - 60000,
        updatedAt: Date.now(),
      };

      // Capture what gets stored
      let storedData: Record<string, string> = {};
      mockRedisClient.hSet.mockImplementationOnce((_key: string, data: Record<string, string>) => {
        storedData = data;
        return Promise.resolve(1);
      });

      await manager.setPowerUpState(matchId, originalState);

      // Return the stored data on get
      mockRedisClient.hGetAll.mockResolvedValueOnce(storedData);

      const retrievedState = await manager.getPowerUpState(matchId);

      // Verify round-trip preserves data
      expect(retrievedState).not.toBeNull();
      expect(retrievedState!.matchId).toBe(originalState.matchId);
      expect(retrievedState!.player1.playerId).toBe(originalState.player1.playerId);
      expect(retrievedState!.player1.inventory.timeFreeze).toBe(0);
      expect(retrievedState!.player1.inventory.codePeek).toBe(1);
      expect(retrievedState!.player1.cooldownUntil).toBe(originalState.player1.cooldownUntil);
      expect(retrievedState!.player1.activeEffect?.type).toBe("code_peek");
      expect(retrievedState!.player2.activeEffect).toBeNull();
    });
  });
});

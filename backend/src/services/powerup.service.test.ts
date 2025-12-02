/**
 * Property-Based Tests for PowerUpService
 * Tests correctness properties for power-up service operations
 */

import { describe, it, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { PowerUpService } from "./powerup.service";
import { powerUpStateManager } from "../redis/powerUpState.service";
import { matchStateService } from "../redis/matchState.service";
import { MatchPowerUpState, PowerUpType, PowerUpInventory, ActivePowerUpEffect, POWERUP_COOLDOWN_MS, DEBUG_SHIELD_CHARGES } from "../types/powerups";

// Mock the Redis services
vi.mock("../redis/powerUpState.service", () => ({
  powerUpStateManager: {
    setPowerUpState: vi.fn(),
    getPowerUpState: vi.fn(),
    updatePlayerInventory: vi.fn(),
    updateCooldown: vi.fn(),
    updateActiveEffect: vi.fn(),
  },
}));

vi.mock("../redis/matchState.service", () => ({
  matchStateService: {
    getMatch: vi.fn(),
  },
}));

// In-memory store for testing
let mockPowerUpStore: Map<string, MatchPowerUpState>;

describe("PowerUpService Property Tests", () => {
  let service: PowerUpService;

  beforeEach(() => {
    service = new PowerUpService();
    mockPowerUpStore = new Map();

    // Setup mock implementations
    vi.mocked(powerUpStateManager.setPowerUpState).mockImplementation(async (matchId: string, state: MatchPowerUpState) => {
      mockPowerUpStore.set(matchId, JSON.parse(JSON.stringify(state)));
    });

    vi.mocked(powerUpStateManager.getPowerUpState).mockImplementation(async (matchId: string) => {
      const state = mockPowerUpStore.get(matchId);
      return state ? JSON.parse(JSON.stringify(state)) : null;
    });

    vi.mocked(powerUpStateManager.updatePlayerInventory).mockImplementation(async (matchId: string, playerId: string, inventory: PowerUpInventory) => {
      const state = mockPowerUpStore.get(matchId);
      if (state) {
        if (state.player1.playerId === playerId) {
          state.player1.inventory = inventory;
        } else {
          state.player2.inventory = inventory;
        }
        state.updatedAt = Date.now();
      }
    });

    vi.mocked(powerUpStateManager.updateCooldown).mockImplementation(async (matchId: string, playerId: string, cooldownUntil: number | null) => {
      const state = mockPowerUpStore.get(matchId);
      if (state) {
        if (state.player1.playerId === playerId) {
          state.player1.cooldownUntil = cooldownUntil;
        } else {
          state.player2.cooldownUntil = cooldownUntil;
        }
        state.updatedAt = Date.now();
      }
    });

    vi.mocked(powerUpStateManager.updateActiveEffect).mockImplementation(async (matchId: string, playerId: string, effect: ActivePowerUpEffect | null) => {
      const state = mockPowerUpStore.get(matchId);
      if (state) {
        if (state.player1.playerId === playerId) {
          state.player1.activeEffect = effect;
        } else {
          state.player2.activeEffect = effect;
        }
        state.updatedAt = Date.now();
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockPowerUpStore.clear();
  });

  /**
   * **Feature: power-ups-system, Property 1: Power-up allocation invariant**
   * For any match that transitions to active status, both players SHALL have
   * exactly one Time Freeze, one Code Peek, and one Debug Shield in their inventory.
   * **Validates: Requirements 1.1, 1.2**
   */
  describe("Property 1: Power-up allocation invariant", () => {
    it("should allocate exactly 1 of each power-up to both players on initialization", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (matchId, player1Id, player2Id) => {
          // Initialize power-ups for the match
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Get the stored state
          const state = mockPowerUpStore.get(matchId);

          // Property: State must exist
          if (!state) return false;

          // Property: Player 1 must have exactly 1 of each power-up
          if (state.player1.inventory.timeFreeze !== 1) return false;
          if (state.player1.inventory.codePeek !== 1) return false;
          if (state.player1.inventory.debugShield !== 1) return false;

          // Property: Player 2 must have exactly 1 of each power-up
          if (state.player2.inventory.timeFreeze !== 1) return false;
          if (state.player2.inventory.codePeek !== 1) return false;
          if (state.player2.inventory.debugShield !== 1) return false;

          // Property: Player IDs must be correctly assigned
          if (state.player1.playerId !== player1Id) return false;
          if (state.player2.playerId !== player2Id) return false;

          // Property: Match ID must be correctly assigned
          if (state.matchId !== matchId) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should initialize players with no active effects and no cooldown", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (matchId, player1Id, player2Id) => {
          await service.initializePowerUps(matchId, player1Id, player2Id);

          const state = mockPowerUpStore.get(matchId);
          if (!state) return false;

          // Property: No active effects at start
          if (state.player1.activeEffect !== null) return false;
          if (state.player2.activeEffect !== null) return false;

          // Property: No cooldown at start
          if (state.player1.cooldownUntil !== null) return false;
          if (state.player2.cooldownUntil !== null) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: power-ups-system, Property 2: Power-up consumption decrements inventory**
   * For any valid power-up activation (player has power-up available and not on cooldown),
   * the corresponding power-up count in the player's inventory SHALL decrease by exactly one.
   * **Validates: Requirements 1.4**
   */
  describe("Property 2: Power-up consumption decrements inventory", () => {
    const powerUpTypeArb: fc.Arbitrary<PowerUpType> = fc.constantFrom("time_freeze", "code_peek", "debug_shield");

    it("should decrement the corresponding power-up count by exactly one on activation", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), powerUpTypeArb, async (matchId, player1Id, player2Id, powerUpType) => {
          // Setup: Initialize power-ups
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state for code_peek
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code: "// player 1 code",
            player2Code: "// player 2 code",
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          // Get inventory before activation
          const stateBefore = mockPowerUpStore.get(matchId);
          if (!stateBefore) return false;

          const inventoryBefore = { ...stateBefore.player1.inventory };

          // Act: Activate power-up
          const result = await service.activatePowerUp(matchId, player1Id, powerUpType);

          // Property: Activation should succeed
          if (!result.success) return false;

          // Get inventory after activation
          const stateAfter = mockPowerUpStore.get(matchId);
          if (!stateAfter) return false;

          const inventoryAfter = stateAfter.player1.inventory;

          // Property: The activated power-up count should decrease by exactly 1
          switch (powerUpType) {
            case "time_freeze":
              if (inventoryAfter.timeFreeze !== inventoryBefore.timeFreeze - 1) return false;
              // Other power-ups should remain unchanged
              if (inventoryAfter.codePeek !== inventoryBefore.codePeek) return false;
              if (inventoryAfter.debugShield !== inventoryBefore.debugShield) return false;
              break;
            case "code_peek":
              if (inventoryAfter.codePeek !== inventoryBefore.codePeek - 1) return false;
              // Other power-ups should remain unchanged
              if (inventoryAfter.timeFreeze !== inventoryBefore.timeFreeze) return false;
              if (inventoryAfter.debugShield !== inventoryBefore.debugShield) return false;
              break;
            case "debug_shield":
              if (inventoryAfter.debugShield !== inventoryBefore.debugShield - 1) return false;
              // Other power-ups should remain unchanged
              if (inventoryAfter.timeFreeze !== inventoryBefore.timeFreeze) return false;
              if (inventoryAfter.codePeek !== inventoryBefore.codePeek) return false;
              break;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should not decrement inventory when activation fails due to zero count", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), powerUpTypeArb, async (matchId, player1Id, player2Id, powerUpType) => {
          // Setup: Initialize power-ups
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code: "// player 1 code",
            player2Code: "// player 2 code",
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          // Set the specific power-up count to 0
          const state = mockPowerUpStore.get(matchId);
          if (!state) return false;

          switch (powerUpType) {
            case "time_freeze":
              state.player1.inventory.timeFreeze = 0;
              break;
            case "code_peek":
              state.player1.inventory.codePeek = 0;
              break;
            case "debug_shield":
              state.player1.inventory.debugShield = 0;
              break;
          }

          const inventoryBefore = { ...state.player1.inventory };

          // Act: Try to activate power-up with zero count
          const result = await service.activatePowerUp(matchId, player1Id, powerUpType);

          // Property: Activation should fail with NO_POWERUP error
          if (result.success) return false;
          if (result.errorCode !== "NO_POWERUP") return false;

          // Property: Inventory should remain unchanged
          const stateAfter = mockPowerUpStore.get(matchId);
          if (!stateAfter) return false;

          if (stateAfter.player1.inventory.timeFreeze !== inventoryBefore.timeFreeze) return false;
          if (stateAfter.player1.inventory.codePeek !== inventoryBefore.codePeek) return false;
          if (stateAfter.player1.inventory.debugShield !== inventoryBefore.debugShield) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should decrement only the specific power-up type used, leaving others unchanged", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          // Generate initial inventory with multiple power-ups
          fc.record({
            timeFreeze: fc.integer({ min: 1, max: 5 }),
            codePeek: fc.integer({ min: 1, max: 5 }),
            debugShield: fc.integer({ min: 1, max: 5 }),
          }),
          powerUpTypeArb,
          async (matchId, player1Id, player2Id, initialInventory, powerUpType) => {
            // Setup: Initialize power-ups
            await service.initializePowerUps(matchId, player1Id, player2Id);

            // Set custom inventory
            const state = mockPowerUpStore.get(matchId);
            if (!state) return false;
            state.player1.inventory = { ...initialInventory };

            // Mock match state
            vi.mocked(matchStateService.getMatch).mockResolvedValue({
              player1Id,
              player2Id,
              challengeId: "test-challenge",
              status: "active",
              player1Ready: true,
              player2Ready: true,
              player1Code: "// player 1 code",
              player2Code: "// player 2 code",
              player1Cursor: { line: 1, column: 1 },
              player2Cursor: { line: 1, column: 1 },
              player1Language: "javascript",
              player2Language: "javascript",
            });

            // Act: Activate power-up
            const result = await service.activatePowerUp(matchId, player1Id, powerUpType);

            // Property: Activation should succeed
            if (!result.success) return false;

            // Get inventory after activation
            const stateAfter = mockPowerUpStore.get(matchId);
            if (!stateAfter) return false;

            const inventoryAfter = stateAfter.player1.inventory;

            // Property: Only the used power-up should be decremented by exactly 1
            const expectedTimeFreeze = powerUpType === "time_freeze" ? initialInventory.timeFreeze - 1 : initialInventory.timeFreeze;
            const expectedCodePeek = powerUpType === "code_peek" ? initialInventory.codePeek - 1 : initialInventory.codePeek;
            const expectedDebugShield = powerUpType === "debug_shield" ? initialInventory.debugShield - 1 : initialInventory.debugShield;

            if (inventoryAfter.timeFreeze !== expectedTimeFreeze) return false;
            if (inventoryAfter.codePeek !== expectedCodePeek) return false;
            if (inventoryAfter.debugShield !== expectedDebugShield) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: power-ups-system, Property 6: Cooldown enforcement**
   * For any power-up activation, a 60-second cooldown SHALL be initiated, and
   * for any subsequent activation attempt within that period, the system SHALL
   * reject the request and return the remaining cooldown time.
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   */
  describe("Property 6: Cooldown enforcement", () => {
    const powerUpTypeArb: fc.Arbitrary<PowerUpType> = fc.constantFrom("time_freeze", "code_peek", "debug_shield");

    it("should start 60-second cooldown after power-up activation", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), powerUpTypeArb, async (matchId, player1Id, player2Id, powerUpType) => {
          // Setup: Initialize match and mock match state for code_peek
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state for code_peek
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code: "// player 1 code",
            player2Code: "// player 2 code",
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          const beforeActivation = Date.now();

          // Act: Activate power-up
          const result = await service.activatePowerUp(matchId, player1Id, powerUpType);

          // Property: Activation should succeed
          if (!result.success) return false;

          // Property: Cooldown should be set to ~60 seconds from now
          const state = mockPowerUpStore.get(matchId);
          if (!state) return false;

          const cooldownUntil = state.player1.cooldownUntil;
          if (cooldownUntil === null) return false;

          // Cooldown should be approximately 60 seconds from activation
          const expectedCooldown = beforeActivation + POWERUP_COOLDOWN_MS;
          const tolerance = 1000; // 1 second tolerance
          if (Math.abs(cooldownUntil - expectedCooldown) > tolerance) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should reject activation during cooldown and return remaining time", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          powerUpTypeArb,
          fc.integer({ min: 1000, max: 59000 }), // Time elapsed during cooldown (1-59 seconds)
          async (matchId, player1Id, player2Id, powerUpType, elapsedTime) => {
            // Setup: Initialize match
            await service.initializePowerUps(matchId, player1Id, player2Id);

            // Mock match state
            vi.mocked(matchStateService.getMatch).mockResolvedValue({
              player1Id,
              player2Id,
              challengeId: "test-challenge",
              status: "active",
              player1Ready: true,
              player2Ready: true,
              player1Code: "// player 1 code",
              player2Code: "// player 2 code",
              player1Cursor: { line: 1, column: 1 },
              player2Cursor: { line: 1, column: 1 },
              player1Language: "javascript",
              player2Language: "javascript",
            });

            // First activation should succeed
            await service.activatePowerUp(matchId, player1Id, powerUpType);

            // Simulate time passing (but still within cooldown)
            const state = mockPowerUpStore.get(matchId);
            if (!state) return false;

            // Set cooldown to future time (simulating we're still in cooldown)
            const now = Date.now();
            const remainingCooldown = POWERUP_COOLDOWN_MS - elapsedTime;
            state.player1.cooldownUntil = now + remainingCooldown;

            // Give player another power-up to try
            state.player1.inventory = {
              timeFreeze: 1,
              codePeek: 1,
              debugShield: 1,
            };

            // Try to activate another power-up during cooldown
            const result = await service.activatePowerUp(matchId, player1Id, "time_freeze");

            // Property: Should be rejected with ON_COOLDOWN error
            if (result.success) return false;
            if (result.errorCode !== "ON_COOLDOWN") return false;

            // Property: Should return remaining cooldown time
            if (result.cooldownRemaining === undefined) return false;
            if (result.cooldownRemaining <= 0) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should allow activation after cooldown expires", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (matchId, player1Id, player2Id) => {
          // Setup: Initialize match
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code: "// player 1 code",
            player2Code: "// player 2 code",
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          // Set expired cooldown (in the past)
          const state = mockPowerUpStore.get(matchId);
          if (!state) return false;
          state.player1.cooldownUntil = Date.now() - 1000; // 1 second ago

          // Check if can use power-up
          const canUseResult = await service.canUsePowerUp(matchId, player1Id);

          // Property: Should be able to use power-up after cooldown expires
          if (!canUseResult.canUse) return false;
          if (canUseResult.cooldownRemaining !== 0) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: power-ups-system, Property 4: Code Peek returns opponent's current code**
   * For any Code Peek activation, the returned code snapshot SHALL equal the opponent's
   * current code stored in the match state at the moment of activation.
   * **Validates: Requirements 3.1**
   */
  describe("Property 4: Code Peek returns opponent's current code", () => {
    // Arbitrary for generating random code strings
    const codeArb = fc.string({ minLength: 0, maxLength: 1000 });

    it("should return player2's code when player1 activates Code Peek", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), codeArb, codeArb, async (matchId, player1Id, player2Id, player1Code, player2Code) => {
          // Setup: Initialize power-ups
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state with the generated code
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code,
            player2Code,
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          // Act: Player 1 activates Code Peek
          const result = await service.activatePowerUp(matchId, player1Id, "code_peek");

          // Property: Activation should succeed
          if (!result.success) return false;

          // Property: Returned code should equal opponent's (player2's) current code
          if (result.opponentCode !== player2Code) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should return player1's code when player2 activates Code Peek", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), codeArb, codeArb, async (matchId, player1Id, player2Id, player1Code, player2Code) => {
          // Setup: Initialize power-ups
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state with the generated code
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code,
            player2Code,
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          // Act: Player 2 activates Code Peek
          const result = await service.activatePowerUp(matchId, player2Id, "code_peek");

          // Property: Activation should succeed
          if (!result.success) return false;

          // Property: Returned code should equal opponent's (player1's) current code
          if (result.opponentCode !== player1Code) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should return exact snapshot of opponent code at activation moment", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          // Generate code with various characters including special chars, newlines, etc.
          fc.string({ minLength: 1, maxLength: 500 }).chain((baseCode) =>
            fc.record({
              player1Code: fc.constant(baseCode + "\n// player 1"),
              player2Code: fc.constant(baseCode + "\n// player 2"),
            })
          ),
          async (matchId, player1Id, player2Id, codes) => {
            // Setup: Initialize power-ups
            await service.initializePowerUps(matchId, player1Id, player2Id);

            const { player1Code, player2Code } = codes;

            // Mock match state
            vi.mocked(matchStateService.getMatch).mockResolvedValue({
              player1Id,
              player2Id,
              challengeId: "test-challenge",
              status: "active",
              player1Ready: true,
              player2Ready: true,
              player1Code,
              player2Code,
              player1Cursor: { line: 1, column: 1 },
              player2Cursor: { line: 1, column: 1 },
              player1Language: "javascript",
              player2Language: "javascript",
            });

            // Act: Player 1 activates Code Peek
            const result = await service.activatePowerUp(matchId, player1Id, "code_peek");

            // Property: Should succeed
            if (!result.success) return false;

            // Property: Code should be an exact match (byte-for-byte)
            if (result.opponentCode !== player2Code) return false;

            // Property: Code should preserve special characters and whitespace
            if (result.opponentCode?.length !== player2Code.length) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: power-ups-system, Property 5: Debug Shield lifecycle**
   * For any Debug Shield activation, the shield SHALL start with 3 charges,
   * each test run while active SHALL consume exactly one charge, and the shield
   * SHALL deactivate when charges reach zero.
   * **Validates: Requirements 4.1, 4.2, 4.3**
   */
  describe("Property 5: Debug Shield lifecycle", () => {
    it("should start Debug Shield with exactly 3 charges", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (matchId, player1Id, player2Id) => {
          // Setup: Initialize power-ups
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code: "// code",
            player2Code: "// code",
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          // Act: Activate Debug Shield
          const result = await service.activatePowerUp(matchId, player1Id, "debug_shield");

          // Property: Activation should succeed
          if (!result.success) return false;

          // Property: Should return exactly DEBUG_SHIELD_CHARGES (3) shielded runs
          if (result.shieldedRunsRemaining !== DEBUG_SHIELD_CHARGES) return false;

          // Property: Active effect should have exactly 3 charges
          const state = mockPowerUpStore.get(matchId);
          if (!state) return false;
          if (!state.player1.activeEffect) return false;
          if (state.player1.activeEffect.type !== "debug_shield") return false;
          if (state.player1.activeEffect.remainingCharges !== DEBUG_SHIELD_CHARGES) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should consume exactly one charge per test run", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: DEBUG_SHIELD_CHARGES }), // Number of charges to consume
          async (matchId, player1Id, player2Id, chargesToConsume) => {
            // Setup: Initialize power-ups
            await service.initializePowerUps(matchId, player1Id, player2Id);

            // Mock match state
            vi.mocked(matchStateService.getMatch).mockResolvedValue({
              player1Id,
              player2Id,
              challengeId: "test-challenge",
              status: "active",
              player1Ready: true,
              player2Ready: true,
              player1Code: "// code",
              player2Code: "// code",
              player1Cursor: { line: 1, column: 1 },
              player2Cursor: { line: 1, column: 1 },
              player1Language: "javascript",
              player2Language: "javascript",
            });

            // Activate Debug Shield
            await service.activatePowerUp(matchId, player1Id, "debug_shield");

            // Consume charges one by one and verify each consumption
            for (let i = 0; i < chargesToConsume; i++) {
              const expectedChargesAfter = DEBUG_SHIELD_CHARGES - (i + 1);
              const status = await service.consumeDebugShieldCharge(matchId, player1Id);

              // Property: Each consumption should be recorded
              if (!status.wasConsumed) return false;

              // Property: Remaining charges should decrease by exactly 1
              if (status.remainingCharges !== expectedChargesAfter) return false;

              // Property: Shield should be active if charges remain
              if (expectedChargesAfter > 0 && !status.isActive) return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should deactivate shield when charges reach zero", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (matchId, player1Id, player2Id) => {
          // Setup: Initialize power-ups
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code: "// code",
            player2Code: "// code",
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          // Activate Debug Shield
          await service.activatePowerUp(matchId, player1Id, "debug_shield");

          // Consume all charges
          for (let i = 0; i < DEBUG_SHIELD_CHARGES - 1; i++) {
            const status = await service.consumeDebugShieldCharge(matchId, player1Id);
            // Property: Shield should still be active before last charge
            if (!status.isActive) return false;
          }

          // Consume the last charge
          const finalStatus = await service.consumeDebugShieldCharge(matchId, player1Id);

          // Property: Last consumption should be recorded
          if (!finalStatus.wasConsumed) return false;

          // Property: Shield should be deactivated after last charge
          if (finalStatus.isActive) return false;

          // Property: Remaining charges should be 0
          if (finalStatus.remainingCharges !== 0) return false;

          // Property: Active effect should be null in state
          const state = mockPowerUpStore.get(matchId);
          if (!state) return false;
          if (state.player1.activeEffect !== null) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should not consume charges when shield is not active", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (matchId, player1Id, player2Id) => {
          // Setup: Initialize power-ups but don't activate Debug Shield
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Try to consume a charge without activating shield
          const status = await service.consumeDebugShieldCharge(matchId, player1Id);

          // Property: Should not consume anything
          if (status.wasConsumed) return false;

          // Property: Shield should not be active
          if (status.isActive) return false;

          // Property: Remaining charges should be 0
          if (status.remainingCharges !== 0) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should not consume charges after shield is deactivated", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (matchId, player1Id, player2Id) => {
          // Setup: Initialize power-ups
          await service.initializePowerUps(matchId, player1Id, player2Id);

          // Mock match state
          vi.mocked(matchStateService.getMatch).mockResolvedValue({
            player1Id,
            player2Id,
            challengeId: "test-challenge",
            status: "active",
            player1Ready: true,
            player2Ready: true,
            player1Code: "// code",
            player2Code: "// code",
            player1Cursor: { line: 1, column: 1 },
            player2Cursor: { line: 1, column: 1 },
            player1Language: "javascript",
            player2Language: "javascript",
          });

          // Activate and fully consume Debug Shield
          await service.activatePowerUp(matchId, player1Id, "debug_shield");
          for (let i = 0; i < DEBUG_SHIELD_CHARGES; i++) {
            await service.consumeDebugShieldCharge(matchId, player1Id);
          }

          // Try to consume another charge after shield is deactivated
          const status = await service.consumeDebugShieldCharge(matchId, player1Id);

          // Property: Should not consume anything
          if (status.wasConsumed) return false;

          // Property: Shield should not be active
          if (status.isActive) return false;

          // Property: Remaining charges should be 0
          if (status.remainingCharges !== 0) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});

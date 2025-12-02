/**
 * Property-Based Tests for Power-Up Types
 * Tests correctness properties for power-up state serialization/deserialization
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { PowerUpType, PowerUpInventory, ActivePowerUpEffect, PlayerPowerUpState, MatchPowerUpState, createDefaultPlayerPowerUpState, createDefaultMatchPowerUpState, DEFAULT_POWERUP_INVENTORY } from "./powerups";

// Arbitrary for generating valid power-up types
const powerUpTypeArb: fc.Arbitrary<PowerUpType> = fc.constantFrom("time_freeze", "code_peek", "debug_shield");

// Arbitrary for generating valid power-up inventory
const powerUpInventoryArb: fc.Arbitrary<PowerUpInventory> = fc.record({
  timeFreeze: fc.integer({ min: 0, max: 10 }),
  codePeek: fc.integer({ min: 0, max: 10 }),
  debugShield: fc.integer({ min: 0, max: 10 }),
});

// Arbitrary for generating valid active power-up effects
const activeEffectArb: fc.Arbitrary<ActivePowerUpEffect> = fc.record({
  type: powerUpTypeArb,
  activatedAt: fc.integer({ min: 0, max: Date.now() + 1000000 }),
  expiresAt: fc.integer({ min: 0, max: Date.now() + 1000000 }),
  remainingCharges: fc.option(fc.integer({ min: 0, max: 3 }), { nil: undefined }),
});

// Arbitrary for generating valid player power-up state
const playerPowerUpStateArb: fc.Arbitrary<PlayerPowerUpState> = fc.record({
  playerId: fc.uuid(),
  inventory: powerUpInventoryArb,
  cooldownUntil: fc.option(fc.integer({ min: 0, max: Date.now() + 1000000 }), { nil: null }),
  activeEffect: fc.option(activeEffectArb, { nil: null }),
});

// Arbitrary for generating valid match power-up state
const matchPowerUpStateArb: fc.Arbitrary<MatchPowerUpState> = fc.record({
  matchId: fc.uuid(),
  player1: playerPowerUpStateArb,
  player2: playerPowerUpStateArb,
  createdAt: fc.integer({ min: 0, max: Date.now() + 1000000 }),
  updatedAt: fc.integer({ min: 0, max: Date.now() + 1000000 }),
});

describe("Power-Up Types Property Tests", () => {
  /**
   * **Feature: power-ups-system, Property 8: Power-up state round-trip consistency**
   * For any valid MatchPowerUpState, serializing to JSON and then deserializing
   * SHALL produce an equivalent data structure with all fields preserved.
   * **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2, 9.3**
   */
  describe("Property 8: Power-up state round-trip consistency", () => {
    it("should preserve MatchPowerUpState through JSON serialization round-trip", () => {
      fc.assert(
        fc.property(matchPowerUpStateArb, (state) => {
          // Serialize to JSON
          const serialized = JSON.stringify(state);

          // Deserialize back
          const deserialized: MatchPowerUpState = JSON.parse(serialized);

          // Property: Round-trip should produce equivalent structure
          expect(deserialized.matchId).toBe(state.matchId);
          expect(deserialized.createdAt).toBe(state.createdAt);
          expect(deserialized.updatedAt).toBe(state.updatedAt);

          // Verify player1 state
          expect(deserialized.player1.playerId).toBe(state.player1.playerId);
          expect(deserialized.player1.inventory.timeFreeze).toBe(state.player1.inventory.timeFreeze);
          expect(deserialized.player1.inventory.codePeek).toBe(state.player1.inventory.codePeek);
          expect(deserialized.player1.inventory.debugShield).toBe(state.player1.inventory.debugShield);
          expect(deserialized.player1.cooldownUntil).toBe(state.player1.cooldownUntil);

          // Verify player2 state
          expect(deserialized.player2.playerId).toBe(state.player2.playerId);
          expect(deserialized.player2.inventory.timeFreeze).toBe(state.player2.inventory.timeFreeze);
          expect(deserialized.player2.inventory.codePeek).toBe(state.player2.inventory.codePeek);
          expect(deserialized.player2.inventory.debugShield).toBe(state.player2.inventory.debugShield);
          expect(deserialized.player2.cooldownUntil).toBe(state.player2.cooldownUntil);
        }),
        { numRuns: 100 }
      );
    });

    it("should preserve PlayerPowerUpState through JSON serialization round-trip", () => {
      fc.assert(
        fc.property(playerPowerUpStateArb, (state) => {
          // Serialize to JSON
          const serialized = JSON.stringify(state);

          // Deserialize back
          const deserialized: PlayerPowerUpState = JSON.parse(serialized);

          // Property: All fields should be preserved
          expect(deserialized.playerId).toBe(state.playerId);
          expect(deserialized.inventory.timeFreeze).toBe(state.inventory.timeFreeze);
          expect(deserialized.inventory.codePeek).toBe(state.inventory.codePeek);
          expect(deserialized.inventory.debugShield).toBe(state.inventory.debugShield);
          expect(deserialized.cooldownUntil).toBe(state.cooldownUntil);

          // Verify active effect if present
          if (state.activeEffect !== null) {
            expect(deserialized.activeEffect).not.toBeNull();
            expect(deserialized.activeEffect!.type).toBe(state.activeEffect.type);
            expect(deserialized.activeEffect!.activatedAt).toBe(state.activeEffect.activatedAt);
            expect(deserialized.activeEffect!.expiresAt).toBe(state.activeEffect.expiresAt);
            expect(deserialized.activeEffect!.remainingCharges).toBe(state.activeEffect.remainingCharges);
          } else {
            expect(deserialized.activeEffect).toBeNull();
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should preserve PowerUpInventory through JSON serialization round-trip", () => {
      fc.assert(
        fc.property(powerUpInventoryArb, (inventory) => {
          // Serialize to JSON
          const serialized = JSON.stringify(inventory);

          // Deserialize back
          const deserialized: PowerUpInventory = JSON.parse(serialized);

          // Property: All inventory counts should be preserved
          expect(deserialized.timeFreeze).toBe(inventory.timeFreeze);
          expect(deserialized.codePeek).toBe(inventory.codePeek);
          expect(deserialized.debugShield).toBe(inventory.debugShield);
        }),
        { numRuns: 100 }
      );
    });

    it("should preserve ActivePowerUpEffect through JSON serialization round-trip", () => {
      fc.assert(
        fc.property(activeEffectArb, (effect) => {
          // Serialize to JSON
          const serialized = JSON.stringify(effect);

          // Deserialize back
          const deserialized: ActivePowerUpEffect = JSON.parse(serialized);

          // Property: All effect fields should be preserved
          expect(deserialized.type).toBe(effect.type);
          expect(deserialized.activatedAt).toBe(effect.activatedAt);
          expect(deserialized.expiresAt).toBe(effect.expiresAt);
          expect(deserialized.remainingCharges).toBe(effect.remainingCharges);
        }),
        { numRuns: 100 }
      );
    });

    it("should handle null activeEffect correctly in round-trip", () => {
      fc.assert(
        fc.property(fc.uuid(), powerUpInventoryArb, (playerId, inventory) => {
          const state: PlayerPowerUpState = {
            playerId,
            inventory,
            cooldownUntil: null,
            activeEffect: null,
          };

          // Serialize and deserialize
          const serialized = JSON.stringify(state);
          const deserialized: PlayerPowerUpState = JSON.parse(serialized);

          // Property: null values should be preserved
          expect(deserialized.cooldownUntil).toBeNull();
          expect(deserialized.activeEffect).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it("should handle debug_shield with remainingCharges correctly", () => {
      fc.assert(
        fc.property(fc.uuid(), fc.integer({ min: 0, max: Date.now() + 1000000 }), fc.integer({ min: 0, max: Date.now() + 1000000 }), fc.integer({ min: 0, max: 3 }), (playerId, activatedAt, expiresAt, charges) => {
          const effect: ActivePowerUpEffect = {
            type: "debug_shield",
            activatedAt,
            expiresAt,
            remainingCharges: charges,
          };

          const state: PlayerPowerUpState = {
            playerId,
            inventory: { ...DEFAULT_POWERUP_INVENTORY },
            cooldownUntil: null,
            activeEffect: effect,
          };

          // Serialize and deserialize
          const serialized = JSON.stringify(state);
          const deserialized: PlayerPowerUpState = JSON.parse(serialized);

          // Property: remainingCharges should be preserved for debug_shield
          expect(deserialized.activeEffect!.remainingCharges).toBe(charges);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Default state creation", () => {
    it("should create valid default player state", () => {
      fc.assert(
        fc.property(fc.uuid(), (playerId) => {
          const state = createDefaultPlayerPowerUpState(playerId);

          // Property: Default state should have correct structure
          expect(state.playerId).toBe(playerId);
          expect(state.inventory.timeFreeze).toBe(1);
          expect(state.inventory.codePeek).toBe(1);
          expect(state.inventory.debugShield).toBe(1);
          expect(state.cooldownUntil).toBeNull();
          expect(state.activeEffect).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it("should create valid default match state", () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), fc.uuid(), (matchId, player1Id, player2Id) => {
          const state = createDefaultMatchPowerUpState(matchId, player1Id, player2Id);

          // Property: Default match state should have correct structure
          expect(state.matchId).toBe(matchId);
          expect(state.player1.playerId).toBe(player1Id);
          expect(state.player2.playerId).toBe(player2Id);
          expect(state.player1.inventory.timeFreeze).toBe(1);
          expect(state.player2.inventory.timeFreeze).toBe(1);
          expect(state.createdAt).toBeGreaterThan(0);
          expect(state.updatedAt).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it("should create independent inventory objects for each player", () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), fc.uuid(), (matchId, player1Id, player2Id) => {
          const state = createDefaultMatchPowerUpState(matchId, player1Id, player2Id);

          // Modify player1's inventory
          state.player1.inventory.timeFreeze = 0;

          // Property: Player2's inventory should be unaffected
          expect(state.player2.inventory.timeFreeze).toBe(1);
        }),
        { numRuns: 100 }
      );
    });
  });
});

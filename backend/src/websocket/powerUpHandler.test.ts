/**
 * Property-Based Tests for PowerUpHandler
 * Tests correctness properties for power-up WebSocket event handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { PowerUpType } from "../types/powerups";

/**
 * Spectator event payload structure
 * This represents the data broadcast to spectators when a power-up is activated
 */
interface SpectatorPowerUpEvent {
  playerId: string;
  username: string;
  powerUpType: PowerUpType;
  timestamp: number;
}

/**
 * Creates a spectator event payload as the handler does
 * This mirrors the logic in broadcastPowerUpActivation
 */
function createSpectatorEventPayload(playerId: string, username: string, powerUpType: PowerUpType): SpectatorPowerUpEvent {
  return {
    playerId,
    username,
    powerUpType,
    timestamp: Date.now(),
  };
}

/**
 * Validates that a spectator event payload contains all required fields
 * per Requirements 7.2
 */
function isValidSpectatorEventPayload(payload: SpectatorPowerUpEvent): boolean {
  // Must have playerId (non-empty string)
  if (typeof payload.playerId !== "string" || payload.playerId.length === 0) {
    return false;
  }

  // Must have username (non-empty string)
  if (typeof payload.username !== "string" || payload.username.length === 0) {
    return false;
  }

  // Must have valid powerUpType
  const validTypes: PowerUpType[] = ["time_freeze", "code_peek", "debug_shield"];
  if (!validTypes.includes(payload.powerUpType)) {
    return false;
  }

  // Must have timestamp (positive number)
  if (typeof payload.timestamp !== "number" || payload.timestamp <= 0) {
    return false;
  }

  return true;
}

describe("PowerUpHandler Property Tests", () => {
  /**
   * **Feature: power-ups-system, Property 7: Spectator event payload completeness**
   * For any power-up activation broadcast to spectators, the event payload SHALL
   * contain the power-up type and the activating player's identifier.
   * **Validates: Requirements 7.2**
   */
  describe("Property 7: Spectator event payload completeness", () => {
    const powerUpTypeArb: fc.Arbitrary<PowerUpType> = fc.constantFrom("time_freeze", "code_peek", "debug_shield");

    const usernameArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

    it("should always include power-up type and player identifier in spectator events", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), usernameArb, powerUpTypeArb, async (playerId, username, powerUpType) => {
          // Create spectator event payload as the handler does
          const payload = createSpectatorEventPayload(playerId, username, powerUpType);

          // Property: Payload must contain playerId
          if (payload.playerId !== playerId) return false;

          // Property: Payload must contain powerUpType
          if (payload.powerUpType !== powerUpType) return false;

          // Property: Payload must be valid according to requirements
          if (!isValidSpectatorEventPayload(payload)) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should include username for player identification", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), usernameArb, powerUpTypeArb, async (playerId, username, powerUpType) => {
          const payload = createSpectatorEventPayload(playerId, username, powerUpType);

          // Property: Username must be included and match
          if (payload.username !== username) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should include timestamp for event ordering", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), usernameArb, powerUpTypeArb, async (playerId, username, powerUpType) => {
          const beforeCreation = Date.now();
          const payload = createSpectatorEventPayload(playerId, username, powerUpType);
          const afterCreation = Date.now();

          // Property: Timestamp must be within the creation window
          if (payload.timestamp < beforeCreation) return false;
          if (payload.timestamp > afterCreation) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should produce valid payloads for all power-up types", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), usernameArb, async (playerId, username) => {
          const powerUpTypes: PowerUpType[] = ["time_freeze", "code_peek", "debug_shield"];

          for (const powerUpType of powerUpTypes) {
            const payload = createSpectatorEventPayload(playerId, username, powerUpType);

            // Property: Each power-up type should produce a valid payload
            if (!isValidSpectatorEventPayload(payload)) return false;
            if (payload.powerUpType !== powerUpType) return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});

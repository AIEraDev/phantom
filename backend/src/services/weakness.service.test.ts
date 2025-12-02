/**
 * Property-Based Tests for Weakness Service
 * Tests correctness properties for the AI Code Coach weakness detection system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { hasEnoughDataForWeaknessDetection, getWeaknessSummary, extractPatternsFromAnalysis, mergePatterns, calculateCategoryScoresFromAnalysis, updateCategoryScores, getTotalPatternFrequency, isValidWeaknessProfile, CONSTANTS } from "./weakness.service";
import { WeaknessProfile, WeaknessPattern, CategoryScores, MatchAnalysis } from "../db/types";

// Mock the database pool
vi.mock("../db/connection", () => ({
  default: {
    query: vi.fn(),
  },
}));

// Import the mocked pool
import pool from "../db/connection";

describe("Weakness Service Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Arbitrary for generating valid category scores
  const categoryScoresArb: fc.Arbitrary<CategoryScores> = fc.record({
    time_complexity: fc.integer({ min: 0, max: 100 }),
    space_complexity: fc.integer({ min: 0, max: 100 }),
    readability: fc.integer({ min: 0, max: 100 }),
    patterns: fc.integer({ min: 0, max: 100 }),
  });

  // Arbitrary for generating valid weakness patterns
  const weaknessPatternArb: fc.Arbitrary<WeaknessPattern> = fc.record({
    category: fc.constantFrom("time_complexity", "space_complexity", "readability", "patterns") as fc.Arbitrary<"time_complexity" | "space_complexity" | "readability" | "patterns">,
    pattern: fc.string({ minLength: 5, maxLength: 100 }),
    frequency: fc.integer({ min: 1, max: 100 }),
    last_seen: fc.date(),
  });

  // Arbitrary for generating valid weakness profiles
  const weaknessProfileArb: fc.Arbitrary<WeaknessProfile> = fc.record({
    id: fc.uuid(),
    user_id: fc.uuid(),
    patterns: fc.array(weaknessPatternArb, { minLength: 0, maxLength: 10 }),
    category_scores: categoryScoresArb,
    matches_analyzed: fc.integer({ min: 0, max: 100 }),
    last_updated: fc.date(),
  });

  // Arbitrary for generating valid complexity analysis
  const complexityAnalysisArb = fc.record({
    detected: fc.constantFrom("O(1)", "O(n)", "O(n log n)", "O(n²)", "O(2^n)"),
    optimal: fc.constantFrom("O(1)", "O(n)", "O(n log n)", "O(n²)"),
    explanation: fc.string({ minLength: 5 }),
  });

  // Arbitrary for generating valid readability scores
  const readabilityScoreArb = fc.record({
    score: fc.integer({ min: 0, max: 10 }),
    strengths: fc.array(fc.string({ minLength: 3 }), { minLength: 1, maxLength: 5 }),
    improvements: fc.array(fc.string({ minLength: 3 }), { minLength: 1, maxLength: 5 }),
  });

  // Arbitrary for generating valid algorithmic approach
  const algorithmicApproachArb = fc.record({
    detected: fc.string({ minLength: 3 }),
    suggested: fc.string({ minLength: 3 }),
    explanation: fc.string({ minLength: 5 }),
  });

  // Arbitrary for generating valid bug analysis
  const bugAnalysisArb = fc.record({
    hasBugs: fc.boolean(),
    bugs: fc.array(
      fc.record({
        location: fc.string({ minLength: 1 }),
        description: fc.string({ minLength: 3 }),
        suggestion: fc.string({ minLength: 3 }),
      }),
      { minLength: 0, maxLength: 3 }
    ),
  });

  // Arbitrary for generating valid suggestions (3-5 items)
  const validSuggestionsArb = fc.integer({ min: 3, max: 5 }).chain((count) => fc.array(fc.string({ minLength: 5 }), { minLength: count, maxLength: count }));

  // Arbitrary for generating valid match analysis
  const matchAnalysisArb: fc.Arbitrary<MatchAnalysis> = fc.record({
    id: fc.uuid(),
    match_id: fc.uuid(),
    user_id: fc.uuid(),
    time_complexity: complexityAnalysisArb,
    space_complexity: complexityAnalysisArb,
    readability_score: readabilityScoreArb,
    algorithmic_approach: algorithmicApproachArb,
    suggestions: validSuggestionsArb,
    bug_analysis: bugAnalysisArb,
    hints_used: fc.integer({ min: 0, max: 3 }),
    created_at: fc.date(),
  });

  /**
   * **Feature: ai-code-coach, Property 7: Weakness detection threshold**
   * For any user with fewer than 5 completed matches, the weakness detection service
   * SHALL return an indication that insufficient data exists for pattern detection.
   * **Validates: Requirements 4.2**
   */
  describe("Property 7: Weakness detection threshold", () => {
    it("should return insufficient data for users with fewer than 5 matches", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.integer({ min: 0, max: 4 }), // matchesAnalyzed (below threshold)
          async (userId, matchesAnalyzed) => {
            const mockPool = pool as any;

            // Mock database to return a profile with fewer than 5 matches
            mockPool.query.mockResolvedValue({
              rows: [
                {
                  id: "profile-id",
                  user_id: userId,
                  patterns: JSON.stringify([]),
                  category_scores: JSON.stringify({
                    time_complexity: 50,
                    space_complexity: 50,
                    readability: 50,
                    patterns: 50,
                  }),
                  matches_analyzed: matchesAnalyzed,
                  last_updated: new Date().toISOString(),
                },
              ],
            });

            const result = await hasEnoughDataForWeaknessDetection(userId);

            // Property: Should indicate insufficient data
            expect(result.hasEnoughData).toBe(false);
            expect(result.matchesAnalyzed).toBe(matchesAnalyzed);
            expect(result.requiredMatches).toBe(CONSTANTS.MIN_MATCHES_FOR_WEAKNESS_DETECTION);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return sufficient data for users with 5 or more matches", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.integer({ min: 5, max: 100 }), // matchesAnalyzed (at or above threshold)
          async (userId, matchesAnalyzed) => {
            const mockPool = pool as any;

            // Mock database to return a profile with 5+ matches
            mockPool.query.mockResolvedValue({
              rows: [
                {
                  id: "profile-id",
                  user_id: userId,
                  patterns: JSON.stringify([]),
                  category_scores: JSON.stringify({
                    time_complexity: 50,
                    space_complexity: 50,
                    readability: 50,
                    patterns: 50,
                  }),
                  matches_analyzed: matchesAnalyzed,
                  last_updated: new Date().toISOString(),
                },
              ],
            });

            const result = await hasEnoughDataForWeaknessDetection(userId);

            // Property: Should indicate sufficient data
            expect(result.hasEnoughData).toBe(true);
            expect(result.matchesAnalyzed).toBe(matchesAnalyzed);
            expect(result.requiredMatches).toBe(CONSTANTS.MIN_MATCHES_FOR_WEAKNESS_DETECTION);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return insufficient data for users with no profile", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (userId) => {
          const mockPool = pool as any;

          // Mock database to return no profile
          mockPool.query.mockResolvedValue({ rows: [] });

          const result = await hasEnoughDataForWeaknessDetection(userId);

          // Property: Should indicate insufficient data
          expect(result.hasEnoughData).toBe(false);
          expect(result.matchesAnalyzed).toBe(0);
          expect(result.requiredMatches).toBe(CONSTANTS.MIN_MATCHES_FOR_WEAKNESS_DETECTION);
        }),
        { numRuns: 100 }
      );
    });

    it("should have threshold exactly at 5 matches", () => {
      // Property: The threshold constant should be exactly 5
      expect(CONSTANTS.MIN_MATCHES_FOR_WEAKNESS_DETECTION).toBe(5);
    });
  });

  /**
   * **Feature: ai-code-coach, Property 8: Weakness summary size**
   * For any user with a weakness profile, the weakness summary
   * SHALL contain at most 3 weakness patterns.
   * **Validates: Requirements 4.3**
   */
  describe("Property 8: Weakness summary size", () => {
    it("should return at most 3 weakness patterns in summary", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.array(weaknessPatternArb, { minLength: 0, maxLength: 20 }), // patterns (any number)
          categoryScoresArb, // category scores
          async (userId, patterns, categoryScores) => {
            const mockPool = pool as any;

            // Mock database to return a profile with patterns
            mockPool.query.mockResolvedValue({
              rows: [
                {
                  id: "profile-id",
                  user_id: userId,
                  patterns: JSON.stringify(patterns),
                  category_scores: JSON.stringify(categoryScores),
                  matches_analyzed: 10,
                  last_updated: new Date().toISOString(),
                },
              ],
            });

            const summary = await getWeaknessSummary(userId);

            // Property: Summary should exist
            expect(summary).not.toBeNull();

            // Property: Top weaknesses should have at most 3 items
            expect(summary!.topWeaknesses.length).toBeLessThanOrEqual(CONSTANTS.MAX_WEAKNESS_PATTERNS_IN_SUMMARY);
            expect(summary!.topWeaknesses.length).toBeLessThanOrEqual(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return patterns sorted by frequency (highest first)", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.array(weaknessPatternArb, { minLength: 2, maxLength: 10 }), // patterns
          categoryScoresArb, // category scores
          async (userId, patterns, categoryScores) => {
            const mockPool = pool as any;

            mockPool.query.mockResolvedValue({
              rows: [
                {
                  id: "profile-id",
                  user_id: userId,
                  patterns: JSON.stringify(patterns),
                  category_scores: JSON.stringify(categoryScores),
                  matches_analyzed: 10,
                  last_updated: new Date().toISOString(),
                },
              ],
            });

            const summary = await getWeaknessSummary(userId);

            // Property: Top weaknesses should be sorted by frequency (descending)
            if (summary && summary.topWeaknesses.length > 1) {
              for (let i = 0; i < summary.topWeaknesses.length - 1; i++) {
                expect(summary.topWeaknesses[i].frequency).toBeGreaterThanOrEqual(summary.topWeaknesses[i + 1].frequency);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return null for users with no profile", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (userId) => {
          const mockPool = pool as any;

          // Mock database to return no profile
          mockPool.query.mockResolvedValue({ rows: [] });

          const summary = await getWeaknessSummary(userId);

          // Property: Should return null for non-existent profile
          expect(summary).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it("should include strongestArea and improvementTrend in summary", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.array(weaknessPatternArb, { minLength: 0, maxLength: 5 }), categoryScoresArb, async (userId, patterns, categoryScores) => {
          const mockPool = pool as any;

          mockPool.query.mockResolvedValue({
            rows: [
              {
                id: "profile-id",
                user_id: userId,
                patterns: JSON.stringify(patterns),
                category_scores: JSON.stringify(categoryScores),
                matches_analyzed: 10,
                last_updated: new Date().toISOString(),
              },
            ],
          });

          const summary = await getWeaknessSummary(userId);

          // Property: Summary should have all required fields
          expect(summary).not.toBeNull();
          expect(summary!.strongestArea).toBeDefined();
          expect(["time_complexity", "space_complexity", "readability", "patterns"]).toContain(summary!.strongestArea);
          expect(summary!.improvementTrend).toBeDefined();
          expect(["improving", "stable", "declining"]).toContain(summary!.improvementTrend);
        }),
        { numRuns: 100 }
      );
    });

    it("should have max patterns constant exactly at 3", () => {
      // Property: The max patterns constant should be exactly 3
      expect(CONSTANTS.MAX_WEAKNESS_PATTERNS_IN_SUMMARY).toBe(3);
    });
  });

  /**
   * **Feature: ai-code-coach, Property 9: Weakness profile freshness**
   * For any match completion that triggers weakness analysis, the weakness profile's
   * lastUpdated timestamp SHALL be greater than or equal to the match completion timestamp.
   * **Validates: Requirements 4.5**
   */
  describe("Property 9: Weakness profile freshness", () => {
    it("should validate that profile has last_updated timestamp", () => {
      fc.assert(
        fc.property(weaknessProfileArb, (profile) => {
          // Property: Valid profile should have last_updated
          const isValid = isValidWeaknessProfile(profile);
          expect(isValid).toBe(true);
          expect(profile.last_updated).toBeDefined();
          expect(profile.last_updated).toBeInstanceOf(Date);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject profiles with null last_updated", () => {
      fc.assert(
        fc.property(weaknessProfileArb, (profile) => {
          // Create invalid profile with null last_updated
          const invalidProfile = { ...profile, last_updated: null as any };

          // Property: Profile with null last_updated should be invalid
          const isValid = isValidWeaknessProfile(invalidProfile);
          expect(isValid).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject profiles with undefined last_updated", () => {
      fc.assert(
        fc.property(weaknessProfileArb, (profile) => {
          // Create invalid profile with undefined last_updated
          const invalidProfile = { ...profile, last_updated: undefined as any };

          // Property: Profile with undefined last_updated should be invalid
          const isValid = isValidWeaknessProfile(invalidProfile);
          expect(isValid).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should validate complete profile structure", () => {
      fc.assert(
        fc.property(weaknessProfileArb, (profile) => {
          // Property: Complete profile should be valid
          const isValid = isValidWeaknessProfile(profile);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject null profiles", () => {
      // Property: Null profile should be invalid
      const isValid = isValidWeaknessProfile(null);
      expect(isValid).toBe(false);
    });

    it("should reject profiles with missing required fields", () => {
      fc.assert(
        fc.property(weaknessProfileArb, (profile) => {
          // Test each required field
          const fieldsToTest = ["id", "user_id", "patterns", "category_scores", "matches_analyzed"];

          for (const field of fieldsToTest) {
            const invalidProfile = { ...profile, [field]: null };
            const isValid = isValidWeaknessProfile(invalidProfile as any);
            expect(isValid).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-code-coach, Property 20: Weakness aggregation consistency**
   * For any weakness profile with N matches analyzed, the pattern frequencies
   * SHALL sum to values consistent with N match analyses.
   * **Validates: Requirements 7.4**
   */
  describe("Property 20: Weakness aggregation consistency", () => {
    it("should correctly merge patterns and update frequencies", () => {
      fc.assert(
        fc.property(
          fc.array(weaknessPatternArb, { minLength: 0, maxLength: 5 }), // existing patterns
          fc.array(weaknessPatternArb, { minLength: 0, maxLength: 5 }), // new patterns
          (existingPatterns, newPatterns) => {
            const merged = mergePatterns(existingPatterns, newPatterns);

            // Property: Merged patterns should be an array
            expect(Array.isArray(merged)).toBe(true);

            // Property: Each pattern in merged should have valid structure
            for (const pattern of merged) {
              expect(pattern.category).toBeDefined();
              expect(pattern.pattern).toBeDefined();
              expect(pattern.frequency).toBeGreaterThanOrEqual(1);
              expect(pattern.last_seen).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should increase frequency when merging duplicate patterns", () => {
      fc.assert(
        fc.property(
          weaknessPatternArb,
          fc.integer({ min: 1, max: 10 }), // additional frequency
          (pattern, additionalFreq) => {
            const existingPatterns = [{ ...pattern, frequency: 5 }];
            const newPatterns = [{ ...pattern, frequency: additionalFreq }];

            const merged = mergePatterns(existingPatterns, newPatterns);

            // Property: Should have exactly one pattern (merged)
            expect(merged.length).toBe(1);

            // Property: Frequency should be sum of both
            expect(merged[0].frequency).toBe(5 + additionalFreq);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should preserve unique patterns when merging", () => {
      fc.assert(
        fc.property(fc.array(weaknessPatternArb, { minLength: 1, maxLength: 3 }), fc.array(weaknessPatternArb, { minLength: 1, maxLength: 3 }), (existingPatterns, newPatterns) => {
          // Make patterns unique by modifying their pattern strings
          const uniqueExisting = existingPatterns.map((p, i) => ({
            ...p,
            pattern: `existing_${i}_${p.pattern}`,
          }));
          const uniqueNew = newPatterns.map((p, i) => ({
            ...p,
            pattern: `new_${i}_${p.pattern}`,
          }));

          const merged = mergePatterns(uniqueExisting, uniqueNew);

          // Property: All unique patterns should be preserved
          expect(merged.length).toBe(uniqueExisting.length + uniqueNew.length);
        }),
        { numRuns: 100 }
      );
    });

    it("should calculate total pattern frequency correctly", () => {
      fc.assert(
        fc.property(weaknessProfileArb, (profile) => {
          const totalFrequency = getTotalPatternFrequency(profile);

          // Property: Total frequency should be sum of all pattern frequencies
          const expectedTotal = profile.patterns.reduce((sum, p) => sum + p.frequency, 0);
          expect(totalFrequency).toBe(expectedTotal);
        }),
        { numRuns: 100 }
      );
    });

    it("should return 0 for profiles with no patterns", () => {
      fc.assert(
        fc.property(weaknessProfileArb, (profile) => {
          const emptyProfile = { ...profile, patterns: [] };
          const totalFrequency = getTotalPatternFrequency(emptyProfile);

          // Property: Empty patterns should have 0 total frequency
          expect(totalFrequency).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it("should extract patterns from analysis correctly", () => {
      fc.assert(
        fc.property(matchAnalysisArb, (analysis) => {
          const patterns = extractPatternsFromAnalysis(analysis);

          // Property: Extracted patterns should be an array
          expect(Array.isArray(patterns)).toBe(true);

          // Property: Each pattern should have valid structure
          for (const pattern of patterns) {
            expect(["time_complexity", "space_complexity", "readability", "patterns"]).toContain(pattern.category);
            expect(pattern.frequency).toBe(1); // New patterns start with frequency 1
            expect(pattern.last_seen).toBeInstanceOf(Date);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should calculate category scores from analysis", () => {
      fc.assert(
        fc.property(matchAnalysisArb, (analysis) => {
          const scores = calculateCategoryScoresFromAnalysis(analysis);

          // Property: All scores should be between 0 and 100
          expect(scores.time_complexity).toBeGreaterThanOrEqual(0);
          expect(scores.time_complexity).toBeLessThanOrEqual(100);
          expect(scores.space_complexity).toBeGreaterThanOrEqual(0);
          expect(scores.space_complexity).toBeLessThanOrEqual(100);
          expect(scores.readability).toBeGreaterThanOrEqual(0);
          expect(scores.readability).toBeLessThanOrEqual(100);
          expect(scores.patterns).toBeGreaterThanOrEqual(0);
          expect(scores.patterns).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });

    it("should update category scores with weighted average", () => {
      fc.assert(
        fc.property(
          categoryScoresArb, // existing scores
          categoryScoresArb, // new scores
          fc.integer({ min: 0, max: 50 }), // matches analyzed
          (existingScores, newScores, matchesAnalyzed) => {
            const updated = updateCategoryScores(existingScores, newScores, matchesAnalyzed);

            // Property: Updated scores should be between 0 and 100
            expect(updated.time_complexity).toBeGreaterThanOrEqual(0);
            expect(updated.time_complexity).toBeLessThanOrEqual(100);
            expect(updated.space_complexity).toBeGreaterThanOrEqual(0);
            expect(updated.space_complexity).toBeLessThanOrEqual(100);
            expect(updated.readability).toBeGreaterThanOrEqual(0);
            expect(updated.readability).toBeLessThanOrEqual(100);
            expect(updated.patterns).toBeGreaterThanOrEqual(0);
            expect(updated.patterns).toBeLessThanOrEqual(100);

            // Property: If matchesAnalyzed is 0, new scores should dominate
            if (matchesAnalyzed === 0) {
              expect(updated.time_complexity).toBe(newScores.time_complexity);
              expect(updated.space_complexity).toBe(newScores.space_complexity);
              expect(updated.readability).toBe(newScores.readability);
              expect(updated.patterns).toBe(newScores.patterns);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

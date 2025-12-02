/**
 * Property-Based Tests for Analysis Service
 * Tests correctness properties for the AI Code Coach analysis system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { buildAnalysisPrompt, validateAnalysisResponse, isValidSuggestions, isAnalysisComplete, hasRequiredPersistenceFields, getAnalysisHistory, CONSTANTS, AnalysisContext, RawAnalysisResponse, TestResult } from "./analysis.service";
import { MatchAnalysis } from "../db/types";

// Mock the database pool
vi.mock("../db/connection", () => ({
  default: {
    query: vi.fn(),
  },
}));

// Mock Redis connection
vi.mock("../redis/connection", () => ({
  getRedisClient: vi.fn(() =>
    Promise.resolve({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    })
  ),
}));

// Import the mocked pool
import pool from "../db/connection";

describe("Analysis Service Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Arbitrary for generating valid test results
  const testResultArb: fc.Arbitrary<TestResult> = fc.record({
    passed: fc.boolean(),
    input: fc.oneof(fc.integer(), fc.string(), fc.array(fc.integer())),
    expectedOutput: fc.oneof(fc.integer(), fc.string(), fc.array(fc.integer())),
    actualOutput: fc.option(fc.oneof(fc.integer(), fc.string(), fc.array(fc.integer())), { nil: undefined }),
    error: fc.option(fc.string(), { nil: undefined }),
  });

  // Arbitrary for generating valid analysis contexts
  const analysisContextArb: fc.Arbitrary<AnalysisContext> = fc.record({
    matchId: fc.uuid(),
    userId: fc.uuid(),
    code: fc.string({ minLength: 10 }),
    language: fc.constantFrom("javascript", "python", "typescript"),
    challengeDescription: fc.string({ minLength: 10 }),
    testResults: fc.array(testResultArb, { minLength: 1, maxLength: 10 }),
    isWinner: fc.boolean(),
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

  // Arbitrary for generating valid raw analysis responses
  const validRawAnalysisArb: fc.Arbitrary<RawAnalysisResponse> = fc.record({
    timeComplexity: complexityAnalysisArb,
    spaceComplexity: complexityAnalysisArb,
    readabilityScore: readabilityScoreArb,
    algorithmicApproach: algorithmicApproachArb,
    suggestions: validSuggestionsArb,
    bugAnalysis: bugAnalysisArb,
  });

  /**
   * **Feature: ai-code-coach, Property 5: Analysis structure completeness**
   * For any generated match analysis, the analysis object SHALL contain
   * non-null values for timeComplexity, spaceComplexity, readabilityScore,
   * and algorithmicApproach fields.
   * **Validates: Requirements 3.2**
   */
  describe("Property 5: Analysis structure completeness", () => {
    it("should validate complete analysis objects as complete", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), (rawAnalysis, matchId, userId) => {
          // Create a complete MatchAnalysis object
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: new Date(),
          };

          // Property: Complete analysis should pass completeness check
          const isComplete = isAnalysisComplete(analysis);
          expect(isComplete).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null timeComplexity", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), (rawAnalysis, matchId, userId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: null as any,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: new Date(),
          };

          // Property: Missing timeComplexity should fail completeness check
          const isComplete = isAnalysisComplete(analysis);
          expect(isComplete).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null spaceComplexity", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), (rawAnalysis, matchId, userId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: null as any,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: new Date(),
          };

          // Property: Missing spaceComplexity should fail completeness check
          const isComplete = isAnalysisComplete(analysis);
          expect(isComplete).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null readabilityScore", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), (rawAnalysis, matchId, userId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: null as any,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: new Date(),
          };

          // Property: Missing readabilityScore should fail completeness check
          const isComplete = isAnalysisComplete(analysis);
          expect(isComplete).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null algorithmicApproach", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), (rawAnalysis, matchId, userId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: null as any,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: new Date(),
          };

          // Property: Missing algorithmicApproach should fail completeness check
          const isComplete = isAnalysisComplete(analysis);
          expect(isComplete).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject null analysis", () => {
      // Property: Null analysis should fail completeness check
      const isComplete = isAnalysisComplete(null);
      expect(isComplete).toBe(false);
    });

    it("should validate raw analysis responses correctly", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, (rawAnalysis) => {
          // Property: Valid raw analysis should pass validation
          const validated = validateAnalysisResponse(rawAnalysis);
          expect(validated).not.toBeNull();
          expect(validated?.timeComplexity).toBeDefined();
          expect(validated?.spaceComplexity).toBeDefined();
          expect(validated?.readabilityScore).toBeDefined();
          expect(validated?.algorithmicApproach).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-code-coach, Property 6: Suggestion count bounds**
   * For any completed match analysis, the suggestions array SHALL contain
   * between 3 and 5 items inclusive.
   * **Validates: Requirements 3.4**
   */
  describe("Property 6: Suggestion count bounds", () => {
    it("should accept suggestions arrays with 3-5 items", () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 5 }), (count) => {
          const suggestions = Array.from({ length: count }, (_, i) => `Suggestion ${i + 1}`);

          // Property: 3-5 suggestions should be valid
          const isValid = isValidSuggestions(suggestions);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject suggestions arrays with fewer than 3 items", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 2 }), (count) => {
          const suggestions = Array.from({ length: count }, (_, i) => `Suggestion ${i + 1}`);

          // Property: Fewer than 3 suggestions should be invalid
          const isValid = isValidSuggestions(suggestions);
          expect(isValid).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject suggestions arrays with more than 5 items", () => {
      fc.assert(
        fc.property(fc.integer({ min: 6, max: 20 }), (count) => {
          const suggestions = Array.from({ length: count }, (_, i) => `Suggestion ${i + 1}`);

          // Property: More than 5 suggestions should be invalid
          const isValid = isValidSuggestions(suggestions);
          expect(isValid).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject non-array suggestions", () => {
      fc.assert(
        fc.property(fc.oneof(fc.string(), fc.integer(), fc.object(), fc.constant(null)), (invalidSuggestions) => {
          // Property: Non-array should be invalid
          const isValid = isValidSuggestions(invalidSuggestions);
          expect(isValid).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject suggestions with empty strings", () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 5 }), (count) => {
          // Create array with one empty string
          const suggestions = Array.from({ length: count }, (_, i) => (i === 0 ? "" : `Suggestion ${i + 1}`));

          // Property: Empty strings should make array invalid
          const isValid = isValidSuggestions(suggestions);
          expect(isValid).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject suggestions with non-string items", () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 5 }), (count) => {
          // Create array with one non-string item
          const suggestions: any[] = Array.from({ length: count }, (_, i) => (i === 0 ? 123 : `Suggestion ${i + 1}`));

          // Property: Non-string items should make array invalid
          const isValid = isValidSuggestions(suggestions);
          expect(isValid).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should validate suggestions in raw analysis response", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, (rawAnalysis) => {
          const validated = validateAnalysisResponse(rawAnalysis);

          // Property: Validated response should have 3-5 suggestions
          expect(validated).not.toBeNull();
          expect(validated!.suggestions.length).toBeGreaterThanOrEqual(CONSTANTS.MIN_SUGGESTIONS);
          expect(validated!.suggestions.length).toBeLessThanOrEqual(CONSTANTS.MAX_SUGGESTIONS);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-code-coach, Property 18: Analysis persistence structure**
   * For any stored match analysis, the record SHALL contain non-null values
   * for timestamp, matchId, userId, hintsUsed, and the full analysis JSON.
   * **Validates: Requirements 7.2**
   */
  describe("Property 18: Analysis persistence structure", () => {
    it("should validate complete persistence structure", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), fc.integer({ min: 0, max: 3 }), (rawAnalysis, matchId, userId, hintsUsed) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: hintsUsed,
            created_at: new Date(),
          };

          // Property: Complete analysis should have all required persistence fields
          const hasFields = hasRequiredPersistenceFields(analysis);
          expect(hasFields).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null created_at", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), (rawAnalysis, matchId, userId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: null as any,
          };

          // Property: Missing created_at should fail persistence check
          const hasFields = hasRequiredPersistenceFields(analysis);
          expect(hasFields).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null match_id", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), (rawAnalysis, userId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: null as any,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: new Date(),
          };

          // Property: Missing match_id should fail persistence check
          const hasFields = hasRequiredPersistenceFields(analysis);
          expect(hasFields).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null user_id", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), (rawAnalysis, matchId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: null as any,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: new Date(),
          };

          // Property: Missing user_id should fail persistence check
          const hasFields = hasRequiredPersistenceFields(analysis);
          expect(hasFields).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null hints_used", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), (rawAnalysis, matchId, userId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: rawAnalysis.suggestions,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: null as any,
            created_at: new Date(),
          };

          // Property: Missing hints_used should fail persistence check
          const hasFields = hasRequiredPersistenceFields(analysis);
          expect(hasFields).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject analysis with null suggestions", () => {
      fc.assert(
        fc.property(validRawAnalysisArb, fc.uuid(), fc.uuid(), (rawAnalysis, matchId, userId) => {
          const analysis: MatchAnalysis = {
            id: "test-id",
            match_id: matchId,
            user_id: userId,
            time_complexity: rawAnalysis.timeComplexity,
            space_complexity: rawAnalysis.spaceComplexity,
            readability_score: rawAnalysis.readabilityScore,
            algorithmic_approach: rawAnalysis.algorithmicApproach,
            suggestions: null as any,
            bug_analysis: rawAnalysis.bugAnalysis,
            hints_used: 0,
            created_at: new Date(),
          };

          // Property: Missing suggestions should fail persistence check
          const hasFields = hasRequiredPersistenceFields(analysis);
          expect(hasFields).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("should reject null analysis", () => {
      // Property: Null analysis should fail persistence check
      const hasFields = hasRequiredPersistenceFields(null);
      expect(hasFields).toBe(false);
    });
  });

  /**
   * **Feature: ai-code-coach, Property 19: Pagination correctness**
   * For any paginated analysis history request with page P and pageSize S,
   * the response SHALL contain at most S items and the correct total count.
   * **Validates: Requirements 7.3**
   */
  describe("Property 19: Pagination correctness", () => {
    it("should return at most pageSize items", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.integer({ min: 1, max: 10 }), // page
          fc.integer({ min: 1, max: 50 }), // pageSize
          fc.integer({ min: 0, max: 100 }), // totalItems in DB
          async (userId, page, pageSize, totalItems) => {
            // Mock the database responses
            const mockPool = pool as any;

            // Mock count query
            mockPool.query.mockImplementation((query: string) => {
              if (query.includes("COUNT")) {
                return Promise.resolve({
                  rows: [{ total: totalItems.toString() }],
                });
              }
              // Mock data query - return appropriate number of items
              const offset = (page - 1) * pageSize;
              const itemsToReturn = Math.max(0, Math.min(pageSize, totalItems - offset));
              const rows = Array.from({ length: itemsToReturn }, (_, i) => ({
                id: `id-${i}`,
                match_id: `match-${i}`,
                user_id: userId,
                time_complexity: JSON.stringify({
                  detected: "O(n)",
                  optimal: "O(n)",
                  explanation: "test",
                }),
                space_complexity: JSON.stringify({
                  detected: "O(1)",
                  optimal: "O(1)",
                  explanation: "test",
                }),
                readability_score: JSON.stringify({
                  score: 8,
                  strengths: ["good"],
                  improvements: ["better"],
                }),
                algorithmic_approach: JSON.stringify({
                  detected: "Linear",
                  suggested: "Linear",
                  explanation: "test",
                }),
                suggestions: JSON.stringify(["suggestion 1", "suggestion 2", "suggestion 3"]),
                bug_analysis: JSON.stringify({ hasBugs: false, bugs: [] }),
                hints_used: 0,
                created_at: new Date().toISOString(),
              }));
              return Promise.resolve({ rows });
            });

            const result = await getAnalysisHistory(userId, page, pageSize);

            // Property: Should return at most pageSize items
            expect(result.analyses.length).toBeLessThanOrEqual(pageSize);

            // Property: Should return correct total count
            expect(result.total).toBe(totalItems);

            // Property: Page and pageSize should be reflected in response
            expect(result.page).toBe(Math.max(1, page));
            expect(result.pageSize).toBeLessThanOrEqual(100); // Capped at 100
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should handle page 1 correctly", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.integer({ min: 1, max: 50 }), fc.integer({ min: 5, max: 50 }), async (userId, pageSize, totalItems) => {
          const mockPool = pool as any;

          mockPool.query.mockImplementation((query: string) => {
            if (query.includes("COUNT")) {
              return Promise.resolve({
                rows: [{ total: totalItems.toString() }],
              });
            }
            const itemsToReturn = Math.min(pageSize, totalItems);
            const rows = Array.from({ length: itemsToReturn }, (_, i) => ({
              id: `id-${i}`,
              match_id: `match-${i}`,
              user_id: userId,
              time_complexity: JSON.stringify({
                detected: "O(n)",
                optimal: "O(n)",
                explanation: "test",
              }),
              space_complexity: JSON.stringify({
                detected: "O(1)",
                optimal: "O(1)",
                explanation: "test",
              }),
              readability_score: JSON.stringify({
                score: 8,
                strengths: ["good"],
                improvements: ["better"],
              }),
              algorithmic_approach: JSON.stringify({
                detected: "Linear",
                suggested: "Linear",
                explanation: "test",
              }),
              suggestions: JSON.stringify(["suggestion 1", "suggestion 2", "suggestion 3"]),
              bug_analysis: JSON.stringify({ hasBugs: false, bugs: [] }),
              hints_used: 0,
              created_at: new Date().toISOString(),
            }));
            return Promise.resolve({ rows });
          });

          const result = await getAnalysisHistory(userId, 1, pageSize);

          // Property: First page should start from beginning
          expect(result.page).toBe(1);
          expect(result.analyses.length).toBeLessThanOrEqual(pageSize);
        }),
        { numRuns: 100 }
      );
    });

    it("should cap pageSize at 100", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 101, max: 500 }), // pageSize over limit
          async (userId, pageSize) => {
            const mockPool = pool as any;

            mockPool.query.mockImplementation((query: string) => {
              if (query.includes("COUNT")) {
                return Promise.resolve({ rows: [{ total: "200" }] });
              }
              return Promise.resolve({ rows: [] });
            });

            const result = await getAnalysisHistory(userId, 1, pageSize);

            // Property: pageSize should be capped at 100
            expect(result.pageSize).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should handle invalid page numbers", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: -100, max: 0 }), // invalid page
          async (userId, invalidPage) => {
            const mockPool = pool as any;

            mockPool.query.mockImplementation((query: string) => {
              if (query.includes("COUNT")) {
                return Promise.resolve({ rows: [{ total: "10" }] });
              }
              return Promise.resolve({ rows: [] });
            });

            const result = await getAnalysisHistory(userId, invalidPage, 10);

            // Property: Invalid page should default to 1
            expect(result.page).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional tests for prompt building
   */
  describe("Analysis prompt building", () => {
    it("should include all required context in prompt", () => {
      fc.assert(
        fc.property(analysisContextArb, (context) => {
          const prompt = buildAnalysisPrompt(context);

          // Property: Prompt should contain challenge description
          expect(prompt).toContain(context.challengeDescription);

          // Property: Prompt should contain code
          expect(prompt).toContain(context.code);

          // Property: Prompt should contain language
          expect(prompt).toContain(context.language);

          // Property: Prompt should mention winner status
          if (context.isWinner) {
            expect(prompt).toContain("WON");
          } else {
            expect(prompt).toContain("lost");
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should include test results in prompt", () => {
      fc.assert(
        fc.property(analysisContextArb, (context) => {
          const prompt = buildAnalysisPrompt(context);

          // Property: Prompt should contain test result summary
          const passedCount = context.testResults.filter((t) => t.passed).length;
          const totalCount = context.testResults.length;
          expect(prompt).toContain(`${passedCount}/${totalCount}`);
        }),
        { numRuns: 100 }
      );
    });
  });
});

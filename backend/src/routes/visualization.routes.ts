import { Router, Request, Response } from "express";
import { generateVisualization } from "../services/visualization.service";
import { authenticateToken } from "../middleware/auth.middleware";
import { VisualizationDataType, TestCase } from "../db/types";

const router = Router();

/**
 * Valid data types for visualization
 */
const VALID_DATA_TYPES: VisualizationDataType[] = ["array", "tree", "graph"];

/**
 * Valid programming languages
 */
const VALID_LANGUAGES = ["javascript", "python", "typescript"] as const;

/**
 * POST /api/visualization/generate
 * Accept code, language, test case, and data type
 * Return visualization data
 * Requirements: 13.1, 13.2, 13.3
 */
router.post("/generate", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { code, language, testCase, dataType } = req.body;

    // Validate required fields
    if (!code) {
      return res.status(400).json({
        error: "code is required",
        code: "MISSING_CODE",
      });
    }

    if (typeof code !== "string") {
      return res.status(400).json({
        error: "code must be a string",
        code: "INVALID_CODE",
      });
    }

    if (!language) {
      return res.status(400).json({
        error: "language is required",
        code: "MISSING_LANGUAGE",
      });
    }

    if (!VALID_LANGUAGES.includes(language)) {
      return res.status(400).json({
        error: `Invalid language. Must be one of: ${VALID_LANGUAGES.join(", ")}`,
        code: "INVALID_LANGUAGE",
      });
    }

    if (!testCase) {
      return res.status(400).json({
        error: "testCase is required",
        code: "MISSING_TEST_CASE",
      });
    }

    // Validate testCase structure
    if (typeof testCase !== "object" || testCase === null) {
      return res.status(400).json({
        error: "testCase must be an object",
        code: "INVALID_TEST_CASE",
      });
    }

    if (testCase.input === undefined) {
      return res.status(400).json({
        error: "testCase.input is required",
        code: "MISSING_TEST_CASE_INPUT",
      });
    }

    if (!dataType) {
      return res.status(400).json({
        error: "dataType is required",
        code: "MISSING_DATA_TYPE",
      });
    }

    if (!VALID_DATA_TYPES.includes(dataType)) {
      return res.status(400).json({
        error: `Invalid dataType. Must be one of: ${VALID_DATA_TYPES.join(", ")}`,
        code: "INVALID_DATA_TYPE",
      });
    }

    // Construct a proper TestCase object
    const validatedTestCase: TestCase = {
      input: testCase.input,
      expectedOutput: testCase.expectedOutput ?? null,
      isHidden: testCase.isHidden ?? false,
      weight: testCase.weight ?? 1,
    };

    // Generate visualization
    const visualization = generateVisualization(validatedTestCase.input, validatedTestCase.expectedOutput);

    res.json({ visualization });
  } catch (error: any) {
    console.error("Error generating visualization:", error);

    // Handle execution errors
    if (error.message?.includes("timeout") || error.message?.includes("Timeout")) {
      return res.status(408).json({
        error: "Code execution timed out",
        code: "EXECUTION_TIMEOUT",
      });
    }

    if (error.message?.includes("memory") || error.message?.includes("Memory")) {
      return res.status(413).json({
        error: "Code execution exceeded memory limit",
        code: "MEMORY_EXCEEDED",
      });
    }

    res.status(500).json({
      error: "Failed to generate visualization",
      code: "INTERNAL_ERROR",
    });
  }
});

export default router;

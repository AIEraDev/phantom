import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { authenticateToken } from "../middleware/auth.middleware";
import { codeExecutionRateLimit } from "../middleware/rateLimit.middleware";
import { queueExecution, waitForExecution } from "../execution/execution.queue";
import { validateCode } from "../middleware/security.middleware";

const router = Router();

interface TestCase {
  input: any;
  expectedOutput: any;
}

interface ExecuteRequest {
  code: string;
  language: "javascript" | "python" | "typescript";
  testCases?: TestCase[];
  timeout?: number;
}

// POST /api/execute - Execute code with test cases
router.post("/", authenticateToken, codeExecutionRateLimit, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { code, language, testCases = [], timeout = 2000 }: ExecuteRequest = req.body;

    // Validate required fields
    if (!code) {
      return res.status(400).json({
        error: "Missing required fields",
        fields: {
          code: "Code is required",
        },
      });
    }

    if (!language) {
      return res.status(400).json({
        error: "Missing required fields",
        fields: {
          language: "Language is required",
        },
      });
    }

    // Validate language
    const validLanguages = ["javascript", "python", "typescript"];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        error: "Invalid language",
        message: `Language must be one of: ${validLanguages.join(", ")}`,
      });
    }

    // Validate code for security and length
    const codeValidation = validateCode(code, language);
    if (!codeValidation.valid) {
      return res.status(400).json({
        error: "Invalid code",
        message: codeValidation.error,
      });
    }

    // Validate timeout
    if (timeout < 100 || timeout > 10000) {
      return res.status(400).json({
        error: "Invalid timeout",
        message: "Timeout must be between 100ms and 10000ms",
      });
    }

    // If no test cases provided, execute code once
    if (testCases.length === 0) {
      const jobId = uuidv4();

      // Queue execution job
      await queueExecution({
        id: jobId,
        code,
        language,
        timeout,
      });

      // Wait for execution to complete
      const result = await waitForExecution(jobId, timeout + 5000);

      return res.status(200).json({
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTime: result.executionTime,
        memoryUsage: result.memoryUsage,
        timedOut: result.timedOut,
      });
    }

    // Execute code against each test case
    const results = [];
    let totalExecutionTime = 0;
    let totalMemoryUsage = 0;

    for (const testCase of testCases) {
      const jobId = uuidv4();

      // Prepare test input
      const testInput = typeof testCase.input === "string" ? testCase.input : JSON.stringify(testCase.input);

      // Queue execution job
      await queueExecution({
        id: jobId,
        code,
        language,
        testInput,
        timeout,
      });

      // Wait for execution to complete
      const result = await waitForExecution(jobId, timeout + 5000);

      totalExecutionTime += result.executionTime;
      totalMemoryUsage = Math.max(totalMemoryUsage, result.memoryUsage);

      // Check if output matches expected
      const actualOutput = result.stdout.trim();
      const expectedOutput = typeof testCase.expectedOutput === "string" ? testCase.expectedOutput.trim() : JSON.stringify(testCase.expectedOutput);

      const passed = actualOutput === expectedOutput && result.exitCode === 0;

      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: result.stdout,
        passed,
        executionTime: result.executionTime,
        memoryUsage: result.memoryUsage,
        stderr: result.stderr,
        timedOut: result.timedOut,
      });
    }

    // Calculate summary
    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;

    return res.status(200).json({
      success: passedCount === totalCount,
      results,
      summary: {
        passed: passedCount,
        failed: totalCount - passedCount,
        total: totalCount,
        totalExecutionTime,
        maxMemoryUsage: totalMemoryUsage,
      },
    });
  } catch (error) {
    console.error("Code execution error:", error);

    if (error instanceof Error) {
      if (error.message.includes("timeout") || error.message.includes("Timeout")) {
        return res.status(408).json({
          error: "Execution timeout",
          message: "Code execution took too long",
        });
      }

      if (error.message.includes("Docker")) {
        return res.status(503).json({
          error: "Service unavailable",
          message: "Code execution service is temporarily unavailable",
        });
      }
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

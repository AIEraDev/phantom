import { ExecutionConfig, ExecutionResult } from "./docker.service";

/**
 * Judge0 Cloud Integration Service
 *
 * This service provides code execution through Judge0 Cloud API,
 * maintaining backward compatibility with the existing ExecutionResult interface.
 */

/**
 * Logger utility for Judge0 service
 * Provides structured logging with timestamps for submissions, completions, and errors
 */
const logger = {
  /**
   * Log submission details when code is submitted to Judge0
   * Requirements: 8.1
   */
  logSubmission(submissionId: string, language: string, languageId: number): void {
    const timestamp = new Date().toISOString();
    console.log(`[Judge0] Submission sent | id=${submissionId} | language=${language} (id=${languageId}) | timestamp=${timestamp}`);
  },

  /**
   * Log completion details when execution finishes
   * Requirements: 8.2
   */
  logCompletion(submissionId: string, executionTime: number, memoryUsage: number, status: string, statusId: number): void {
    const timestamp = new Date().toISOString();
    console.log(`[Judge0] Submission completed | id=${submissionId} | executionTime=${executionTime}ms | memoryUsage=${memoryUsage} bytes | status=${status} (id=${statusId}) | timestamp=${timestamp}`);
  },

  /**
   * Log error details when an error occurs
   * Requirements: 8.3
   */
  logError(context: string, errorMessage: string, responseBody?: string): void {
    const timestamp = new Date().toISOString();
    const bodyInfo = responseBody ? ` | responseBody=${responseBody}` : "";
    console.error(`[Judge0] Error | context=${context} | error=${errorMessage}${bodyInfo} | timestamp=${timestamp}`);
  },

  /**
   * Log batch submission details
   */
  logBatchSubmission(submissionCount: number, tokens: string[]): void {
    const timestamp = new Date().toISOString();
    console.log(`[Judge0] Batch submission sent | count=${submissionCount} | tokens=[${tokens.join(", ")}] | timestamp=${timestamp}`);
  },

  /**
   * Log batch completion details
   */
  logBatchCompletion(totalCount: number, successCount: number, failureCount: number): void {
    const timestamp = new Date().toISOString();
    console.log(`[Judge0] Batch completed | total=${totalCount} | success=${successCount} | failures=${failureCount} | timestamp=${timestamp}`);
  },
};

// Judge0 API Configuration
export interface Judge0Config {
  apiKey: string;
  apiHost: string;
  cpuTimeLimit: number; // seconds
  memoryLimit: number; // kilobytes
  maxPollingTime: number; // milliseconds
  pollingInterval: number; // milliseconds
}

// Judge0 Submission Request
export interface Judge0Submission {
  source_code: string; // Base64 encoded
  language_id: number;
  stdin?: string; // Base64 encoded
  cpu_time_limit?: number; // seconds
  memory_limit?: number; // KB
  base64_encoded?: boolean;
}

// Judge0 API Response
export interface Judge0Response {
  token: string;
  stdout: string | null; // Base64 encoded
  stderr: string | null; // Base64 encoded
  status: {
    id: number;
    description: string;
  };
  time: string | null; // Execution time in seconds
  memory: number | null; // Memory usage in KB
  compile_output: string | null;
  message: string | null;
}

// Judge0 Status Codes
export enum Judge0Status {
  InQueue = 1,
  Processing = 2,
  Accepted = 3,
  WrongAnswer = 4,
  TimeLimitExceeded = 5,
  CompilationError = 6,
  RuntimeErrorSIGSEGV = 7,
  RuntimeErrorSIGXFSZ = 8,
  RuntimeErrorSIGFPE = 9,
  RuntimeErrorSIGABRT = 10,
  RuntimeErrorNZEC = 11,
  RuntimeErrorOther = 12,
  InternalError = 13,
  ExecFormatError = 14,
}

// Language ID mapping for Judge0
// Reference: https://ce.judge0.com/languages
export const LANGUAGE_MAP: Record<string, number> = {
  javascript: 63, // Node.js (12.14.0)
  python: 71, // Python (3.8.1)
  typescript: 74, // TypeScript (3.7.4)
};

// Supported languages type
export type SupportedLanguage = keyof typeof LANGUAGE_MAP;

/**
 * Custom error class for Judge0 API errors
 * Includes HTTP status code and response body for detailed error handling
 */
export class Judge0ApiError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly responseBody: string) {
    super(message);
    this.name = "Judge0ApiError";
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  isRateLimitError(): boolean {
    return this.statusCode === 429;
  }

  isServerError(): boolean {
    return this.statusCode >= 500;
  }
}

/**
 * Judge0Service - Cloud-based code execution service
 *
 * Provides code execution through Judge0 Cloud API with:
 * - Automatic language mapping
 * - Polling-based result retrieval
 * - Rate limit handling with exponential backoff
 * - Batch submission support
 */
// Retry configuration for API error handling
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

// Default retry configurations
const RATE_LIMIT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1s, 2s, 4s delays
  maxDelayMs: 4000,
};

const SERVER_ERROR_RETRY_CONFIG: RetryConfig = {
  maxRetries: 1,
  baseDelayMs: 1000,
  maxDelayMs: 1000,
};

export class Judge0Service {
  private config: Judge0Config;

  constructor(config?: Partial<Judge0Config>) {
    // Read API key from environment
    const apiKey = config?.apiKey || process.env.JUDGE0_API_KEY || "";

    if (!apiKey) {
      console.error("[Judge0] JUDGE0_API_KEY not set");
    }

    // Set configuration with defaults
    this.config = {
      apiKey,
      apiHost: config?.apiHost || "judge0-ce.p.rapidapi.com",
      cpuTimeLimit: config?.cpuTimeLimit || 10, // 10 seconds
      memoryLimit: config?.memoryLimit || 131072, // 128MB in KB
      maxPollingTime: config?.maxPollingTime || 30000, // 30 seconds
      pollingInterval: config?.pollingInterval || 500, // 500ms
    };
  }

  /**
   * Get the current configuration (for testing purposes)
   */
  getConfig(): Judge0Config {
    return { ...this.config };
  }

  /**
   * Map language string to Judge0 language ID
   * @throws Error if language is not supported
   */
  mapLanguageToId(language: string): number {
    const languageId = LANGUAGE_MAP[language];
    if (languageId === undefined) {
      throw new Error(`Unsupported language: ${language}. Supported languages: ${Object.keys(LANGUAGE_MAP).join(", ")}`);
    }
    return languageId;
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return language in LANGUAGE_MAP;
  }

  /**
   * Build the API URL for Judge0 endpoints
   */
  private buildApiUrl(endpoint: string): string {
    return `https://${this.config.apiHost}${endpoint}`;
  }

  /**
   * Build common headers for Judge0 API requests
   */
  private buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": this.config.apiKey,
      "X-RapidAPI-Host": this.config.apiHost,
    };
  }

  /**
   * Submit code to Judge0 Cloud API for execution
   *
   * @param submission - The submission object containing source code, language ID, and optional stdin
   * @returns The submission token for result retrieval
   * @throws Error if the API request fails after retries
   *
   * Requirements: 1.1, 1.2, 5.3, 5.4, 6.1, 6.2, 6.3
   */
  async submitCode(submission: Judge0Submission): Promise<string> {
    const url = this.buildApiUrl("/submissions?base64_encoded=true&wait=false");

    // Build request body with base64 encoded source code and stdin
    const requestBody: Judge0Submission = {
      source_code: Buffer.from(submission.source_code).toString("base64"),
      language_id: submission.language_id,
      base64_encoded: true,
      cpu_time_limit: submission.cpu_time_limit ?? this.config.cpuTimeLimit,
      memory_limit: submission.memory_limit ?? this.config.memoryLimit,
    };

    // Add stdin if provided (base64 encoded)
    if (submission.stdin) {
      requestBody.stdin = Buffer.from(submission.stdin).toString("base64");
    }

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      // Log error details including response body (Requirements: 8.3)
      logger.logError("submitCode", `HTTP ${response.status} ${response.statusText}`, errorBody);

      throw new Judge0ApiError(`Judge0 API error: ${response.status} ${response.statusText} - ${errorBody}`, response.status, errorBody);
    }

    const data = (await response.json()) as { token: string };

    if (!data.token) {
      logger.logError("submitCode", "Judge0 API did not return a submission token");
      throw new Error("Judge0 API did not return a submission token");
    }

    // Log submission details (Requirements: 8.1)
    const languageName = Object.entries(LANGUAGE_MAP).find(([_, id]) => id === submission.language_id)?.[0] || "unknown";
    logger.logSubmission(data.token, languageName, submission.language_id);

    return data.token;
  }

  /**
   * Poll Judge0 API for submission result
   *
   * Polls at configured intervals until the submission is complete
   * (status is not InQueue or Processing) or maxPollingTime is exceeded.
   * Includes retry logic for rate limits and server errors.
   *
   * @param token - The submission token returned by submitCode
   * @returns The full Judge0Response on completion
   * @throws Error if polling times out or API request fails after retries
   *
   * Requirements: 1.3, 3.5, 5.4, 6.1, 6.2, 6.3
   */
  async pollResult(token: string): Promise<Judge0Response> {
    const url = this.buildApiUrl(`/submissions/${token}?base64_encoded=true`);
    const startTime = Date.now();

    while (true) {
      // Check if we've exceeded max polling time
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= this.config.maxPollingTime) {
        logger.logError("pollResult", `Polling timeout: exceeded ${this.config.maxPollingTime}ms waiting for submission ${token}`);
        throw new Error(`Polling timeout: exceeded ${this.config.maxPollingTime}ms waiting for submission ${token}`);
      }

      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const errorBody = await response.text();

        // Log error details including response body (Requirements: 8.3)
        logger.logError("pollResult", `HTTP ${response.status} ${response.statusText}`, errorBody);

        throw new Judge0ApiError(`Judge0 API error: ${response.status} ${response.statusText} - ${errorBody}`, response.status, errorBody);
      }

      const data = (await response.json()) as Judge0Response;

      // Check if submission is still processing
      const statusId = data.status?.id;
      if (statusId !== Judge0Status.InQueue && statusId !== Judge0Status.Processing) {
        // Submission is complete (either success or error)
        // Log completion details (Requirements: 8.2)
        const executionTime = data.time ? Math.round(parseFloat(data.time) * 1000) : 0;
        const memoryUsage = data.memory ? data.memory * 1024 : 0;
        logger.logCompletion(token, executionTime, memoryUsage, data.status.description, statusId);
        return data;
      }

      // Wait before next poll
      await this.sleep(this.config.pollingInterval);
    }
  }

  /**
   * Map Judge0 response to ExecutionResult
   *
   * Decodes base64 stdout/stderr, parses execution metrics,
   * and maps status codes to appropriate result fields.
   *
   * @param response - The Judge0Response from pollResult
   * @returns ExecutionResult compatible with existing interface
   *
   * Requirements: 1.4, 4.1
   */
  mapResponseToResult(response: Judge0Response): ExecutionResult {
    // Decode base64 stdout and stderr
    const stdout = response.stdout ? Buffer.from(response.stdout, "base64").toString("utf-8") : "";
    let stderr = response.stderr ? Buffer.from(response.stderr, "base64").toString("utf-8") : "";

    // Handle compile_output for compilation errors
    if (response.status.id === Judge0Status.CompilationError && response.compile_output) {
      const compileOutput = Buffer.from(response.compile_output, "base64").toString("utf-8");
      stderr = compileOutput + (stderr ? "\n" + stderr : "");
    }

    // Parse time field to milliseconds (Judge0 returns time in seconds as string)
    const executionTime = response.time ? Math.round(parseFloat(response.time) * 1000) : 0;

    // Convert memory from KB to bytes (Judge0 returns memory in KB)
    const memoryUsage = response.memory ? response.memory * 1024 : 0;

    // Map status to exitCode and timedOut flag
    const { exitCode, timedOut, statusMessage } = this.mapStatusToResult(response.status.id);

    // Append status message to stderr if there's an error
    if (statusMessage && exitCode !== 0) {
      stderr = stderr ? `${stderr}\n${statusMessage}` : statusMessage;
    }

    return {
      stdout,
      stderr,
      exitCode,
      executionTime,
      memoryUsage,
      timedOut,
    };
  }

  /**
   * Map Judge0 status code to execution result fields
   *
   * @param statusId - The Judge0 status ID
   * @returns Object with exitCode, timedOut flag, and optional status message
   *
   * Requirements: 3.3, 3.4
   */
  private mapStatusToResult(statusId: number): { exitCode: number; timedOut: boolean; statusMessage?: string } {
    switch (statusId) {
      case Judge0Status.Accepted:
        return { exitCode: 0, timedOut: false };

      case Judge0Status.WrongAnswer:
        return { exitCode: 0, timedOut: false }; // Wrong answer is not an execution error

      case Judge0Status.TimeLimitExceeded:
        return { exitCode: 124, timedOut: true, statusMessage: "Time limit exceeded" };

      case Judge0Status.CompilationError:
        return { exitCode: 1, timedOut: false, statusMessage: "Compilation error" };

      case Judge0Status.RuntimeErrorSIGSEGV:
        return { exitCode: 139, timedOut: false, statusMessage: "Runtime error: Segmentation fault (SIGSEGV)" };

      case Judge0Status.RuntimeErrorSIGXFSZ:
        return { exitCode: 153, timedOut: false, statusMessage: "Runtime error: File size limit exceeded (SIGXFSZ)" };

      case Judge0Status.RuntimeErrorSIGFPE:
        return { exitCode: 136, timedOut: false, statusMessage: "Runtime error: Floating point exception (SIGFPE)" };

      case Judge0Status.RuntimeErrorSIGABRT:
        return { exitCode: 134, timedOut: false, statusMessage: "Runtime error: Aborted (SIGABRT)" };

      case Judge0Status.RuntimeErrorNZEC:
        return { exitCode: 1, timedOut: false, statusMessage: "Runtime error: Non-zero exit code" };

      case Judge0Status.RuntimeErrorOther:
        return { exitCode: 1, timedOut: false, statusMessage: "Runtime error" };

      case Judge0Status.InternalError:
        return { exitCode: 1, timedOut: false, statusMessage: "Internal error" };

      case Judge0Status.ExecFormatError:
        return { exitCode: 1, timedOut: false, statusMessage: "Execution format error" };

      default:
        return { exitCode: 1, timedOut: false, statusMessage: `Unknown status: ${statusId}` };
    }
  }

  /**
   * Sleep utility for polling intervals
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handle API errors and return appropriate ExecutionResult
   *
   * @param status - HTTP status code
   * @param errorBody - Error response body
   * @returns ExecutionResult with appropriate error information
   *
   * Requirements: 1.5, 5.4
   */
  handleApiError(status: number, errorBody: string): ExecutionResult {
    let stderr: string;
    let exitCode = 1;

    if (status === 401 || status === 403) {
      // Authentication error
      stderr = `Authentication error: Unauthorized access to Judge0 API (${status}). ${errorBody}`;
      logger.logError("handleApiError", `Authentication error: ${status}`, errorBody);
    } else if (status === 429) {
      // Rate limit exceeded
      stderr = `Rate limit exceeded: Judge0 API rate limit reached. ${errorBody}`;
      logger.logError("handleApiError", "Rate limit exceeded", errorBody);
    } else if (status >= 500) {
      // Server error
      stderr = `Server error: Judge0 API returned ${status}. ${errorBody}`;
      logger.logError("handleApiError", `Server error: ${status}`, errorBody);
    } else {
      // Other client errors
      stderr = `API error: Judge0 API returned ${status}. ${errorBody}`;
      logger.logError("handleApiError", `API error: ${status}`, errorBody);
    }

    return {
      stdout: "",
      stderr,
      exitCode,
      executionTime: 0,
      memoryUsage: 0,
      timedOut: false,
    };
  }

  /**
   * Execute a fetch request with retry logic for rate limits and server errors
   *
   * @param url - The URL to fetch
   * @param options - Fetch options
   * @returns Response object or throws error after all retries exhausted
   *
   * Requirements: 6.1, 6.2, 6.3
   */
  async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let rateLimitRetries = 0;
    let serverErrorRetries = 0;

    while (true) {
      const response = await fetch(url, options);

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        if (rateLimitRetries < RATE_LIMIT_RETRY_CONFIG.maxRetries) {
          const delay = Math.min(RATE_LIMIT_RETRY_CONFIG.baseDelayMs * Math.pow(2, rateLimitRetries), RATE_LIMIT_RETRY_CONFIG.maxDelayMs);
          console.warn(`[Judge0] Rate limited, retrying in ${delay}ms (attempt ${rateLimitRetries + 1}/${RATE_LIMIT_RETRY_CONFIG.maxRetries})`);
          await this.sleep(delay);
          rateLimitRetries++;
          continue;
        }
        // All retries exhausted
        return response;
      }

      // Handle server errors (5xx) with single retry
      if (response.status >= 500) {
        if (serverErrorRetries < SERVER_ERROR_RETRY_CONFIG.maxRetries) {
          const delay = SERVER_ERROR_RETRY_CONFIG.baseDelayMs;
          console.warn(`[Judge0] Server error ${response.status}, retrying in ${delay}ms (attempt ${serverErrorRetries + 1}/${SERVER_ERROR_RETRY_CONFIG.maxRetries})`);
          await this.sleep(delay);
          serverErrorRetries++;
          continue;
        }
        // All retries exhausted
        return response;
      }

      // For all other responses (success or client errors), return immediately
      return response;
    }
  }

  /**
   * Check if a response indicates an authentication error
   */
  isAuthError(status: number): boolean {
    return status === 401 || status === 403;
  }

  /**
   * Check if a response indicates a rate limit error
   */
  isRateLimitError(status: number): boolean {
    return status === 429;
  }

  /**
   * Check if a response indicates a server error
   */
  isServerError(status: number): boolean {
    return status >= 500;
  }

  /**
   * Wrap user code to read input from stdin instead of file
   * This ensures compatibility between Docker (file-based) and Judge0 (stdin-based) execution
   */
  private wrapCodeForStdin(code: string, language: string): string {
    // Check if code already reads from stdin or doesn't need wrapping
    if (!code.includes("/tmp/input.json") && !code.includes("input.json")) {
      return code;
    }

    if (language === "javascript" || language === "typescript") {
      // Replace file read with stdin read for JavaScript/TypeScript
      // The wrapper reads all stdin, writes to virtual file path, then runs original code
      const wrappedCode = `
// Judge0 stdin wrapper - reads input from stdin instead of file
const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
let stdinData = '';

// Read all stdin synchronously
const buffer = Buffer.alloc(1024);
let bytesRead;
try {
  while ((bytesRead = fs.readSync(0, buffer, 0, buffer.length, null)) > 0) {
    stdinData += buffer.toString('utf8', 0, bytesRead);
  }
} catch (e) {
  // End of stdin
}

// Mock fs.readFileSync to return stdin data for input.json
fs.readFileSync = function(path, encoding) {
  if (path === '/tmp/input.json' || path.endsWith('input.json')) {
    return stdinData.trim();
  }
  return originalReadFileSync.call(fs, path, encoding);
};

// Original user code below
${code}
`;
      return wrappedCode;
    } else if (language === "python") {
      // Replace file read with stdin read for Python
      const wrappedCode = `
# Judge0 stdin wrapper - reads input from stdin instead of file
import sys
import json
import builtins

_stdin_data = sys.stdin.read()

_original_open = builtins.open
def _mock_open(file, *args, **kwargs):
    if file == '/tmp/input.json' or str(file).endswith('input.json'):
        import io
        return io.StringIO(_stdin_data)
    return _original_open(file, *args, **kwargs)
builtins.open = _mock_open

# Original user code below
${code}
`;
      return wrappedCode;
    }

    return code;
  }

  /**
   * Execute code through Judge0 Cloud API
   * Maintains backward compatibility with ExecutionConfig interface
   *
   * @param config - ExecutionConfig with language, code, testInput, and optional timeout
   * @returns ExecutionResult with stdout, stderr, exitCode, executionTime, memoryUsage, timedOut
   * @throws Error if language is not supported
   *
   * Requirements: 4.2
   */
  async executeCode(config: ExecutionConfig): Promise<ExecutionResult> {
    const { language, code, testInput, timeout } = config;

    try {
      // Step 1: Validate language is supported (throws if not)
      const languageId = this.mapLanguageToId(language);

      // Step 2: Wrap code to read from stdin instead of file (for Judge0 compatibility)
      const wrappedCode = this.wrapCodeForStdin(code, language);

      // Step 3: Build submission and submit code to get token
      const submission: Judge0Submission = {
        source_code: wrappedCode,
        language_id: languageId,
        stdin: testInput,
        cpu_time_limit: timeout ? Math.ceil(timeout / 1000) : this.config.cpuTimeLimit,
        memory_limit: this.config.memoryLimit,
      };

      const token = await this.submitCode(submission);

      // Step 4: Poll for result
      const response = await this.pollResult(token);

      // Step 5: Map response to ExecutionResult
      return this.mapResponseToResult(response);
    } catch (error) {
      // Handle Judge0 API errors
      if (error instanceof Judge0ApiError) {
        return this.handleApiError(error.statusCode, error.responseBody);
      }

      // Handle unsupported language error
      if (error instanceof Error && error.message.includes("Unsupported language")) {
        throw error; // Re-throw language validation errors
      }

      // Handle polling timeout
      if (error instanceof Error && error.message.includes("Polling timeout")) {
        return {
          stdout: "",
          stderr: `Execution timeout: ${error.message}`,
          exitCode: 124,
          executionTime: this.config.maxPollingTime,
          memoryUsage: 0,
          timedOut: true,
        };
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : "Unknown execution error";
      logger.logError("executeCode", errorMessage);

      return {
        stdout: "",
        stderr: `Execution error: ${errorMessage}`,
        exitCode: 1,
        executionTime: 0,
        memoryUsage: 0,
        timedOut: false,
      };
    }
  }

  /**
   * Execute multiple code submissions in batch
   *
   * Submits multiple ExecutionConfig objects to Judge0 batch endpoint,
   * handling chunking for large batches and partial failures.
   *
   * @param configs - Array of ExecutionConfig objects to execute
   * @returns Array of ExecutionResult objects in the same order as input
   *
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  async executeBatch(configs: ExecutionConfig[]): Promise<ExecutionResult[]> {
    // Handle empty input
    if (configs.length === 0) {
      return [];
    }

    // Split into chunks of max 20 submissions (Judge0 batch limit)
    const chunks = this.chunkArray(configs, 20);
    const allResults: ExecutionResult[] = [];

    // Process each chunk
    for (const chunk of chunks) {
      const chunkResults = await this.executeChunk(chunk);
      allResults.push(...chunkResults);
    }

    return allResults;
  }

  /**
   * Split an array into chunks of specified size
   *
   * @param array - Array to split
   * @param chunkSize - Maximum size of each chunk
   * @returns Array of chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Execute a chunk of submissions through Judge0 batch endpoint
   *
   * @param configs - Array of ExecutionConfig objects (max 20)
   * @returns Array of ExecutionResult objects in the same order as input
   */
  private async executeChunk(configs: ExecutionConfig[]): Promise<ExecutionResult[]> {
    // Build submissions array with original indices for tracking
    const submissionsWithIndices: Array<{
      index: number;
      submission: Judge0Submission | null;
      error: ExecutionResult | null;
    }> = configs.map((config, index) => {
      try {
        const languageId = this.mapLanguageToId(config.language);
        return {
          index,
          submission: {
            source_code: config.code,
            language_id: languageId,
            stdin: config.testInput,
            cpu_time_limit: config.timeout ? Math.ceil(config.timeout / 1000) : this.config.cpuTimeLimit,
            memory_limit: this.config.memoryLimit,
          },
          error: null,
        };
      } catch (error) {
        // Handle unsupported language - mark as error but don't fail batch
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          index,
          submission: null,
          error: {
            stdout: "",
            stderr: `Submission error: ${errorMessage}`,
            exitCode: 1,
            executionTime: 0,
            memoryUsage: 0,
            timedOut: false,
          },
        };
      }
    });

    // Filter out submissions that had validation errors
    const validSubmissions = submissionsWithIndices.filter((s) => s.submission !== null);

    // If no valid submissions, return all errors
    if (validSubmissions.length === 0) {
      return submissionsWithIndices.map((s) => s.error!);
    }

    // Submit batch to Judge0
    let tokens: Array<{ index: number; token: string | null; error: ExecutionResult | null }>;
    try {
      tokens = await this.submitBatch(validSubmissions.map((s) => ({ index: s.index, submission: s.submission! })));
    } catch (error) {
      // If batch submission fails entirely, return error for all valid submissions
      const errorMessage = error instanceof Error ? error.message : "Unknown batch submission error";
      const errorResult: ExecutionResult = {
        stdout: "",
        stderr: `Batch submission error: ${errorMessage}`,
        exitCode: 1,
        executionTime: 0,
        memoryUsage: 0,
        timedOut: false,
      };

      // Build results array with validation errors and batch error
      const results: ExecutionResult[] = new Array(configs.length);
      for (const item of submissionsWithIndices) {
        results[item.index] = item.error || errorResult;
      }
      return results;
    }

    // Poll for all results
    const polledResults = await this.pollBatchResults(tokens);

    // Build final results array maintaining original order
    const results: ExecutionResult[] = new Array(configs.length);

    // First, fill in validation errors
    for (const item of submissionsWithIndices) {
      if (item.error) {
        results[item.index] = item.error;
      }
    }

    // Then, fill in polled results
    for (const result of polledResults) {
      results[result.index] = result.result;
    }

    return results;
  }

  /**
   * Submit a batch of submissions to Judge0 batch endpoint
   *
   * @param submissions - Array of submissions with their original indices
   * @returns Array of tokens with their original indices
   */
  private async submitBatch(submissions: Array<{ index: number; submission: Judge0Submission }>): Promise<Array<{ index: number; token: string | null; error: ExecutionResult | null }>> {
    const url = this.buildApiUrl("/submissions/batch?base64_encoded=true");

    // Build request body with base64 encoded submissions
    const requestBody = {
      submissions: submissions.map((s) => ({
        source_code: Buffer.from(s.submission.source_code).toString("base64"),
        language_id: s.submission.language_id,
        stdin: s.submission.stdin ? Buffer.from(s.submission.stdin).toString("base64") : undefined,
        cpu_time_limit: s.submission.cpu_time_limit ?? this.config.cpuTimeLimit,
        memory_limit: s.submission.memory_limit ?? this.config.memoryLimit,
        base64_encoded: true,
      })),
    };

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      // Log error details including response body (Requirements: 8.3)
      logger.logError("submitBatch", `HTTP ${response.status} ${response.statusText}`, errorBody);

      throw new Judge0ApiError(`Judge0 batch API error: ${response.status} ${response.statusText} - ${errorBody}`, response.status, errorBody);
    }

    const data = (await response.json()) as Array<{ token: string }>;

    // Log batch submission details (Requirements: 8.1)
    const tokens = data.map((d) => d.token).filter(Boolean);
    logger.logBatchSubmission(submissions.length, tokens);

    // Map tokens back to original indices
    return submissions.map((s, i) => ({
      index: s.index,
      token: data[i]?.token || null,
      error: data[i]?.token
        ? null
        : {
            stdout: "",
            stderr: "Failed to get submission token from batch response",
            exitCode: 1,
            executionTime: 0,
            memoryUsage: 0,
            timedOut: false,
          },
    }));
  }

  /**
   * Poll for results of multiple submissions
   *
   * @param tokens - Array of tokens with their original indices
   * @returns Array of results with their original indices
   */
  private async pollBatchResults(tokens: Array<{ index: number; token: string | null; error: ExecutionResult | null }>): Promise<Array<{ index: number; result: ExecutionResult }>> {
    const results: Array<{ index: number; result: ExecutionResult }> = [];
    let successCount = 0;
    let failureCount = 0;

    // Handle tokens that already have errors
    for (const item of tokens) {
      if (item.error) {
        results.push({ index: item.index, result: item.error });
        failureCount++;
      }
    }

    // Get valid tokens to poll
    const validTokens = tokens.filter((t) => t.token !== null);

    if (validTokens.length === 0) {
      // Log batch completion (Requirements: 8.2)
      logger.logBatchCompletion(tokens.length, successCount, failureCount);
      return results;
    }

    // Poll for each token individually (Judge0 batch GET requires all tokens)
    // Using Promise.allSettled to handle partial failures
    const pollPromises = validTokens.map(async (item) => {
      try {
        const response = await this.pollResult(item.token!);
        return {
          index: item.index,
          result: this.mapResponseToResult(response),
          success: response.status.id === Judge0Status.Accepted || response.status.id === Judge0Status.WrongAnswer,
        };
      } catch (error) {
        // Handle polling errors without failing entire batch
        const errorMessage = error instanceof Error ? error.message : "Unknown polling error";

        // Check if it's a timeout error
        const isTimeout = errorMessage.includes("Polling timeout");

        return {
          index: item.index,
          result: {
            stdout: "",
            stderr: `Polling error: ${errorMessage}`,
            exitCode: isTimeout ? 124 : 1,
            executionTime: isTimeout ? this.config.maxPollingTime : 0,
            memoryUsage: 0,
            timedOut: isTimeout,
          } as ExecutionResult,
          success: false,
        };
      }
    });

    const pollResults = await Promise.allSettled(pollPromises);

    // Process results
    for (const result of pollResults) {
      if (result.status === "fulfilled") {
        results.push({ index: result.value.index, result: result.value.result });
        if (result.value.success) {
          successCount++;
        } else {
          failureCount++;
        }
      }
      // Rejected promises should not happen due to try/catch in pollPromises
      // but handle them just in case
      if (result.status === "rejected") {
        logger.logError("pollBatchResults", "Unexpected rejection in batch polling", String(result.reason));
        failureCount++;
      }
    }

    // Log batch completion (Requirements: 8.2)
    logger.logBatchCompletion(tokens.length, successCount, failureCount);

    return results;
  }

  /**
   * Health check against Judge0 API
   *
   * Makes a GET request to the Judge0 /about endpoint to verify
   * the API is accessible and responding.
   *
   * @returns true if the API is healthy, false otherwise
   *
   * Requirements: 8.4
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = this.buildApiUrl("/about");

      const response = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (response.ok) {
        console.log("[Judge0] Health check passed");
        return true;
      }

      console.error(`[Judge0] Health check failed: ${response.status} ${response.statusText}`);
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Judge0] Health check error: ${errorMessage}`);
      return false;
    }
  }
}

// Export a factory function for creating the service
export function createJudge0Service(config?: Partial<Judge0Config>): Judge0Service {
  return new Judge0Service(config);
}

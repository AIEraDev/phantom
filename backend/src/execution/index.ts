/**
 * Execution Service Factory
 *
 * Factory module that selects the appropriate code execution backend
 * based on environment configuration. Supports Judge0 Cloud and Docker backends.
 *
 * Requirements: 4.3, 5.2
 */

import { dockerService, type ExecutionConfig, type ExecutionResult } from "./docker.service";
import { createJudge0Service } from "./judge0.service";

/**
 * Supported execution backends
 */
export type ExecutionBackend = "docker" | "judge0";

/**
 * Unified execution service interface
 * Both Docker and Judge0 services implement this interface
 */
export interface ExecutionService {
  executeCode(config: ExecutionConfig): Promise<ExecutionResult>;
  healthCheck(): Promise<boolean>;
}

/**
 * Create the appropriate execution service based on environment configuration
 *
 * Selection logic:
 * 1. If EXECUTION_BACKEND=judge0 and JUDGE0_API_KEY exists -> Judge0Service
 * 2. If EXECUTION_BACKEND=judge0 but no API key -> fallback to DockerExecutionService (with warning)
 * 3. If EXECUTION_BACKEND=docker or unset -> DockerExecutionService
 *
 * @returns ExecutionService instance (either Judge0Service or DockerExecutionService)
 *
 * Requirements: 4.3, 5.2
 */
export function createExecutionService(): ExecutionService {
  const backend = (process.env.EXECUTION_BACKEND || "docker") as ExecutionBackend;

  if (backend === "judge0") {
    const apiKey = process.env.JUDGE0_API_KEY;

    if (!apiKey) {
      console.error("[ExecutionFactory] JUDGE0_API_KEY not set, falling back to Docker execution");
      return dockerService;
    }

    console.log("[ExecutionFactory] Using Judge0 Cloud execution backend");
    return createJudge0Service({ apiKey });
  }

  // Default to Docker execution
  console.log("[ExecutionFactory] Using Docker execution backend");
  return dockerService;
}

/**
 * Singleton execution service instance
 * Created once at module load time based on environment configuration
 */
export const executionService: ExecutionService = createExecutionService();

// Re-export types and services for convenience
export { ExecutionConfig, ExecutionResult } from "./docker.service";
export { DockerExecutionService, dockerService } from "./docker.service";
export { Judge0Service, createJudge0Service } from "./judge0.service";

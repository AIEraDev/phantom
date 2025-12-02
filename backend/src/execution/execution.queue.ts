import { Queue, Worker, Job, QueueEvents } from "bullmq";
import { dockerService, ExecutionResult } from "./docker.service";

export interface ExecutionJob {
  id: string;
  code: string;
  language: "javascript" | "python" | "typescript";
  testInput?: string;
  timeout?: number;
}

export interface ExecutionJobResult extends ExecutionResult {
  jobId: string;
}

// Create Redis connection for BullMQ
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: parseInt(url.port) || 6379,
  password: url.password || undefined,
};

export const executionQueue = new Queue<ExecutionJob>("code-execution", {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: "exponential",
      delay: 1000, // Start with 1 second delay
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
      count: 1000, // Keep last 1000 failed jobs
    },
  },
});

export const executionQueueEvents = new QueueEvents("code-execution", {
  connection,
});

// Worker to process execution jobs
export const executionWorker = new Worker<ExecutionJob, ExecutionJobResult>(
  "code-execution",
  async (job: Job<ExecutionJob>) => {
    const { id, code, language, testInput, timeout } = job.data;

    try {
      // Update job progress
      await job.updateProgress(10);

      // Check if Docker is available
      const dockerHealthy = await dockerService.healthCheck();
      if (!dockerHealthy) {
        throw new Error("Docker is not available");
      }

      await job.updateProgress(20);

      // Pull image if needed (this will be fast if already pulled)
      await dockerService.pullImage(language);

      await job.updateProgress(40);

      // Execute code
      const result = await dockerService.executeCode({
        language,
        code,
        testInput,
        timeout,
      });

      await job.updateProgress(100);

      return {
        ...result,
        jobId: id,
      };
    } catch (error) {
      // Log error for monitoring
      console.error(`Execution job ${id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // per second
    },
  }
);

// Event handlers for monitoring
executionWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

executionWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

executionWorker.on("error", (err) => {
  console.error("Worker error:", err);
});

/**
 * Add a code execution job to the queue
 */
export async function queueExecution(jobData: ExecutionJob): Promise<Job<ExecutionJob, ExecutionJobResult>> {
  const job = await executionQueue.add("execute", jobData, {
    jobId: jobData.id,
  });

  return job;
}

/**
 * Get job status and result
 */
export async function getExecutionResult(jobId: string): Promise<ExecutionJobResult | null> {
  const job = await executionQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();

  if (state === "completed") {
    return job.returnvalue;
  }

  return null;
}

/**
 * Wait for job to complete and return result
 */
export async function waitForExecution(jobId: string, timeout: number = 10000): Promise<ExecutionJobResult> {
  const job = await executionQueue.getJob(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  // Wait for job to complete
  const result = await job.waitUntilFinished(executionQueueEvents, timeout);

  return result;
}

/**
 * Gracefully close queue and worker
 */
export async function closeExecutionQueue(): Promise<void> {
  await executionWorker.close();
  await executionQueue.close();
}

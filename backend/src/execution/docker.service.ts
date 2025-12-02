import Docker from "dockerode";

const docker = new Docker();

export interface ExecutionConfig {
  language: "javascript" | "python" | "typescript";
  code: string;
  testInput?: string;
  timeout?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  memoryUsage: number;
  timedOut: boolean;
}

const LANGUAGE_CONFIG = {
  javascript: {
    image: "node:20-alpine",
    cmd: ["node", "/tmp/code.js"],
    filename: "code.js",
    inputFilename: "input.json",
  },
  python: {
    image: "python:3.11-slim",
    cmd: ["python", "/tmp/code.py"],
    filename: "code.py",
    inputFilename: "input.json",
  },
  typescript: {
    image: "node:20-alpine",
    cmd: ["sh", "-c", "npx -y esbuild /tmp/code.ts --outfile=/tmp/code.js && node /tmp/code.js"],
    filename: "code.ts",
    inputFilename: "input.json",
  },
};

// Container pool for reuse (optimization)
interface PooledContainer {
  container: Docker.Container;
  language: string;
  inUse: boolean;
  lastUsed: number;
}

export class DockerExecutionService {
  private containerPool: Map<string, PooledContainer[]> = new Map();
  private readonly MAX_POOL_SIZE = 5;
  private readonly POOL_CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly CONTAINER_MAX_AGE = 300000; // 5 minutes
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Start cleanup interval
    this.startPoolCleanup();
  }
  /**
   * Start periodic cleanup of old containers in pool
   */
  private startPoolCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldContainers();
    }, this.POOL_CLEANUP_INTERVAL);
  }

  /**
   * Cleanup old containers from pool
   */
  private async cleanupOldContainers(): Promise<void> {
    const now = Date.now();

    for (const [language, containers] of this.containerPool.entries()) {
      const toRemove: number[] = [];

      for (let i = 0; i < containers.length; i++) {
        const pooled = containers[i];
        if (!pooled.inUse && now - pooled.lastUsed > this.CONTAINER_MAX_AGE) {
          await this.cleanupContainer(pooled.container);
          toRemove.push(i);
        }
      }

      // Remove cleaned up containers from pool
      for (let i = toRemove.length - 1; i >= 0; i--) {
        containers.splice(toRemove[i], 1);
      }
    }
  }

  /**
   * Get a container from pool or create new one
   */
  private async getOrCreateContainer(language: "javascript" | "python" | "typescript"): Promise<Docker.Container> {
    const pool = this.containerPool.get(language) || [];

    // Try to find available container in pool
    const available = pool.find((p) => !p.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      return available.container;
    }

    // Create new container
    const container = await this.createSecureContainer(language);

    // Add to pool if not full
    if (pool.length < this.MAX_POOL_SIZE) {
      pool.push({
        container,
        language,
        inUse: true,
        lastUsed: Date.now(),
      });
      this.containerPool.set(language, pool);
    }

    return container;
  }

  /**
   * Return container to pool
   */
  private returnContainerToPool(container: Docker.Container, language: "javascript" | "python" | "typescript"): void {
    const pool = this.containerPool.get(language) || [];
    const pooled = pool.find((p) => p.container.id === container.id);

    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
    }
  }

  /**
   * Execute code in an isolated Docker container with security restrictions
   */
  async executeCode(config: ExecutionConfig): Promise<ExecutionResult> {
    const { language, code, testInput = "", timeout = 10000 } = config; // Increased default timeout to 10s
    const langConfig = LANGUAGE_CONFIG[language];

    const startTime = Date.now();
    let container: Docker.Container | null = null;
    let timedOut = false;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Always create a fresh container for reliability
      // Container pooling was causing issues with state management
      container = await this.createSecureContainer(language);

      // Write code and input to container using tar archive
      // This is more reliable than using stdin
      const tar = require("tar-stream");
      const pack = tar.pack();
      pack.entry({ name: langConfig.filename }, code);
      if (testInput) {
        pack.entry({ name: "input.json" }, testInput);
      }
      pack.finalize();

      await container.putArchive(pack, { path: "/tmp" });

      // Attach to container BEFORE starting for stdin support (backward compatibility)
      const stream = await container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
      });

      // Start the container
      await container.start();

      // Write input to stdin as well (for backward compatibility with old code that reads from stdin)
      if (testInput) {
        stream.write(testInput + "\n");
      }
      stream.end();

      // Create a promise that will resolve/reject based on execution
      const executionPromise = new Promise<{ stdout: string; stderr: string; exitCode: number }>(async (resolve, reject) => {
        try {
          // Wait for container to finish and get output
          const result = await this.waitForContainer(container!);
          if (!timedOut) {
            resolve(result);
          }
        } catch (error) {
          if (!timedOut) {
            reject(error);
          }
        }
      });

      // Set up timeout handler that will kill the container
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(async () => {
          timedOut = true;
          // Kill the container immediately on timeout
          if (container) {
            try {
              await container.kill();
            } catch (e) {
              // Container might already be stopped
            }
          }
          reject(new Error("Execution timeout"));
        }, timeout);
      });

      // Execute code and race against timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Clear timeout if execution completed
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const executionTime = Date.now() - startTime;

      // Get container stats for memory usage (skip if timed out)
      let memoryUsage = 0;
      try {
        const stats = await container.stats({ stream: false });
        memoryUsage = stats.memory_stats.usage || 0;
      } catch (e) {
        // Stats might fail if container was killed
      }

      return {
        ...result,
        executionTime,
        memoryUsage,
        timedOut: false,
      };
    } catch (error) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const executionTime = Date.now() - startTime;

      if (timedOut) {
        return {
          stdout: "",
          stderr: "Execution timed out",
          exitCode: 124,
          executionTime,
          memoryUsage: 0,
          timedOut: true,
        };
      }

      // Return error result instead of throwing
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : "Execution failed",
        exitCode: 1,
        executionTime,
        memoryUsage: 0,
        timedOut: false,
      };
    } finally {
      // Always cleanup container
      if (container) {
        await this.cleanupContainer(container);
      }
    }
  }

  /**
   * Create a secure Docker container with resource limits and restrictions
   * Optimized for faster startup
   */
  private async createSecureContainer(language: "javascript" | "python" | "typescript"): Promise<Docker.Container> {
    const langConfig = LANGUAGE_CONFIG[language];

    // Create container with security configurations and optimizations
    const container = await docker.createContainer({
      Image: langConfig.image,
      Cmd: langConfig.cmd,
      HostConfig: {
        Memory: 512 * 1024 * 1024, // 512MB
        MemorySwap: 512 * 1024 * 1024, // No additional swap
        CpuQuota: 100000, // 100% of one core
        NetworkMode: "none", // No network access
        // Note: ReadonlyRootfs removed - it prevents putArchive from writing code files
        // Security is maintained through: no network, memory/cpu limits, process limits
        AutoRemove: false, // We'll remove manually after getting stats
        // Performance optimizations
        PidsLimit: 50, // Limit number of processes
        OomKillDisable: false, // Allow OOM killer
      },
      WorkingDir: "/tmp",
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: true,
      StdinOnce: true,
      Tty: false,
      // Optimization: Don't allocate a TTY
      Labels: {
        "phantom.pool": "execution",
        "phantom.language": language,
      },
    });

    return container;
  }

  /**
   * Wait for container to finish and capture output using logs
   */
  private async waitForContainer(container: Docker.Container): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Wait for container to finish
    const result = await container.wait();

    // Get logs
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      follow: false,
    });

    // Parse logs - Docker logs are multiplexed with 8-byte header
    let stdout = "";
    let stderr = "";

    // Convert to buffer if needed
    const buffer = Buffer.isBuffer(logs) ? logs : Buffer.from(logs);
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) break;

      const streamType = buffer[offset]; // 1 = stdout, 2 = stderr
      const size = buffer.readUInt32BE(offset + 4);
      offset += 8;

      if (offset + size > buffer.length) break;

      const content = buffer.slice(offset, offset + size).toString("utf-8");
      if (streamType === 1) {
        stdout += content;
      } else if (streamType === 2) {
        stderr += content;
      }
      offset += size;
    }

    // Log execution result for debugging
    if (result.StatusCode !== 0) {
      console.log(`[Docker] Execution failed with exit code ${result.StatusCode}`);
      console.log(`[Docker] stdout: ${stdout.substring(0, 500)}`);
      console.log(`[Docker] stderr: ${stderr.substring(0, 500)}`);
    }

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: result.StatusCode,
    };
  }

  /**
   * Run the container with an already-attached stream and capture output
   * This method is used when the stream is attached before the container starts
   * @deprecated Use waitForContainer instead
   */
  private async runContainerWithStream(container: Docker.Container, stream: NodeJS.ReadWriteStream, input: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    let stdout = "";
    let stderr = "";

    // Demultiplex Docker stream
    const stdoutStream = new WritableStream({
      write(chunk) {
        stdout += chunk.toString();
      },
    });

    const stderrStream = new WritableStream({
      write(chunk) {
        stderr += chunk.toString();
      },
    });

    // Use Docker's demux to separate stdout and stderr
    container.modem.demuxStream(stream, stdoutStream as any, stderrStream as any);

    // Send input if provided (add newline to ensure proper stdin reading)
    if (input) {
      console.log(`[Docker] Writing stdin: ${input.substring(0, 100)}${input.length > 100 ? "..." : ""}`);
      stream.write(input + "\n");
    }
    stream.end();

    // Wait for container to finish
    const result = await container.wait();

    // Log execution result for debugging
    if (result.StatusCode !== 0) {
      console.log(`[Docker] Execution failed with exit code ${result.StatusCode}`);
      console.log(`[Docker] stdout: ${stdout.substring(0, 500)}`);
      console.log(`[Docker] stderr: ${stderr.substring(0, 500)}`);
    }

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: result.StatusCode,
    };
  }

  /**
   * Run the container and capture output (legacy method, attaches after start)
   * @deprecated Use runContainerWithStream instead
   */
  private async runContainer(container: Docker.Container, input: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Attach to container streams
    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
    });

    return this.runContainerWithStream(container, stream, input);
  }

  /**
   * Cleanup container after execution
   */
  private async cleanupContainer(container: Docker.Container): Promise<void> {
    try {
      // Stop container if still running
      const info = await container.inspect();
      if (info.State.Running) {
        await container.kill();
      }

      // Remove container
      await container.remove({ force: true });
    } catch (error) {
      // Log error but don't throw - cleanup is best effort
      console.error("Error cleaning up container:", error);
    }
  }

  /**
   * Create a tar archive containing the code file
   */
  private createTarArchive(filename: string, content: string): NodeJS.ReadableStream {
    const tar = require("tar-stream");
    const pack = tar.pack();

    pack.entry({ name: filename }, content);
    pack.finalize();

    return pack;
  }

  /**
   * Pull Docker image if not already available
   */
  async pullImage(language: "javascript" | "python" | "typescript"): Promise<void> {
    const langConfig = LANGUAGE_CONFIG[language];

    try {
      await docker.getImage(langConfig.image).inspect();
      // Image already exists
    } catch (error) {
      // Image doesn't exist, pull it
      console.log(`Pulling Docker image: ${langConfig.image}`);
      await new Promise<void>((resolve, reject) => {
        docker.pull(langConfig.image, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            reject(err);
            return;
          }

          docker.modem.followProgress(stream, (progressErr: Error | null) => {
            if (progressErr) {
              reject(progressErr);
            } else {
              resolve();
            }
          });
        });
      });
    }
  }

  /**
   * Check if Docker is available and running
   */
  async healthCheck(): Promise<boolean> {
    try {
      await docker.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Warm up container pool by pre-creating containers
   */
  async warmupPool(): Promise<void> {
    const languages: Array<"javascript" | "python" | "typescript"> = ["javascript", "python", "typescript"];

    for (const lang of languages) {
      try {
        // Ensure image is pulled
        await this.pullImage(lang);

        // Pre-create containers for pool
        const pool = this.containerPool.get(lang) || [];
        const toCreate = Math.min(2, this.MAX_POOL_SIZE - pool.length); // Pre-create 2 containers per language

        for (let i = 0; i < toCreate; i++) {
          const container = await this.createSecureContainer(lang);
          pool.push({
            container,
            language: lang,
            inUse: false,
            lastUsed: Date.now(),
          });
        }

        if (pool.length > 0) {
          this.containerPool.set(lang, pool);
        }
      } catch (error) {
        console.error(`Failed to warm up pool for ${lang}:`, error);
      }
    }
  }

  /**
   * Shutdown and cleanup all pooled containers
   */
  async shutdown(): Promise<void> {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Cleanup all pooled containers
    for (const [language, containers] of this.containerPool.entries()) {
      for (const pooled of containers) {
        await this.cleanupContainer(pooled.container);
      }
    }

    this.containerPool.clear();
  }
}

export const dockerService = new DockerExecutionService();

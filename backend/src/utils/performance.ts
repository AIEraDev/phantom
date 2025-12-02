/**
 * Performance monitoring utilities
 */

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS = 1000;

  /**
   * Start timing an operation
   */
  startTimer(operation: string): (metadata?: Record<string, any>) => void {
    const start = Date.now();

    return (metadata?: Record<string, any>) => {
      const duration = Date.now() - start;
      this.recordMetric({
        operation,
        duration,
        timestamp: start,
        metadata,
      });
    };
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Log slow operations (> 1 second)
    if (metric.duration > 1000) {
      console.warn(`Slow operation detected: ${metric.operation} took ${metric.duration}ms`, metric.metadata);
    }
  }

  /**
   * Get average duration for an operation
   */
  getAverageDuration(operation: string): number {
    const operationMetrics = this.metrics.filter((m) => m.operation === operation);

    if (operationMetrics.length === 0) {
      return 0;
    }

    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  /**
   * Get all metrics for an operation
   */
  getMetrics(operation?: string): PerformanceMetrics[] {
    if (operation) {
      return this.metrics.filter((m) => m.operation === operation);
    }
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get performance summary
   */
  getSummary(): Record<string, { count: number; avgDuration: number; maxDuration: number }> {
    const summary: Record<string, { count: number; totalDuration: number; maxDuration: number }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.operation]) {
        summary[metric.operation] = {
          count: 0,
          totalDuration: 0,
          maxDuration: 0,
        };
      }

      summary[metric.operation].count++;
      summary[metric.operation].totalDuration += metric.duration;
      summary[metric.operation].maxDuration = Math.max(summary[metric.operation].maxDuration, metric.duration);
    }

    // Convert to final format with average
    const result: Record<string, { count: number; avgDuration: number; maxDuration: number }> = {};
    for (const [operation, data] of Object.entries(summary)) {
      result[operation] = {
        count: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
        maxDuration: data.maxDuration,
      };
    }

    return result;
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for monitoring async function performance
 */
export function monitored(operation: string) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const endTimer: ReturnType<typeof performanceMonitor.startTimer> = performanceMonitor.startTimer(`${operation}.${propertyKey}`);
      try {
        const result = await originalMethod.apply(this, args);
        endTimer({ success: true });
        return result;
      } catch (error) {
        endTimer({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
        throw error;
      }
    };

    return descriptor;
  };
}

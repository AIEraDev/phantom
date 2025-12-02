import { Router } from "express";
import { performanceMonitor } from "../utils/performance";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/performance/metrics
 * Get performance metrics summary (admin only in production)
 */
router.get("/metrics", authenticateToken, (req, res) => {
  // In production, you might want to restrict this to admin users
  // For now, any authenticated user can access

  const summary = performanceMonitor.getSummary();

  res.json({
    summary,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/performance/metrics/:operation
 * Get detailed metrics for a specific operation
 */
router.get("/metrics/:operation", authenticateToken, (req, res) => {
  const { operation } = req.params;
  const metrics = performanceMonitor.getMetrics(operation);

  if (metrics.length === 0) {
    return res.status(404).json({
      error: "No metrics found for operation",
      operation,
    });
  }

  const avgDuration = performanceMonitor.getAverageDuration(operation);

  res.json({
    operation,
    count: metrics.length,
    avgDuration,
    metrics: metrics.slice(-100), // Return last 100 metrics
  });
});

/**
 * DELETE /api/performance/metrics
 * Clear all performance metrics
 */
router.delete("/metrics", authenticateToken, (req, res) => {
  performanceMonitor.clear();

  res.json({
    message: "Performance metrics cleared",
    timestamp: new Date().toISOString(),
  });
});

export default router;

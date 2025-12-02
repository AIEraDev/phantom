import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import challengeRoutes from "./routes/challenge.routes";
import matchmakingRoutes from "./routes/matchmaking.routes";
import executionRoutes from "./routes/execution.routes";
import matchRoutes from "./routes/match.routes";
import leaderboardRoutes from "./routes/leaderboard.routes";
import performanceRoutes from "./routes/performance.routes";
import skillTreeRoutes from "./routes/skillTree.routes";
import ghostRoutes from "./routes/ghost.routes";
import practiceRoutes from "./routes/practice.routes";
import visualizationRoutes from "./routes/visualization.routes";
import coachRoutes from "./routes/coach.routes";
import { matchmakingProcessor } from "./services/matchmaking.processor";
import { matchCleanupService } from "./services/matchCleanup.service";
import { setupConnectionHandlers, requireAuth, ClientToServerEvents, ServerToClientEvents } from "./websocket";
import { dockerService } from "./execution/docker.service";
import { securityHeaders, getCorsOptions, sanitizeInput } from "./middleware/security.middleware";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Get allowed origins for WebSocket CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [process.env.FRONTEND_URL || "http://localhost:3000"];

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Security Middleware - Apply first
app.use(securityHeaders);
app.use(cors(getCorsOptions()));

// Body parsing with size limits to prevent DoS
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Input sanitization - Apply to all routes
app.use(sanitizeInput);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/matchmaking", matchmakingRoutes);
app.use("/api/execute", executionRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/skill-tree", skillTreeRoutes);
app.use("/api/ghosts", ghostRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/visualization", visualizationRoutes);
app.use("/api/coach", coachRoutes);

// Setup WebSocket authentication middleware (optional - allows auth via handshake)
io.use(requireAuth);

// Setup WebSocket connection handlers
const eventEmitter = setupConnectionHandlers(io);

// Set Socket.IO instance for matchmaking processor
matchmakingProcessor.setIO(io);

// Export io and eventEmitter for use in other modules
export { io, eventEmitter };

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);

  // Start matchmaking processor
  matchmakingProcessor.start();

  // Start match cleanup service (cleans up stale/abandoned matches)
  matchCleanupService.start();

  // Warm up Docker container pool for better performance
  console.log("Warming up Docker container pool...");
  try {
    await dockerService.warmupPool();
    console.log("Docker container pool ready");
  } catch (error) {
    console.error("Failed to warm up Docker container pool:", error);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  matchmakingProcessor.stop();
  matchCleanupService.stop();
  await dockerService.shutdown();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  matchmakingProcessor.stop();
  matchCleanupService.stop();
  await dockerService.shutdown();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

import { Socket } from "socket.io";
import { verifyToken } from "../utils/jwt";
import { AuthenticatedSocket } from "./types";
import { sessionManager } from "./sessionManager";

/**
 * Authenticate WebSocket connection using JWT token
 */
export function authenticateSocket(socket: AuthenticatedSocket, token: string): boolean {
  try {
    // Verify JWT token
    const payload = verifyToken(token);

    // Attach user data to socket
    socket.user = payload;
    socket.userId = payload.userId;

    // Create user session
    sessionManager.addSession({
      userId: payload.userId,
      socketId: socket.id,
      username: payload.username,
      email: payload.email,
      connectedAt: new Date(),
    });

    console.log(`User ${payload.username} (${payload.userId}) authenticated on socket ${socket.id}`);

    return true;
  } catch (error) {
    console.error("WebSocket authentication failed:", error);
    return false;
  }
}

/**
 * Middleware to require authentication for WebSocket connection
 */
export function requireAuth(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error("Authentication token required"));
  }

  try {
    const payload = verifyToken(token as string);
    (socket as AuthenticatedSocket).user = payload;
    (socket as AuthenticatedSocket).userId = payload.userId;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        return next(new Error("Token expired"));
      }
      if (error.name === "JsonWebTokenError") {
        return next(new Error("Invalid token"));
      }
    }
    return next(new Error("Authentication failed"));
  }
}

import { UserSession } from "./types";

/**
 * Manages active WebSocket user sessions in memory
 */
class SessionManager {
  private sessions: Map<string, UserSession> = new Map();
  private userIdToSocketId: Map<string, string> = new Map();

  /**
   * Add a new user session
   * If user already has a session with a different socketId, remove the old one first
   */
  addSession(session: UserSession): void {
    // Check if user already has a session with a different socket
    const existingSocketId = this.userIdToSocketId.get(session.userId);
    if (existingSocketId && existingSocketId !== session.socketId) {
      // Remove old session
      this.sessions.delete(existingSocketId);
      console.log(`Replaced old session ${existingSocketId} with new session ${session.socketId} for user ${session.userId}`);
    }

    this.sessions.set(session.socketId, session);
    this.userIdToSocketId.set(session.userId, session.socketId);
  }

  /**
   * Remove a session by socket ID
   */
  removeSession(socketId: string): UserSession | undefined {
    const session = this.sessions.get(socketId);
    if (session) {
      this.sessions.delete(socketId);
      this.userIdToSocketId.delete(session.userId);
    }
    return session;
  }

  /**
   * Get session by socket ID
   */
  getSessionBySocketId(socketId: string): UserSession | undefined {
    return this.sessions.get(socketId);
  }

  /**
   * Get session by user ID
   */
  getSessionByUserId(userId: string): UserSession | undefined {
    const socketId = this.userIdToSocketId.get(userId);
    return socketId ? this.sessions.get(socketId) : undefined;
  }

  /**
   * Get socket ID for a user ID
   */
  getSocketIdByUserId(userId: string): string | undefined {
    return this.userIdToSocketId.get(userId);
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.userIdToSocketId.has(userId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get total number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clear all sessions (useful for testing)
   */
  clearAll(): void {
    this.sessions.clear();
    this.userIdToSocketId.clear();
  }
}

export const sessionManager = new SessionManager();

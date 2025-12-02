import { Server } from "socket.io";
import { sessionManager } from "./sessionManager";
import { ServerToClientEvents, ClientToServerEvents } from "./types";

/**
 * Utility class for broadcasting WebSocket events to specific users or rooms
 */
export class EventEmitter {
  constructor(private io: Server<ClientToServerEvents, ServerToClientEvents>) {}

  /**
   * Emit event to a specific user by user ID
   */
  emitToUser<K extends keyof ServerToClientEvents>(userId: string, event: K, ...args: Parameters<ServerToClientEvents[K]>): boolean {
    const socketId = sessionManager.getSocketIdByUserId(userId);
    if (!socketId) {
      console.warn(`Cannot emit to user ${userId}: not connected`);
      return false;
    }

    this.io.to(socketId).emit(event, ...args);
    return true;
  }

  /**
   * Emit event to multiple users by user IDs
   */
  emitToUsers<K extends keyof ServerToClientEvents>(userIds: string[], event: K, ...args: Parameters<ServerToClientEvents[K]>): void {
    userIds.forEach((userId) => {
      this.emitToUser(userId, event, ...args);
    });
  }

  /**
   * Emit event to a specific room
   */
  emitToRoom<K extends keyof ServerToClientEvents>(room: string, event: K, ...args: Parameters<ServerToClientEvents[K]>): void {
    this.io.to(room).emit(event, ...args);
  }

  /**
   * Emit event to all connected clients
   */
  emitToAll<K extends keyof ServerToClientEvents>(event: K, ...args: Parameters<ServerToClientEvents[K]>): void {
    this.io.emit(event, ...args);
  }

  /**
   * Emit event to all clients in a room except specific socket
   */
  emitToRoomExcept<K extends keyof ServerToClientEvents>(room: string, excludeSocketId: string, event: K, ...args: Parameters<ServerToClientEvents[K]>): void {
    this.io
      .to(room)
      .except(excludeSocketId)
      .emit(event, ...args);
  }

  /**
   * Join a socket to a room
   */
  joinRoom(socketId: string, room: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(room);
    }
  }

  /**
   * Remove a socket from a room
   */
  leaveRoom(socketId: string, room: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(room);
    }
  }

  /**
   * Get all sockets in a room
   */
  async getSocketsInRoom(room: string): Promise<string[]> {
    const sockets = await this.io.in(room).fetchSockets();
    return sockets.map((socket) => socket.id);
  }

  /**
   * Get number of clients in a room
   */
  async getRoomSize(room: string): Promise<number> {
    const sockets = await this.getSocketsInRoom(room);
    return sockets.length;
  }
}

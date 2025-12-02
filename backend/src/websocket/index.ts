/**
 * WebSocket module exports
 */
export { setupConnectionHandlers } from "./connectionHandler";
export { EventEmitter } from "./eventEmitter";
export { sessionManager } from "./sessionManager";
export { authenticateSocket, requireAuth } from "./authHandler";
export { setupMatchmakingHandlers } from "./matchmakingHandler";
export { setupBattleArenaHandlers } from "./battleArenaHandler";
export { setupSpectatorHandlers } from "./spectatorHandler";
export { setupGhostRaceHandlers } from "./ghostRaceHandler";
export { setupCoachHandlers, emitAnalysisReady, emitAnalysisError } from "./coachHandler";
export { setupPowerUpHandlers, sendPowerUpStateToPlayer } from "./powerUpHandler";
export * from "./types";

# Implementation Plan

- [x] 1. Create power-up type definitions and data models

  - [x] 1.1 Create power-up types file with TypeScript interfaces
    - Create `backend/src/types/powerups.ts` with PowerUpType, PowerUpInventory, ActivePowerUpEffect, PlayerPowerUpState, MatchPowerUpState, and result types
    - Export all types for use across services
    - _Requirements: 1.1, 1.2, 9.1, 9.2_
  - [x] 1.2 Write property test for power-up state round-trip
    - **Property 8: Power-up state round-trip consistency**
    - **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2, 9.3**
  - [x] 1.3 Create frontend power-up types
    - Create `frontend/src/types/powerups.ts` mirroring backend types for client use
    - _Requirements: 5.1_

- [x] 2. Implement PowerUpStateManager for Redis integration

  - [x] 2.1 Create power-up state manager service
    - Create `backend/src/redis/powerUpState.service.ts`
    - Implement setPowerUpState, getPowerUpState, updatePlayerInventory, updateCooldown, updateActiveEffect methods
    - Use existing Redis connection from `backend/src/redis/connection.ts`
    - _Requirements: 1.2, 8.1, 8.2, 9.1, 9.2_
  - [x] 2.2 Write unit tests for PowerUpStateManager
    - Test serialization/deserialization of power-up state
    - Test CRUD operations on power-up state
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 3. Implement core PowerUpService

  - [x] 3.1 Create PowerUpService with initialization logic
    - Create `backend/src/services/powerup.service.ts`
    - Implement initializePowerUps method to allocate 1 of each power-up to both players
    - Implement getPlayerPowerUps and getMatchPowerUpState methods
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 3.2 Write property test for power-up allocation
    - **Property 1: Power-up allocation invariant**
    - **Validates: Requirements 1.1, 1.2**
  - [x] 3.3 Implement cooldown checking logic
    - Implement canUsePowerUp method with 60-second cooldown check
    - Return remaining cooldown time when on cooldown
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 3.4 Write property test for cooldown enforcement
    - **Property 6: Cooldown enforcement**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  - [x] 3.5 Implement Time Freeze activation
    - Implement activateTimeFreeze method
    - Set 30-second freeze duration
    - Update player's active effect state
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 3.6 Implement calculateEffectiveTimeRemaining
    - Account for active Time Freeze when calculating player's remaining time
    - Ensure opponent's time is unaffected
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 3.7 Write property test for Time Freeze timer isolation
    - **Property 3: Time Freeze timer isolation**
    - **Validates: Requirements 2.1, 2.2, 2.3**
  - [x] 3.8 Implement Code Peek activation
    - Implement activateCodePeek method
    - Capture opponent's current code from match state
    - Return code snapshot to requesting player
    - _Requirements: 3.1, 3.2_
  - [x] 3.9 Write property test for Code Peek snapshot
    - **Property 4: Code Peek returns opponent's current code**
    - **Validates: Requirements 3.1**
  - [x] 3.10 Implement Debug Shield activation
    - Implement activateDebugShield method
    - Set 3 shielded test runs
    - _Requirements: 4.1, 4.2_
  - [x] 3.11 Implement consumeDebugShieldCharge
    - Decrement shield charges on test run
    - Deactivate shield when charges reach 0
    - _Requirements: 4.2, 4.3_
  - [x] 3.12 Write property test for Debug Shield lifecycle
    - **Property 5: Debug Shield lifecycle**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [x] 3.13 Implement unified activatePowerUp method
    - Route to specific activation method based on power-up type
    - Validate inventory and cooldown before activation
    - Decrement inventory and start cooldown on success
    - _Requirements: 1.4, 2.5, 3.5, 4.5_
  - [x] 3.14 Write property test for power-up consumption
    - **Property 2: Power-up consumption decrements inventory**
    - **Validates: Requirements 1.4**

- [x] 4. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement WebSocket handler for power-ups

  - [x] 5.1 Create power-up WebSocket handler
    - Create `backend/src/websocket/powerUpHandler.ts`
    - Implement handleActivatePowerUp to process activation requests
    - Validate authentication and match participation
    - _Requirements: 1.3, 2.4, 3.3_
  - [x] 5.2 Implement power-up event broadcasting
    - Broadcast powerup_activated to requesting player with full details
    - Broadcast opponent_used_powerup to opponent (limited info)
    - Broadcast spectator_powerup_event to spectators
    - _Requirements: 2.4, 3.3, 7.1, 7.2_
  - [x] 5.3 Write property test for spectator event payload
    - **Property 7: Spectator event payload completeness**
    - **Validates: Requirements 7.2**
  - [x] 5.4 Register power-up handler in WebSocket index
    - Update `backend/src/websocket/index.ts` to include power-up handler
    - Add power-up events to ServerToClientEvents and ClientToServerEvents types
    - _Requirements: 1.3_

- [x] 6. Integrate power-ups with match lifecycle

  - [x] 6.1 Initialize power-ups on match start
    - Update lobby handler to call initializePowerUps when match transitions to active
    - _Requirements: 1.1, 1.2_
  - [x] 6.2 Send power-up state on player connection
    - Update connection handler to send current power-up state when player joins active match
    - _Requirements: 1.3, 8.1_
  - [x] 6.3 Integrate Debug Shield with test execution
    - Update battleArenaHandler run_code to check for active Debug Shield
    - Mark test failures as "shielded" when shield is active
    - Call consumeDebugShieldCharge after each test run
    - _Requirements: 4.2, 4.3_
  - [x] 6.4 Integrate Time Freeze with timer sync
    - Update timer_sync emission to account for Time Freeze
    - Use calculateEffectiveTimeRemaining for affected players
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement frontend power-up components

  - [x] 8.1 Create PowerUpButton component
    - Create `frontend/src/components/PowerUpButton.tsx`
    - Display power-up icon, remaining count, and cooldown timer
    - Handle click to emit activate_powerup event
    - Disable when count is 0 or on cooldown
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 8.2 Create PowerUpPanel component
    - Create `frontend/src/components/PowerUpPanel.tsx`
    - Display all three power-up buttons in a row
    - Show global cooldown indicator
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 8.3 Create CodePeekOverlay component
    - Create `frontend/src/components/CodePeekOverlay.tsx`
    - Display opponent's code snapshot for 5 seconds
    - Auto-dismiss after timer expires
    - _Requirements: 3.2, 3.4_
  - [x] 8.4 Create DebugShieldIndicator component
    - Create `frontend/src/components/DebugShieldIndicator.tsx`
    - Display remaining shielded runs when Debug Shield is active
    - _Requirements: 4.4_
  - [x] 8.5 Create TimeFreezeIndicator component
    - Create `frontend/src/components/TimeFreezeIndicator.tsx`
    - Display visual indicator when Time Freeze is active
    - Show remaining freeze time
    - _Requirements: 2.1, 7.3_

- [x] 9. Integrate power-up UI with battle page

  - [x] 9.1 Add power-up WebSocket event handlers
    - Update `frontend/src/hooks/useWebSocket.ts` to handle power-up events
    - Add state management for power-up inventory and active effects
    - _Requirements: 1.3, 5.4_
  - [x] 9.2 Integrate PowerUpPanel into battle page
    - Update `frontend/src/app/battle/[matchId]/page.tsx` to include PowerUpPanel
    - Connect power-up state to UI components
    - _Requirements: 5.1_
  - [x] 9.3 Integrate CodePeekOverlay into battle page
    - Show overlay when Code Peek is activated
    - Hide after 5 seconds
    - _Requirements: 3.2, 3.4_
  - [x] 9.4 Integrate shield and freeze indicators
    - Show DebugShieldIndicator when shield is active
    - Show TimeFreezeIndicator when freeze is active (own or opponent's)
    - _Requirements: 4.4, 7.3_
  - [x] 9.5 Update test result display for shielded failures
    - Modify TestCasePanel to show "shielded" badge on failures when Debug Shield is active
    - _Requirements: 4.2_

- [x] 10. Add spectator power-up visibility

  - [x] 10.1 Update spectator view for power-up events
    - Update `frontend/src/app/spectate/[matchId]/page.tsx` to display power-up activations
    - Show Time Freeze indicator for affected player
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

# Requirements Document

## Introduction

The Power-Ups System introduces strategic gameplay elements to coding battles through three distinct power-ups: Time Freeze, Code Peek, and Debug Shield. These power-ups add tactical depth to matches, allowing players to gain temporary advantages while managing limited resources. Each player receives a set allocation of power-ups per match, creating meaningful decisions about when and how to deploy them.

## Glossary

- **Power-Up**: A consumable ability that provides a temporary strategic advantage during a coding battle
- **Time Freeze**: A power-up that pauses the match timer for the activating player for a limited duration
- **Code Peek**: A power-up that reveals a snapshot of the opponent's current code for a brief moment
- **Debug Shield**: A power-up that provides immunity to test case failures for a limited number of test runs
- **Cooldown**: A mandatory waiting period after using a power-up before another can be activated
- **Match State**: The real-time data structure tracking all aspects of an active coding battle stored in Redis
- **Power-Up Inventory**: The collection of available power-ups assigned to a player at match start

## Requirements

### Requirement 1

**User Story:** As a player, I want to receive a set of power-ups at the start of each match, so that I can use them strategically during the battle.

#### Acceptance Criteria

1. WHEN a match transitions to active status THEN the Power-Ups System SHALL allocate one Time Freeze, one Code Peek, and one Debug Shield to each player
2. WHEN power-ups are allocated THEN the Power-Ups System SHALL store the power-up inventory in the match state
3. WHEN a player connects to an active match THEN the Power-Ups System SHALL send the current power-up inventory to the player's client
4. WHEN a power-up is used THEN the Power-Ups System SHALL decrement the corresponding power-up count in the player's inventory

### Requirement 2

**User Story:** As a player, I want to activate Time Freeze to pause my timer, so that I can have extra time to think through a difficult problem.

#### Acceptance Criteria

1. WHEN a player activates Time Freeze THEN the Power-Ups System SHALL pause that player's match timer for 30 seconds
2. WHILE Time Freeze is active THEN the Power-Ups System SHALL continue the opponent's timer normally
3. WHEN Time Freeze duration expires THEN the Power-Ups System SHALL resume the player's timer from where it paused
4. WHEN a player activates Time Freeze THEN the Power-Ups System SHALL notify the opponent that Time Freeze was activated
5. WHEN a player attempts to activate Time Freeze with zero remaining THEN the Power-Ups System SHALL reject the request and return an error

### Requirement 3

**User Story:** As a player, I want to use Code Peek to see my opponent's current code, so that I can gauge their progress and adjust my strategy.

#### Acceptance Criteria

1. WHEN a player activates Code Peek THEN the Power-Ups System SHALL capture a snapshot of the opponent's current code
2. WHEN Code Peek is activated THEN the Power-Ups System SHALL display the opponent's code snapshot to the requesting player for 5 seconds
3. WHEN Code Peek is activated THEN the Power-Ups System SHALL notify the opponent that their code was peeked
4. WHEN the 5-second display period ends THEN the Power-Ups System SHALL hide the opponent's code from the requesting player
5. WHEN a player attempts to activate Code Peek with zero remaining THEN the Power-Ups System SHALL reject the request and return an error

### Requirement 4

**User Story:** As a player, I want to activate Debug Shield to protect against test failures, so that I can experiment with risky code changes without penalty.

#### Acceptance Criteria

1. WHEN a player activates Debug Shield THEN the Power-Ups System SHALL mark the next 3 test runs as shielded
2. WHILE Debug Shield is active THEN the Power-Ups System SHALL display test results normally but mark failures as "shielded"
3. WHEN all 3 shielded test runs are consumed THEN the Power-Ups System SHALL deactivate Debug Shield automatically
4. WHEN Debug Shield is active THEN the Power-Ups System SHALL display a visual indicator showing remaining shielded runs
5. WHEN a player attempts to activate Debug Shield with zero remaining THEN the Power-Ups System SHALL reject the request and return an error

### Requirement 5

**User Story:** As a player, I want to see my available power-ups and their status, so that I can make informed decisions about when to use them.

#### Acceptance Criteria

1. WHEN a match is active THEN the Power-Ups System SHALL display each power-up with its remaining count
2. WHEN a power-up is on cooldown THEN the Power-Ups System SHALL display the remaining cooldown time
3. WHEN a power-up count reaches zero THEN the Power-Ups System SHALL display the power-up as unavailable
4. WHEN any power-up state changes THEN the Power-Ups System SHALL update the UI within 100 milliseconds

### Requirement 6

**User Story:** As a player, I want power-up usage to have a cooldown period, so that the game remains balanced and strategic.

#### Acceptance Criteria

1. WHEN a player uses any power-up THEN the Power-Ups System SHALL start a 60-second cooldown before another power-up can be used
2. WHILE a cooldown is active THEN the Power-Ups System SHALL prevent activation of any power-up
3. WHEN a player attempts to use a power-up during cooldown THEN the Power-Ups System SHALL reject the request and return the remaining cooldown time
4. WHEN the cooldown period expires THEN the Power-Ups System SHALL allow power-up activation again

### Requirement 7

**User Story:** As a spectator, I want to see when players use power-ups, so that I can follow the strategic elements of the match.

#### Acceptance Criteria

1. WHEN a player activates any power-up THEN the Power-Ups System SHALL broadcast the activation event to all spectators
2. WHEN broadcasting power-up activation THEN the Power-Ups System SHALL include the power-up type and the activating player's identifier
3. WHEN Time Freeze is active THEN the Power-Ups System SHALL display a visual indicator on the spectator view

### Requirement 8

**User Story:** As a system administrator, I want power-up state to persist through reconnections, so that players do not lose their power-ups due to network issues.

#### Acceptance Criteria

1. WHEN a player disconnects and reconnects to an active match THEN the Power-Ups System SHALL restore the player's power-up inventory state
2. WHEN a player reconnects THEN the Power-Ups System SHALL restore any active power-up effects with correct remaining duration
3. WHEN restoring Time Freeze state THEN the Power-Ups System SHALL calculate the correct remaining freeze time based on elapsed time

### Requirement 9

**User Story:** As a developer, I want power-up data to be serialized and deserialized correctly, so that state can be stored and retrieved from Redis.

#### Acceptance Criteria

1. WHEN storing power-up state THEN the Power-Ups System SHALL serialize the inventory to JSON format
2. WHEN retrieving power-up state THEN the Power-Ups System SHALL deserialize JSON back to the inventory data structure
3. WHEN serializing and then deserializing power-up state THEN the Power-Ups System SHALL produce an equivalent data structure

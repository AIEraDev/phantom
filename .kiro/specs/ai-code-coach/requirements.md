# Requirements Document

## Introduction

The AI Code Coach is an intelligent assistant that provides real-time coding hints during battles and comprehensive post-match analysis. Building on the existing Gemini integration, this feature transforms the competitive coding experience by offering contextual guidance without giving away solutions, helping players learn while they compete. The coach analyzes code patterns, detects common mistakes, suggests optimizations, and provides personalized feedback based on the player's skill level and coding style.

## Glossary

- **AI Code Coach**: An AI-powered assistant that provides real-time hints and post-match analysis to help players improve their coding skills
- **Real-time Hint**: A contextual suggestion provided during a match that guides the player without revealing the solution
- **Post-match Analysis**: A comprehensive review of a player's code and strategy after a match concludes
- **Hint Cooldown**: A time-based restriction preventing hint spam during matches
- **Hint Level**: The degree of specificity in a hint (subtle, moderate, direct)
- **Code Pattern**: A recognizable structure or approach in code that the AI can identify and comment on
- **Weakness Detection**: AI identification of recurring mistakes or suboptimal patterns in a player's code history
- **Coaching Session**: A complete interaction cycle including hints during match and analysis after

## Requirements

### Requirement 1: Real-time Hint System

**User Story:** As a player, I want to receive contextual hints during a match when I'm stuck, so that I can learn and progress without completely giving up.

#### Acceptance Criteria

1. WHEN a player requests a hint during a match THEN the AI Code Coach SHALL analyze the current code state and challenge requirements to generate a contextual hint within 3 seconds
2. WHEN generating a hint THEN the AI Code Coach SHALL provide guidance that points toward the solution approach without revealing the exact implementation
3. WHEN a player requests multiple hints THEN the AI Code Coach SHALL enforce a 60-second cooldown between hint requests
4. WHEN a hint is delivered THEN the AI Code Coach SHALL display the hint in a non-intrusive overlay that does not obstruct the code editor
5. WHEN a player uses a hint THEN the AI Code Coach SHALL record the hint usage and apply a 5% score penalty per hint used (maximum 3 hints per match)
6. IF a player has already used 3 hints in a match THEN the AI Code Coach SHALL disable further hint requests and display a message indicating the limit has been reached

### Requirement 2: Progressive Hint Levels

**User Story:** As a player, I want hints that become progressively more specific if I continue to struggle, so that I can get the right level of help for my situation.

#### Acceptance Criteria

1. WHEN a player requests their first hint THEN the AI Code Coach SHALL provide a subtle hint focusing on the general approach or algorithm category
2. WHEN a player requests their second hint THEN the AI Code Coach SHALL provide a moderate hint including specific data structure suggestions or edge cases to consider
3. WHEN a player requests their third hint THEN the AI Code Coach SHALL provide a direct hint with pseudocode or step-by-step logic outline
4. WHEN displaying hint level THEN the AI Code Coach SHALL show a visual indicator of the current hint level (1/3, 2/3, 3/3)
5. WHEN a hint is generated THEN the AI Code Coach SHALL tailor the hint complexity to the player's rating level

### Requirement 3: Post-match Analysis

**User Story:** As a player, I want detailed analysis of my code after a match, so that I can understand what I did well and where I can improve.

#### Acceptance Criteria

1. WHEN a match concludes THEN the AI Code Coach SHALL generate a comprehensive analysis of the player's submitted code within 10 seconds
2. WHEN generating analysis THEN the AI Code Coach SHALL evaluate time complexity, space complexity, code readability, and algorithmic approach
3. WHEN presenting analysis THEN the AI Code Coach SHALL compare the player's solution to optimal approaches without showing exact optimal code
4. WHEN analysis is complete THEN the AI Code Coach SHALL provide 3-5 specific, actionable improvement suggestions
5. WHEN the player's solution has bugs THEN the AI Code Coach SHALL identify the bug locations and explain the logical errors
6. WHEN the player wins THEN the AI Code Coach SHALL highlight strengths while still suggesting optimizations

### Requirement 4: Weakness Detection and Tracking

**User Story:** As a player, I want the AI to track my recurring mistakes across matches, so that I can focus on improving my weak areas.

#### Acceptance Criteria

1. WHEN a player completes a match THEN the AI Code Coach SHALL analyze the code for common mistake patterns and store findings
2. WHEN a player has completed 5 or more matches THEN the AI Code Coach SHALL identify recurring weakness patterns from match history
3. WHEN displaying player profile THEN the AI Code Coach SHALL show a weakness summary with the top 3 areas needing improvement
4. WHEN a player starts a new match THEN the AI Code Coach SHALL optionally display a pre-match tip based on their identified weaknesses
5. WHEN weakness patterns change THEN the AI Code Coach SHALL update the weakness profile after each match

### Requirement 5: Coaching Dashboard

**User Story:** As a player, I want a dedicated dashboard to review my coaching history and improvement trends, so that I can track my learning progress over time.

#### Acceptance Criteria

1. WHEN a player accesses the coaching dashboard THEN the AI Code Coach SHALL display a summary of total hints used, matches analyzed, and improvement score
2. WHEN viewing the dashboard THEN the AI Code Coach SHALL show a timeline of skill progression based on AI analysis scores
3. WHEN viewing the dashboard THEN the AI Code Coach SHALL display categorized feedback history (time complexity, space complexity, readability, patterns)
4. WHEN a player selects a past match THEN the AI Code Coach SHALL show the full analysis and hints used for that match
5. WHEN displaying trends THEN the AI Code Coach SHALL visualize improvement in each weakness category over the last 10 matches

### Requirement 6: Hint Content Generation

**User Story:** As a platform operator, I want hints to be educational and safe, so that players learn effectively without receiving inappropriate content.

#### Acceptance Criteria

1. WHEN generating hint content THEN the AI Code Coach SHALL use the challenge description, test cases, and current code as context
2. WHEN generating hint content THEN the AI Code Coach SHALL avoid revealing test case inputs/outputs that are meant to be hidden
3. WHEN generating hint content THEN the AI Code Coach SHALL format hints with proper code syntax highlighting when including code snippets
4. WHEN the AI service is unavailable THEN the AI Code Coach SHALL fall back to pre-written generic hints based on challenge category
5. IF hint generation fails THEN the AI Code Coach SHALL not consume the player's hint allowance and SHALL display an error message

### Requirement 7: Analysis Data Persistence

**User Story:** As a player, I want my coaching data to be saved, so that I can review past analyses and track long-term improvement.

#### Acceptance Criteria

1. WHEN a match analysis is generated THEN the AI Code Coach SHALL persist the analysis data to the database linked to the match record
2. WHEN storing analysis THEN the AI Code Coach SHALL include timestamp, match ID, player ID, hint count, and full analysis JSON
3. WHEN a player requests historical analysis THEN the AI Code Coach SHALL retrieve and display past analyses with pagination
4. WHEN storing weakness data THEN the AI Code Coach SHALL aggregate patterns across matches for trend analysis
5. WHEN data is older than 90 days THEN the AI Code Coach SHALL retain summary statistics while archiving detailed analysis

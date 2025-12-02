-- Migration: Add performance optimization indexes
-- Description: Additional indexes for frequently queried fields to improve query performance

-- Additional index on users.username for case-insensitive searches (already exists but adding LOWER index)
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- Composite index for match queries by player and status
CREATE INDEX IF NOT EXISTS idx_matches_player1_status ON matches(player1_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_player2_status ON matches(player2_id, status);

-- Composite index for active matches
CREATE INDEX IF NOT EXISTS idx_matches_status_created ON matches(status, created_at DESC) WHERE status IN ('waiting', 'lobby', 'active');

-- Index for completed matches with winner
CREATE INDEX IF NOT EXISTS idx_matches_winner_completed ON matches(winner_id, completed_at DESC) WHERE status = 'completed';

-- Index for challenge queries
CREATE INDEX IF NOT EXISTS idx_challenges_difficulty ON challenges(difficulty);

-- Composite index for match events (for replay queries)
CREATE INDEX IF NOT EXISTS idx_match_events_match_timestamp ON match_events(match_id, timestamp);

-- Add comments for documentation
COMMENT ON INDEX idx_users_username_lower IS 'Supports case-insensitive username searches';
COMMENT ON INDEX idx_matches_player1_status IS 'Optimizes queries for player matches by status';
COMMENT ON INDEX idx_matches_player2_status IS 'Optimizes queries for player matches by status';
COMMENT ON INDEX idx_matches_status_created IS 'Optimizes queries for active matches list';
COMMENT ON INDEX idx_matches_winner_completed IS 'Optimizes queries for completed matches by winner';

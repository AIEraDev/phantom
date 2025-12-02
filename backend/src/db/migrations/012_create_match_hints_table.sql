-- Migration: Create match_hints table
-- Description: Stores hints requested by players during matches for the AI Code Coach feature
-- Requirements: 7.1, 7.2

CREATE TABLE IF NOT EXISTS match_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hint_level INTEGER NOT NULL CHECK (hint_level >= 1 AND hint_level <= 3),
  hint_content TEXT NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  consumed BOOLEAN DEFAULT TRUE NOT NULL
);

-- Create composite index for efficient lookups by match and user
CREATE INDEX idx_match_hints_match_user ON match_hints(match_id, user_id);

-- Create index for user history queries
CREATE INDEX idx_match_hints_user_id ON match_hints(user_id);

-- Create index for match queries
CREATE INDEX idx_match_hints_match_id ON match_hints(match_id);

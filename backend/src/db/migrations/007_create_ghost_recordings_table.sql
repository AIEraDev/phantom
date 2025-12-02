-- Migration: Create ghost_recordings table
-- Description: Stores ghost recordings for ghost mode racing feature
-- Requirements: 14.1, 14.2, 14.5

CREATE TABLE IF NOT EXISTS ghost_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  is_ai BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX idx_ghost_recordings_challenge_id ON ghost_recordings(challenge_id);
CREATE INDEX idx_ghost_recordings_score ON ghost_recordings(score DESC);
CREATE INDEX idx_ghost_recordings_challenge_score ON ghost_recordings(challenge_id, score DESC);

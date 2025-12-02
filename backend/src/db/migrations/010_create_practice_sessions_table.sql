-- Migration: Create practice_sessions table
-- Description: Stores solo practice mode sessions with code, feedback, and hints
-- Requirements: 17.1, 17.4, 17.5

CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  code TEXT DEFAULT '' NOT NULL,
  language VARCHAR(20) NOT NULL CHECK (language IN ('javascript', 'python', 'typescript')),
  score INTEGER,
  feedback JSONB,
  hints_used INTEGER DEFAULT 0 NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient queries
CREATE INDEX idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX idx_practice_sessions_challenge_id ON practice_sessions(challenge_id);
CREATE INDEX idx_practice_sessions_user_challenge ON practice_sessions(user_id, challenge_id);
CREATE INDEX idx_practice_sessions_started_at ON practice_sessions(started_at DESC);

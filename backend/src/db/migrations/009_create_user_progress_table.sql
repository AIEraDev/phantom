-- Migration: Create user_progress table
-- Description: Tracks user progress on challenges for skill tree progression
-- Requirements: 16.2, 16.5

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  mastered BOOLEAN DEFAULT FALSE NOT NULL,
  best_score INTEGER DEFAULT 0 NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_challenge UNIQUE (user_id, challenge_id)
);

-- Create indexes for efficient progress queries
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_challenge_id ON user_progress(challenge_id);
CREATE INDEX idx_user_progress_completed ON user_progress(user_id, completed);
CREATE INDEX idx_user_progress_mastered ON user_progress(user_id, mastered);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: Create matches table
-- Description: Stores match information, player codes, scores, and results

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player1_score INTEGER,
  player2_score INTEGER,
  player1_code TEXT,
  player2_code TEXT,
  player1_language VARCHAR(20) NOT NULL,
  player2_language VARCHAR(20) NOT NULL,
  player1_feedback TEXT, -- AI-generated feedback for player 1
  player2_feedback TEXT, -- AI-generated feedback for player 2
  duration INTEGER, -- Match duration in seconds
  status VARCHAR(20) DEFAULT 'waiting' NOT NULL CHECK (status IN ('waiting', 'lobby', 'active', 'completed', 'abandoned')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for frequently queried fields
CREATE INDEX idx_matches_player1_id ON matches(player1_id);
CREATE INDEX idx_matches_player2_id ON matches(player2_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX idx_matches_challenge_id ON matches(challenge_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

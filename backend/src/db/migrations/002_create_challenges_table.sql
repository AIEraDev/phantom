-- Migration: Create challenges table
-- Description: Stores coding challenges with test cases and starter code

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  time_limit INTEGER DEFAULT 600 NOT NULL, -- Time limit in seconds (default 10 minutes)
  test_cases JSONB NOT NULL, -- Array of test cases with input, expectedOutput, isHidden, weight
  starter_code JSONB NOT NULL, -- Object with javascript, python, typescript keys
  optimal_solution TEXT, -- Optional reference solution for efficiency comparison
  tags TEXT[] DEFAULT '{}', -- Array of tags for categorization
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for filtering and searching
CREATE INDEX idx_challenges_difficulty ON challenges(difficulty);
CREATE INDEX idx_challenges_tags ON challenges USING GIN(tags);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: Create match_analyses table
-- Description: Stores AI-generated post-match code analysis for the AI Code Coach feature
-- Requirements: 7.1, 7.2

CREATE TABLE IF NOT EXISTS match_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_complexity JSONB NOT NULL,
  space_complexity JSONB NOT NULL,
  readability_score JSONB NOT NULL,
  algorithmic_approach JSONB NOT NULL,
  suggestions JSONB NOT NULL,
  bug_analysis JSONB NOT NULL,
  hints_used INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for history queries
CREATE INDEX idx_match_analyses_user_id ON match_analyses(user_id);

-- Create index on match_id for match lookups
CREATE INDEX idx_match_analyses_match_id ON match_analyses(match_id);

-- Create composite index for user history ordered by date
CREATE INDEX idx_match_analyses_user_created ON match_analyses(user_id, created_at DESC);

-- Create unique constraint to ensure one analysis per user per match
CREATE UNIQUE INDEX idx_match_analyses_match_user_unique ON match_analyses(match_id, user_id);

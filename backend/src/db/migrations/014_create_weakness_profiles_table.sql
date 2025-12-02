-- Migration: Create weakness_profiles table
-- Description: Stores player weakness patterns and category scores for the AI Code Coach feature
-- Requirements: 4.1, 4.5

CREATE TABLE IF NOT EXISTS weakness_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patterns JSONB DEFAULT '[]'::jsonb NOT NULL,
  category_scores JSONB DEFAULT '{"time_complexity": 0, "space_complexity": 0, "readability": 0, "patterns": 0}'::jsonb NOT NULL,
  matches_analyzed INTEGER DEFAULT 0 NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint on user_id (one profile per user)
CREATE UNIQUE INDEX idx_weakness_profiles_user_id_unique ON weakness_profiles(user_id);

-- Create index for user lookups
CREATE INDEX idx_weakness_profiles_user_id ON weakness_profiles(user_id);

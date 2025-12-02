-- Migration: Create coaching_summaries table
-- Description: Stores aggregated coaching statistics and trends for the AI Code Coach feature
-- Requirements: 5.1

CREATE TABLE IF NOT EXISTS coaching_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_hints_used INTEGER DEFAULT 0 NOT NULL,
  total_matches_analyzed INTEGER DEFAULT 0 NOT NULL,
  improvement_score FLOAT DEFAULT 0.0 NOT NULL,
  trend_data JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint on user_id (one summary per user)
CREATE UNIQUE INDEX idx_coaching_summaries_user_id_unique ON coaching_summaries(user_id);

-- Create index for user lookups
CREATE INDEX idx_coaching_summaries_user_id ON coaching_summaries(user_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_coaching_summaries_updated_at BEFORE UPDATE ON coaching_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: Create achievements and user_achievements tables
-- Description: Stores achievement definitions and user achievement progress

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_url TEXT,
  category VARCHAR(50) NOT NULL, -- e.g., 'wins', 'streak', 'challenges', 'rating'
  requirement JSONB NOT NULL, -- Criteria for unlocking (e.g., {"wins": 10}, {"rating": 1500})
  points INTEGER DEFAULT 0 NOT NULL, -- Achievement points value
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress JSONB DEFAULT '{}', -- Current progress towards achievement
  unlocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);

-- Create indexes for querying user achievements
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_unlocked ON user_achievements(unlocked_at) WHERE unlocked_at IS NOT NULL;
CREATE INDEX idx_achievements_category ON achievements(category);

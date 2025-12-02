-- Migration: Create match_events table
-- Description: Stores match events for replay functionality

CREATE TABLE IF NOT EXISTS match_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('code_update', 'test_run', 'submission', 'cursor_move')),
  timestamp BIGINT NOT NULL, -- Milliseconds from match start
  data JSONB NOT NULL, -- Event-specific data (code, cursor position, test results, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient replay queries
CREATE INDEX idx_match_events_match_id ON match_events(match_id, timestamp);
CREATE INDEX idx_match_events_player_id ON match_events(player_id);
CREATE INDEX idx_match_events_event_type ON match_events(event_type);

-- Create composite index for replay queries
CREATE INDEX idx_match_events_replay ON match_events(match_id, timestamp, event_type);

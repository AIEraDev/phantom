-- Migration: Create spectator_messages table
-- Description: Stores chat messages from spectators watching matches
-- Requirements: 15.2, 15.5

CREATE TABLE IF NOT EXISTS spectator_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' NOT NULL CHECK (message_type IN ('text', 'emoji', 'reaction')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient chat history retrieval
CREATE INDEX idx_spectator_messages_match_id ON spectator_messages(match_id);
CREATE INDEX idx_spectator_messages_match_created ON spectator_messages(match_id, created_at);

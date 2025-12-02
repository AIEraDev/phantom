-- Migration: Create skill tree tables
-- Description: Stores skill tree nodes and edges for progression system
-- Requirements: 16.1, 16.2, 16.3

-- Skill tree nodes table
CREATE TABLE IF NOT EXISTS skill_tree_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 5),
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('arrays', 'strings', 'trees', 'graphs', 'dp'))
);

-- Create indexes for skill tree nodes
CREATE INDEX idx_skill_tree_nodes_challenge_id ON skill_tree_nodes(challenge_id);
CREATE INDEX idx_skill_tree_nodes_tier ON skill_tree_nodes(tier);
CREATE INDEX idx_skill_tree_nodes_category ON skill_tree_nodes(category);

-- Skill tree edges table (defines prerequisites)
CREATE TABLE IF NOT EXISTS skill_tree_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id UUID NOT NULL REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,
  CONSTRAINT unique_edge UNIQUE (from_node_id, to_node_id),
  CONSTRAINT no_self_reference CHECK (from_node_id != to_node_id)
);

-- Create indexes for skill tree edges
CREATE INDEX idx_skill_tree_edges_from_node ON skill_tree_edges(from_node_id);
CREATE INDEX idx_skill_tree_edges_to_node ON skill_tree_edges(to_node_id);

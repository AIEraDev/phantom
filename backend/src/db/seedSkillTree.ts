import pool from "./connection";

/**
 * Skill Tree Seed Script
 * Requirements: 16.1, 16.3
 *
 * This script seeds the skill tree with:
 * - 5 tiers of increasing difficulty
 * - Challenges mapped to skill tree nodes
 * - Prerequisite edges between nodes
 * - Category assignments (arrays, strings, trees, graphs, dp)
 * - Position calculations for visual layout
 */

// ============================================================================
// Types
// ============================================================================

interface SkillTreeNodeSeed {
  challengeTitle: string;
  tier: number;
  positionX: number;
  category: "arrays" | "strings" | "trees" | "graphs" | "dp";
}

interface SkillTreeEdgeSeed {
  fromChallengeTitle: string;
  toChallengeTitle: string;
}

// ============================================================================
// Skill Tree Structure Definition
// Requirements: 16.1, 16.3
// ============================================================================

/**
 * Tier structure (5 tiers of increasing difficulty):
 * - Tier 1: Beginner challenges (easy) - Always unlocked for new users
 * - Tier 2: Foundation challenges (easy/medium)
 * - Tier 3: Intermediate challenges (medium)
 * - Tier 4: Advanced challenges (medium/hard)
 * - Tier 5: Expert challenges (hard/expert)
 *
 * Categories:
 * - arrays: Array manipulation, searching, sorting
 * - strings: String processing, pattern matching
 * - trees: Tree traversal, binary trees
 * - graphs: Graph algorithms, BFS/DFS
 * - dp: Dynamic programming, optimization
 */

const skillTreeNodes: SkillTreeNodeSeed[] = [
  // ============================================================================
  // TIER 1 - Beginner (Always Unlocked)
  // ============================================================================

  // Arrays category - Tier 1
  { challengeTitle: "Two Sum", tier: 1, positionX: 0, category: "arrays" },
  { challengeTitle: "Contains Duplicate", tier: 1, positionX: 1, category: "arrays" },
  { challengeTitle: "Single Number", tier: 1, positionX: 2, category: "arrays" },

  // Strings category - Tier 1
  { challengeTitle: "Reverse String", tier: 1, positionX: 0, category: "strings" },
  { challengeTitle: "Valid Palindrome", tier: 1, positionX: 1, category: "strings" },
  { challengeTitle: "Valid Anagram", tier: 1, positionX: 2, category: "strings" },

  // DP category - Tier 1 (basic math/logic)
  { challengeTitle: "FizzBuzz", tier: 1, positionX: 0, category: "dp" },
  { challengeTitle: "Climbing Stairs", tier: 1, positionX: 1, category: "dp" },
  { challengeTitle: "Plus One", tier: 1, positionX: 2, category: "dp" },

  // ============================================================================
  // TIER 2 - Foundation
  // ============================================================================

  // Arrays category - Tier 2
  { challengeTitle: "Merge Sorted Array", tier: 2, positionX: 0, category: "arrays" },
  { challengeTitle: "Move Zeroes", tier: 2, positionX: 1, category: "arrays" },
  { challengeTitle: "Remove Duplicates from Sorted Array", tier: 2, positionX: 2, category: "arrays" },
  { challengeTitle: "Search Insert Position", tier: 2, positionX: 3, category: "arrays" },

  // Strings category - Tier 2
  { challengeTitle: "First Unique Character", tier: 2, positionX: 0, category: "strings" },
  { challengeTitle: "Isomorphic Strings", tier: 2, positionX: 1, category: "strings" },
  { challengeTitle: "Length of Last Word", tier: 2, positionX: 2, category: "strings" },
  { challengeTitle: "Add Binary", tier: 2, positionX: 3, category: "strings" },

  // DP category - Tier 2
  { challengeTitle: "Maximum Subarray", tier: 2, positionX: 0, category: "dp" },
  { challengeTitle: "Best Time to Buy and Sell Stock", tier: 2, positionX: 1, category: "dp" },
  { challengeTitle: "Palindrome Number", tier: 2, positionX: 2, category: "dp" },
  { challengeTitle: "Roman to Integer", tier: 2, positionX: 3, category: "dp" },

  // ============================================================================
  // TIER 3 - Intermediate
  // ============================================================================

  // Arrays category - Tier 3
  { challengeTitle: "Majority Element", tier: 3, positionX: 0, category: "arrays" },
  { challengeTitle: "3Sum", tier: 3, positionX: 1, category: "arrays" },
  { challengeTitle: "Container With Most Water", tier: 3, positionX: 2, category: "arrays" },
  { challengeTitle: "Product of Array Except Self", tier: 3, positionX: 3, category: "arrays" },

  // Strings category - Tier 3
  { challengeTitle: "Longest Substring Without Repeating Characters", tier: 3, positionX: 0, category: "strings" },
  { challengeTitle: "Group Anagrams", tier: 3, positionX: 1, category: "strings" },

  // DP category - Tier 3
  { challengeTitle: "Unique Paths", tier: 3, positionX: 0, category: "dp" },
  { challengeTitle: "Jump Game", tier: 3, positionX: 1, category: "dp" },

  // ============================================================================
  // TIER 4 - Advanced
  // ============================================================================

  // Arrays category - Tier 4
  { challengeTitle: "Valid Sudoku", tier: 4, positionX: 0, category: "arrays" },
  { challengeTitle: "Rotate Image", tier: 4, positionX: 1, category: "arrays" },
  { challengeTitle: "Spiral Matrix", tier: 4, positionX: 2, category: "arrays" },
  { challengeTitle: "Set Matrix Zeroes", tier: 4, positionX: 3, category: "arrays" },

  // Strings/Linked List category - Tier 4
  { challengeTitle: "Add Two Numbers", tier: 4, positionX: 0, category: "strings" },

  // DP category - Tier 4
  { challengeTitle: "Merge Intervals", tier: 4, positionX: 0, category: "dp" },

  // ============================================================================
  // TIER 5 - Expert (from seed.ts)
  // ============================================================================

  // Trees category - Tier 5 (using linked list challenges as tree-like)
  { challengeTitle: "Reverse Linked List", tier: 5, positionX: 0, category: "trees" },

  // Graphs category - Tier 5
  { challengeTitle: "Merge K Sorted Lists", tier: 5, positionX: 0, category: "graphs" },
];

// ============================================================================
// Prerequisite Edges Definition
// Requirements: 16.1, 16.3
// ============================================================================

/**
 * Edges define prerequisite relationships:
 * - from: Challenge that must be completed first
 * - to: Challenge that gets unlocked after completing 'from'
 */
const skillTreeEdges: SkillTreeEdgeSeed[] = [
  // ============================================================================
  // Arrays progression
  // ============================================================================

  // Tier 1 -> Tier 2
  { fromChallengeTitle: "Two Sum", toChallengeTitle: "Merge Sorted Array" },
  { fromChallengeTitle: "Two Sum", toChallengeTitle: "Search Insert Position" },
  { fromChallengeTitle: "Contains Duplicate", toChallengeTitle: "Remove Duplicates from Sorted Array" },
  { fromChallengeTitle: "Single Number", toChallengeTitle: "Move Zeroes" },

  // Tier 2 -> Tier 3
  { fromChallengeTitle: "Merge Sorted Array", toChallengeTitle: "3Sum" },
  { fromChallengeTitle: "Search Insert Position", toChallengeTitle: "Container With Most Water" },
  { fromChallengeTitle: "Remove Duplicates from Sorted Array", toChallengeTitle: "Majority Element" },
  { fromChallengeTitle: "Move Zeroes", toChallengeTitle: "Product of Array Except Self" },

  // Tier 3 -> Tier 4
  { fromChallengeTitle: "3Sum", toChallengeTitle: "Valid Sudoku" },
  { fromChallengeTitle: "Container With Most Water", toChallengeTitle: "Rotate Image" },
  { fromChallengeTitle: "Product of Array Except Self", toChallengeTitle: "Spiral Matrix" },
  { fromChallengeTitle: "Majority Element", toChallengeTitle: "Set Matrix Zeroes" },

  // ============================================================================
  // Strings progression
  // ============================================================================

  // Tier 1 -> Tier 2
  { fromChallengeTitle: "Reverse String", toChallengeTitle: "First Unique Character" },
  { fromChallengeTitle: "Valid Palindrome", toChallengeTitle: "Isomorphic Strings" },
  { fromChallengeTitle: "Valid Anagram", toChallengeTitle: "Length of Last Word" },
  { fromChallengeTitle: "Valid Anagram", toChallengeTitle: "Add Binary" },

  // Tier 2 -> Tier 3
  { fromChallengeTitle: "First Unique Character", toChallengeTitle: "Longest Substring Without Repeating Characters" },
  { fromChallengeTitle: "Isomorphic Strings", toChallengeTitle: "Group Anagrams" },

  // Tier 3 -> Tier 4
  { fromChallengeTitle: "Longest Substring Without Repeating Characters", toChallengeTitle: "Add Two Numbers" },
  { fromChallengeTitle: "Group Anagrams", toChallengeTitle: "Add Two Numbers" },

  // ============================================================================
  // DP progression
  // ============================================================================

  // Tier 1 -> Tier 2
  { fromChallengeTitle: "FizzBuzz", toChallengeTitle: "Palindrome Number" },
  { fromChallengeTitle: "Climbing Stairs", toChallengeTitle: "Maximum Subarray" },
  { fromChallengeTitle: "Climbing Stairs", toChallengeTitle: "Best Time to Buy and Sell Stock" },
  { fromChallengeTitle: "Plus One", toChallengeTitle: "Roman to Integer" },

  // Tier 2 -> Tier 3
  { fromChallengeTitle: "Maximum Subarray", toChallengeTitle: "Unique Paths" },
  { fromChallengeTitle: "Best Time to Buy and Sell Stock", toChallengeTitle: "Jump Game" },

  // Tier 3 -> Tier 4
  { fromChallengeTitle: "Unique Paths", toChallengeTitle: "Merge Intervals" },
  { fromChallengeTitle: "Jump Game", toChallengeTitle: "Merge Intervals" },

  // ============================================================================
  // Cross-category progression to Tier 5
  // ============================================================================

  // Multiple Tier 4 challenges unlock Tier 5
  { fromChallengeTitle: "Rotate Image", toChallengeTitle: "Reverse Linked List" },
  { fromChallengeTitle: "Add Two Numbers", toChallengeTitle: "Reverse Linked List" },

  { fromChallengeTitle: "Valid Sudoku", toChallengeTitle: "Merge K Sorted Lists" },
  { fromChallengeTitle: "Merge Intervals", toChallengeTitle: "Merge K Sorted Lists" },
];

// ============================================================================
// Position Calculation
// Requirements: 16.3
// ============================================================================

/**
 * Calculate position_y based on tier
 * Each tier is spaced 150 units apart vertically
 */
function calculatePositionY(tier: number): number {
  return (tier - 1) * 150;
}

/**
 * Calculate position_x based on category and position within category
 * Categories are spaced 200 units apart horizontally
 * Nodes within a category are spaced 100 units apart
 */
function calculatePositionX(category: string, positionX: number): number {
  const categoryOffsets: Record<string, number> = {
    arrays: 0,
    strings: 500,
    trees: 1000,
    graphs: 1500,
    dp: 2000,
  };
  return (categoryOffsets[category] || 0) + positionX * 100;
}

// ============================================================================
// Seed Function
// ============================================================================

export async function seedSkillTree(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log("Starting skill tree seeding...");

    // Check if skill tree already has data
    const existingNodes = await client.query("SELECT COUNT(*) FROM skill_tree_nodes");
    const nodeCount = parseInt(existingNodes.rows[0].count);

    if (nodeCount > 0) {
      console.log(`Skill tree already has ${nodeCount} node(s). Skipping seed.`);
      console.log("To re-seed, delete existing skill tree data first.");
      return;
    }

    await client.query("BEGIN");

    // Get all challenges from database
    const challengesResult = await client.query<{ id: string; title: string }>("SELECT id, title FROM challenges");

    const challengeMap = new Map<string, string>();
    for (const row of challengesResult.rows) {
      challengeMap.set(row.title, row.id);
    }

    console.log(`Found ${challengeMap.size} challenges in database`);

    // Insert skill tree nodes
    const nodeIdMap = new Map<string, string>(); // challengeTitle -> nodeId
    let insertedNodes = 0;
    let skippedNodes = 0;

    for (const node of skillTreeNodes) {
      const challengeId = challengeMap.get(node.challengeTitle);

      if (!challengeId) {
        console.log(`⚠ Challenge not found: "${node.challengeTitle}" - skipping`);
        skippedNodes++;
        continue;
      }

      const positionY = calculatePositionY(node.tier);
      const positionX = calculatePositionX(node.category, node.positionX);

      const result = await client.query<{ id: string }>(
        `INSERT INTO skill_tree_nodes (challenge_id, tier, position_x, position_y, category)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [challengeId, node.tier, positionX, positionY, node.category]
      );

      nodeIdMap.set(node.challengeTitle, result.rows[0].id);
      insertedNodes++;
      console.log(`✓ Added node: ${node.challengeTitle} (Tier ${node.tier}, ${node.category})`);
    }

    console.log(`\nInserted ${insertedNodes} nodes, skipped ${skippedNodes}`);

    // Insert skill tree edges
    let insertedEdges = 0;
    let skippedEdges = 0;

    for (const edge of skillTreeEdges) {
      const fromNodeId = nodeIdMap.get(edge.fromChallengeTitle);
      const toNodeId = nodeIdMap.get(edge.toChallengeTitle);

      if (!fromNodeId || !toNodeId) {
        console.log(`⚠ Edge skipped: "${edge.fromChallengeTitle}" -> "${edge.toChallengeTitle}" (node not found)`);
        skippedEdges++;
        continue;
      }

      await client.query(
        `INSERT INTO skill_tree_edges (from_node_id, to_node_id)
         VALUES ($1, $2)`,
        [fromNodeId, toNodeId]
      );

      insertedEdges++;
      console.log(`✓ Added edge: ${edge.fromChallengeTitle} -> ${edge.toChallengeTitle}`);
    }

    console.log(`\nInserted ${insertedEdges} edges, skipped ${skippedEdges}`);

    await client.query("COMMIT");

    console.log("\n✅ Skill tree seeding complete!");
    console.log(`   Nodes: ${insertedNodes}`);
    console.log(`   Edges: ${insertedEdges}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Skill tree seeding failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// Clear Function (for re-seeding)
// ============================================================================

export async function clearSkillTree(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log("Clearing skill tree data...");

    await client.query("BEGIN");

    // Delete edges first (foreign key constraint)
    const edgesResult = await client.query("DELETE FROM skill_tree_edges");
    console.log(`Deleted ${edgesResult.rowCount} edges`);

    // Delete nodes
    const nodesResult = await client.query("DELETE FROM skill_tree_nodes");
    console.log(`Deleted ${nodesResult.rowCount} nodes`);

    await client.query("COMMIT");

    console.log("✅ Skill tree cleared!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to clear skill tree:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--clear")) {
    await clearSkillTree();
  }

  if (args.includes("--seed") || !args.includes("--clear")) {
    await seedSkillTree();
  }

  await pool.end();
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

export default seedSkillTree;

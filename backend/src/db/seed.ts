import pool from "./connection";
import { challenges as challengesData } from "./challenges-data";

async function seedDatabase() {
  try {
    console.log("Starting database seeding...");

    // Check if challenges already exist
    const existingChallenges = await pool.query("SELECT COUNT(*) FROM challenges");
    const count = parseInt(existingChallenges.rows[0].count);

    if (count > 0) {
      console.log(`Database already has ${count} challenge(s). Skipping seed.`);
      console.log("To re-seed, delete existing challenges first with: DELETE FROM challenges;");
      return;
    }

    // Insert challenges from challenges-data.ts
    for (const challenge of challengesData) {
      await pool.query(
        `INSERT INTO challenges (
          title, description, difficulty, time_limit, 
          test_cases, starter_code, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [challenge.title, challenge.description, challenge.difficulty, challenge.timeLimit, JSON.stringify(challenge.testCases), JSON.stringify(challenge.starterCode), challenge.tags]
      );
      console.log(`✓ Seeded challenge: ${challenge.title}`);
    }

    // Insert sample achievements
    const achievements = [
      {
        name: "First Victory",
        description: "Win your first match",
        category: "wins",
        requirement: { wins: 1 },
        points: 10,
      },
      {
        name: "Winning Streak",
        description: "Win 5 matches in a row",
        category: "streak",
        requirement: { streak: 5 },
        points: 50,
      },
      {
        name: "Code Master",
        description: "Reach a rating of 1500",
        category: "rating",
        requirement: { rating: 1500 },
        points: 100,
      },
      {
        name: "Challenge Accepted",
        description: "Complete 10 different challenges",
        category: "challenges",
        requirement: { uniqueChallenges: 10 },
        points: 30,
      },
      {
        name: "Speed Demon",
        description: "Win a match in under 2 minutes",
        category: "wins",
        requirement: { winUnderSeconds: 120 },
        points: 25,
      },
    ];

    for (const achievement of achievements) {
      await pool.query(
        `INSERT INTO achievements (name, description, category, requirement, points)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING`,
        [achievement.name, achievement.description, achievement.category, JSON.stringify(achievement.requirement), achievement.points]
      );
      console.log(`✓ Seeded achievement: ${achievement.name}`);
    }

    console.log(`\nSeeding complete! Added ${challengesData.length} challenges and ${achievements.length} achievements.`);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;

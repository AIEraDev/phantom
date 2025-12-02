import pool from "./connection";

async function verifyDatabase() {
  try {
    console.log("Verifying database setup...\n");

    // Check if migrations table exists
    const migrationsTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'migrations'
      ) as exists
    `);

    if (!migrationsTable.rows[0].exists) {
      console.log("❌ Migrations table not found. Run 'npm run migrate' first.");
      process.exit(1);
    }
    console.log("✓ Migrations table exists");

    // Check executed migrations
    const migrations = await pool.query("SELECT filename FROM migrations ORDER BY id");
    console.log(`✓ Executed ${migrations.rows.length} migration(s):`);
    migrations.rows.forEach((row) => {
      console.log(`  - ${row.filename}`);
    });

    // Check tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`\n✓ Found ${tables.rows.length} table(s):`);
    tables.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });

    // Check challenges count
    const challenges = await pool.query("SELECT COUNT(*) FROM challenges");
    console.log(`\n✓ Challenges: ${challenges.rows[0].count}`);

    // Check achievements count
    const achievements = await pool.query("SELECT COUNT(*) FROM achievements");
    console.log(`✓ Achievements: ${achievements.rows[0].count}`);

    console.log("\n✅ Database verification complete!");
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  verifyDatabase();
}

export default verifyDatabase;

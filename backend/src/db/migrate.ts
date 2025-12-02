import fs from "fs";
import path from "path";
import pool from "./connection";

interface Migration {
  filename: string;
  sql: string;
}

async function runMigrations() {
  try {
    console.log("Starting database migrations...");

    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of executed migrations
    const executedResult = await pool.query("SELECT filename FROM migrations ORDER BY id");
    const executedMigrations = new Set(executedResult.rows.map((row) => row.filename));

    // Read migration files
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const migrations: Migration[] = files.map((filename) => ({
      filename,
      sql: fs.readFileSync(path.join(migrationsDir, filename), "utf-8"),
    }));

    // Execute pending migrations
    let executedCount = 0;
    for (const migration of migrations) {
      if (!executedMigrations.has(migration.filename)) {
        console.log(`Executing migration: ${migration.filename}`);

        await pool.query("BEGIN");
        try {
          await pool.query(migration.sql);
          await pool.query("INSERT INTO migrations (filename) VALUES ($1)", [migration.filename]);
          await pool.query("COMMIT");
          console.log(`✓ Migration ${migration.filename} completed`);
          executedCount++;
        } catch (error) {
          await pool.query("ROLLBACK");
          console.error(`✗ Migration ${migration.filename} failed:`, error);
          throw error;
        }
      } else {
        console.log(`⊘ Migration ${migration.filename} already executed`);
      }
    }

    console.log(`\nMigrations complete! Executed ${executedCount} new migration(s).`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export default runMigrations;

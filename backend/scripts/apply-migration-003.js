/**
 * Apply Migration 003: Fix reg_number constraint
 * Run: node backend/scripts/apply-migration-003.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 5432,
});

async function applyMigration() {
  console.log('🔄 Applying migration 003: Fix reg_number constraint...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../src/database/migrations/003_fix_reg_number_constraint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration applied successfully!\n');

    // Verify the constraint was created
    const verifyQuery = `
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'students' AND constraint_type = 'UNIQUE'
    `;
    
    const result = await pool.query(verifyQuery);
    console.log('📋 Current UNIQUE constraints on students table:');
    result.rows.forEach(row => {
      console.log(`   - ${row.constraint_name} (${row.constraint_type})`);
    });

    console.log('\n✨ Done! Registration numbers can now be duplicated across schools.');
    console.log('   But they remain unique within each school.\n');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();

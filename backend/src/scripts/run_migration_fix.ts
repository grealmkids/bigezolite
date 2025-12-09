
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
};

const pool = new Pool(config);

const migration = async () => {
    try {
        console.log('Starting migration...');

        // 1. Add columns to students table if they don't exist
        console.log('Checking students table columns...');
        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS lin VARCHAR(255),
            ADD COLUMN IF NOT EXISTS joining_term INTEGER;
        `);
        console.log('Added columns to students table (if not existed).');

        // 2. Create student_terms table if it doesn't exist
        console.log('Checking student_terms table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS student_terms (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                year INTEGER NOT NULL,
                term INTEGER NOT NULL,
                class_name_at_term VARCHAR(255),
                status_at_term VARCHAR(50),
                presence BOOLEAN DEFAULT TRUE,
                UNIQUE(student_id, year, term)
            );
        `);
        console.log('Created student_terms table (if not existed).');

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
};

migration();

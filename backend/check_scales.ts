import { pool } from './src/database/database';

async function checkScales() {
    try {
        console.log('Checking grading scales...');
        const res = await pool.query('SELECT * FROM config_grading_scales');
        console.log('Total scales found:', res.rows.length);
        console.table(res.rows);

        console.log('Checking schools...');
        const schoolRes = await pool.query('SELECT school_id, school_name FROM schools');
        console.table(schoolRes.rows);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkScales();


const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bigezo_db',
    password: 'root',
    port: 5432,
});

async function checkData() {
    try {
        const staffId = 3; // From user log
        const schoolId = 7; // From user log

        console.log('--- Assignments ---');
        const assignRes = await pool.query('SELECT * FROM staff_subject_assignments WHERE staff_id = $1 AND school_id = $2', [staffId, schoolId]);
        console.log(assignRes.rows);

        if (assignRes.rows.length > 0) {
            const subjectId = assignRes.rows[0].subject_id;
            console.log(`\n--- Subject (ID: ${subjectId}) ---`);
            const subRes = await pool.query('SELECT * FROM subjects WHERE subject_id = $1', [subjectId]);
            console.log(subRes.rows);

            console.log('\n--- JOIN Test ---');
            const joinRes = await pool.query(`
                SELECT ssa.*, s.name as subject_name 
                FROM staff_subject_assignments ssa
                JOIN subjects s ON ssa.subject_id = s.subject_id
                WHERE ssa.staff_id = $1 AND ssa.school_id = $2
            `, [staffId, schoolId]);
            console.log(joinRes.rows);
        } else {
            console.log('No assignments found for this staff/school.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkData();

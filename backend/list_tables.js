
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bigezo_db',
    password: 'root',
    port: 5432,
});

async function listTables() {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        console.log('--- TABLES IN PUBLIC SCHEMA ---');
        res.rows.forEach(r => console.log(r.table_name));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

listTables();


import { pool } from '../database/database';

async function createOrdersTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS orders (
            order_id SERIAL PRIMARY KEY,
            school_name VARCHAR,
            contact_phone VARCHAR,
            package_type VARCHAR,
            sms_count INTEGER,
            price DECIMAL,
            status VARCHAR DEFAULT 'Pending',
            meta JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    `;

    try {
        console.log('Creating orders table...');
        await pool.query(createTableQuery);
        console.log('Orders table created successfully.');
    } catch (error) {
        console.error('Error creating orders table:', error);
    } finally {
        await pool.end();
    }
}

createOrdersTable();


import { pool } from '../database/database';

async function addTrackingIdToOrders() {
    const alterTableQuery = `
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS tracking_id VARCHAR;
    `;

    try {
        console.log('Adding tracking_id column to orders table...');
        await pool.query(alterTableQuery);
        console.log('Column added successfully.');
    } catch (error) {
        console.error('Error adding column:', error);
    } finally {
        await pool.end();
    }
}

addTrackingIdToOrders();

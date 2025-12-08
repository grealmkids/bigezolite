
import { query } from '../src/database/database';

async function fixRole() {
    try {
        console.log('Adding "Head Teacher" to staff_role enum...');
        // Postgres ENUMs: you can't add IF NOT EXISTS easily in one line without a block, 
        // but ALTER TYPE ... ADD VALUE 'Head Teacher' throws if it exists.
        // We can catch the error.
        try {
            await query(`ALTER TYPE staff_role ADD VALUE 'Head Teacher'`);
            console.log('Successfully added "Head Teacher" to staff_role.');
        } catch (e: any) {
            if (e.message.includes('already exists')) {
                console.log('"Head Teacher" already exists in staff_role enum.');
            } else {
                throw e;
            }
        }
    } catch (error) {
        console.error('Error fixing role:', error);
    } finally {
        process.exit(0);
    }
}

fixRole();

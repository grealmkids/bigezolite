import { query, pool } from '../database/database';

async function fixPermissions() {
    console.log('Starting permissions fix...');
    try {
        // 1. Find the constraint name
        const findConstraintSql = `
            SELECT con.conname
            FROM pg_catalog.pg_constraint con
            INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
            INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'results_entry'
              AND con.contype = 'f';
        `;

        const res = await query(findConstraintSql);
        console.log('Found constraints:', res.rows.map(r => r.conname));

        // Filter for the one referencing users(user_id) on entered_by_user_id
        // Since we can't easily parse what it points to without more complex SQL, 
        // let's look for the likely name.
        // Usually: results_entry_entered_by_user_id_fkey

        const targetConstraint = res.rows.find(r => r.conname.includes('entered_by_user_id'));

        if (targetConstraint) {
            console.log(`Dropping constraint: ${targetConstraint.conname}`);
            await query(`ALTER TABLE results_entry DROP CONSTRAINT ${targetConstraint.conname}`);
            console.log('Constraint dropped successfully.');
        } else {
            console.log('Constraint not found. It might have strictly named "results_entry_entered_by_user_id_fkey" or already dropped.');
            // Try explicit name just in case
            try {
                await query(`ALTER TABLE results_entry DROP CONSTRAINT results_entry_entered_by_user_id_fkey`);
                console.log('Dropped "results_entry_entered_by_user_id_fkey" explicitly.');
            } catch (e: any) {
                console.log('Explicit drop failed (likely not exists):', e.message);
            }
        }

    } catch (e) {
        console.error('Error fixing permissions:', e);
    } finally {
        await pool.end();
    }
}

fixPermissions();

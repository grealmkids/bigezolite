import { pool } from '../../database/database';

export const getSmsCredentialsForSchool = async (schoolId: number): Promise<{ username: string; password: string } | null> => {
    const result = await pool.query('SELECT username, password FROM sms_credentials WHERE school_id = $1 LIMIT 1', [schoolId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { username: row.username, password: row.password };
};

export const upsertSmsCredentials = async (schoolId: number, username: string, password: string, provider: string = 'egosms'): Promise<void> => {
    // Try update first
    const updateResult = await pool.query('UPDATE sms_credentials SET username = $1, password = $2, provider = $3, updated_at = now() WHERE school_id = $4', [username, password, provider, schoolId]);
    if (updateResult.rowCount === 0) {
        await pool.query('INSERT INTO sms_credentials (school_id, username, password, provider) VALUES ($1, $2, $3, $4)', [schoolId, username, password, provider]);
    }
};

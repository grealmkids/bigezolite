import { pool } from '../../database/database';

export const upsertSmsAccount = async (schoolId: number, providerBalance: number): Promise<void> => {
    // Try update first
    const updateResult = await pool.query('UPDATE sms_accounts SET provider_balance_bigint = $1, last_checked = now(), updated_at = now() WHERE school_id = $2', [providerBalance, schoolId]);
    if (updateResult.rowCount === 0) {
        await pool.query('INSERT INTO sms_accounts (school_id, provider_balance_bigint, last_checked) VALUES ($1, $2, now())', [schoolId, providerBalance]);
    }
};

export const getSmsAccountBalance = async (schoolId: number): Promise<number> => {
    const result = await pool.query('SELECT provider_balance_bigint FROM sms_accounts WHERE school_id = $1', [schoolId]);
    if (result.rows.length === 0) return 0;
    return Number(result.rows[0].provider_balance_bigint || 0);
};

export const addSmsTransaction = async (schoolId: number, type: 'debit' | 'credit' | 'check', amount: number, details: any = null): Promise<void> => {
    await pool.query('INSERT INTO sms_transactions (school_id, type, amount_bigint, details) VALUES ($1, $2, $3, $4)', [schoolId, type, amount, details]);
};

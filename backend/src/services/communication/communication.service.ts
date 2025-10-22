import { pool } from '../../database/database';
import { sendSms, checkBalance } from '../../utils/sms.util';
import { getSmsCredentialsForSchool } from './smsCredentials.service';
import { upsertSmsAccount, getSmsAccountBalance, addSmsTransaction } from './smsAccount.service';
import { config } from '../../config';

export const getSmsCredits = async (schoolId: number): Promise<number> => {
    // Prefer provider-tracked balance if present in sms_accounts
    const accountBalance = await getSmsAccountBalance(schoolId);
    if (accountBalance && accountBalance > 0) return accountBalance;

    // Fallback to legacy sms_credits column on schools table
    const result = await pool.query('SELECT sms_credits FROM schools WHERE school_id = $1', [schoolId]);
    if (result.rows.length > 0) {
        return result.rows[0].sms_credits || 0;
    }
    return 0;
};

export const processBulkSms = async (schoolId: number, recipientFilter: any, message: string): Promise<void> => {
    const params: any[] = [schoolId];
    let query = 'SELECT parent_phone_sms FROM students WHERE school_id = $1';

    // frontend currently sends a class name string (or 'All Students') as recipientFilter
    if (recipientFilter && typeof recipientFilter === 'string' && recipientFilter !== 'All Students') {
        query = 'SELECT parent_phone_sms FROM students WHERE school_id = $1 AND class_name = $2';
        params.push(recipientFilter);
    }

    const studentsResult = await pool.query(query, params);
    const phoneNumbers: string[] = studentsResult.rows.map((row: any) => row.parent_phone_sms).filter(Boolean);

    const recipientCount = phoneNumbers.length;
    const costPerSms = Number(config.costPerSms || 50);
    const requiredAmount = recipientCount * costPerSms;

    // Determine provider balance by calling checkBalance (prefer creds), apply algorithm in controller
    const creds = await getSmsCredentialsForSchool(schoolId);
    if (!creds) {
        const err: any = new Error('Missing SMS credentials. Subscribe or Contact Support');
        err.statusCode = 403;
        throw err;
    }
    // Must use per-school credentials (no fallback to env/global creds)
    const providerBalance = await checkBalance(creds.username, creds.password);

    // Apply money logic: here providerBalance is assumed to be in same units as COST_PER_SMS
    if (providerBalance < requiredAmount) {
        throw new Error('Insufficient SMS balance for bulk send');
    }

    for (const phoneNumber of phoneNumbers) {
        await sendSms(phoneNumber, message, creds.username, creds.password, creds.username);
    }

    // Record transaction and update account (attempt SMS accounts table update)
    await addSmsTransaction(schoolId, 'debit', requiredAmount, { type: 'bulk', recipients: recipientCount });
    const newProviderBalance = providerBalance - requiredAmount;
    await upsertSmsAccount(schoolId, newProviderBalance);
    // For backwards compatibility, also decrement legacy column if present
    await pool.query('UPDATE schools SET sms_credits = GREATEST(0, COALESCE(sms_credits,0) - $1) WHERE school_id = $2', [recipientCount, schoolId]);
};

export const processSingleSms = async (schoolId: number, studentId: number, message: string): Promise<void> => {
    const studentResult = await pool.query('SELECT parent_phone_sms FROM students WHERE student_id = $1 AND school_id = $2', [studentId, schoolId]);
    if (studentResult.rows.length === 0) {
        throw new Error('Student not found');
    }
    const phoneNumber = studentResult.rows[0].parent_phone_sms;

    const costPerSms = Number(config.costPerSms || 50);
    const creds = await getSmsCredentialsForSchool(schoolId);
    if (!creds) {
        const err: any = new Error('Missing SMS credentials. Subscribe or Contact Support');
        err.statusCode = 403;
        throw err;
    }

    const providerBalance = await checkBalance(creds.username, creds.password);

    if (providerBalance < costPerSms) {
        throw new Error('Insufficient SMS balance for single send');
    }

    await sendSms(phoneNumber, message, creds.username, creds.password, creds.username);

    await addSmsTransaction(schoolId, 'debit', costPerSms, { type: 'single', studentId });
    const newProviderBalance = providerBalance - costPerSms;
    await upsertSmsAccount(schoolId, newProviderBalance);
    await pool.query('UPDATE schools SET sms_credits = GREATEST(0, COALESCE(sms_credits,0) - 1) WHERE school_id = $1', [schoolId]);
};

import { pool } from '../../database/database';
import { sendSms, checkBalance } from '../../utils/sms.util';
import { getSmsCredentialsForSchool } from './smsCredentials.service';
import { upsertSmsAccount, getSmsAccountBalance, addSmsTransaction } from './smsAccount.service';
import { config } from '../../config';

export const getSmsCredits = async (schoolId: number): Promise<number> => {
    // Prefer provider-tracked balance if present in sms_accounts
    const accountBalance = await getSmsAccountBalance(schoolId);
    if (accountBalance && accountBalance > 0) return accountBalance;
    // No legacy fallback: rely on sms_accounts table or provider balance
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
    console.debug('[processBulkSms] recipientCount:', recipientCount, 'costPerSms:', costPerSms, 'requiredAmount:', requiredAmount, 'providerBalance:', providerBalance);

    // Apply money logic: here providerBalance is assumed to be in same units as COST_PER_SMS
    if (providerBalance < requiredAmount) {
        const err: any = new Error('Insufficient SMS balance for bulk send');
        err.statusCode = 402; // Payment required / insufficient funds
        err.details = { providerBalance, requiredAmount };
        throw err;
    }

    for (const phoneNumber of phoneNumbers) {
        await sendSms(phoneNumber, message, creds.username, creds.password, creds.username);
    }

    // Record transaction and update provider-backed account
    await addSmsTransaction(schoolId, 'debit', requiredAmount, { type: 'bulk', recipients: recipientCount });
    const newProviderBalance = providerBalance - requiredAmount;
    await upsertSmsAccount(schoolId, newProviderBalance);
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

    console.debug('[processSingleSms] costPerSms:', costPerSms, 'providerBalance:', providerBalance);

    if (providerBalance < costPerSms) {
        const err: any = new Error('Insufficient SMS balance for single send');
        err.statusCode = 402;
        err.details = { providerBalance, requiredAmount: costPerSms };
        throw err;
    }

    await sendSms(phoneNumber, message, creds.username, creds.password, creds.username);

    await addSmsTransaction(schoolId, 'debit', costPerSms, { type: 'single', studentId });
    const newProviderBalance = providerBalance - costPerSms;
    await upsertSmsAccount(schoolId, newProviderBalance);
};

// Generate fees reminder message
const generateFeesReminderMessage = (studentName: string, amountPaid: number, balance: number, deadline: string): string => {
    const formattedAmountPaid = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountPaid);
    const formattedBalance = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(balance);
    const deadlineText = deadline ? ` before ${deadline}` : '';
    return `Dear parent of ${studentName}, you have so far paid ${formattedAmountPaid}. Kindly pay the remaining School fees balance of ${formattedBalance}${deadlineText}.`;
};

// Process fees reminder for individual student
export const processFeesReminder = async (schoolId: number, studentId: number): Promise<void> => {
    // Get student details and fees balance
    const studentQuery = `
        SELECT s.student_name, s.parent_phone_sms, s.school_id,
               COALESCE(SUM(f.total_amount - f.amount_paid), 0) as balance,
               COALESCE(SUM(f.amount_paid), 0) as amount_paid,
               MIN(f.due_date) as earliest_due_date
        FROM students s
        LEFT JOIN fees_records f ON s.student_id = f.student_id
        WHERE s.student_id = $1 AND s.school_id = $2
        GROUP BY s.student_id, s.student_name, s.parent_phone_sms, s.school_id
    `;
    const studentResult = await pool.query(studentQuery, [studentId, schoolId]);
    
    if (studentResult.rows.length === 0) {
        throw new Error('Student not found or does not belong to your school');
    }

    const student = studentResult.rows[0];
    const balance = parseFloat(student.balance);
    const amountPaid = parseFloat(student.amount_paid);
    
    if (balance <= 0) {
        throw new Error('Student has no outstanding balance');
    }

    // Format deadline as DD-MMM-YYYY
    const deadline = student.earliest_due_date 
        ? new Date(student.earliest_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
        : '';

    // Generate message
    const message = generateFeesReminderMessage(student.student_name, amountPaid, balance, deadline);

    // Send SMS
    const costPerSms = Number(config.costPerSms || 50);
    const creds = await getSmsCredentialsForSchool(schoolId);
    if (!creds) {
        const err: any = new Error('Missing SMS credentials. Subscribe or Contact Support');
        err.statusCode = 403;
        throw err;
    }

    const providerBalance = await checkBalance(creds.username, creds.password);
    if (providerBalance < costPerSms) {
        const err: any = new Error('Insufficient SMS balance');
        err.statusCode = 402;
        err.details = { providerBalance, requiredAmount: costPerSms };
        throw err;
    }

    await sendSms(student.parent_phone_sms, message, creds.username, creds.password, creds.username);
    await addSmsTransaction(schoolId, 'debit', costPerSms, { type: 'fees-reminder', studentId });
    const newProviderBalance = providerBalance - costPerSms;
    await upsertSmsAccount(schoolId, newProviderBalance);
};

// Process bulk fees reminders with filters
export const processBulkFeesReminders = async (
    schoolId: number,
    thresholdAmount: number,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string
): Promise<void> => {
    // Build query to get students with outstanding balances >= threshold
    let query = `
        SELECT s.student_id, s.student_name, s.parent_phone_sms, s.class_name, s.status,
               COALESCE(SUM(f.total_amount - f.amount_paid), 0) as balance,
               COALESCE(SUM(f.amount_paid), 0) as amount_paid,
               MIN(f.due_date) as earliest_due_date
        FROM students s
        LEFT JOIN fees_records f ON s.student_id = f.student_id
        WHERE s.school_id = $1
    `;
    const params: any[] = [schoolId];
    let paramIndex = 2;

    // Apply class filter
    if (classFilter && classFilter !== 'All Students') {
        query += ` AND s.class_name = $${paramIndex}`;
        params.push(classFilter);
        paramIndex++;
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'All Statuses') {
        query += ` AND s.status = $${paramIndex}`;
        params.push(statusFilter);
        paramIndex++;
    }

    query += ` GROUP BY s.student_id, s.student_name, s.parent_phone_sms, s.class_name, s.status`;
    query += ` HAVING COALESCE(SUM(f.total_amount - f.amount_paid), 0) >= $${paramIndex}`;
    params.push(thresholdAmount);

    const studentsResult = await pool.query(query, params);
    const students = studentsResult.rows;

    if (students.length === 0) {
        throw new Error('No students match the specified criteria');
    }

    // Format custom deadline as DD-MMM-YYYY if provided
    const formattedCustomDeadline = customDeadline 
        ? new Date(customDeadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
        : null;

    // Calculate total cost and check balance
    const recipientCount = students.length;
    const costPerSms = Number(config.costPerSms || 50);
    const requiredAmount = recipientCount * costPerSms;

    const creds = await getSmsCredentialsForSchool(schoolId);
    if (!creds) {
        const err: any = new Error('Missing SMS credentials. Subscribe or Contact Support');
        err.statusCode = 403;
        throw err;
    }

    const providerBalance = await checkBalance(creds.username, creds.password);
    console.debug('[processBulkFeesReminders] recipientCount:', recipientCount, 'costPerSms:', costPerSms, 'requiredAmount:', requiredAmount, 'providerBalance:', providerBalance);

    if (providerBalance < requiredAmount) {
        const err: any = new Error('Insufficient SMS balance for bulk fees reminders');
        err.statusCode = 402;
        err.details = { providerBalance, requiredAmount };
        throw err;
    }

    // Send SMS to each student
    for (const student of students) {
        const balance = parseFloat(student.balance);
        const amountPaid = parseFloat(student.amount_paid);
        const deadline = formattedCustomDeadline || 
            (student.earliest_due_date 
                ? new Date(student.earliest_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
                : '');
        
        const message = generateFeesReminderMessage(student.student_name, amountPaid, balance, deadline);
        await sendSms(student.parent_phone_sms, message, creds.username, creds.password, creds.username);
    }

    // Record transaction
    await addSmsTransaction(schoolId, 'debit', requiredAmount, { type: 'bulk-fees-reminders', recipients: recipientCount, thresholdAmount });
    const newProviderBalance = providerBalance - requiredAmount;
    await upsertSmsAccount(schoolId, newProviderBalance);
};

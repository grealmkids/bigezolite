import { pool } from '../../database/database';
import { sendSms, checkBalance } from '../../utils/sms.util';
import { getSmsCredentialsForSchool } from './smsCredentials.service';
import { upsertSmsAccount, getSmsAccountBalance, addSmsTransaction } from './smsAccount.service';
import { config } from '../../config';
import { findSchoolById } from '../schools/school.service';

export const getSmsCredits = async (schoolId: number): Promise<number> => {
    // Prefer provider-tracked balance if present in sms_accounts
    const accountBalance = await getSmsAccountBalance(schoolId);
    if (accountBalance && accountBalance > 0) return accountBalance;
    // No legacy fallback: rely on sms_accounts table or provider balance
    return 0;
};

export const previewBulkSmsData = async (schoolId: number, recipientFilter: any): Promise<{ recipientCount: number; estimatedCost: number; currentBalance: number; costPerSms: number }> => {
    const params: any[] = [schoolId];
    let query = 'SELECT parent_phone_sms FROM students WHERE school_id = $1';
    if (recipientFilter && typeof recipientFilter === 'string' && recipientFilter !== 'All Students') {
        query = 'SELECT parent_phone_sms FROM students WHERE school_id = $1 AND class_name = $2';
        params.push(recipientFilter);
    }
    const studentsResult = await pool.query(query, params);
    const phoneNumbers: string[] = studentsResult.rows.map((row: any) => row.parent_phone_sms).filter(Boolean);
    const recipientCount = phoneNumbers.length;
    const costPerSms = Number(config.costPerSms || 50);
    const estimatedCost = recipientCount * costPerSms;
    const creds = await getSmsCredentialsForSchool(schoolId);
    if (!creds) {
        const err: any = new Error('Missing SMS credentials. Subscribe or Contact Support');
        err.statusCode = 403;
        throw err;
    }
    const providerBalance = await checkBalance(creds.username, creds.password);
    // Compute display balance using configured COST_PER_SMS (reseller price)
    const displayBalance = Math.round((Number(providerBalance) || 0) * (config.costPerSms || 35) / 35);
    return { recipientCount, estimatedCost, currentBalance: providerBalance, costPerSms: costPerSms, balance: displayBalance } as any;
};

export const processBulkSms = async (schoolId: number, recipientFilter: any, message: string): Promise<{ sentCount: number; failedCount: number; failures: Array<{ phone: string; error: string }> }> => {
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

    const failures: Array<{ phone: string; error: string }> = [];
    let sentCount = 0;
    for (const phoneNumber of phoneNumbers) {
        try {
            console.log(`[BulkSMS] -> ${phoneNumber}: ${message}`);
            await sendSms(phoneNumber, message, creds.username, creds.password, creds.username);
            sentCount++;
        } catch (e: any) {
            console.error(`[BulkSMS][FAIL] ${phoneNumber}:`, e?.message || e);
            failures.push({ phone: phoneNumber, error: e?.message || String(e) });
        }
    }

    // Record transaction and update provider-backed account (charge only for successful sends)
    const charge = sentCount * costPerSms;
    await addSmsTransaction(schoolId, 'debit', charge, { type: 'bulk', recipients: sentCount });
    const newProviderBalance = providerBalance - charge;
    await upsertSmsAccount(schoolId, newProviderBalance);

    return { sentCount, failedCount: failures.length, failures };
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

// Generate fees reminder message (simple/generic)
const generateFeesReminderMessage = (studentName: string, amountPaid: number, balance: number, deadline: string): string => {
    const formattedAmountPaid = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountPaid);
    const formattedBalance = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(balance);
    const deadlineText = deadline ? ` before ${deadline}` : '';
    return `Dear parent of ${studentName}, you have so far paid ${formattedAmountPaid}. Kindly pay the remaining School fees balance of ${formattedBalance}${deadlineText}.`;
};

// Detailed per-record message to mimic single-student reminder modal
const generateDetailedFeesMessage = (opts: {
    studentName: string;
    feeName?: string;
    amountPaid: number;
    totalDue: number;
    balance: number;
    dueDate?: string; // DD-MMM-YYYY
    rsvpNumber?: string;
    schoolName?: string;
    term?: number;
    year?: number;
}): string => {
    const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
    const deadlineText = opts.dueDate ? ` before ${opts.dueDate}` : '';
    const feeLabel = opts.feeName || 'School Fees';
    const rsvp = opts.rsvpNumber ? ` RSVP: ${opts.rsvpNumber}` : '';
    const termYear = opts.term && opts.year ? ` Term ${opts.term}, ${opts.year}` : '';
    const schoolTag = opts.schoolName ? ` -${opts.schoolName}:${termYear}` : termYear ? ` -${termYear}` : '';
    return `Dear parent of ${opts.studentName}, you have paid ${fmt(opts.amountPaid)} out of ${fmt(opts.totalDue)} for ${feeLabel}. Please pay Balance ${fmt(opts.balance)}${deadlineText}. Thank you.${rsvp}${schoolTag}`;
};

// Message from a template allowing placeholders
const buildMessageFromTemplate = (template: string, ctx: Record<string, string | number | undefined>): string => {
    return template
        .replace(/\{child(?:'s)?_?name\}/gi, String(ctx.child_name || ctx.student_name || ''))
        .replace(/\{child_name\}/gi, String(ctx.child_name || ctx.student_name || ''))
        .replace(/\{student_name\}/gi, String(ctx.student_name || ''))
        .replace(/\{fee(?:s?_to_)?track\}/gi, String(ctx.fee_name || 'fees'))
        .replace(/\{fee_name\}/gi, String(ctx.fee_name || 'fees'))
        .replace(/\{today(?:'s)?_?date\}/gi, String(ctx.today_date || ''))
        .replace(/\{rsvp(?:_number)?\}/gi, String(ctx.rsvp_number || ''))
        .replace(/\{school(?:_name)?\}/gi, String(ctx.school_name || ''))
        .replace(/\{term\}/gi, String(ctx.term || ''))
        .replace(/\{year\}/gi, String(ctx.year || ''))
        .replace(/\{balance\}/gi, String(ctx.balance || ''))
        .replace(/\{amount_paid\}/gi, String(ctx.amount_paid || ''))
        .replace(/\{total_due\}/gi, String(ctx.total_due || ''))
        .replace(/\{due_date\}/gi, String(ctx.due_date || ''));
};

// Process fees reminder for individual student
export const processFeesReminder = async (schoolId: number, studentId: number): Promise<void> => {
    // Get student details and fees balance
    const studentQuery = `
        SELECT s.student_name, s.parent_phone_sms, s.school_id,
               COALESCE(SUM(f.balance_due), 0) as balance,
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
    
    // Do not send reminders for trivially small balances under the threshold (UGX 1,000)
    if (balance < 1000) {
        const err: any = new Error('Outstanding balance is less than UGX 1,000 — reminder not sent');
        err.statusCode = 400;
        err.details = { balance };
        throw err;
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

// Preview bulk fees reminders data
export const previewBulkFeesRemindersData = async (
    schoolId: number,
    thresholdAmount: number,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string,
    year?: string | number,
    term?: string | number,
    feesStatus?: string,
    messageType: 'detailed' | 'sent_home' | 'custom' | 'generic' = 'detailed',
    messageTemplate?: string
): Promise<any> => {
    // Fetch school info for message context
    const school = await findSchoolById(schoolId);
    // Per request: do NOT include the school name in outgoing messages. Keep accountant/rsvp number if present.
    const schoolName: string = '';
    const rsvpNumber: string = school?.accountant_number || '';

    // Check if student_terms table exists and has proper columns
    let hasStudentTerms = false;
    try {
        const stProbe = await pool.query(
            `SELECT 1 FROM student_terms st JOIN students s ON s.student_id = st.student_id WHERE s.school_id = $1 LIMIT 1`,
            [schoolId]
        );
        hasStudentTerms = ((stProbe as any)?.rowCount ?? 0) > 0;
    } catch (err) {
        console.debug('[BulkFeesPreview] student_terms table issue:', (err as any)?.message);
        hasStudentTerms = false;
    }
    
    // Build SQL safely by assembling WHERE clauses and a params array in order.
    // This avoids mismatched placeholder counts for different filter combinations.
    const params: any[] = [];

    // Base students filters
    const baseStudentWhere: string[] = [];
    params.push(schoolId); // $1
    baseStudentWhere.push('s.school_id = $1');
    if (statusFilter && statusFilter !== 'All Statuses') {
        baseStudentWhere.push(`s.student_status = $${params.length + 1}`);
        params.push(statusFilter);
    }
    if (classFilter && classFilter !== 'All Students') {
        baseStudentWhere.push(`s.class_name = $${params.length + 1}`);
        params.push(classFilter);
    }

    // fees_records filters
    const feesWhere: string[] = [];
    feesWhere.push('COALESCE(f.balance_due, 0) > 0');
    if (year) {
        feesWhere.push(`f.year = $${params.length + 1}`);
        params.push(Number(year));
    }
    if (term) {
        feesWhere.push(`f.term = $${params.length + 1}`);
        params.push(Number(term));
    }

    // Threshold parameter (balance minimum)
    const thresholdPlaceholder = `$${params.length + 1}`;
    params.push(Number(thresholdAmount));

    const sql = `
        WITH base_students AS (
            SELECT s.student_id, s.student_name, s.parent_phone_sms, s.class_name, s.student_status
            FROM students s
            WHERE ${baseStudentWhere.join(' AND ')}
        ),
        fr AS (
            SELECT f.*, ft.name as fee_name
            FROM fees_records f
            LEFT JOIN fees_to_track ft ON ft.fee_id = f.fee_id
            WHERE ${feesWhere.join(' AND ')}
        ),
        ranked AS (
            SELECT fr.*, ROW_NUMBER() OVER (PARTITION BY fr.student_id ORDER BY COALESCE(fr.balance_due,0) DESC, fr.due_date ASC NULLS LAST) rn
            FROM fr
        )
        SELECT bs.student_id, bs.student_name, bs.parent_phone_sms, bs.class_name, bs.student_status,
               r.total_fees_due, r.amount_paid, r.balance_due, r.term, r.year, r.due_date, r.fee_name
        FROM base_students bs
        JOIN ranked r ON r.student_id = bs.student_id AND r.rn = 1
        WHERE COALESCE(r.balance_due,0) >= ${thresholdPlaceholder}
    `;

    console.debug('[BulkFeesPreview] filters:', { thresholdAmount, classFilter, statusFilter, customDeadline, year, term, feesStatus, messageType });
    console.debug('[BulkFeesPreview] SQL params:', params);
    console.debug('[BulkFeesPreview] Final SQL:', sql);
    // Audit placeholders vs params so we can trace mismatches in production
    const _pm_preview = sql.match(/\$([1-9][0-9]*)/g) || [];
    const _idxs_preview = _pm_preview.map((m) => Number(m.slice(1)));
    const _maxPlaceholderPreview = _idxs_preview.length ? Math.max(..._idxs_preview) : 0;
    console.debug('[BulkFeesPreview] placeholders vs params', { maxPlaceholder: _maxPlaceholderPreview, paramsLength: params.length });
    // Sanity check: ensure numeric placeholders ($1,$2,...) match params length
    if (_maxPlaceholderPreview !== params.length) {
        console.error('[BulkFeesPreview] placeholder/params mismatch', { maxPlaceholder: _maxPlaceholderPreview, paramsLength: params.length, params, sql });
        throw new Error(`SQL placeholder/params mismatch: SQL expects ${_maxPlaceholderPreview} params but provided ${params.length}`);
    }
    
    // Debug: Check what students exist for this school
    const studentCheck = await pool.query('SELECT COUNT(*) as count, array_agg(DISTINCT student_status) as statuses, array_agg(DISTINCT class_name) as classes FROM students WHERE school_id = $1', [schoolId]);
    console.debug('[BulkFeesPreview] Students in school:', studentCheck.rows[0]);
    
    // Debug: Check what fees records exist
    const feesCheck = await pool.query('SELECT COUNT(*) as count, array_agg(DISTINCT year) as years, array_agg(DISTINCT term) as terms FROM fees_records f JOIN students s ON f.student_id = s.student_id WHERE s.school_id = $1', [schoolId]);
    console.debug('[BulkFeesPreview] Fees records for school:', feesCheck.rows[0]);
    
    // Debug: Check what school IDs actually have data
    const allSchoolsCheck = await pool.query('SELECT school_id, COUNT(*) as student_count FROM students GROUP BY school_id ORDER BY school_id');
    console.debug('[BulkFeesPreview] All schools with students:', allSchoolsCheck.rows);
    
    const allFeesCheck = await pool.query('SELECT s.school_id, COUNT(f.*) as fees_count FROM fees_records f JOIN students s ON f.student_id = s.student_id GROUP BY s.school_id ORDER BY s.school_id');
    console.debug('[BulkFeesPreview] All schools with fees:', allFeesCheck.rows);
    
    // Debug: Check student_terms table structure and sample data
    try {
        const stCheck = await pool.query('SELECT * FROM student_terms LIMIT 1');
        console.debug('[BulkFeesPreview] student_terms sample:', stCheck.rows[0]);
        if (stCheck.rows.length > 0) {
            console.debug('[BulkFeesPreview] student_terms columns:', Object.keys(stCheck.rows[0]));
        }
    } catch (err: any) {
        console.debug('[BulkFeesPreview] student_terms error:', err.message);
    }
    // Execute query
    const result = await pool.query(sql, params);
    let rows: any[] = result.rows || [];
    console.debug('[BulkFeesPreview] top-record rows:', rows.length);

    // Get school's SMS balance
    const creds = await getSmsCredentialsForSchool(schoolId);
    if (!creds) {
        throw new Error('Missing SMS credentials. Subscribe or Contact Support');
    }
    const smsBalance = await checkBalance(creds.username, creds.password);

    // Optional feesStatus filter similar to students page
    if (feesStatus) {
        rows = rows.filter((r) => {
            const paid = Number(r.amount_paid || 0);
            const bal = Number(r.balance_due || 0);
            if (feesStatus === 'Paid') return bal === 0 && (paid > 0 || Number(r.total_fees_due || 0) > 0);
            if (feesStatus === 'Pending') return bal > 0 && paid > 0; // Partially Paid
            if (feesStatus === 'Defaulter') return bal > 0 && paid === 0; // No payment yet
            return true;
        });
    }

    if (rows.length === 0) {
        // Fallback: aggregate by student (legacy style) under provided filters
        let aggSql = `
            SELECT s.student_id, s.student_name, s.parent_phone_sms, s.class_name, s.student_status,
                   COALESCE(SUM(f.balance_due), 0) as balance,
                   COALESCE(SUM(f.amount_paid), 0) as amount_paid,
                   MIN(f.due_date) as earliest_due_date
            FROM students s
            JOIN fees_records f ON s.student_id = f.student_id
            WHERE s.school_id = $1
        `;
        const aParams: any[] = [schoolId];
        let aNext = 2;
        if (classFilter && classFilter !== 'All Students') { aggSql += ` AND s.class_name = $${aNext}`; aParams.push(classFilter); aNext++; }
        if (statusFilter && statusFilter !== 'All Statuses') { aggSql += ` AND s.student_status = $${aNext}`; aParams.push(statusFilter); aNext++; }
        if (year) { aggSql += ` AND f.year = $${aNext}`; aParams.push(Number(year)); aNext++; }
        if (term) { aggSql += ` AND f.term = $${aNext}`; aParams.push(Number(term)); aNext++; }
        aggSql += ` GROUP BY s.student_id, s.student_name, s.parent_phone_sms, s.class_name, s.student_status`;
        aggSql += ` HAVING COALESCE(SUM(f.balance_due), 0) >= $${aNext}`; aParams.push(Number(thresholdAmount));

        console.debug('[BulkFeesPreview][Fallback] SQL params:', aParams);
        const aggRes = await pool.query(aggSql, aParams);
        rows = aggRes.rows || [];
        console.debug('[BulkFeesPreview][Fallback] rows:', rows.length);

        if (feesStatus) {
            rows = rows.filter((r: any) => {
                const paid = Number(r.amount_paid || 0);
                const bal = Number(r.balance || 0);
                if (feesStatus === 'Paid') return bal === 0 && (paid > 0);
                if (feesStatus === 'Pending') return bal > 0 && paid > 0;
                if (feesStatus === 'Defaulter') return bal > 0 && paid === 0;
                return true;
            });
        }

        if (rows.length === 0) {
            return { recipientCount: 0, totalBalance: 0, sampleMessage: '', estimatedCost: 0, recipients: [], messageLength: 0, smsUnits: 0 };
        }
    }

    // Determine custom deadline format
    const formattedCustomDeadline = customDeadline
        ? new Date(customDeadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
        : undefined;

    // Build messages context for first student (sample)
    const first = rows[0];
    const dueDate = formattedCustomDeadline || (first.due_date ? new Date(first.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : undefined);

    let sampleMessage = '';
    if (messageType === 'detailed') {
        sampleMessage = generateDetailedFeesMessage({
            studentName: first.student_name,
            feeName: first.fee_name,
            amountPaid: Number(first.amount_paid || 0),
            totalDue: Number(first.total_fees_due || 0),
            balance: Number(first.balance_due || 0),
            dueDate,
            rsvpNumber,
            schoolName,
            term: Number(first.term || 0) || undefined,
            year: Number(first.year || 0) || undefined
        });
    } else if (messageType === 'sent_home') {
        const template = messageTemplate && messageTemplate.trim().length > 0 ? messageTemplate : `Dear parent of {child's name}, we have sent your child back home for {fee_name} today {today's date}. {RSVP number} - {School name}.`;
        sampleMessage = buildMessageFromTemplate(template, {
            child_name: first.student_name,
            student_name: first.student_name,
            fee_name: first.fee_name,
            today_date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
            rsvp_number: rsvpNumber,
            school_name: schoolName,
            term: first.term,
            year: first.year,
            balance: Number(first.balance_due || 0),
            amount_paid: Number(first.amount_paid || 0),
            total_due: Number(first.total_fees_due || 0),
            due_date: dueDate
        });
    } else if (messageType === 'custom') {
        const template = messageTemplate || '';
        sampleMessage = buildMessageFromTemplate(template, {
            child_name: first.student_name,
            student_name: first.student_name,
            fee_name: first.fee_name,
            today_date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
            rsvp_number: rsvpNumber,
            school_name: schoolName,
            term: first.term,
            year: first.year,
            balance: Number(first.balance_due || 0),
            amount_paid: Number(first.amount_paid || 0),
            total_due: Number(first.total_fees_due || 0),
            due_date: dueDate
        });
    } else {
        // generic (legacy)
        sampleMessage = generateFeesReminderMessage(first.student_name, Number(first.amount_paid || 0), Number(first.balance_due || 0), dueDate || '');
    }

    const recipientCount = rows.length;
    // totalBalance in preview should reflect the school's SMS airtime balance (provider value)
    const totalBalance = smsBalance;
    const costPerSms = Number(config.costPerSms || 50);
    const smsUnits = Math.max(1, Math.ceil(sampleMessage.length / 160));
    const costPerRecipient = costPerSms * smsUnits; // total cost to send this message to one recipient
    const estimatedCost = recipientCount * costPerRecipient;

    const preview = {
        recipientCount,
        totalBalance, // Use the school's SMS balance instead of fees balance
        sampleMessage,
        estimatedCost, // total cost = recipients * cost per recipient
        messageLength: sampleMessage.length,
        smsUnits,
        recipients: rows.map((s: any) => ({
            studentName: s.student_name,
            phoneNumber: s.parent_phone_sms,
            balance: Number(s.balance_due || 0),
            amountPaid: Number(s.amount_paid || 0)
        }))
    } as any;
    console.debug('[BulkFeesPreview] preview summary:', { recipientCount: preview.recipientCount, totalBalance: preview.totalBalance, smsUnits: preview.smsUnits });
    return preview;
};

// Process bulk fees reminders with filters
export const processBulkFeesReminders = async (
    schoolId: number,
    thresholdAmount: number,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string,
    year?: string | number,
    term?: string | number,
    feesStatus?: string,
    messageType: 'detailed' | 'sent_home' | 'custom' | 'generic' = 'detailed',
    messageTemplate?: string
): Promise<void> => {
    // Fetch school info for message context
    const school = await findSchoolById(schoolId);
    // Per request: do NOT include the school name in outgoing messages. Keep accountant/rsvp number if present.
    const schoolName: string = '';
    const rsvpNumber: string = school?.accountant_number || '';

    // Check if student_terms has data for this school's students
    const stProbe = await pool.query(
        `SELECT 1 FROM student_terms st JOIN students s ON s.student_id = st.student_id WHERE s.school_id = $1 LIMIT 1`,
        [schoolId]
    );
    const hasStudentTerms = ((stProbe as any)?.rowCount ?? 0) > 0;

    // Select top outstanding record per student similar to preview
    let sql = `
        WITH base_students AS (
            SELECT s.student_id, s.student_name, s.parent_phone_sms, s.class_name, s.student_status
            FROM students s
            WHERE s.school_id = $1
        ),
        filtered_students AS (
            SELECT * FROM base_students
            WHERE 1=1
            /*CLASS_FILTER*/
            /*STATUS_OR_ST_FILTER*/
        ),
        fr AS (
            SELECT f.*, ft.name as fee_name
            FROM fees_records f
LEFT JOIN fees_to_track ft ON ft.fee_id = f.fee_id
            WHERE COALESCE(f.balance_due, 0) > 0
            ${year ? ' AND f.year = $Y' : ''}
            ${term ? ' AND f.term = $T' : ''}
        ),
        ranked AS (
            SELECT fr.*, ROW_NUMBER() OVER (PARTITION BY fr.student_id ORDER BY COALESCE(fr.balance_due,0) DESC, fr.due_date ASC NULLS LAST) rn
            FROM fr
        )
        SELECT fs.student_id, fs.student_name, fs.parent_phone_sms, fs.class_name, fs.student_status,
               r.total_fees_due, r.amount_paid, r.balance_due, r.term, r.year, r.due_date, r.fee_name
        FROM filtered_students fs
        JOIN ranked r ON r.student_id = fs.student_id AND r.rn = 1
        WHERE COALESCE(r.balance_due,0) >= $X
    `;

    const params: any[] = [schoolId];
    let next = 2;

    // Inject class filter
    if (classFilter && classFilter !== 'All Students') {
        sql = sql.replace('/*CLASS_FILTER*/', ` AND class_name = $${next}`);
        params.push(classFilter);
        next++;
    } else {
        sql = sql.replace('/*CLASS_FILTER*/', '');
    }

    // For status: if year/term provided, prefer student_terms.status; else students.student_status
    const useStudentTerms = Boolean(term || year) && hasStudentTerms;
        if (statusFilter && statusFilter !== 'All Statuses') {
            if (useStudentTerms) {
                // Build student_terms existence clause using tokens ($Y/$T) for year/term
                // so we only bind year/term once later when replacing $Y/$T placeholders.
                let stClause = ' AND EXISTS (SELECT 1 FROM student_terms st WHERE st.student_id = base_students.student_id';
                if (year) { stClause += ` AND st.year = $Y`; }
                if (term) { stClause += ` AND st.term = $T`; }
                // status_at_term will use the next numeric placeholder; push statusFilter now
                stClause += ` AND st.status_at_term = $${next})`;
                params.push(statusFilter);
                next++;
                sql = sql.replace('/*STATUS_OR_ST_FILTER*/', stClause);
            } else {
                sql = sql.replace('/*STATUS_OR_ST_FILTER*/', ` AND student_status = $${next}`);
                params.push(statusFilter);
                next++;
            }
        } else {
            if (useStudentTerms) {
                // Use tokens for year/term; actual numeric placeholders will be substituted below
                let stClause = ' AND EXISTS (SELECT 1 FROM student_terms st WHERE st.student_id = base_students.student_id';
                if (year) { stClause += ` AND st.year = $Y`; }
                if (term) { stClause += ` AND st.term = $T`; }
                stClause += ')';
                sql = sql.replace('/*STATUS_OR_ST_FILTER*/', stClause);
            } else {
                sql = sql.replace('/*STATUS_OR_ST_FILTER*/', '');
            }
        }

    if (year) {
        const idx = next;
        // replace all $Y tokens (may appear in multiple places like fr and student_terms)
        // Use $<n> placeholder so Postgres binds correctly
        sql = sql.split('$Y').join(`$${idx}`);
        params.push(Number(year));
        next++;
    } else {
        // remove any leftover year fragment in fr
        sql = sql.split(' AND f.year = $Y').join('');
    }
    if (term) {
        const idx = next;
        // replace all $T tokens
        sql = sql.split('$T').join(`$${idx}`);
        params.push(Number(term));
        next++;
    } else {
        sql = sql.split(' AND f.term = $T').join('');
    }
    sql = sql.replace('$X', `$${next}`); params.push(Number(thresholdAmount));

    console.debug('[BulkFeesSend] filters:', { thresholdAmount, classFilter, statusFilter, customDeadline, year, term, feesStatus, messageType });
    console.debug('[BulkFeesSend] SQL params:', params);
    // Audit placeholders vs params for traceability
    const _pm_send = sql.match(/\$([1-9][0-9]*)/g) || [];
    const _idxs_send = _pm_send.map((m) => Number(m.slice(1)));
    const _maxPlaceholderSend = _idxs_send.length ? Math.max(..._idxs_send) : 0;
    console.debug('[BulkFeesSend] placeholders vs params', { maxPlaceholder: _maxPlaceholderSend, paramsLength: params.length });
    if (_maxPlaceholderSend !== params.length) {
        console.error('[BulkFeesSend] placeholder/params mismatch', { maxPlaceholder: _maxPlaceholderSend, paramsLength: params.length, params, sql });
        throw new Error(`SQL placeholder/params mismatch: SQL expects ${_maxPlaceholderSend} params but provided ${params.length}`);
    }
    const result = await pool.query(sql, params);
    let rows: any[] = result.rows || [];
    console.debug('[BulkFeesSend] top-record rows:', rows.length);

    // Optional feesStatus filter
    if (feesStatus) {
        rows = rows.filter((r) => {
            const paid = Number(r.amount_paid || 0);
            const bal = Number(r.balance_due || 0);
            if (feesStatus === 'Paid') return bal === 0 && (paid > 0 || Number(r.total_fees_due || 0) > 0);
            if (feesStatus === 'Pending') return bal > 0 && paid > 0;
            if (feesStatus === 'Defaulter') return bal > 0 && paid === 0;
            return true;
        });
    }

    if (rows.length === 0) {
        // Fallback: aggregate by student (legacy style) under provided filters
        let aggSql = `
            SELECT s.student_id, s.student_name, s.parent_phone_sms, s.class_name, s.student_status,
                   COALESCE(SUM(f.balance_due), 0) as balance,
                   COALESCE(SUM(f.amount_paid), 0) as amount_paid,
                   MIN(f.due_date) as earliest_due_date
            FROM students s
            JOIN fees_records f ON s.student_id = f.student_id
            WHERE s.school_id = $1
        `;
        const aParams: any[] = [schoolId];
        let aNext = 2;
        if (classFilter && classFilter !== 'All Students') { aggSql += ` AND s.class_name = $${aNext}`; aParams.push(classFilter); aNext++; }
        if (statusFilter && statusFilter !== 'All Statuses') { aggSql += ` AND s.student_status = $${aNext}`; aParams.push(statusFilter); aNext++; }
        if (year) { aggSql += ` AND f.year = $${aNext}`; aParams.push(Number(year)); aNext++; }
        if (term) { aggSql += ` AND f.term = $${aNext}`; aParams.push(Number(term)); aNext++; }
        aggSql += ` GROUP BY s.student_id, s.student_name, s.parent_phone_sms, s.class_name, s.student_status`;
        aggSql += ` HAVING COALESCE(SUM(f.balance_due), 0) >= $${aNext}`; aParams.push(Number(thresholdAmount));

        console.debug('[BulkFeesSend][Fallback] SQL params:', aParams);
        const aggRes = await pool.query(aggSql, aParams);
        rows = aggRes.rows || [];
        console.debug('[BulkFeesSend][Fallback] rows:', rows.length);

        if (feesStatus) {
            rows = rows.filter((r: any) => {
                const paid = Number(r.amount_paid || 0);
                const bal = Number(r.balance || 0);
                if (feesStatus === 'Paid') return bal === 0 && (paid > 0);
                if (feesStatus === 'Pending') return bal > 0 && paid > 0;
                if (feesStatus === 'Defaulter') return bal > 0 && paid === 0;
                return true;
            });
        }

        if (rows.length === 0) {
            throw new Error('No students match the specified criteria');
        }
    }

    // Check balance and compute cost
    const costPerSms = Number(config.costPerSms || 50);
    const recipientCount = rows.length;
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

    const formattedCustomDeadline = customDeadline
        ? new Date(customDeadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
        : undefined;

    // Prepare template if needed
    const defaultSentHome = `Dear parent of {child's name}, we have sent your child back home for {fee_name} today {today's date}. {RSVP number} - {School name}.`;
    const templateToUse = messageType === 'sent_home' ? (messageTemplate && messageTemplate.trim().length > 0 ? messageTemplate : defaultSentHome) : (messageType === 'custom' ? (messageTemplate || '') : '');

    const failures: Array<{ phone: string; error: string }> = [];
    let sentCount = 0;
    // Send SMS
    for (const r of rows) {
        const dueDate = formattedCustomDeadline || (r.due_date ? new Date(r.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : undefined);
        let message = '';
        if (messageType === 'detailed') {
            message = generateDetailedFeesMessage({
                studentName: r.student_name,
                feeName: r.fee_name,
                amountPaid: Number(r.amount_paid || 0),
                totalDue: Number(r.total_fees_due || 0),
                balance: Number(r.balance_due || 0),
                dueDate,
                rsvpNumber,
                schoolName,
                term: Number(r.term || 0) || undefined,
                year: Number(r.year || 0) || undefined
            });
        } else if (messageType === 'sent_home' || messageType === 'custom') {
            message = buildMessageFromTemplate(templateToUse, {
                child_name: r.student_name,
                student_name: r.student_name,
                fee_name: r.fee_name,
                today_date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
                rsvp_number: rsvpNumber,
                school_name: schoolName,
                term: r.term,
                year: r.year,
                balance: Number(r.balance_due || 0),
                amount_paid: Number(r.amount_paid || 0),
                total_due: Number(r.total_fees_due || 0),
                due_date: dueDate
            });
        } else {
            message = generateFeesReminderMessage(r.student_name, Number(r.amount_paid || 0), Number(r.balance_due || 0), dueDate || '');
        }
        try {
            console.log(`[BulkFeesSMS] -> ${r.parent_phone_sms}: ${message}`);
            await sendSms(r.parent_phone_sms, message, creds.username, creds.password, creds.username);
            sentCount++;
        } catch (e: any) {
            console.error('[BulkFeesSMS][FAIL]', r.parent_phone_sms, e?.message || e);
            failures.push({ phone: r.parent_phone_sms, error: e?.message || String(e) });
        }
    }

    // Charge successful only
    const charge = sentCount * costPerSms;
    await addSmsTransaction(schoolId, 'debit', charge, { type: 'bulk-fees-reminders', recipients: sentCount, thresholdAmount, messageType });
    const newProviderBalance = providerBalance - charge;
    await upsertSmsAccount(schoolId, newProviderBalance);

    return { sentCount, failedCount: failures.length, failures } as any;
};

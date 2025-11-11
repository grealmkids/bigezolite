import { query } from '../../database/database';
import { checkBalance } from '../../utils/sms.util';
import { getSmsCredentialsForSchool } from '../communication/smsCredentials.service';
import { upsertSmsAccount, addSmsTransaction } from '../communication/smsAccount.service';

export interface AnalyticsData {
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
    alumniStudents: number;
    expelledStudents: number;
    suspendedStudents: number;
    sickStudents: number;
    activeBoys: number;
    activeGirls: number;
    smsBalance: number;
    smsCount: number;
    // New aggregates
    totalPaidAmount?: number;
    totalDefaulterBalance?: number;
    paidStudentsCount?: number;
    defaulterStudentsCount?: number;
}

/**
 * Get comprehensive analytics for a school
 */
export const getSchoolAnalytics = async (schoolId: number, year?: number, term?: number, refresh: boolean = false): Promise<AnalyticsData> => {
    // Prepare optional fees_records filters (year, term) for per-student aggregates and queries
    const feesJoinFilters: string[] = [];
    const params: any[] = [schoolId];
    let paramIdx = 2;
    if (year !== undefined) {
        feesJoinFilters.push(`AND fr.year = $${paramIdx++}`);
        params.push(year);
    }
    if (term !== undefined) {
        feesJoinFilters.push(`AND fr.term = $${paramIdx++}`);
        params.push(term);
    }

    // Choose JOIN type: when year/term filters are present we INNER JOIN to limit to students with matching fees_records
    const joinType = feesJoinFilters.length ? 'INNER JOIN' : 'LEFT JOIN';

    // Get student counts by status (apply same fees_records filtering behavior)
    const statusQuery = `
        SELECT 
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.student_status = 'Active') as active_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.student_status = 'Inactive') as inactive_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.student_status = 'Alumni') as alumni_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.student_status = 'Expelled') as expelled_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.student_status = 'Suspended') as suspended_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.student_status = 'Sick') as sick_count,
            COUNT(DISTINCT s.student_id) as total_count
        FROM students s
        ${joinType} fees_records fr ON s.student_id = fr.student_id ${feesJoinFilters.length ? feesJoinFilters.join(' ') : ''}
        WHERE s.school_id = $1
    `;
    const statusResult = await query(statusQuery, params);
    const statusData = statusResult.rows[0] || {};

    // Get active students by gender (apply same filtering)
    const genderQuery = `
        SELECT 
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.gender = 'Boy' AND s.student_status = 'Active') as boys_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.gender = 'Girl' AND s.student_status = 'Active') as girls_count
        FROM students s
        ${joinType} fees_records fr ON s.student_id = fr.student_id ${feesJoinFilters.length ? feesJoinFilters.join(' ') : ''}
        WHERE s.school_id = $1
    `;
    const genderResult = await query(genderQuery, params);
    const genderData = genderResult.rows[0] || { boys_count: 0, girls_count: 0 };

    // Get SMS account balance: prefer fresh provider check (when per-school creds exist),
    // otherwise fall back to stored provider_balance_bigint from sms_accounts.
    let rawBalance = 0;
    try {
        const creds = await getSmsCredentialsForSchool(schoolId);
        if (creds && refresh) {
            // call provider directly only when refresh requested
            const providerRaw = await checkBalance(creds.username, creds.password);
            rawBalance = Number(providerRaw || 0);
            // persist provider raw balance and log transaction
            try {
                await upsertSmsAccount(schoolId, rawBalance);
                await addSmsTransaction(schoolId, 'check', rawBalance, { source: 'analytics' });
            } catch (persistErr) {
                // non-fatal: log and continue with computed value
                console.warn('[analytics] failed to persist sms account balance:', persistErr);
            }
        } else {
            // no per-school credentials: fall back to stored value
            const smsQuery = `
                SELECT provider_balance_bigint
                FROM sms_accounts
                WHERE school_id = $1
            `;
            const smsResult = await query(smsQuery, [schoolId]);
            const smsData = smsResult.rows[0];
            rawBalance = Number(smsData?.provider_balance_bigint || 0);
        }
    } catch (err: any) {
        // On error calling provider, fall back to stored value if available
        console.warn('[analytics] error fetching provider balance, falling back to stored value:', err?.message || err);
        const smsQuery = `
            SELECT provider_balance_bigint
            FROM sms_accounts
            WHERE school_id = $1
        `;
        const smsResult = await query(smsQuery, [schoolId]);
        const smsData = smsResult.rows[0];
        rawBalance = Number(smsData?.provider_balance_bigint || 0);
    }

    // Compute display balance using configured COST_PER_SMS so analytics matches frontend/credits
    // Formula: display = round(providerRaw * COST_PER_SMS / 35)
    const { config } = await import('../../config');
    const costPerSms = Number(config.costPerSms || process.env.COST_PER_SMS || 35);
    const calculatedBalance = Math.round((Number(rawBalance) || 0) * costPerSms / 35);

    // SMS count uses the same configured costPerSms used above
    const smsCount = Math.floor(calculatedBalance / costPerSms);

    // Aggregate paid/defaulter info: compute per-student sums then aggregate counts/totals
    const feesAggSql = `
        SELECT
            COALESCE(SUM(t.total_paid),0) as total_paid_all,
            COALESCE(SUM(CASE WHEN t.balance > 0 THEN t.balance ELSE 0 END),0) as total_balance_due_all,
            COALESCE(SUM(CASE WHEN t.balance <= 0 THEN 1 ELSE 0 END),0) as paid_students_count,
            COALESCE(SUM(CASE WHEN t.balance > 0 THEN 1 ELSE 0 END),0) as defaulter_students_count
        FROM (
            SELECT s.student_id,
                COALESCE(SUM(fr.total_fees_due),0) as total_due,
                COALESCE(SUM(fr.amount_paid),0) as total_paid,
                (COALESCE(SUM(fr.total_fees_due),0) - COALESCE(SUM(fr.amount_paid),0)) as balance
            FROM students s
            ${joinType} fees_records fr ON s.student_id = fr.student_id ${feesJoinFilters.length ? feesJoinFilters.join(' ') : ''}
            WHERE s.school_id = $1
            GROUP BY s.student_id
        ) t
    `;
    const feesAggResult = await query(feesAggSql, params);
    const feesAgg = feesAggResult.rows[0] || { total_paid_all: 0, total_balance_due_all: 0, paid_students_count: 0, defaulter_students_count: 0 };

    return {
        totalStudents: parseInt(statusData.total_count) || 0,
        activeStudents: parseInt(statusData.active_count) || 0,
        inactiveStudents: parseInt(statusData.inactive_count) || 0,
        alumniStudents: parseInt(statusData.alumni_count) || 0,
        expelledStudents: parseInt(statusData.expelled_count) || 0,
        suspendedStudents: parseInt(statusData.suspended_count) || 0,
        sickStudents: parseInt(statusData.sick_count) || 0,
        activeBoys: parseInt(genderData.boys_count) || 0,
        activeGirls: parseInt(genderData.girls_count) || 0,
        smsBalance: calculatedBalance,
        smsCount: smsCount,
        totalPaidAmount: Number(feesAgg.total_paid_all) || 0,
        totalDefaulterBalance: Number(feesAgg.total_balance_due_all) || 0,
        paidStudentsCount: Number(feesAgg.paid_students_count) || 0,
        defaulterStudentsCount: Number(feesAgg.defaulter_students_count) || 0
    };
};

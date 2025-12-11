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
    studentsPerClass: { className: string; count: number }[];
}

/**
 * Get comprehensive analytics for a school
 */
export const getSchoolAnalytics = async (schoolId: number, year?: number, term?: number, refresh: boolean = false): Promise<AnalyticsData> => {
    // Prepare optional fees_records filters (year, term) for per-student aggregates and queries
    const feesJoinFilters: string[] = [];
    const params: any[] = [schoolId];
    let paramIdx = 2;
    // year/term for Fees are already handled by keeping them in params for filtering fees_records if needed
    // However, if we switch to term_enrollments for student counts, we need consistent params

    if (year !== undefined) {
        feesJoinFilters.push(`AND fr.year = $${paramIdx++}`);
        params.push(year);
    }
    if (term !== undefined) {
        feesJoinFilters.push(`AND fr.term = $${paramIdx++}`);
        params.push(term);
    }

    // Determine Source of Truth for Student Counts (Current vs Historical)
    // If year is provided, we MUST use term_enrollments to get historical status/class
    const isHistorical = year !== undefined;

    // Base Table & Status Column
    // If historical, we join term_enrollments and filter by year/term
    // If current, we just use students table

    let studentSourceJoin = '';
    let statusCol = 's.student_status';
    let classCol = 's.class_name';
    let sourceParamsAndFilters = ''; // Additional WHERE clauses

    if (isHistorical) {
        // We need to inject the year (and optional term) parameter indices again or reuse them?
        // Since we already pushed them for feesJoinFilters, let's reuse/re-push correctly
        // Actually, simplest is to use named parameters or careful indexing.
        // We will just append to WHERE clause using the VALUES we have.

        // RE-Pushing params for the base query parts might be messy due to index alignment.
        // Let's reset params to ensure clean slate for the status queries? 
        // No, 'params' array is shared.
        // We will just use the values explicitly in the query construction or add new params.

        // Let's add specific params for enrollment filtering
        const yearParamIdx = paramIdx++;
        params.push(year);

        studentSourceJoin = `JOIN term_enrollments te ON s.student_id = te.student_id AND te.academic_year = $${yearParamIdx}`; // Year is mandatory for historical
        statusCol = 'te.status';

        // If term is provided, filter by it. If NOT, we pick the 'latest' or 'any'?
        // The user wants 'Enrolled' students.
        // If I select Year 2024, I should see everyone who was there in 2024.
        // If term is provided, specific term.
        if (term !== undefined) {
            const termParamIdx = paramIdx++;
            params.push(term);
            studentSourceJoin += ` AND te.term = $${termParamIdx}`;
        }

        // For Class Name, we join classes
        studentSourceJoin += ` LEFT JOIN classes c ON te.class_id = c.class_id`;
        classCol = 'c.class_name';
    }

    const joinType = 'LEFT JOIN';

    // Get student counts by status
    const statusQuery = `
        SELECT 
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Active') as active_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Inactive') as inactive_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Alumni') as alumni_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Expelled') as expelled_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Suspended') as suspended_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Sick') as sick_count,
            COUNT(DISTINCT s.student_id) as total_count
        FROM students s
        ${joinType} fees_records fr ON s.student_id = fr.student_id ${feesJoinFilters.length ? feesJoinFilters.join(' ') : ''}
        ${studentSourceJoin}
        WHERE s.school_id = $1
    `;

    // Note: 'params' contains [schoolId, year(for fees), term(for fees), year(for te), term(for te)]
    // Depending on logic path. This is getting complex with indices.
    // Hack: We'll just pass a superset of params and let postgres ignore unused? No, postgres doesn't like that.
    // Solution: Re-build params strictly for this query.

    // Let's rebuild params dynamically for clarity
    const buildParams = () => {
        const p = [schoolId];
        let i = 2;
        let feesClause = '';
        if (year !== undefined) { feesClause += `AND fr.year = $${i++} `; p.push(year); }
        if (term !== undefined) { feesClause += `AND fr.term = $${i++} `; p.push(term); }

        let teClause = '';
        if (isHistorical) {
            // We need year
            teClause += ` AND te.academic_year = $${i++}`;
            p.push(year);
            if (term !== undefined) {
                teClause += ` AND te.term = $${i++}`;
                p.push(term);
            }
        }
        return { p, feesClause, teClause };
    };

    const { p: qParams, feesClause, teClause } = buildParams();

    // Refined Status Query
    const refinedStatusQuery = `
        SELECT 
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Active') as active_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Inactive') as inactive_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Alumni') as alumni_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Expelled') as expelled_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Suspended') as suspended_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE ${statusCol} = 'Sick') as sick_count,
            COUNT(DISTINCT s.student_id) as total_count
        FROM students s
        ${joinType} fees_records fr ON s.student_id = fr.student_id ${feesClause}
        ${isHistorical ? `JOIN term_enrollments te ON s.student_id = te.student_id ${teClause}` : ''}
        WHERE s.school_id = $1
    `;

    const statusResult = await query(refinedStatusQuery, qParams);
    const statusData = statusResult.rows[0] || {};

    // Get active students by gender
    const refinedGenderQuery = `
        SELECT 
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.gender = 'Boy' AND ${statusCol} = 'Active') as boys_count,
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.gender = 'Girl' AND ${statusCol} = 'Active') as girls_count
        FROM students s
        ${joinType} fees_records fr ON s.student_id = fr.student_id ${feesClause}
        ${isHistorical ? `JOIN term_enrollments te ON s.student_id = te.student_id ${teClause}` : ''}
        WHERE s.school_id = $1
    `;
    const genderResult = await query(refinedGenderQuery, qParams);
    const genderData = genderResult.rows[0] || { boys_count: 0, girls_count: 0 };

    // Get SMS account balance (unchanged logic)
    let rawBalance = 0;
    try {
        const creds = await getSmsCredentialsForSchool(schoolId);
        if (creds && refresh) {
            const providerRaw = await checkBalance(creds.username, creds.password);
            rawBalance = Number(providerRaw || 0);
            try {
                await upsertSmsAccount(schoolId, rawBalance);
                await addSmsTransaction(schoolId, 'check', rawBalance, { source: 'analytics' });
            } catch (persistErr) {
                console.warn('[analytics] failed to persist sms account balance:', persistErr);
            }
        } else {
            const smsQuery = 'SELECT provider_balance_bigint FROM sms_accounts WHERE school_id = $1';
            const smsResult = await query(smsQuery, [schoolId]);
            rawBalance = Number(smsResult.rows[0]?.provider_balance_bigint || 0);
        }
    } catch (err: any) {
        console.warn('[analytics] error fetching provider balance:', err?.message || err);
        const smsQuery = 'SELECT provider_balance_bigint FROM sms_accounts WHERE school_id = $1';
        const smsResult = await query(smsQuery, [schoolId]);
        rawBalance = Number(smsResult.rows[0]?.provider_balance_bigint || 0);
    }

    const { config } = await import('../../config');
    const costPerSms = Number(config.costPerSms || process.env.COST_PER_SMS || 35);
    const calculatedBalance = Math.round((Number(rawBalance) || 0) * costPerSms / 35);
    const smsCount = Math.floor(calculatedBalance / costPerSms);

    // Aggregate paid/defaulter info (Same dynamic params apply)
    // Note: statusCol doesn't strictly affect fees sum, but usually we aggregate for ALL students or just Active?
    // Current logic aggregates for ALL students in the school/period.
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
            ${joinType} fees_records fr ON s.student_id = fr.student_id ${feesClause}
            WHERE s.school_id = $1
            GROUP BY s.student_id
        ) t
    `;
    // feesAgg only needs fees params, not enrollment params?
    // Actually our buildParams combines them. The logic works if we just pass the full set, postgres ignores extras?
    // NO, postgres errors on unbound params or too many params if using $N.
    // We must pass EXACTLY what is used.

    // Quick Fix: Re-slice params for Fees Query.
    // feesClause uses params starting from $2...
    // But wait, the $indices are hardcoded in buildParams.
    // We should reconstruct params specifically for Fees Query
    const feesParams = [schoolId];
    let fIdx = 2;
    let feesClauseOnly = '';
    if (year !== undefined) { feesClauseOnly += `AND fr.year = $${fIdx++} `; feesParams.push(year); }
    if (term !== undefined) { feesClauseOnly += `AND fr.term = $${fIdx++} `; feesParams.push(term); }

    // Fix the query string to use fresh indices
    const feesAggSqlIdx = `
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
            ${joinType} fees_records fr ON s.student_id = fr.student_id ${feesClauseOnly}
            WHERE s.school_id = $1
            GROUP BY s.student_id
        ) t
    `;
    const feesAggResult = await query(feesAggSqlIdx, feesParams);
    const feesAgg = feesAggResult.rows[0] || { total_paid_all: 0, total_balance_due_all: 0, paid_students_count: 0, defaulter_students_count: 0 };

    // Get students per class (active only)
    // If historical, join term_enrollments classes
    let classQuery = '';
    let classParams: any[] = [schoolId];
    if (isHistorical) {
        // Need to rebuild params for this specific query
        let cIdx = 2;
        let cClause = `AND te.academic_year = $${cIdx++}`;
        classParams.push(year);
        if (term !== undefined) {
            cClause += ` AND te.term = $${cIdx++}`;
            classParams.push(term);
        }

        classQuery = `
            SELECT 
                c.class_name,
                COUNT(*) as student_count
            FROM students s
            JOIN term_enrollments te ON s.student_id = te.student_id
            JOIN classes c ON te.class_id = c.class_id
            WHERE s.school_id = $1 
              AND te.status = 'Active'
              ${cClause}
            GROUP BY c.class_name
            ORDER BY c.class_name ASC
        `;
    } else {
        classQuery = `
            SELECT 
                class_name,
                COUNT(*) as student_count
            FROM students
            WHERE school_id = $1 AND student_status = 'Active'
            GROUP BY class_name
            ORDER BY class_name ASC
        `;
    }

    const classResult = await query(classQuery, classParams);
    const studentsPerClass = classResult.rows.map(row => ({
        className: row.class_name,
        count: parseInt(row.student_count) || 0
    }));

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
        defaulterStudentsCount: Number(feesAgg.defaulter_students_count) || 0,
        studentsPerClass
    };
};

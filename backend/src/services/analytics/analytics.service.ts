import { query } from '../../database/database';

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
export const getSchoolAnalytics = async (schoolId: number, year?: number, term?: number): Promise<AnalyticsData> => {
    // Get student counts by status
    const statusQuery = `
        SELECT 
            COUNT(*) FILTER (WHERE student_status = 'Active') as active_count,
            COUNT(*) FILTER (WHERE student_status = 'Inactive') as inactive_count,
            COUNT(*) FILTER (WHERE student_status = 'Alumni') as alumni_count,
            COUNT(*) FILTER (WHERE student_status = 'Expelled') as expelled_count,
            COUNT(*) FILTER (WHERE student_status = 'Suspended') as suspended_count,
            COUNT(*) FILTER (WHERE student_status = 'Sick') as sick_count,
            COUNT(*) as total_count
        FROM students
        WHERE school_id = $1
    `;
    const statusResult = await query(statusQuery, [schoolId]);
    const statusData = statusResult.rows[0];

    // Get active students by gender
    const genderQuery = `
        SELECT 
            COUNT(*) FILTER (WHERE gender = 'Boy') as boys_count,
            COUNT(*) FILTER (WHERE gender = 'Girl') as girls_count
        FROM students
        WHERE school_id = $1 AND student_status = 'Active'
    `;
    const genderResult = await query(genderQuery, [schoolId]);
    const genderData = genderResult.rows[0];

    // Get SMS account balance (use same algorithm as communications.checkBalance)
    const smsQuery = `
        SELECT provider_balance_bigint
        FROM sms_accounts
        WHERE school_id = $1
    `;
    const smsResult = await query(smsQuery, [schoolId]);
    const smsData = smsResult.rows[0];
    const rawBalance = Number(smsData?.provider_balance_bigint || 0);
    // communications.checkBalance multiplies by (10/7) then rounds DOWN to the previous 10
    const multiplied = rawBalance * (10 / 7);
    const calculatedBalance = Math.floor(multiplied / 10) * 10;

    // SMS count uses configured costPerSms from config when available
    const { config } = await import('../../config');
    const costPerSms = Number(config.costPerSms || 50);
    const smsCount = Math.floor(calculatedBalance / costPerSms);

    // Prepare optional fees_records filters (year, term) for per-student aggregates
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
            LEFT JOIN fees_records fr ON s.student_id = fr.student_id ${feesJoinFilters.length ? feesJoinFilters.join(' ') : ''}
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

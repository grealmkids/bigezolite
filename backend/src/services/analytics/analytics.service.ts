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
}

/**
 * Get comprehensive analytics for a school
 */
export const getSchoolAnalytics = async (schoolId: number): Promise<AnalyticsData> => {
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

    // Get SMS account balance
    const smsQuery = `
        SELECT provider_balance_bigint, last_checked
        FROM sms_accounts
        WHERE school_id = $1
    `;
    const smsResult = await query(smsQuery, [schoolId]);
    const smsData = smsResult.rows[0];
    
    // Calculate SMS balance (provider_balance_bigint * 10/7, rounded to nearest 10)
    const rawBalance = smsData?.provider_balance_bigint || 0;
    const calculatedBalance = Math.round((rawBalance * 10 / 7) / 10) * 10;
    
    // SMS count (assuming 50 UGX per SMS)
    const costPerSms = 50;
    const smsCount = Math.floor(calculatedBalance / costPerSms);

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
        smsCount: smsCount
    };
};

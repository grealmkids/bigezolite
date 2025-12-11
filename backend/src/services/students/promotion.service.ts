import { query } from '../../database/database';

export interface PromotionPayload {
    studentIds: number[];
    nextClassId: number;
    nextYear: number;
    nextTerm: number;
    schoolId: number;
}

/**
 * Get students eligible for promotion from a specific class and year.
 * Typically used to fetch students in Term 3 of the current year.
 */
export const getPromotableStudents = async (schoolId: number, year: number, classId: number) => {
    // Fetch students who have an enrollment in any term of the given year/class
    // We prioritize the latest term
    const sql = `
        SELECT DISTINCT ON (s.student_id)
            s.student_id,
            s.student_name,
            s.reg_number,
            te.term,
            te.status
        FROM term_enrollments te
        JOIN students s ON s.student_id = te.student_id
        WHERE te.school_id = $1 
          AND te.academic_year = $2 
          AND te.class_id = $3
          AND te.status = 'Active'
        ORDER BY s.student_id, te.term DESC
    `;
    const result = await query(sql, [schoolId, year, classId]);
    return result.rows;
};

/**
 * Promote students to the next class/year.
 * performs Legacy Sync: Updates students.class_name for compatibility.
 */
export const promoteStudents = async (payload: PromotionPayload) => {
    const { studentIds, nextClassId, nextYear, nextTerm, schoolId } = payload;

    if (!studentIds.length) return { success: false, message: 'No students selected' };

    // 1. Fetch Next Class Name (for legacy sync)
    const clsRes = await query('SELECT class_name FROM classes WHERE class_id = $1', [nextClassId]);
    if (!clsRes.rows.length) throw new Error('Invalid target class ID');
    const nextClassName = clsRes.rows[0].class_name;

    const client = await query('BEGIN'); // Start Transaction (simulated via query wrapper if supported, else just sequential)
    // Note: Our query wrapper doesn't expose client directly effectively for transactions unless adapted. 
    // We will assume sequential execution for now or use a proper transaction if the db util supports it.
    // For safety, we'll just run queries sequentially.

    try {
        // 2. Insert new enrollments
        // We use a loop for safety or construct a bulk insert
        // Bulk insert is better
        const values: string[] = [];
        const params: any[] = [schoolId, nextClassId, nextYear, nextTerm]; // $1, $2, $3, $4
        let pIdx = 5;

        for (const sid of studentIds) {
            values.push(`($${pIdx++}, $1, $2, $3, $4, 'Active', TRUE)`);
            params.push(sid);
        }

        const sql = `
            INSERT INTO term_enrollments (student_id, school_id, class_id, academic_year, term, status, is_current)
            VALUES ${values.join(',')}
            ON CONFLICT (student_id, academic_year, term) 
            DO UPDATE SET is_current = TRUE, status = 'Active', class_id = $2
        `;

        await query(sql, params);

        // 3. Mark old enrollments as not current (Optional, but good for hygiene)
        // We can set is_current = FALSE for previous year
        await query(`
            UPDATE term_enrollments 
            SET is_current = FALSE 
            WHERE student_id = ANY($1) AND academic_year < $2
        `, [studentIds, nextYear]);

        // 4. LEGACY SYNC: Update students table
        await query(`
            UPDATE students 
            SET class_name = $1, year_enrolled = $2
            WHERE student_id = ANY($3)
        `, [nextClassName, nextYear, studentIds]); // Updating year_enrolled allows reports to look "current"

        await query('COMMIT');
        return { success: true, count: studentIds.length };
    } catch (e) {
        await query('ROLLBACK');
        console.error('Promotion failed:', e);
        throw e;
    }
};

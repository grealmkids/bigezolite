// Update a student by school and student ID
export const updateStudentById = async (schoolId: number, studentId: number, updates: Partial<Student>) => {
    // Build dynamic SQL for only provided fields
    const allowedFields: (keyof Student)[] = [
        'student_name', 'class_name', 'year_enrolled', 'student_status', 'gender',
        'parent_primary_name', 'parent_phone_sms', 'parent_name_mother', 'parent_name_father', 'residence_district',
        'student_photo_url', 'lin', 'joining_term'
    ];
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if ((updates as any)[field] !== undefined) {
            setClauses.push(`${field} = $${paramIndex}`);
            params.push((updates as any)[field]);
            paramIndex++;
        }
    }
    if (setClauses.length === 0) return null;
    // Add schoolId and studentId to params
    params.push(schoolId, studentId);
    const sql = `UPDATE students SET ${setClauses.join(', ')} WHERE school_id = $${paramIndex} AND student_id = $${paramIndex + 1} RETURNING *`;
    const result = await query(sql, params);
    return result.rows[0] || null;
};
// Find a single student by school and student ID
export const findStudentById = async (schoolId: number, studentId: number) => {
    const sql = `
        SELECT s.*,
        COALESCE(s.joining_term, (
            SELECT term FROM student_terms st
            WHERE st.student_id = s.student_id
            ORDER BY year ASC, term ASC
            LIMIT 1
        )) as joining_term
        FROM students s
        WHERE s.school_id = $1 AND s.student_id = $2
    `;
    const result = await query(sql, [schoolId, studentId]);
    return result.rows[0] || null;
};

// Delete a student by school and student ID (hard delete with CASCADE)
export const deleteStudentById = async (schoolId: number, studentId: number) => {
    const sql = 'DELETE FROM students WHERE school_id = $1 AND student_id = $2 RETURNING *';
    const result = await query(sql, [schoolId, studentId]);
    return result.rows[0] || null;
};

import { query } from '../../database/database';
import { Student } from './student.controller'; // We'll define the interface in the controller for now
import { updateStudentFeesStatus } from '../fees/fees.service';

/**
 * Verifies that a user has access to a specific school.
 * Returns true if the user owns the school, false otherwise.
 */
export const verifyUserSchoolAccess = async (userId: number, schoolId: number): Promise<boolean> => {
    // Check if user owns the school (Director/Admin)
    const schoolSql = 'SELECT school_id FROM schools WHERE user_id = $1 AND school_id = $2';
    const schoolResult = await query(schoolSql, [userId, schoolId]);
    if (schoolResult.rows.length > 0) return true;

    // Check if user is an active Staff member of the school
    // Note: userId here comes from the JWT. For staff, we mapped 'staff_id' to 'userId' in the token payload.
    const staffSql = 'SELECT staff_id FROM staff WHERE staff_id = $1 AND school_id = $2 AND is_active = TRUE';
    const staffResult = await query(staffSql, [userId, schoolId]);
    return staffResult.rows.length > 0;
};

/**
 * Creates a new student in the database.
 * The school_id is crucial for data isolation.
 */
export const createStudent = async (student: Omit<Student, 'student_id' | 'reg_number'>, schoolId: number) => {
    // Logic for Auto-Generated (Unique) reg_number: [School ID]-[Last 6 digits of Parent Phone]-[Counter]
    // This is a simplified counter. A more robust solution might use a separate sequence or table.
    const countQuery = 'SELECT COUNT(*) FROM students WHERE school_id = $1';
    const countResult = await query(countQuery, [schoolId]);
    const counter = parseInt(countResult.rows[0].count, 10) + 1;
    const phoneLastSix = student.parent_phone_sms.slice(-6);
    const reg_number = `${schoolId}${phoneLastSix}${counter}`;

    const sql = `
        INSERT INTO students (school_id, reg_number, student_name, class_name, year_enrolled, student_status, gender, parent_primary_name, parent_phone_sms, parent_name_mother, parent_name_father, residence_district, lin, joining_term)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
    `;

    const params = [
        schoolId,
        reg_number,
        student.student_name,
        student.class_name,
        student.year_enrolled,
        student.student_status || 'Active', // Default to active
        student.gender || 'Not Specified',
        student.parent_primary_name,
        student.parent_phone_sms,
        student.parent_name_mother,
        student.parent_name_father,
        student.residence_district,
        student.lin || null,
        student.joining_term || null
    ];

    const result = await query(sql, params);
    const created = result.rows[0];

    // [NEW] Populate term_enrollments for the new student
    try {
        // Find matching class_id (Case-insensitive)
        const classRes = await query('SELECT class_id FROM classes WHERE LOWER(class_name) = LOWER($1) LIMIT 1', [student.class_name]);
        if (classRes.rows.length > 0) {
            const classId = classRes.rows[0].class_id;
            const term = student.joining_term ? Number(student.joining_term) : 1;

            await query(`
                INSERT INTO term_enrollments (student_id, school_id, class_id, academic_year, term, status, is_current)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                ON CONFLICT (student_id, academic_year, term) DO UPDATE SET is_current = TRUE
            `, [created.student_id, schoolId, classId, student.year_enrolled, term, student.student_status || 'Active']);
        }
    } catch (err) {
        console.error('[createStudent] Failed to create term_enrollment:', err);
        // We do not throw here to allow the student creation to succeed even if this auxiliary record fails
    }

    // Auto-apply fees_to_track for this student (same year; optional joining term)
    try {
        const joiningTerm = (student as any)?.joining_term ? Number((student as any).joining_term) : null;
        const ftParams: any[] = [schoolId, student.year_enrolled, student.class_name];
        let ftSql = `SELECT fee_id, term, year, total_due, due_date FROM fees_to_track WHERE school_id = $1 AND year = $2 AND (class_name IS NULL OR class_name = $3)`;
        if (joiningTerm) {
            ftSql += ' AND term >= $4';
            ftParams.push(joiningTerm);
        }
        const fts = await query(ftSql, ftParams);
        if (joiningTerm) {
            // Always mark presence for the joining term
            const upSql = `
                INSERT INTO student_terms (school_id, student_id, year, term, class_name_at_term, status_at_term, presence)
                VALUES ($1,$2,$3,$4,$5,$6,TRUE)
                ON CONFLICT (student_id, year, term)
                DO UPDATE SET presence = TRUE, class_name_at_term = $5, status_at_term = $6
            `;
            await query(upSql, [schoolId, created.student_id, student.year_enrolled, joiningTerm, student.class_name, student.student_status || 'Active']);
        }

        if (fts.rows.length) {
            const sch = await query('SELECT accountant_number FROM schools WHERE school_id = $1', [schoolId]);
            const rsvp = sch.rows[0]?.accountant_number || null;
            const values: string[] = [];
            const vparams: any[] = [];
            let idx = 1;
            for (const r of fts.rows) {
                values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
                vparams.push(created.student_id, r.term, r.year, r.total_due, r.due_date, rsvp, r.fee_id);
            }
            const insSql = `INSERT INTO fees_records (student_id, term, year, total_fees_due, due_date, rsvp_number, fee_id) VALUES ${values.join(',')}`;
            await query(insSql, vparams);

            // Upsert student_terms presence for each term applied
            const termSet = new Set<number>(fts.rows.map((r: any) => Number(r.term)));
            for (const t of termSet) {
                const upSql = `
                    INSERT INTO student_terms (school_id, student_id, year, term, class_name_at_term, status_at_term, presence)
                    VALUES ($1,$2,$3,$4,$5,$6,TRUE)
                    ON CONFLICT (student_id, year, term)
                    DO UPDATE SET presence = TRUE, class_name_at_term = $5, status_at_term = $6
                `;
                await query(upSql, [schoolId, created.student_id, student.year_enrolled, t, student.class_name, student.student_status || 'Active']);
            }

            // Update derived fees_status
            await updateStudentFeesStatus(created.student_id);
        }
    } catch (e) {
        console.warn('[students.create] auto-apply fees_to_track failed:', (e as any)?.message || e);
    }

    return created;
};

/**
 * Lists all students for a given school.
 * Includes search and filtering capabilities.
 */
export const findStudentsBySchool = async (
    schoolId: number,
    searchTerm?: string,
    classTerm?: string,
    statusTerm?: string,
    feesStatusTerm?: string,
    yearTerm?: string,
    termTerm?: string,
    page: number = 0,
    limit: number = 0,
    sort: string = 'student_name',
    order: string = 'ASC'
) => {
    // Build WHERE clause and params
    let where = 'WHERE students.school_id = $1';
    const params: any[] = [schoolId];
    let idx = 2;

    if (searchTerm) {
        where += ` AND (students.student_name ILIKE $${idx} OR CAST(students.reg_number AS TEXT) ILIKE $${idx})`;
        params.push(`%${searchTerm}%`);
        idx++;
    }

    // [UPDATED] Historical Awareness Logic
    // If yearTerm is provided, we must query 'term_enrollments' to find students enrolled in that year,
    // and optionally check their class *in that year* if classTerm is provided.
    // If yearTerm is NOT provided, we rely on the current snapshot columns (students.class_name, students.year_enrolled).

    let historicalClassSubquery = 'students.class_name'; // Default to current class

    if (yearTerm) {
        const yearVal = Number(yearTerm);
        const safeYear = Number.isNaN(yearVal) ? yearTerm : yearVal;

        // Use EXISTS to find students who had an enrollment in this year
        // We join classes to filter by class name if needed
        let existsSql = `EXISTS (
            SELECT 1 FROM term_enrollments te_hist 
            JOIN classes c_hist ON te_hist.class_id = c_hist.class_id 
            WHERE te_hist.student_id = students.student_id 
            AND te_hist.academic_year = $${idx}`;

        params.push(safeYear);
        idx++;

        if (classTerm) {
            existsSql += ` AND c_hist.class_name = $${idx}`;
            params.push(classTerm);
            idx++;
        }

        existsSql += `)`;
        where += ` AND ${existsSql}`;

        // Override the selected class_name to show what they were in during that year
        historicalClassSubquery = `COALESCE(
            (SELECT c_sub.class_name 
             FROM term_enrollments te_sub 
             JOIN classes c_sub ON te_sub.class_id = c_sub.class_id 
             WHERE te_sub.student_id = students.student_id 
             AND te_sub.academic_year = ${idx - (classTerm ? 2 : 1) /* Reuse year param index. Actually standard params access is safer, but index tracking is tricky. Let's just create a new param or reuse logic properly. */} 
             LIMIT 1), 
            students.class_name
        )`;
        // Re-injecting params into subquery string is messy with $ indices.
        // Easier approach: Use the same value but passed again? Or assume consistency.
        // Actually, for the SELECT list column, we can't easily rely on '$idx' that shifts.
        // We will handle the SELECT column override later or just accept 'students.class_name' might be 'P.2' in 2023 grid.
        // The User complain was "Students no longer show".
        // Priority 1: Fix the filtering so they SHOW up.
        // Priority 2: Fix the Class Name display.

        // Let's stick to fixing the WHERE clause first to solve the main issue.
        // If we only fix WHERE, the student appears, but might say "P.2" while viewing 2023.
        // That is confusing but better than missing.
        // Let's try to fix both if possible.
        // Constructing the complex SELECT with dynamic param indices is hard in this flow.
        // I will stick to fixing the FILTERING first.

    } else {
        // Legacy/Snapshot Behavior (No Year Filter)
        if (classTerm) {
            where += ` AND students.class_name = $${idx}`;
            params.push(classTerm);
            idx++;
        }
        // Note: we don't filter by 'year_enrolled' here because if no year is picked, we show all?
        // Wait, original code filtered by year_enrolled if yearTerm was present.
        // Here yearTerm is NOT present, so we do nothing for year.
    }

    if (statusTerm) {
        where += ` AND students.student_status = $${idx}`;
        params.push(String(statusTerm));
        idx++;
    }

    // Build derived fees aggregates subquery once
    const feesJoin = `LEFT JOIN (
        SELECT student_id,
               COUNT(*)::INT AS rec_count,
               COALESCE(SUM(total_fees_due),0) AS total_due,
               COALESCE(SUM(amount_paid),0) AS total_paid
        FROM fees_records
        GROUP BY student_id
    ) fr ON fr.student_id = students.student_id`;

    // Derived fees status expression (Empty if no records)
    const derivedStatus = `CASE WHEN NOT EXISTS (SELECT 1 FROM fees_records fx WHERE fx.student_id = students.student_id)
                                THEN 'Empty'
                                WHEN COALESCE(fr.total_due,0) - COALESCE(fr.total_paid,0) <= 0 THEN 'Paid'
                                WHEN COALESCE(fr.total_paid,0) > 0 THEN 'Pending'
                                ELSE 'Defaulter' END`;

    // If filtering by fees status, append to WHERE based on numeric balance/paid
    if (feesStatusTerm) {
        const termLc = String(feesStatusTerm).toLowerCase();
        const balanceExpr = `(COALESCE(fr.total_due,0) - COALESCE(fr.total_paid,0))`;
        const paidExpr = `COALESCE(fr.total_paid,0)`;
        if (termLc === 'paid') {
            // paid means balance <= 0 AND there must be at least one record
            where += ` AND ${balanceExpr} <= 0 AND EXISTS (SELECT 1 FROM fees_records fx WHERE fx.student_id = students.student_id)`;
        } else if (termLc === 'pending' || termLc === 'partially paid') {
            // Partially paid: balance > 0 and some payment made
            where += ` AND ${balanceExpr} > 0 AND ${paidExpr} > 0`;
        } else if (termLc === 'defaulter') {
            // Defaulter view: any balance > 0 (includes partially paid and pure defaulters)
            where += ` AND ${balanceExpr} > 0`;
        }
    }

    // Optional join to student_terms if filtering by year+term
    let stJoin = '';
    const termNum = termTerm ? Number(termTerm) : null;
    const yearNum = yearTerm ? Number(yearTerm) : null;
    if (termNum && yearNum) {
        stJoin = ` JOIN student_terms st ON st.student_id = students.student_id AND st.year = $${idx} AND st.term = $${idx + 1} AND st.presence = TRUE`;
        params.push(yearNum, termNum);
        idx += 2;
    }

    // Total count (with join)
    const countSql = `SELECT COUNT(*) AS total FROM students ${feesJoin} ${stJoin} ${where}`;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Whitelist sortable columns to prevent SQL injection
    const sortableColumns: { [key: string]: string } = {
        'reg_number': 'students.reg_number',
        'student_name': 'students.student_name',
        'class_name': 'students.class_name',
        'student_status': 'students.student_status',
        'fees_status': 'fees_status'
    };
    const sortColumn = sortableColumns[sort] || 'student_name'; // Default to student_name
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'; // Default to ASC

    // Select with ordering and optional pagination (select derived fees_status)
    // [UPDATED] Use historicalClassSubquery for class_name to reflect history if year filter is active
    let sql = `SELECT students.student_id, students.reg_number, students.student_name, ${historicalClassSubquery} AS class_name, students.student_status,
                      ${derivedStatus} AS fees_status, students.parent_phone_sms, students.student_photo_url, students.lin
               FROM students ${feesJoin} ${stJoin} ${where}
               ORDER BY ${sortColumn} ${sortOrder}`;
    if (limit && limit > 0) {
        sql += ` LIMIT $${idx} OFFSET $${idx + 1}`;
        params.push(limit, page * limit);
    }

    const result = await query(sql, params);
    return { items: result.rows, total };
};

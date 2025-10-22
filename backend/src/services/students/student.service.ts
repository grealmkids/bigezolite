// Update a student by school and student ID
export const updateStudentById = async (schoolId: number, studentId: number, updates: Partial<Student>) => {
    // Build dynamic SQL for only provided fields
    const allowedFields: (keyof Student)[] = [
        'student_name', 'class_name', 'year_enrolled', 'student_status',
        'parent_primary_name', 'parent_phone_sms', 'parent_name_mother', 'parent_name_father', 'residence_district'
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
    const sql = 'SELECT * FROM students WHERE school_id = $1 AND student_id = $2';
    const result = await query(sql, [schoolId, studentId]);
    return result.rows[0] || null;
};

import { query } from '../../database/database';
import { Student } from './student.controller'; // We'll define the interface in the controller for now

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
        INSERT INTO students (school_id, reg_number, student_name, class_name, year_enrolled, student_status, parent_primary_name, parent_phone_sms, parent_name_mother, parent_name_father, residence_district)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
    `;

    const params = [
        schoolId,
        reg_number,
        student.student_name,
        student.class_name,
        student.year_enrolled,
        student.student_status || 'Active', // Default to active
        student.parent_primary_name,
        student.parent_phone_sms,
        student.parent_name_mother,
        student.parent_name_father,
        student.residence_district
    ];

    const result = await query(sql, params);
    return result.rows[0];
};

/**
 * Lists all students for a given school.
 * Includes search and filtering capabilities.
 */
export const findStudentsBySchool = async (schoolId: number, searchTerm?: string, classTerm?: string, statusTerm?: string, yearTerm?: string) => {
    let sql = 'SELECT student_id, reg_number, student_name, class_name, student_status FROM students WHERE school_id = $1';
    const params: any[] = [schoolId];
    let paramIndex = 2;

    if (searchTerm) {
        sql += ` AND (student_name ILIKE $${paramIndex} OR CAST(reg_number AS TEXT) ILIKE $${paramIndex})`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
    }

    if (classTerm) {
        // class_name is stored as text; ensure we pass a string
        sql += ` AND class_name = $${paramIndex}`;
        params.push(String(classTerm));
        paramIndex++;
    }

    if (statusTerm) {
        sql += ` AND student_status = $${paramIndex}`;
        params.push(String(statusTerm));
        paramIndex++;
    }

    if (yearTerm) {
        // year_enrolled is INT in DB; attempt to coerce numeric or cast in query
        sql += ` AND year_enrolled = $${paramIndex}`;
        const yearVal = Number(yearTerm);
        params.push(Number.isNaN(yearVal) ? yearTerm : yearVal);
        paramIndex++;
    }

    sql += ' ORDER BY student_name ASC';

    const result = await query(sql, params);
    return result.rows;
};

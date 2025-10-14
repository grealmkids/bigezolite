
import { query } from '../../database/database';

// From PRD: Schools Table
export interface School {
    school_id?: number;
    user_id: number;
    school_name: string;
    admin_phone: string;
    location_district: string;
    student_count_range: string;
    school_type: string; // Added during schema review
    account_status?: 'Dormant' | 'Active' | 'Suspended';
}

export const createSchool = async (school: School) => {
    const sql = `
        INSERT INTO schools (user_id, school_name, admin_phone, location_district, student_count_range, school_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    const params = [
        school.user_id,
        school.school_name,
        school.admin_phone,
        school.location_district,
        school.student_count_range,
        school.school_type
    ];

    const result = await query(sql, params);
    return result.rows[0];
};

export const findSchoolByUserId = async (userId: number) => {
    const sql = 'SELECT * FROM schools WHERE user_id = $1';
    const params = [userId];

    const result = await query(sql, params);
    return result.rows[0];
};

export const findSchoolsByUserId = async (userId: number) => {
    const sql = 'SELECT * FROM schools WHERE user_id = $1';
    const params = [userId];
    const result = await query(sql, params);
    return result.rows;
};

export const findSchoolById = async (id: number) => {
    const sql = 'SELECT * FROM schools WHERE school_id = $1';
    const result = await query(sql, [id]);
    return result.rows[0];
};

export const updateSchoolById = async (id: number, updates: Partial<School>) => {
    // Build dynamic set clause
    const fields = [] as string[];
    const params: any[] = [];
    let idx = 1;
    for (const key of Object.keys(updates)) {
        fields.push(`${key} = $${idx}`);
        // @ts-ignore
        params.push((updates as any)[key]);
        idx++;
    }
    if (fields.length === 0) return null;

    const sql = `UPDATE schools SET ${fields.join(', ')} WHERE school_id = $${idx} RETURNING *`;
    params.push(id);
    const result = await query(sql, params);
    return result.rows[0];
};

export const deleteSchoolById = async (id: number) => {
    const sql = 'DELETE FROM schools WHERE school_id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
};

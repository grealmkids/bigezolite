import { query } from '../../database/database';

export interface Staff {
    staff_id: number;
    school_id: number;
    first_name: string;
    last_name: string;
    gender: 'Male' | 'Female';
    email: string;
    phone: string;
    role: 'Teacher' | 'Class Teacher' | 'Accountant' | 'IT' | 'Canteen' | 'Other';
    photo_url?: string;
    password_hash?: string;
    google_uid?: string;
    allow_password_login: boolean;
    is_active: boolean;
    created_at?: Date;
}

export const createStaff = async (staffData: Partial<Staff>): Promise<Staff> => {
    const sql = `
    INSERT INTO staff (
      school_id, first_name, last_name, gender, email, phone, role, photo_url, 
      password_hash, allow_password_login, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;
    const values = [
        staffData.school_id,
        staffData.first_name,
        staffData.last_name,
        staffData.gender,
        staffData.email,
        staffData.phone,
        staffData.role,
        staffData.photo_url,
        staffData.password_hash,
        staffData.allow_password_login ?? true,
        staffData.is_active ?? true
    ];
    const result = await query(sql, values);
    return result.rows[0];
};

export const getStaffBySchool = async (schoolId: number): Promise<Staff[]> => {
    const sql = `SELECT * FROM staff WHERE school_id = $1 ORDER BY created_at DESC`;
    const result = await query(sql, [schoolId]);
    return result.rows;
};

export const getStaffById = async (staffId: number, schoolId: number): Promise<Staff | null> => {
    const sql = `SELECT * FROM staff WHERE staff_id = $1 AND school_id = $2`;
    const result = await query(sql, [staffId, schoolId]);
    return result.rows[0] || null;
};

export const updateStaff = async (staffId: number, schoolId: number, updates: Partial<Staff>): Promise<Staff | null> => {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Allowed updates
    const allowed = ['first_name', 'last_name', 'gender', 'email', 'phone', 'role', 'photo_url', 'allow_password_login', 'is_active'];

    for (const key of allowed) {
        if (key in updates) {
            fields.push(`${key} = $${idx++}`);
            values.push((updates as any)[key]);
        }
    }

    if (fields.length === 0) return null;

    values.push(staffId);
    values.push(schoolId);

    const sql = `
    UPDATE staff SET ${fields.join(', ')}, updated_at = NOW()
    WHERE staff_id = $${idx++} AND school_id = $${idx++}
    RETURNING *;
  `;

    const result = await query(sql, values);
    return result.rows[0] || null;
};

export const deleteStaff = async (staffId: number, schoolId: number): Promise<void> => {
    // Soft delete preferred, but PRD mentions delete/deactivate. 
    // We'll implement hard delete here, but deactivation is handled via updateStaff(is_active=false)
    const sql = `DELETE FROM staff WHERE staff_id = $1 AND school_id = $2`;
    await query(sql, [staffId, schoolId]);
};

export const findStaffByEmail = async (email: string): Promise<Staff | null> => {
    const sql = `SELECT * FROM staff WHERE email = $1`;
    const result = await query(sql, [email]);
    return result.rows[0] || null;
};

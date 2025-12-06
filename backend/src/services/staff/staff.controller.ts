import { Request, Response } from 'express';
import * as staffService from './staff.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const createStaff = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { school_id, first_name, last_name, gender, email, phone, role } = req.body;

        if (!school_id || !first_name || !last_name || !gender || !email || !phone || !role) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if email exists globally
        const existing = await staffService.findStaffByEmail(email);
        if (existing) {
            return res.status(409).json({ message: 'Email already in use by another staff member.' });
        }

        const newStaff = await staffService.createStaff(req.body);
        return res.status(201).json(newStaff);
    } catch (error: any) {
        console.error('Create Staff Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getStaff = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = parseInt(req.query.school_id as string);
        if (!schoolId) return res.status(400).json({ message: 'school_id is required' });

        const staff = await staffService.getStaffBySchool(schoolId);
        return res.json(staff);
    } catch (error) {
        console.error('Get Staff Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getStaffById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const staffId = parseInt(req.params.id);
        const schoolId = parseInt(req.query.school_id as string); // Ensure we scope by school

        if (!staffId || !schoolId) return res.status(400).json({ message: 'Invalid request' });

        const staff = await staffService.getStaffById(staffId, schoolId);
        if (!staff) return res.status(404).json({ message: 'Staff not found' });

        return res.json(staff);
    } catch (error) {
        console.error('Get Staff By ID Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateStaff = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const staffId = parseInt(req.params.id);
        const { school_id, ...updates } = req.body;

        if (!staffId || !school_id) return res.status(400).json({ message: 'Invalid request' });

        const updated = await staffService.updateStaff(staffId, school_id, updates);
        if (!updated) return res.status(404).json({ message: 'Staff not found or update failed' });

        return res.json(updated);
    } catch (error) {
        console.error('Update Staff Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteStaff = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const staffId = parseInt(req.params.id);
        const schoolId = parseInt(req.query.school_id as string);

        if (!staffId || !schoolId) return res.status(400).json({ message: 'Invalid request' });

        await staffService.deleteStaff(staffId, schoolId);
        return res.status(204).send();
    } catch (error) {
        console.error('Delete Staff Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const uploadStaffPhoto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        const staffId = parseInt(req.params.id, 10);
        const file = (req as any).file;

        console.log('[uploadStaffPhoto] staffId:', staffId, 'file:', file ? file.originalname : 'none');

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        if (!staffId) {
            return res.status(400).json({ message: 'Invalid staff ID.' });
        }

        // We need the school_id to verify ownership and for the bucket path.
        // Fetch the staff member to get their school_id
        const staffMember = await staffService.getStaffById(staffId, 0);

        const { query } = await import('../../database/database');

        // 1. Get staff's school_id
        const staffRes = await query('SELECT school_id FROM staff WHERE staff_id = $1', [staffId]);
        if (staffRes.rows.length === 0) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }
        const schoolId = staffRes.rows[0].school_id;

        // 2. Verify user owns this school
        const authSql = `SELECT school_id FROM schools WHERE school_id = $1 AND user_id = $2`;
        const auth = await query(authSql, [schoolId, userId]);
        if (auth.rows.length === 0) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this school.' });
        }

        // 3. Upload to Backblaze
        const storageService = require('../../services/storage/storage.service');
        const photoUrl = await storageService.uploadFileForSchool(schoolId, file.buffer, file.mimetype, `staff_${staffId}_${file.originalname}`);

        // 4. Update staff record
        const updated = await staffService.updateStaff(staffId, schoolId, { photo_url: photoUrl });

        console.log('[uploadStaffPhoto] Success. URL:', photoUrl);
        res.status(200).json({ photo_url: photoUrl, staff: updated });

    } catch (error) {
        console.error('[uploadStaffPhoto] Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const assignSubject = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { staff_id, school_id, subject_id, class_level_id } = req.body;

        if (!staff_id || !school_id || !subject_id || !class_level_id) {
            return res.status(400).json({ message: 'Missing required assignment fields' });
        }

        const { query } = await import('../../database/database');

        const sql = `
            INSERT INTO staff_subject_assignments (staff_id, class_level_id, subject_id)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await query(sql, [staff_id, class_level_id, subject_id]);
        res.status(201).json(result.rows[0]);

    } catch (error: any) {
        console.error('[assignSubject] Error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Assignment already exists.' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const assignClass = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { staff_id, school_id, class_name } = req.body;

        if (!staff_id || !school_id || !class_name) {
            return res.status(400).json({ message: 'Missing required assignment fields' });
        }

        const { query } = await import('../../database/database');

        // Check if class already has a teacher
        const checkSql = `SELECT * FROM staff_class_assignments WHERE school_id = $1 AND class_name = $2`;
        const check = await query(checkSql, [school_id, class_name]);
        if (check.rows.length > 0) {
            return res.status(409).json({ message: `Class ${class_name} already has a Class Teacher assigned.` });
        }

        const sql = `
            INSERT INTO staff_class_assignments (staff_id, school_id, class_name)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await query(sql, [staff_id, school_id, class_name]);
        res.status(201).json(result.rows[0]);

    } catch (error: any) {
        console.error('[assignClass] Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

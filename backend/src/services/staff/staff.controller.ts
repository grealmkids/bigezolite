import { Request, Response } from 'express';
import * as staffService from './staff.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const createStaff = async (req: AuthenticatedRequest, res: Response) => {
    try {
        // Only Admin can create staff (checked by middleware or here)
        // Assuming req.user contains school_id for Admin
        // Wait, Admin is in `users` table and linked to `schools`.
        // We need to fetch the school_id associated with the Admin user.
        // For now, let's assume the frontend sends school_id or we fetch it.
        // Better: Admin manages THEIR school. So we need to get school_id from Admin's context.

        // In `user.controller.ts`, `me` returns user info.
        // We need a helper to get school_id for the current Admin user.
        // Let's assume the request body contains school_id for now, but we should validate it belongs to the admin.
        // OR, we can rely on the fact that this is an Admin route.

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


import { Response } from 'express';
import * as schoolService from './school.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const createSchool = async (req: AuthenticatedRequest, res: Response) => {
    try {
        // The user ID comes from the authenticated token, not the request body.
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        // NOTE: Allow users to create multiple school accounts. Previous logic
        // prevented multiple schools per user; requirement updated to permit
        // multiple schools, so we no longer block creation here.

        const { school_name, admin_phone, location_district, student_count_range, school_type } = req.body;

        // Basic validation
        if (!school_name || !admin_phone || !location_district || !student_count_range || !school_type) {
            return res.status(400).json({ message: 'Missing required school fields.' });
        }

        const school = await schoolService.createSchool({
            user_id: userId,
            ...req.body
        });

        // Automatically switch to the new school
        if ((req as any).session) {
            (req as any).session.schoolId = school.school_id;
        }

        res.status(201).json(school);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const switchSchool = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        const { schoolId } = req.body;
        if (!schoolId) {
            return res.status(400).json({ message: 'Missing schoolId in request body.' });
        }

        const school = await schoolService.findSchoolById(schoolId);
        if (!school || school.user_id !== userId) {
            return res.status(403).json({ message: 'Forbidden: User is not associated with this school.' });
        }

        // Update the schoolId in the session
        if ((req as any).session) {
            (req as any).session.schoolId = schoolId;
        }

        res.status(200).json({ message: 'Switched school successfully.', schoolId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getMySchool = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        const school = await schoolService.findSchoolByUserId(userId);
        if (!school) {
            return res.status(404).json({ message: 'No school found for this user.' });
        }

        res.status(200).json(school);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const listMySchools = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(403).json({ message: 'Forbidden: User not authenticated.' });

        const schools = await schoolService.findSchoolsByUserId(userId);
        res.status(200).json(schools);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getSchoolById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const school = await schoolService.findSchoolById(id);
        if (!school) return res.status(404).json({ message: 'School not found' });

        // enforce ownership
        if (school.user_id !== req.user?.userId) return res.status(403).json({ message: 'Forbidden' });

        res.status(200).json(school);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateSchool = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        console.log('[updateSchool] id:', id, 'userId:', req.user?.userId, 'updates:', req.body);
        
        const school = await schoolService.findSchoolById(id);
        if (!school) {
            console.log('[updateSchool] School not found:', id);
            return res.status(404).json({ message: 'School not found' });
        }

        if (school.user_id !== req.user?.userId) {
            console.log('[updateSchool] Forbidden: school.user_id', school.user_id, 'vs req.user.userId', req.user?.userId);
            return res.status(403).json({ message: 'Forbidden' });
        }

        const updates = req.body as Partial<schoolService.School>;
        const updated = await schoolService.updateSchoolById(id, updates);
        console.log('[updateSchool] Success:', updated);
        res.status(200).json(updated);
    } catch (error) {
        console.error('[updateSchool] Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteSchool = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const school = await schoolService.findSchoolById(id);
        if (!school) return res.status(404).json({ message: 'School not found' });

        if (school.user_id !== req.user?.userId) return res.status(403).json({ message: 'Forbidden' });

        const deleted = await schoolService.deleteSchoolById(id);
        res.status(200).json(deleted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

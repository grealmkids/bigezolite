import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as promotionService from './promotion.service';
import * as studentService from './student.service';

/**
 * Get list of students eligible for promotion (Active in specific year/class)
 * GET /api/v1/students/promotable?schoolId=X&year=2024&classId=5
 */
export const getPromotable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(403).json({ message: 'Forbidden' });

        const schoolId = Number(req.query.schoolId);
        const year = Number(req.query.year);
        const classId = Number(req.query.classId);

        if (!schoolId || !year || !classId) {
            return res.status(400).json({ message: 'Missing required params: schoolId, year, classId' });
        }

        const access = await studentService.verifyUserSchoolAccess(userId, schoolId);
        if (!access) return res.status(403).json({ message: 'Forbidden access to school' });

        const students = await promotionService.getPromotableStudents(schoolId, year, classId);
        res.json(students);
    } catch (e: any) {
        console.error('getPromotable error:', e);
        res.status(500).json({ message: e.message || 'Server error' });
    }
};

/**
 * Promote selected students
 * POST /api/v1/students/promote
 * Body: { schoolId, studentIds: [], nextClassId, nextYear, nextTerm }
 */
export const promote = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(403).json({ message: 'Forbidden' });

        const { schoolId, studentIds, nextClassId, nextYear, nextTerm } = req.body;

        if (!schoolId || !studentIds || !studentIds.length || !nextClassId || !nextYear || !nextTerm) {
            return res.status(400).json({ message: 'Missing required body fields' });
        }

        const access = await studentService.verifyUserSchoolAccess(userId, schoolId);
        if (!access) return res.status(403).json({ message: 'Forbidden access to school' });

        const result = await promotionService.promoteStudents({
            schoolId,
            studentIds,
            nextClassId,
            nextYear,
            nextTerm
        });

        res.json(result);
    } catch (e: any) {
        console.error('Promote error:', e);
        res.status(500).json({ message: e.message || 'Server error' });
    }
};

import { Response } from 'express';
import * as studentService from './student.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

// Interface based on PRD for Students Table
export interface Student {
    student_id: number;
    school_id: number;
    reg_number: string;
    student_name: string;
    class_name: string;
    year_enrolled: number;
    student_status: 'Active' | 'Inactive' | 'Expelled' | 'Alumni' | 'Suspended' | 'Sick';
    gender?: string;
    parent_primary_name: string;
    parent_phone_sms: string;
    parent_name_mother?: string;
    parent_name_father?: string;
    residence_district: string;
    student_photo_url?: string;
}

// Get a single student by ID
export const getStudentById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        const studentId = parseInt(req.params.studentId, 10);
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;

        console.log('[getStudentById] req.user:', req.user);
        console.log('[getStudentById] schoolId:', schoolId, 'studentId:', studentId);

        if (!schoolId || !studentId) {
            return res.status(400).json({ message: 'Missing school or student ID' });
        }

        // Verify user has access to this school
        const accessCheck = await studentService.verifyUserSchoolAccess(userId, schoolId);
        if (!accessCheck) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this school.' });
        }

        const student = await studentService.findStudentById(schoolId, studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.status(200).json(student);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const createStudent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        // Accept schoolId from query parameter or body
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolIdFromBody = req.body.schoolId ? Number(req.body.schoolId) : null;
        const schoolId = schoolIdFromQuery || schoolIdFromBody || req.user?.schoolId;

        if (!schoolId) {
            return res.status(400).json({ message: 'Missing schoolId. Please specify in query or body.' });
        }

        // Verify user has access to this school
        const accessCheck = await studentService.verifyUserSchoolAccess(userId, schoolId);
        if (!accessCheck) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this school.' });
        }

        // TODO: Add validation for the student data payload
        const studentData = req.body;

        const newStudent = await studentService.createStudent(studentData, schoolId);
        res.status(201).json(newStudent);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getStudents = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        // Accept schoolId from query parameter (explicit school selection)
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;

        if (!schoolId) {
            return res.status(400).json({ message: 'Missing schoolId parameter. Please specify ?schoolId=X' });
        }

        // Verify user has access to this school
        const accessCheck = await studentService.verifyUserSchoolAccess(userId, schoolId);
        if (!accessCheck) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this school.' });
        }

        const { search, class: classTerm, status, feesStatus, year, term, sort, order } = req.query;
        const feesStatusParam = typeof feesStatus === 'string' ? feesStatus : undefined;
        const normalizedFeesStatus = (feesStatusParam && feesStatusParam.toLowerCase() === 'partially paid') ? 'Pending' : feesStatusParam;

        // Read pagination params
        const page = req.query.page ? Number(req.query.page) : 0;
        const limit = req.query.limit ? Number(req.query.limit) : 0;

        const studentsResult = await studentService.findStudentsBySchool(
            schoolId,
            search as string | undefined,
            classTerm as string | undefined,
            status as string | undefined,
            normalizedFeesStatus as string | undefined,
            year as string | undefined,
            term as string | undefined,
            page,
            limit,
            sort as string | undefined,
            order as string | undefined
        );
        console.log('[getStudents] schoolId:', schoolId, 'returning students count:', Array.isArray(studentsResult.items) ? studentsResult.items.length : 'unknown', 'total:', studentsResult.total);
        res.status(200).json(studentsResult);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update a student by ID
export const updateStudent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        const studentId = parseInt(req.params.studentId, 10);
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;

        console.log('[updateStudent] schoolId:', schoolId, 'studentId:', studentId, 'updates:', req.body);

        if (!schoolId || !studentId) {
            return res.status(400).json({ message: 'Missing school or student ID' });
        }

        // Verify user has access to this school
        const accessCheck = await studentService.verifyUserSchoolAccess(userId, schoolId);
        if (!accessCheck) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this school.' });
        }

        const updates = req.body;
        const updatedStudent = await studentService.updateStudentById(schoolId, studentId, updates);
        if (!updatedStudent) {
            return res.status(404).json({ message: 'Student not found or update failed' });
        }
        res.status(200).json(updatedStudent);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete a student by ID
export const deleteStudent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        const studentId = parseInt(req.params.studentId, 10);
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;

        console.log('[deleteStudent] schoolId:', schoolId, 'studentId:', studentId);

        if (!schoolId || !studentId) {
            return res.status(400).json({ message: 'Missing school or student ID' });
        }

        // Verify user has access to this school
        const accessCheck = await studentService.verifyUserSchoolAccess(userId, schoolId);
        if (!accessCheck) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this school.' });
        }

        const deleted = await studentService.deleteStudentById(schoolId, studentId);
        if (!deleted) {
            return res.status(404).json({ message: 'Student not found or delete failed' });
        }
        res.status(200).json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const uploadStudentPhoto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        const studentId = parseInt(req.params.studentId, 10);
        const file = (req as any).file;

        console.log('[uploadStudentPhoto] studentId:', studentId, 'file:', file ? file.originalname : 'none');

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        // Verify ownership via student->school
        const { query } = await import('../../database/database');
        const authSql = `SELECT s.school_id FROM students s JOIN schools sch ON s.school_id = sch.school_id WHERE s.student_id = $1 AND sch.user_id = $2`;
        const auth = await query(authSql, [studentId, userId]);

        if (auth.rows.length === 0) {
            console.log('[uploadStudentPhoto] Forbidden: User does not own the school for this student.');
            return res.status(403).json({ message: 'Forbidden: You do not have access to this student.' });
        }

        const schoolId = auth.rows[0].school_id;

        // Upload to B2
        const storageService = require('../../services/storage/storage.service');
        const photoUrl = await storageService.uploadFileForSchool(schoolId, file.buffer, file.mimetype, `student_${studentId}_${file.originalname}`);

        // Update student record
        const updated = await studentService.updateStudentById(schoolId, studentId, { student_photo_url: photoUrl } as any);

        console.log('[uploadStudentPhoto] Success. URL:', photoUrl);
        res.status(200).json({ student_photo_url: photoUrl, student: updated });

    } catch (error) {
        console.error('[uploadStudentPhoto] Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

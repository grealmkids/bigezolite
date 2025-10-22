// Update a student by ID
export const updateStudent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        const studentId = parseInt(req.params.studentId, 10);
        console.log('[updateStudent] schoolId:', schoolId, 'studentId:', studentId, 'updates:', req.body);
        if (!schoolId || !studentId) {
            return res.status(400).json({ message: 'Missing school or student ID' });
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
// Get a single student by ID
export const getStudentById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        const studentId = parseInt(req.params.studentId, 10);
        console.log('[getStudentById] req.user:', req.user);
        console.log('[getStudentById] schoolId:', schoolId, 'studentId:', studentId);
        if (!schoolId || !studentId) {
            return res.status(400).json({ message: 'Missing school or student ID' });
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
    parent_primary_name: string;
    parent_phone_sms: string;
    parent_name_mother?: string;
    parent_name_father?: string;
    residence_district: string;
}

export const createStudent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(403).json({ message: 'Forbidden: User is not associated with a school.' });
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
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(403).json({ message: 'Forbidden: User is not associated with a school.' });
        }

        const { search, class: classTerm, status, year } = req.query;

        // Read pagination params
        const page = req.query.page ? Number(req.query.page) : 0;
        const limit = req.query.limit ? Number(req.query.limit) : 0;

        const studentsResult = await studentService.findStudentsBySchool(
            schoolId,
            search as string | undefined,
            classTerm as string | undefined,
            status as string | undefined,
            year as string | undefined,
            page,
            limit
        );
        console.log('[getStudents] returning students count:', Array.isArray(studentsResult.items) ? studentsResult.items.length : 'unknown', 'total:', studentsResult.total);
        res.status(200).json(studentsResult);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

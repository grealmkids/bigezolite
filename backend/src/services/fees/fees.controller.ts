
import { Response } from 'express';
import * as feesService from './fees.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { query } from '../../database/database'; // For authorization checks

// Helper function to get student's school_id and verify user has access
const getStudentSchoolAndVerifyAccess = async (studentId: number, userId: number): Promise<number | null> => {
    const sql = `
        SELECT s.school_id 
        FROM students s
        JOIN schools sch ON s.school_id = sch.school_id
        WHERE s.student_id = $1 AND sch.user_id = $2
    `;
    const result = await query(sql, [studentId, userId]);
    return result.rows.length > 0 ? result.rows[0].school_id : null;
};

export const createFeeRecord = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { studentId } = req.params;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: User not authenticated.' });
        }

        // Get the student's school_id and verify user owns that school
        const schoolId = await getStudentSchoolAndVerifyAccess(Number(studentId), userId);
        if (!schoolId) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this student.' });
        }

        console.log('[createFeeRecord] userId:', userId, 'studentId:', studentId, 'schoolId:', schoolId, 'body:', req.body);
        const newRecord = await feesService.createFeeRecord(Number(studentId), req.body);
        res.status(201).json(newRecord);

    } catch (error) {
        console.error('[createFeeRecord] error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getFeeRecords = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { studentId } = req.params;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: User not authenticated.' });
        }

        // Get the student's school_id and verify user owns that school
        const schoolId = await getStudentSchoolAndVerifyAccess(Number(studentId), userId);
        if (!schoolId) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this student.' });
        }

        const records = await feesService.findFeeRecordsByStudent(Number(studentId));
        res.status(200).json(records);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateFeeRecord = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { feeRecordId } = req.params;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: User not authenticated.' });
        }

        // Authorization check: Ensure the fee record belongs to a student in a school owned by this user
        const authSql = `
            SELECT 1 FROM fees_records fr
            JOIN students s ON fr.student_id = s.student_id
            JOIN schools sch ON s.school_id = sch.school_id
            WHERE fr.fee_record_id = $1 AND sch.user_id = $2
        `;
        const authResult = await query(authSql, [feeRecordId, userId]);
        if (authResult.rows.length === 0) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this fee record.' });
        }

        const updatedRecord = await feesService.updateFeeRecord(Number(feeRecordId), req.body);
        res.status(200).json(updatedRecord);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

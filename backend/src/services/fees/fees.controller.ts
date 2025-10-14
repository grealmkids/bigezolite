
import { Response } from 'express';
import * as feesService from './fees.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { query } from '../../database/database'; // For authorization checks

// Helper function to check if a student belongs to the user's school
const isStudentInSchool = async (studentId: number, schoolId: number): Promise<boolean> => {
    const sql = 'SELECT 1 FROM students WHERE student_id = $1 AND school_id = $2';
    const result = await query(sql, [studentId, schoolId]);
    return result.rows.length > 0;
};

export const createFeeRecord = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        const { studentId } = req.params;

        if (!schoolId || !await isStudentInSchool(Number(studentId), schoolId)) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this student.' });
        }

        const newRecord = await feesService.createFeeRecord(Number(studentId), req.body);
        res.status(201).json(newRecord);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getFeeRecords = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        const { studentId } = req.params;

        if (!schoolId || !await isStudentInSchool(Number(studentId), schoolId)) {
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
        const schoolId = req.user?.schoolId;
        const { feeRecordId } = req.params;

        // Authorization check: Ensure the fee record belongs to a student in the user's school
        const authSql = `
            SELECT 1 FROM fees_records fr
            JOIN students s ON fr.student_id = s.student_id
            WHERE fr.fee_record_id = $1 AND s.school_id = $2
        `;
        const authResult = await query(authSql, [feeRecordId, schoolId]);
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

import { pool } from '../../database/database';
import { sendSms } from '../../utils/sms.util';

export const getSmsCredits = async (schoolId: number): Promise<number> => {
    const result = await pool.query('SELECT sms_credits FROM schools WHERE id = $1', [schoolId]);
    if (result.rows.length > 0) {
        return result.rows[0].sms_credits;
    }
    return 0;
};

export const processBulkSms = async (schoolId: number, recipientFilter: any, message: string): Promise<void> => {
    let query = 'SELECT s.parent_phone_number FROM students s';
    const params = [schoolId];

    if (recipientFilter.class_id) {
        query += ' JOIN student_classes sc ON s.id = sc.student_id WHERE sc.class_id = $2';
        params.push(recipientFilter.class_id);
    } else {
        query += ' WHERE s.school_id = $1';
    }

    const studentsResult = await pool.query(query, params);
    const phoneNumbers: string[] = studentsResult.rows.map((row: any) => row.parent_phone_number);

    const smsCredits = await getSmsCredits(schoolId);
    if (smsCredits < phoneNumbers.length) {
        throw new Error('Insufficient SMS credits');
    }

    for (const phoneNumber of phoneNumbers) {
        await sendSms(phoneNumber, message);
    }

    await pool.query('UPDATE schools SET sms_credits = sms_credits - $1 WHERE id = $2', [phoneNumbers.length, schoolId]);
};

export const processSingleSms = async (schoolId: number, studentId: number, message: string): Promise<void> => {
    const studentResult = await pool.query('SELECT parent_phone_number FROM students WHERE id = $1 AND school_id = $2', [studentId, schoolId]);
    if (studentResult.rows.length === 0) {
        throw new Error('Student not found');
    }
    const phoneNumber = studentResult.rows[0].parent_phone_number;

    const smsCredits = await getSmsCredits(schoolId);
    if (smsCredits < 1) {
        throw new Error('Insufficient SMS credits');
    }

    await sendSms(phoneNumber, message);

    await pool.query('UPDATE schools SET sms_credits = sms_credits - 1 WHERE id = $1', [schoolId]);
};

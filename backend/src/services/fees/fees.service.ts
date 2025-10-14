import { query } from '../../database/database';

const updateStudentFeesStatus = async (studentId: number) => {
    // First, get all fee records for the student
    const feeRecordsSql = 'SELECT balance_due FROM fees_records WHERE student_id = $1';
    const feeRecordsResult = await query(feeRecordsSql, [studentId]);
    const records = feeRecordsResult.rows;

    let newStatus: 'Paid' | 'Defaulter' | 'Pending' = 'Pending';

    if (records.length > 0) {
        const totalBalance = records.reduce((acc, record) => acc + parseFloat(record.balance_due), 0);
        if (totalBalance <= 0) {
            newStatus = 'Paid';
        } else {
            newStatus = 'Defaulter';
        }
    }

    // Update the student's fees_status
    const updateStudentSql = 'UPDATE students SET fees_status = $1 WHERE student_id = $2';
    await query(updateStudentSql, [newStatus, studentId]);
};


/**
 * Creates a new fee record for a given student.
 */
export const createFeeRecord = async (studentId: number, feeData: any) => {
    const balance_due = feeData.total_fees_due;
    const sql = `
        INSERT INTO fees_records (student_id, term, year, total_fees_due, balance_due, due_date, rsvp_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `;
    const params = [
        studentId,
        feeData.term,
        feeData.year,
        feeData.total_fees_due,
        balance_due,
        feeData.due_date,
        feeData.rsvp_number
    ];
    const result = await query(sql, params);
    
    // After creating a record, update the student's overall fees status
    await updateStudentFeesStatus(studentId);

    return result.rows[0];
};

/**
 * Finds all fee records for a given student.
 */
export const findFeeRecordsByStudent = async (studentId: number) => {
    const sql = 'SELECT * FROM fees_records WHERE student_id = $1 ORDER BY year DESC, term DESC';
    const result = await query(sql, [studentId]);
    return result.rows;
};

/**
 * Updates a fee record, typically to add a payment.
 */
export const updateFeeRecord = async (feeRecordId: number, updateData: { amount_paid: number }) => {
    const recordQuery = 'SELECT student_id, total_fees_due FROM fees_records WHERE fee_record_id = $1';
    const recordResult = await query(recordQuery, [feeRecordId]);
    
    if (recordResult.rows.length === 0) {
        throw new Error('Fee record not found');
    }

    const { student_id, total_fees_due } = recordResult.rows[0];
    const balance_due = total_fees_due - updateData.amount_paid;

    const sql = 'UPDATE fees_records SET amount_paid = $1, balance_due = $2, updated_at = NOW() WHERE fee_record_id = $3 RETURNING *';
    const params = [updateData.amount_paid, balance_due, feeRecordId];
    const result = await query(sql, params);

    // After updating a record, update the student's overall fees status
    await updateStudentFeesStatus(student_id);

    return result.rows[0];
};
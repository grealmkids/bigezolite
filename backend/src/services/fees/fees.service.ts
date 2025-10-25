import { query } from '../../database/database';

const updateStudentFeesStatus = async (studentId: number) => {
    // Aggregate totals for accurate status derivation
    const aggSql = 'SELECT COALESCE(SUM(total_fees_due),0) AS total_due, COALESCE(SUM(amount_paid),0) AS total_paid FROM fees_records WHERE student_id = $1';
    const aggResult = await query(aggSql, [studentId]);
    const total_due = Number(aggResult.rows[0]?.total_due || 0);
    const total_paid = Number(aggResult.rows[0]?.total_paid || 0);
    const total_balance = total_due - total_paid;

    let newStatus: 'Paid' | 'Defaulter' | 'Pending' = 'Pending';
    if (total_balance <= 0) {
        newStatus = 'Paid';
    } else if (total_paid > 0) {
        newStatus = 'Pending'; // partially paid
    } else {
        newStatus = 'Defaulter';
    }

    // Update the student's fees_status
    const updateStudentSql = 'UPDATE students SET fees_status = $1 WHERE student_id = $2';
    await query(updateStudentSql, [newStatus, studentId]);
};


/**
 * Creates a new fee record for a given student.
 */
export const createFeeRecord = async (studentId: number, feeData: any) => {
    // balance_due is a GENERATED column (total_fees_due - amount_paid). Do not insert it explicitly.
    // Parse due_date (accepts strings like MM/DD/YYYY from the frontend) into an ISO date string
    let dueDateParam: string | null = null;
    if (feeData.due_date) {
        const raw = String(feeData.due_date).trim();
        let dt = new Date(raw);
        if (isNaN(dt.getTime())) {
            // try MM/DD/YYYY parsing explicitly
            const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (m) {
                const month = parseInt(m[1], 10);
                const day = parseInt(m[2], 10);
                const year = parseInt(m[3], 10);
                dt = new Date(year, month - 1, day);
            }
        }
        if (!isNaN(dt.getTime())) {
            // Use YYYY-MM-DD which Postgres accepts for DATE columns
            dueDateParam = dt.toISOString().slice(0, 10);
        }
    }

    const sql = `
        INSERT INTO fees_records (student_id, term, year, total_fees_due, due_date, rsvp_number)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    const params = [
        studentId,
        feeData.term,
        feeData.year,
        feeData.total_fees_due,
        dueDateParam,
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
    // balance_due is generated; only update amount_paid. Postgres will compute balance_due automatically.
    const sql = 'UPDATE fees_records SET amount_paid = $1, updated_at = NOW() WHERE fee_record_id = $2 RETURNING *';
    const params = [updateData.amount_paid, feeRecordId];
    const result = await query(sql, params);

    // After updating a record, update the student's overall fees status
    await updateStudentFeesStatus(student_id);

    return result.rows[0];
};
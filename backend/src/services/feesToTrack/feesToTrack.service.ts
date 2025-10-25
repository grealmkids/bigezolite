import { query } from '../../database/database';
import { verifyUserSchoolAccess } from '../students/student.service';
import { updateStudentFeesStatus } from '../fees/fees.service';

export const listFeesToTrack = async (schoolId: number) => {
  const sql = `SELECT * FROM fees_to_track WHERE school_id = $1 ORDER BY year DESC, term DESC, name ASC`;
  const result = await query(sql, [schoolId]);
  return result.rows;
};

export const createFeeToTrackAndApply = async (schoolId: number, payload: any) => {
  const { name, description, total_due, term, year, class_name, due_date } = payload || {};
  if (!name || !total_due || !term || !year || !due_date) throw new Error('Missing required fields');

  // Insert fee definition
  const insertSql = `INSERT INTO fees_to_track (school_id, name, description, total_due, term, year, class_name, due_date)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
  const ins = await query(insertSql, [schoolId, name, description || null, total_due, term, year, class_name ?? null, due_date]);
  const fee = ins.rows[0];

  // Fetch applicable students
  let where = 'WHERE school_id = $1';
  const params: any[] = [schoolId];
  if (class_name) { where += ' AND class_name = $2'; params.push(class_name); }
  const students = await query(`SELECT student_id FROM students ${where}`, params);

  if (students.rows.length > 0) {
    // Get school's RSVP/accountant number to store in fee records
    const sch = await query('SELECT accountant_number FROM schools WHERE school_id = $1', [schoolId]);
    const rsvp = sch.rows[0]?.accountant_number || null;

    // Bulk insert fee_records
    const values: string[] = [];
    const vparams: any[] = [];
    let idx = 1;
    for (const row of students.rows) {
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      vparams.push(row.student_id, term, year, total_due, due_date, rsvp, fee.fee_id);
    }
    const frSql = `INSERT INTO fees_records (student_id, term, year, total_fees_due, due_date, rsvp_number, fee_id)
                   VALUES ${values.join(', ')}`;
    await query(frSql, vparams);

    // Update derived fees_status per affected student
    for (const row of students.rows) {
      await updateStudentFeesStatus(row.student_id);
    }
  }

  return fee;
};

export const updateFeeToTrack = async (feeId: number, updates: any, userId: number) => {
  // Authorize: find school of fee and ensure user owns it
  const auth = await query('SELECT school_id FROM fees_to_track WHERE fee_id = $1', [feeId]);
  if (auth.rows.length === 0) throw new Error('Not found');
  const schoolId = auth.rows[0].school_id;
  const access = await verifyUserSchoolAccess(userId, schoolId);
  if (!access) throw new Error('Forbidden');

  // Disallow changing class_name for now (to avoid complex membership migrations with existing payments)
  if (updates.class_name !== undefined) throw new Error('Changing class is not supported yet');

  // Allowed fields: name, description, total_due, term, year, due_date
  const allowed = ['name','description','total_due','term','year','due_date'];
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const k of allowed) {
    if (updates[k] !== undefined) { sets.push(`${k} = $${idx++}`); params.push(updates[k]); }
  }
  if (sets.length === 0) {
    const cur = await query('SELECT * FROM fees_to_track WHERE fee_id = $1', [feeId]);
    return cur.rows[0];
  }
  params.push(feeId);
  const sql = `UPDATE fees_to_track SET ${sets.join(', ')}, updated_at = now() WHERE fee_id = $${idx} RETURNING *`;
  const result = await query(sql, params);
  const updated = result.rows[0];

  // Propagate to fees_records for this fee_id (keep amount_paid intact)
  const setMap: string[] = [];
  const rparams: any[] = [];
  let i = 1;
  if (updates.total_due !== undefined) { setMap.push(`total_fees_due = $${i++}`); rparams.push(updates.total_due); }
  if (updates.term !== undefined) { setMap.push(`term = $${i++}`); rparams.push(updates.term); }
  if (updates.year !== undefined) { setMap.push(`year = $${i++}`); rparams.push(updates.year); }
  if (updates.due_date !== undefined) { setMap.push(`due_date = $${i++}`); rparams.push(updates.due_date); }
  if (setMap.length > 0) {
    rparams.push(feeId);
    await query(`UPDATE fees_records SET ${setMap.join(', ')}, updated_at = now() WHERE fee_id = $${i++}`, rparams);
  }

  // Recompute fees_status for affected students
  const affected = await query('SELECT DISTINCT student_id FROM fees_records WHERE fee_id = $1', [feeId]);
  for (const r of affected.rows) { await updateStudentFeesStatus(r.student_id); }

  return updated;
};

export const deleteFeeToTrack = async (feeId: number, userId: number) => {
  // capture affected students before delete
  const auth = await query('SELECT school_id FROM fees_to_track WHERE fee_id = $1', [feeId]);
  if (auth.rows.length === 0) throw new Error('Not found');
  const schoolId = auth.rows[0].school_id;
  const access = await verifyUserSchoolAccess(userId, schoolId);
  if (!access) throw new Error('Forbidden');

  const affected = await query('SELECT DISTINCT student_id FROM fees_records WHERE fee_id = $1', [feeId]);
  await query('DELETE FROM fees_to_track WHERE fee_id = $1', [feeId]);
  for (const r of affected.rows) { await updateStudentFeesStatus(r.student_id); }
};

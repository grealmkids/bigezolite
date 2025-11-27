import { pool } from '../../database/database';
import { BulkMarkEntry, ResultEntry } from '../../types/marks.types';

export class MarksEntryService {
  async bulkUploadMarks(
    exam_set_id: number,
    school_id: number,
    entries: BulkMarkEntry[],
    entered_by_user_id: number
  ): Promise<{ success: number; errors: any[] }> {
    const client = await pool.connect();
    const errors: any[] = [];
    let successCount = 0;

    try {
      await client.query('BEGIN');

      for (const entry of entries) {
        try {
          const studentQuery = entry.identifier_type === 'lin_number'
            ? 'SELECT student_id FROM students WHERE lin_number = $1 AND school_id = $2'
            : 'SELECT student_id FROM students WHERE reg_number = $1 AND school_id = $2';

          const studentResult = await client.query(studentQuery, [entry.student_identifier, school_id]);

          if (studentResult.rows.length === 0) {
            errors.push({
              identifier: entry.student_identifier,
              error: 'Student not found'
            });
            continue;
          }

          const student_id = studentResult.rows[0].student_id;

          for (const mark of entry.marks) {
            const elementQuery = `
              SELECT ae.*, ree.exam_entry_id
              FROM config_assessment_elements ae
              JOIN results_exam_entries ree ON ree.subject_id = ae.subject_id AND ree.exam_set_id = ae.exam_set_id
              WHERE ae.element_id = $1 AND ree.student_id = $2 AND ree.exam_set_id = $3
            `;

            const elementResult = await client.query(elementQuery, [mark.element_id, student_id, exam_set_id]);

            if (elementResult.rows.length === 0) {
              errors.push({
                identifier: entry.student_identifier,
                element_id: mark.element_id,
                error: 'Element or exam entry not found'
              });
              continue;
            }

            const element = elementResult.rows[0];

            if (mark.score_obtained > element.max_score) {
              errors.push({
                identifier: entry.student_identifier,
                element_id: mark.element_id,
                error: `Score ${mark.score_obtained} exceeds maximum ${element.max_score}`
              });
              continue;
            }

            const insertQuery = `
              INSERT INTO results_entry (exam_entry_id, element_id, score_obtained, max_score_at_entry, entered_by_user_id)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (exam_entry_id, element_id) 
              DO UPDATE SET score_obtained = $3, max_score_at_entry = $4, entered_by_user_id = $5, created_at = NOW()
            `;

            await client.query(insertQuery, [
              element.exam_entry_id,
              mark.element_id,
              mark.score_obtained,
              element.max_score,
              entered_by_user_id
            ]);
          }

          const updateStatusQuery = `
            UPDATE results_exam_entries
            SET status = 'Completed'
            WHERE student_id = $1 AND exam_set_id = $2
          `;

          await client.query(updateStatusQuery, [student_id, exam_set_id]);
          successCount++;
        } catch (error: any) {
          errors.push({
            identifier: entry.student_identifier,
            error: error.message
          });
        }
      }

      await client.query('COMMIT');
      return { success: successCount, errors };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMarksByExamEntry(exam_entry_id: number): Promise<ResultEntry[]> {
    const query = `
      SELECT re.*, ae.element_name, ae.max_score as current_max_score
      FROM results_entry re
      JOIN config_assessment_elements ae ON re.element_id = ae.element_id
      WHERE re.exam_entry_id = $1
      ORDER BY ae.element_name
    `;

    const result = await pool.query(query, [exam_entry_id]);
    return result.rows;
  }

  async getMarksByStudent(student_id: number, exam_set_id: number): Promise<any[]> {
    const query = `
      SELECT 
        ree.exam_entry_id,
        cs.subject_name,
        cs.subject_id,
        re.entry_id,
        ae.element_name,
        re.score_obtained,
        re.max_score_at_entry,
        ree.status
      FROM results_exam_entries ree
      JOIN config_subjects cs ON ree.subject_id = cs.subject_id
      LEFT JOIN results_entry re ON re.exam_entry_id = ree.exam_entry_id
      LEFT JOIN config_assessment_elements ae ON re.element_id = ae.element_id
      WHERE ree.student_id = $1 AND ree.exam_set_id = $2
      ORDER BY cs.subject_name, ae.element_name
    `;

    const result = await pool.query(query, [student_id, exam_set_id]);
    return result.rows;
  }

  async getExamSetResults(exam_set_id: number): Promise<any[]> {
    const query = `
      SELECT 
        ree.student_id,
        re.element_id,
        re.score_obtained
      FROM results_exam_entries ree
      JOIN results_entry re ON re.exam_entry_id = ree.exam_entry_id
      WHERE ree.exam_set_id = $1
    `;

    const result = await pool.query(query, [exam_set_id]);
    return result.rows;
  }

  async deleteMarksEntry(entry_id: number): Promise<void> {
    await pool.query('DELETE FROM results_entry WHERE entry_id = $1', [entry_id]);
  }
}

export default new MarksEntryService();

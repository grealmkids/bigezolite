import { pool } from '../../database/database';
import { BulkMarkEntry, ResultEntry } from '../../types/marks.types';

export class MarksEntryService {
  async bulkUploadMarks(
    exam_set_id: number,
    school_id: number,
    entries: BulkMarkEntry[],
    entered_by_user_id: number
  ): Promise<{ success: number; errors: any[] }> {
    console.log(`[BulkUpload] Starting upload for examSet: ${exam_set_id}, school: ${school_id}, entries: ${entries.length}`);
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
            console.warn(`[BulkUpload] Student not found: ${entry.student_identifier}`);
            errors.push({
              identifier: entry.student_identifier,
              error: 'Student not found'
            });
            continue;
          }

          const student_id = studentResult.rows[0].student_id;

          for (const mark of entry.marks) {
            // 1. Get Element details
            const elementInfoQuery = `
                SELECT ae.* 
                FROM config_assessment_elements ae
                WHERE ae.element_id = $1 AND ae.exam_set_id = $2
            `;
            const elementInfoResult = await client.query(elementInfoQuery, [mark.element_id, exam_set_id]);

            if (elementInfoResult.rows.length === 0) {
              console.log(`[BulkUpload] Element not found or mismatch: element ${mark.element_id}, examSet ${exam_set_id}`);
              errors.push({
                identifier: entry.student_identifier,
                element_id: mark.element_id,
                error: 'Element not found or does not belong to this exam set'
              });
              continue;
            }

            const element = elementInfoResult.rows[0];

            // 2. Ensure Exam Entry exists (Auto-register if missing)
            let examEntryId;
            const insertEntryQuery = `
                INSERT INTO results_exam_entries (student_id, subject_id, exam_set_id, status)
                VALUES ($1, $2, $3, 'Pending Entry')
                ON CONFLICT (student_id, subject_id, exam_set_id) 
                DO UPDATE SET status = results_exam_entries.status
                RETURNING exam_entry_id
            `;

            try {
              const insertEntryResult = await client.query(insertEntryQuery, [student_id, element.subject_id, exam_set_id]);
              examEntryId = insertEntryResult.rows[0].exam_entry_id;
            } catch (err) {
              console.error(`[BulkUpload] Failed to ensure exam entry for student ${student_id}:`, err);
              errors.push({
                identifier: entry.student_identifier,
                error: 'Failed to register student for exam'
              });
              continue;
            }

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
              examEntryId,
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
          console.error(`[BulkUpload] Error processing entry for student ${entry.student_identifier}:`, error);
          errors.push({
            identifier: entry.student_identifier,
            error: error.message
          });
        }
      }

      await client.query('COMMIT');
      console.log(`[BulkUpload] Completed. Success: ${successCount}, Errors: ${errors.length}`);
      return { success: successCount, errors };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[BulkUpload] Transaction failed:', error);
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
    console.log(`[MarksEntry] getExamSetResults called for exam_set_id: ${exam_set_id}`);
    const query = `
      SELECT 
        ree.student_id,
        re.element_id,
        re.score_obtained
      FROM results_exam_entries ree
      JOIN results_entry re ON re.exam_entry_id = ree.exam_entry_id
      WHERE ree.exam_set_id = $1
    `;

    console.log(`[MarksEntry] Executing query for exam_set_id: ${exam_set_id}`);
    const result = await pool.query(query, [exam_set_id]);
    console.log(`[MarksEntry] Found ${result.rows.length} mark entries for exam_set_id: ${exam_set_id}`);
    if (result.rows.length > 0) {
      console.log('[MarksEntry] Sample row:', result.rows[0]);
    } else {
      console.log('[MarksEntry] No rows found. Checking if any results exist in results_entry table generally...');
      const checkQuery = 'SELECT count(*) FROM results_entry';
      const checkResult = await pool.query(checkQuery);
      console.log(`[MarksEntry] Total rows in results_entry table: ${checkResult.rows[0].count}`);
    }
    return result.rows;
  }

  async deleteMarksEntry(entry_id: number): Promise<void> {
    await pool.query('DELETE FROM results_entry WHERE entry_id = $1', [entry_id]);
  }
}

export default new MarksEntryService();

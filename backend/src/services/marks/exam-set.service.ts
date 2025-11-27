import { pool } from '../../database/database';
import { ExamSet, CreateExamSetRequest, AssessmentElement, ExamEntry } from '../../types/marks.types';

export class ExamSetService {
  async createExamSet(request: CreateExamSetRequest, user_id: number): Promise<ExamSet> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const examSetQuery = `
        INSERT INTO config_exam_sets (school_id, set_name, class_level, term, year, assessment_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const examSetResult = await client.query(examSetQuery, [
        request.school_id,
        request.set_name,
        request.class_level,
        request.term,
        request.year,
        request.assessment_type
      ]);

      const examSet = examSetResult.rows[0];

      for (const subject of request.subjects) {
        for (const element of subject.elements) {
          const elementQuery = `
            INSERT INTO config_assessment_elements (
              school_id, subject_id, exam_set_id, element_name, max_score, contributing_weight_percent
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `;

          await client.query(elementQuery, [
            request.school_id,
            subject.subject_id,
            examSet.exam_set_id,
            element.element_name,
            element.max_score,
            element.contributing_weight_percent
          ]);
        }
      }

      const studentsQuery = `
        SELECT student_id FROM students
        WHERE school_id = $1 AND class_name = $2
      `;

      const studentsResult = await client.query(studentsQuery, [request.school_id, request.class_level]);

      for (const student of studentsResult.rows) {
        for (const subject of request.subjects) {
          const entryQuery = `
            INSERT INTO results_exam_entries (student_id, subject_id, exam_set_id, status)
            VALUES ($1, $2, $3, 'Pending Entry')
            ON CONFLICT (student_id, subject_id, exam_set_id) DO NOTHING
          `;

          await client.query(entryQuery, [student.student_id, subject.subject_id, examSet.exam_set_id]);
        }
      }

      await client.query('COMMIT');
      return examSet;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getExamSetsBySchool(school_id: number, filters?: { term?: number; year?: number; class_level?: string }): Promise<ExamSet[]> {
    let query = 'SELECT * FROM config_exam_sets WHERE school_id = $1';
    const params: any[] = [school_id];
    let paramIndex = 2;

    if (filters?.term) {
      query += ` AND term = $${paramIndex}`;
      params.push(filters.term);
      paramIndex++;
    }

    if (filters?.year) {
      query += ` AND year = $${paramIndex}`;
      params.push(filters.year);
      paramIndex++;
    }

    if (filters?.class_level) {
      query += ` AND class_level = $${paramIndex}`;
      params.push(filters.class_level);
    }

    query += ' ORDER BY year DESC, term DESC, set_name';

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getExamSetById(exam_set_id: number): Promise<ExamSet | null> {
    const result = await pool.query('SELECT * FROM config_exam_sets WHERE exam_set_id = $1', [exam_set_id]);
    return result.rows[0] || null;
  }

  async getAssessmentElementsByExamSet(exam_set_id: number): Promise<AssessmentElement[]> {
    const query = `
      SELECT ae.*, cs.subject_name
      FROM config_assessment_elements ae
      LEFT JOIN config_subjects cs ON ae.subject_id = cs.subject_id
      WHERE ae.exam_set_id = $1
      ORDER BY cs.subject_name, ae.element_name
    `;

    const result = await pool.query(query, [exam_set_id]);
    console.log(`[ExamSetService] getAssessmentElementsByExamSet for examSetId ${exam_set_id}: Found ${result.rows.length} elements`);
    if (result.rows.length === 0) {
      console.log('[ExamSetService] Query was:', query);
    }
    return result.rows;
  }

  async deleteExamSet(exam_set_id: number): Promise<void> {
    await pool.query('DELETE FROM config_exam_sets WHERE exam_set_id = $1', [exam_set_id]);
  }

  async createAssessmentElement(element: AssessmentElement): Promise<AssessmentElement> {
    const query = `
      INSERT INTO config_assessment_elements (
        school_id, subject_id, exam_set_id, element_name, max_score, contributing_weight_percent
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      element.school_id,
      element.subject_id,
      element.exam_set_id,
      element.element_name,
      element.max_score,
      element.contributing_weight_percent
    ]);

    return result.rows[0];
  }

  async updateAssessmentElement(element: AssessmentElement): Promise<AssessmentElement> {
    const query = `
      UPDATE config_assessment_elements
      SET element_name = $1, max_score = $2, contributing_weight_percent = $3
      WHERE element_id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [
      element.element_name,
      element.max_score,
      element.contributing_weight_percent,
      element.element_id
    ]);

    return result.rows[0];
  }

  async deleteAssessmentElement(element_id: number): Promise<void> {
    await pool.query('DELETE FROM config_assessment_elements WHERE element_id = $1', [element_id]);
  }

  async getAssessmentElementById(element_id: number): Promise<AssessmentElement | null> {
    const query = `
      SELECT ae.*, cs.subject_name
      FROM config_assessment_elements ae
      LEFT JOIN config_subjects cs ON ae.subject_id = cs.subject_id
      WHERE ae.element_id = $1
    `;

    const result = await pool.query(query, [element_id]);
    return result.rows[0] || null;
  }
}

export default new ExamSetService();

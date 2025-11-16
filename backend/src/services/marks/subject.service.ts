import { pool } from '../../database/database';
import { Subject, SubjectFilterParams, SubjectType } from '../../types/marks.types';

export class SubjectService {
  async getSubjectsBySchoolAndLevel(params: SubjectFilterParams): Promise<Subject[]> {
    const { school_id, school_level } = params;
    
    const query = `
      SELECT * FROM config_subjects
      WHERE school_id = $1 AND school_level = $2
      ORDER BY subject_type, subject_name
    `;
    
    const result = await pool.query(query, [school_id, school_level]);
    return result.rows;
  }

  async createSubject(subject: Omit<Subject, 'subject_id'>): Promise<Subject> {
    const query = `
      INSERT INTO config_subjects (
        school_id, subject_name, school_level, subject_type, 
        ncdc_reference_name, max_selections_allowed
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      subject.school_id,
      subject.subject_name,
      subject.school_level,
      subject.subject_type,
      subject.ncdc_reference_name || null,
      subject.max_selections_allowed
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateSubject(subject_id: number, updates: Partial<Subject>): Promise<Subject> {
    const allowedFields = ['subject_name', 'subject_type', 'ncdc_reference_name', 'max_selections_allowed'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `UPDATE config_subjects SET ${setClause} WHERE subject_id = $1 RETURNING *`;
    const values = [subject_id, ...fields.map(field => updates[field as keyof Subject])];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async deleteSubject(subject_id: number): Promise<void> {
    await pool.query('DELETE FROM config_subjects WHERE subject_id = $1', [subject_id]);
  }

  async getSubjectById(subject_id: number): Promise<Subject | null> {
    const result = await pool.query('SELECT * FROM config_subjects WHERE subject_id = $1', [subject_id]);
    return result.rows[0] || null;
  }
}

export default new SubjectService();

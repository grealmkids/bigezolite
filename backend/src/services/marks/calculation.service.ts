import { pool } from '../../database/database';
import { GradingScale, SchoolSetting, ResultEntry, AssessmentElement } from '../../types/marks.types';

export interface WeightedScoreResult {
  formative_score: number;
  summative_score: number;
  weighted_total: number;
  total_percentage: number;
}

export class CalculationService {
  /**
   * Get grading configuration for a school
   */
  async getGradingConfig(school_id: number): Promise<SchoolSetting | null> {
    const query = 'SELECT * FROM config_school_settings WHERE school_id = $1';
    const result = await pool.query(query, [school_id]);
    return result.rows[0] || null;
  }

  /**
   * Get all grading scales for a school
   */
  async getGradingScales(school_id: number): Promise<GradingScale[]> {
    const query = `
      SELECT * FROM config_grading_scales 
      WHERE school_id = $1 
      ORDER BY min_score_percent DESC
    `;
    const result = await pool.query(query, [school_id]);
    return result.rows;
  }

  /**
   * Calculate weighted score based on formative and summative scores
   * Supports LSC (80/20), P7 (60/40), and custom formulas
   * @param formative_score Raw formative/CA score
   * @param summative_score Raw summative/end-of-term score
   * @param weights Object containing weight percentages
   * @returns Weighted score calculation result
   */
  async calculateWeightedScore(
    formative_score: number,
    summative_score: number,
    weights: { formative: number; summative: number },
    school_id?: number
  ): Promise<WeightedScoreResult> {
    // Validate weights
    const totalWeight = weights.formative + weights.summative;
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Weights must sum to 100%');
    }

    // Calculate weighted components
    const weighted_formative = (formative_score * weights.formative) / 100;
    const weighted_summative = (summative_score * weights.summative) / 100;
    const weighted_total = weighted_formative + weighted_summative;

    // Normalize to percentage (assuming max score of 100)
    const total_percentage = weighted_total;

    return {
      formative_score: weighted_formative,
      summative_score: weighted_summative,
      weighted_total,
      total_percentage
    };
  }

  /**
   * Get the grade for a given score based on school's grading scale
   * @param score Percentage score (0-100)
   * @param school_id School ID for grading scale lookup
   * @returns Grade object with letter and descriptor
   */
  async getGradeForScore(score: number, school_id: number): Promise<GradingScale | null> {
    const scales = await this.getGradingScales(school_id);
    
    if (scales.length === 0) {
      return null;
    }

    // Find the highest minimum score that the given score meets or exceeds
    for (const scale of scales) {
      if (score >= scale.min_score_percent) {
        return scale;
      }
    }

    return null;
  }

  /**
   * Calculate marks for a student across all elements in a subject
   * Aggregates individual element marks into formative and summative categories
   * @param student_id Student ID
   * @param exam_set_id Exam set ID
   * @param subject_id Subject ID
   * @returns Calculated scores and grades
   */
  async calculateStudentSubjectMarks(
    student_id: number,
    exam_set_id: number,
    subject_id: number
  ): Promise<any> {
    // Get all assessment elements for this subject/exam set
    const elementsQuery = `
      SELECT element_id, element_name, max_score, contributing_weight_percent
      FROM config_assessment_elements
      WHERE exam_set_id = $1 AND subject_id = $2
      ORDER BY element_id
    `;
    const elementsResult = await pool.query(elementsQuery, [exam_set_id, subject_id]);
    const elements = elementsResult.rows;

    if (elements.length === 0) {
      return null;
    }

    // Get all marks for these elements
    const marksQuery = `
      SELECT 
        re.element_id, 
        re.score_obtained,
        re.max_score_at_entry,
        cae.contributing_weight_percent
      FROM results_entry re
      JOIN config_assessment_elements cae ON re.element_id = cae.element_id
      JOIN results_exam_entries ree ON re.exam_entry_id = ree.exam_entry_id
      WHERE ree.student_id = $1 
        AND ree.exam_set_id = $2 
        AND cae.subject_id = $3
      ORDER BY re.element_id
    `;
    const marksResult = await pool.query(marksQuery, [student_id, exam_set_id, subject_id]);
    const marks = marksResult.rows;

    if (marks.length === 0) {
      return {
        student_id,
        exam_set_id,
        subject_id,
        total_marks_obtained: 0,
        total_max_marks: 0,
        percentage: 0,
        elements_data: []
      };
    }

    // Calculate totals
    let total_marks = 0;
    let total_max_marks = 0;
    const elements_data = [];

    for (const mark of marks) {
      const percentage = (mark.score_obtained / mark.max_score_at_entry) * 100;
      total_marks += mark.score_obtained;
      total_max_marks += mark.max_score_at_entry;

      elements_data.push({
        element_id: mark.element_id,
        score_obtained: mark.score_obtained,
        max_score: mark.max_score_at_entry,
        percentage,
        weight_percent: mark.contributing_weight_percent
      });
    }

    const percentage = total_max_marks > 0 ? (total_marks / total_max_marks) * 100 : 0;

    return {
      student_id,
      exam_set_id,
      subject_id,
      total_marks_obtained: total_marks,
      total_max_marks,
      percentage: Math.round(percentage * 100) / 100,
      elements_data
    };
  }

  /**
   * Calculate overall report for a student in an exam set
   * Includes all subjects with weighted scoring
   * @param student_id Student ID
   * @param exam_set_id Exam set ID
   * @param school_id School ID (for grading config)
   * @returns Complete report with all subjects and grades
   */
  async calculateStudentReport(
    student_id: number,
    exam_set_id: number,
    school_id: number
  ): Promise<any> {
    // Get exam set details
    const examSetQuery = `
      SELECT es.*, css.curriculum_type
      FROM config_exam_sets es
      LEFT JOIN config_school_settings css ON es.school_id = css.school_id
      WHERE es.exam_set_id = $1
    `;
    const examSetResult = await pool.query(examSetQuery, [exam_set_id]);
    if (examSetResult.rows.length === 0) {
      throw new Error('Exam set not found');
    }
    const examSet = examSetResult.rows[0];

    // Get all subjects for this exam set
    const subjectsQuery = `
      SELECT DISTINCT subject_id
      FROM config_assessment_elements
      WHERE exam_set_id = $1
    `;
    const subjectsResult = await pool.query(subjectsQuery, [exam_set_id]);
    const subjects = subjectsResult.rows;

    // Calculate marks for each subject
    const subjectMarks = [];
    for (const subject of subjects) {
      const marks = await this.calculateStudentSubjectMarks(
        student_id,
        exam_set_id,
        subject.subject_id
      );
      if (marks) {
        subjectMarks.push(marks);
      }
    }

    // Get assessment weights for the school
    const weightConfig = await this.getGradingConfig(school_id);
    
    // Determine weights based on curriculum type
    let formativeWeight = 20; // Default LSC
    let summativeWeight = 80;

    if (weightConfig?.curriculum_type === 'Secondary-LSC') {
      formativeWeight = 20;
      summativeWeight = 80;
    } else if (weightConfig?.curriculum_type === 'Primary-Local') {
      formativeWeight = 40;
      summativeWeight = 60;
    }

    // Get grading scales
    const scales = await this.getGradingScales(school_id);

    return {
      student_id,
      exam_set_id,
      school_id,
      curriculum_type: examSet.curriculum_type,
      term: examSet.term,
      year: examSet.year,
      class_level: examSet.class_level,
      weights: {
        formative: formativeWeight,
        summative: summativeWeight
      },
      subjects: subjectMarks,
      grading_scales: scales,
      generated_at: new Date()
    };
  }

  /**
   * Recalculate all reports for a student across all exam sets
   */
  async recalculateStudentReports(student_id: number, school_id: number): Promise<void> {
    const query = `
      SELECT DISTINCT exam_set_id 
      FROM results_exam_entries 
      WHERE student_id = $1
    `;
    const result = await pool.query(query, [student_id]);
    
    for (const row of result.rows) {
      await this.calculateStudentReport(student_id, row.exam_set_id, school_id);
    }
  }
}

export default new CalculationService();

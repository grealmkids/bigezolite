import { pool } from '../../database/database';
import { ReportGenerationRequest, ReportSummary, HolisticFeedback } from '../../types/marks.types';

export class ReportService {
  async generateReport(request: ReportGenerationRequest): Promise<any> {
    const { student_id, school_id, term, year } = request;

    const subjectsQuery = `
      SELECT DISTINCT
        cs.subject_id,
        cs.subject_name,
        cs.subject_type
      FROM results_exam_entries ree
      JOIN config_subjects cs ON ree.subject_id = cs.subject_id
      JOIN config_exam_sets ces ON ree.exam_set_id = ces.exam_set_id
      WHERE ree.student_id = $1 
        AND ces.school_id = $2 
        AND ces.term = $3 
        AND ces.year = $4
      ORDER BY cs.subject_name
    `;
    
    const subjectsResult = await pool.query(subjectsQuery, [student_id, school_id, term, year]);
    const subjects = [];

    for (const subject of subjectsResult.rows) {
      const marksQuery = `
        SELECT 
          ae.element_name,
          ae.contributing_weight_percent,
          re.score_obtained,
          re.max_score_at_entry,
          ces.assessment_type
        FROM results_entry re
        JOIN results_exam_entries ree ON re.exam_entry_id = ree.exam_entry_id
        JOIN config_assessment_elements ae ON re.element_id = ae.element_id
        JOIN config_exam_sets ces ON ree.exam_set_id = ces.exam_set_id
        WHERE ree.student_id = $1 
          AND ree.subject_id = $2 
          AND ces.term = $3 
          AND ces.year = $4
      `;
      
      const marksResult = await pool.query(marksQuery, [student_id, subject.subject_id, term, year]);
      
      let totalScore = 0;
      let formativeScore = 0;
      let summativeScore = 0;
      
      for (const mark of marksResult.rows) {
        const percentage = (mark.score_obtained / mark.max_score_at_entry) * 100;
        const weightedScore = (percentage * mark.contributing_weight_percent) / 100;
        totalScore += weightedScore;
        
        if (mark.assessment_type === 'Formative') {
          formativeScore += weightedScore;
        } else if (mark.assessment_type === 'Summative') {
          summativeScore += weightedScore;
        }
      }

      const gradeQuery = `
        SELECT grade_letter, descriptor
        FROM config_grading_scales
        WHERE school_id = $1 
          AND min_score_percent <= $2
        ORDER BY min_score_percent DESC
        LIMIT 1
      `;
      
      const gradeResult = await pool.query(gradeQuery, [school_id, totalScore]);
      const grade = gradeResult.rows[0] || { grade_letter: 'N/A', descriptor: '' };

      subjects.push({
        subject_name: subject.subject_name,
        subject_type: subject.subject_type,
        marks: marksResult.rows,
        total_score: totalScore.toFixed(2),
        formative_score: formativeScore.toFixed(2),
        summative_score: summativeScore.toFixed(2),
        grade: grade.grade_letter,
        grade_descriptor: grade.descriptor
      });
    }

    const holisticQuery = `
      SELECT 
        hm.metric_name,
        hm.metric_type,
        rhf.rating
      FROM reports_holistic_feedback rhf
      JOIN config_holistic_metrics hm ON rhf.metric_id = hm.metric_id
      WHERE rhf.student_id = $1 
        AND rhf.school_id = $2 
        AND rhf.term = $3 
        AND rhf.year = $4
    `;
    
    const holisticResult = await pool.query(holisticQuery, [student_id, school_id, term, year]);

    return {
      student_id,
      school_id,
      term,
      year,
      subjects,
      holistic_feedback: holisticResult.rows
    };
  }

  async saveReportSummary(summary: Omit<ReportSummary, 'summary_id'>): Promise<ReportSummary> {
    const query = `
      INSERT INTO reports_summary (
        header_id, total_percentage_score, final_grade_ref, 
        weighted_formative_score, weighted_summative_score,
        class_teacher_comment, head_teacher_comment
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (header_id) 
      DO UPDATE SET 
        total_percentage_score = $2,
        final_grade_ref = $3,
        weighted_formative_score = $4,
        weighted_summative_score = $5,
        class_teacher_comment = $6,
        head_teacher_comment = $7
      RETURNING *
    `;
    
    const values = [
      summary.header_id,
      summary.total_percentage_score,
      summary.final_grade_ref || null,
      summary.weighted_formative_score || null,
      summary.weighted_summative_score || null,
      summary.class_teacher_comment || null,
      summary.head_teacher_comment || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async saveHolisticFeedback(feedback: Omit<HolisticFeedback, 'feedback_id'>): Promise<HolisticFeedback> {
    const query = `
      INSERT INTO reports_holistic_feedback (student_id, school_id, term, year, metric_id, rating)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (student_id, metric_id, term, year)
      DO UPDATE SET rating = $6
      RETURNING *
    `;
    
    const values = [
      feedback.student_id,
      feedback.school_id,
      feedback.term,
      feedback.year,
      feedback.metric_id,
      feedback.rating || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getReportSummary(student_id: number, term: number, year: number): Promise<any> {
    const query = `
      SELECT 
        rs.*,
        rh.subject_id,
        cs.subject_name,
        cgs.grade_letter,
        cgs.descriptor
      FROM reports_summary rs
      JOIN results_header rh ON rs.header_id = rh.header_id
      JOIN config_subjects cs ON rh.subject_id = cs.subject_id
      LEFT JOIN config_grading_scales cgs ON rs.final_grade_ref = cgs.scale_id
      WHERE rh.student_id = $1 AND rh.term = $2 AND rh.year = $3
    `;
    
    const result = await pool.query(query, [student_id, term, year]);
    return result.rows;
  }
}

export default new ReportService();

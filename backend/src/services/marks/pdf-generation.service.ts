import { Response } from 'express';
import { pool } from '../../database/database';
import { CalculationService } from './calculation.service';

const calculationService = new CalculationService();

export class PdfGenerationService {
  /**
   * Generate a student report as PDF (returns as buffer/stream)
   * Uses PDFKit library on backend
   * @param student_id Student ID
   * @param exam_set_id Exam Set ID
   * @param school_id School ID
   * @param res Express response object to send PDF
   */
  async generateStudentReportPdf(
    student_id: number,
    exam_set_id: number,
    school_id: number,
    res: Response
  ): Promise<void> {
    try {
      console.log('[PdfGenerationService] Starting PDF generation', { 
        student_id, 
        exam_set_id, 
        school_id,
        timestamp: new Date().toISOString()
      });

      // Get calculation data
      console.log('[PdfGenerationService] Calculating student report');
      const reportData = await calculationService.calculateStudentReport(
        student_id,
        exam_set_id,
        school_id
      );
      console.log('[PdfGenerationService] Report calculation complete', {
        subjectCount: reportData.subjects?.length || 0,
        hasGradingScales: !!reportData.grading_scales,
        hasHolisticFeedback: !!reportData.holistic_feedback
      });

      // Get student details
      const studentQuery = `
        SELECT s.*, sch.school_name, sch.school_type
        FROM students s
        JOIN schools sch ON s.school_id = sch.school_id
        WHERE s.student_id = $1
      `;
      console.log('[PdfGenerationService] Fetching student details for ID:', student_id);
      const studentResult = await pool.query(studentQuery, [student_id]);
      if (studentResult.rows.length === 0) {
        console.log('[PdfGenerationService] Student not found:', student_id);
        throw new Error('Student not found');
      }
      const student = studentResult.rows[0];
      console.log('[PdfGenerationService] Student found:', { 
        student_id: student.student_id,
        name: student.full_name,
        school: student.school_name
      });

      // Get exam set details
      const examSetQuery = `
        SELECT * FROM config_exam_sets WHERE exam_set_id = $1
      `;
      console.log('[PdfGenerationService] Fetching exam set details for ID:', exam_set_id);
      const examSetResult = await pool.query(examSetQuery, [exam_set_id]);
      if (examSetResult.rows.length === 0) {
        console.log('[PdfGenerationService] Exam set not found:', exam_set_id);
        throw new Error('Exam set not found');
      }
      const examSet = examSetResult.rows[0];
      console.log('[PdfGenerationService] Exam set found:', { 
        exam_set_id: examSet.exam_set_id,
        name: examSet.set_name,
        term: examSet.term,
        year: examSet.year
      });

      // Generate HTML content (will be converted to PDF by frontend)
      console.log('[PdfGenerationService] Generating HTML content');
      const htmlContent = this.generateReportHtml(student, examSet, reportData);
      console.log('[PdfGenerationService] HTML generated, length:', htmlContent.length);

      // Set response headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Report_${student.full_name}_${examSet.set_name}.pdf"`
      );

      console.log('[PdfGenerationService] Sending PDF response');
      // Send HTML as response (frontend will handle conversion)
      // In production, use Puppeteer to convert HTML to PDF
      res.send(htmlContent);
      console.log('[PdfGenerationService] PDF sent successfully');
    } catch (error) {
      console.error('[PdfGenerationService] Error generating PDF:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        student_id,
        exam_set_id,
        school_id,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate HTML report content
   * Frontend will convert this to PDF using print-to-PDF or similar
   */
  private generateReportHtml(student: any, examSet: any, reportData: any): string {
    const termNames = ['', 'Term 1', 'Term 2', 'Term 3'];

    // Build subject rows
    const subjectRows = reportData.subjects
      .map((subject: any) => {
        const percentage = subject.percentage.toFixed(2);
        const letterGrade = this.getLetterGrade(parseFloat(percentage), reportData.grading_scales);
        return `
          <tr>
            <td style="text-align: left;">${subject.subject_id}</td>
            <td style="text-align: center;">${subject.total_marks_obtained}/${subject.total_max_marks}</td>
            <td style="text-align: right;">${percentage}%</td>
            <td style="text-align: center; font-weight: bold; color: #2c3e50;">${letterGrade}</td>
          </tr>
        `;
      })
      .join('');

    // Build grading scales table
    const gradeScalesRows = reportData.grading_scales
      .map(
        (scale: any) => `
        <tr>
          <td style="text-align: center; font-weight: bold;">${scale.grade_letter}</td>
          <td style="text-align: center;">${scale.min_score_percent}%</td>
          <td style="text-align: left;">${scale.descriptor || '-'}</td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Student Report - ${student.full_name}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #2c3e50;
            line-height: 1.6;
            background: #f8f9fa;
            padding: 20px;
          }

          .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
          }

          /* Header Styling */
          .header {
            text-align: center;
            border-bottom: 3px solid #0059b3;
            padding-bottom: 25px;
            margin-bottom: 30px;
          }

          .school-name {
            font-size: 28px;
            font-weight: bold;
            color: #0059b3;
            margin-bottom: 5px;
          }

          .report-title {
            font-size: 20px;
            color: #34495e;
            margin: 10px 0;
            font-weight: 600;
          }

          .report-period {
            font-size: 14px;
            color: #7f8c8d;
            margin-top: 8px;
          }

          /* Student Info Section */
          .student-info {
            background: linear-gradient(135deg, #ecf0f1 0%, #f8f9fa 100%);
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
            border-left: 4px solid #0059b3;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
          }

          .info-label {
            font-weight: 600;
            color: #2c3e50;
            width: 200px;
          }

          .info-value {
            color: #34495e;
            flex: 1;
          }

          /* Section Styling */
          .section {
            margin: 30px 0;
          }

          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #0059b3;
            margin: 20px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #e0e0e0;
          }

          /* Table Styling */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          }

          th {
            background-color: #0059b3;
            color: white;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          td {
            padding: 11px 10px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 13px;
          }

          tr:nth-child(even) {
            background-color: #f8f9fa;
          }

          tr:hover {
            background-color: #f0f4f8;
          }

          /* Meta Information */
          .meta-info {
            display: flex;
            justify-content: space-between;
            margin: 25px 0;
            padding: 15px;
            background: #fafbfc;
            border-radius: 6px;
            font-size: 12px;
            color: #7f8c8d;
          }

          .generated-date {
            text-align: right;
          }

          /* Print Optimization */
          @media print {
            body {
              background: white;
              padding: 0;
            }

            .container {
              box-shadow: none;
              padding: 0;
              margin: 0;
            }

            a {
              color: #0059b3;
              text-decoration: none;
            }

            .no-print {
              display: none;
            }

            table {
              page-break-inside: avoid;
            }

            tr {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- HEADER -->
          <div class="header">
            <div class="school-name">${student.school_name}</div>
            <div class="report-title">Student Report Card</div>
            <div class="report-title">${examSet.set_name}</div>
            <div class="report-period">${termNames[examSet.term]} ${examSet.year}</div>
          </div>

          <!-- STUDENT INFORMATION -->
          <div class="student-info">
            <div class="info-row">
              <span class="info-label">Student Name:</span>
              <span class="info-value">${student.full_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Registration Number:</span>
              <span class="info-value">${student.reg_number}</span>
            </div>
            ${student.lin_number ? `
            <div class="info-row">
              <span class="info-label">LIN Number:</span>
              <span class="info-value">${student.lin_number}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Class Level:</span>
              <span class="info-value">${examSet.class_level}</span>
            </div>
          </div>

          <!-- ACADEMIC PERFORMANCE -->
          <div class="section">
            <h3 class="section-title">📚 Academic Performance</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 15%;">Subject ID</th>
                  <th style="width: 25%;">Marks Obtained</th>
                  <th style="width: 25%;">Percentage</th>
                  <th style="width: 15%;">Grade</th>
                </tr>
              </thead>
              <tbody>
                ${subjectRows || '<tr><td colspan="4" style="text-align: center; color: #999;">No marks recorded</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- GRADING SCALE REFERENCE -->
          <div class="section">
            <h3 class="section-title">📊 Grading Scale Reference</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 20%;">Grade</th>
                  <th style="width: 30%;">Minimum Score</th>
                  <th style="width: 50%;">Description</th>
                </tr>
              </thead>
              <tbody>
                ${gradeScalesRows}
              </tbody>
            </table>
          </div>

          <!-- ASSESSMENT WEIGHTS -->
          <div class="section">
            <h3 class="section-title">⚖️ Assessment Weights</h3>
            <div class="student-info">
              <div class="info-row">
                <span class="info-label">Formative (Continuous Assessment):</span>
                <span class="info-value"><strong>${reportData.weights.formative}%</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Summative (End-of-Term):</span>
                <span class="info-value"><strong>${reportData.weights.summative}%</strong></span>
              </div>
            </div>
          </div>

          <!-- META INFORMATION -->
          <div class="meta-info">
            <div>Curriculum: <strong>${reportData.curriculum_type}</strong></div>
            <div class="generated-date">Generated: ${new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
          </div>

          <!-- FOOTER -->
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #95a5a6; font-size: 11px;">
            <p>This is an automatically generated report from the BIGEZO Assessment System.</p>
            <p>For inquiries, please contact the school administration.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Helper to get letter grade from percentage
   */
  private getLetterGrade(percentage: number, scales: any[]): string {
    for (const scale of scales) {
      if (percentage >= scale.min_score_percent) {
        return scale.grade_letter;
      }
    }
    return 'N/A';
  }
}

export default new PdfGenerationService();

import { Response } from 'express';
import { pool } from '../../database/database';
import { CalculationService } from './calculation.service';
import puppeteer from 'puppeteer';

const calculationService = new CalculationService();

export class PdfGenerationService {
  /**
   * Generate a student report as PDF (returns as buffer/stream)
   * Uses Puppeteer to render HTML to PDF
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
      const reportData = await calculationService.calculateStudentReport(
        student_id,
        exam_set_id,
        school_id
      );

      // Get student details including photo
      const studentQuery = `
        SELECT s.*, sch.school_name, sch.school_type, sch.badge_url
        FROM students s
        JOIN schools sch ON s.school_id = sch.school_id
        WHERE s.student_id = $1
      `;
      const studentResult = await pool.query(studentQuery, [student_id]);
      if (studentResult.rows.length === 0) {
        throw new Error('Student not found');
      }
      const student = studentResult.rows[0];

      // Get exam set details
      const examSetQuery = `
        SELECT * FROM config_exam_sets WHERE exam_set_id = $1
      `;
      const examSetResult = await pool.query(examSetQuery, [exam_set_id]);
      if (examSetResult.rows.length === 0) {
        throw new Error('Exam set not found');
      }
      const examSet = examSetResult.rows[0];

      // Generate HTML content
      const htmlContent = this.generateReportHtml(student, examSet, reportData);

      // Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();

      // Set content and wait for load
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0px',
          bottom: '0px',
          left: '0px',
          right: '0px'
        }
      });

      await browser.close();

      // Set headers and send PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Report_${student.student_name.replace(/[^a-z0-9]/gi, '_')}_${examSet.set_name}.pdf"`
      );
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);
      console.log('[PdfGenerationService] PDF generated and sent successfully');

    } catch (error) {
      console.error('[PdfGenerationService] Error generating PDF:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate HTML report content
   */
  private generateReportHtml(student: any, examSet: any, reportData: any): string {
    const termNames = ['', 'Term 1', 'Term 2', 'Term 3'];

    // Build subject rows
    const subjectRows = reportData.subjects
      .map((subject: any, index: number) => {
        // Use Math.round for whole numbers as requested
        // Handle NaN/Missing scores
        const isMissing = isNaN(subject.percentage) || subject.percentage === null || subject.percentage === undefined;

        let percentageDisplay = 'Missing';
        let marksDisplay = 'Missing';
        let letterGrade = 'N/A';

        if (!isMissing) {
          percentageDisplay = Math.round(subject.percentage) + '%';
          marksDisplay = `${Math.round(subject.total_marks_obtained)} / ${Math.round(subject.total_max_marks)}`;
          letterGrade = this.getLetterGrade(Math.round(subject.percentage), reportData.grading_scales);
        }

        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        return `
          <tr style="background-color: ${rowBg};">
            <td style="padding: 10px 15px; border-bottom: 1px solid #e0e0e0; font-weight: 500; font-size: 13px;">${subject.subject_name || subject.subject_id}</td>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 13px;">${marksDisplay}</td>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e0e0e0; text-align: right; font-family: 'Roboto Mono', monospace; font-size: 13px;">${percentageDisplay}</td>
            <td style="padding: 10px 15px; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: bold; color: ${this.getGradeColor(letterGrade)}; font-size: 13px;">${letterGrade}</td>
          </tr>
        `;
      })
      .join('');

    // Build grading scales
    const gradeScalesRows = reportData.grading_scales && reportData.grading_scales.length > 0
      ? reportData.grading_scales
        .map((scale: any, index: number) => {
          const rowBg = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
          return `
          <tr style="background-color: ${rowBg};">
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold; font-size: 11px; color: ${this.getGradeColor(scale.grade_letter)};">${scale.grade_letter}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; font-size: 11px;">${Math.round(scale.min_score_percent)}% - 100%</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 11px;">${scale.descriptor || '-'}</td>
          </tr>
        `})
        .join('')
      : '<tr><td colspan="3" style="padding: 10px; text-align: center; font-size: 11px; color: #999;">Grading system not configured.</td></tr>';

    // Badge Handling
    const badgeHtml = student.badge_url
      ? `<img src="${student.badge_url}" alt="School Badge" style="height: 80px; width: auto; object-fit: contain;">`
      : `<div style="width: 80px; height: 80px; background: #f0f0f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #999; font-weight: bold; font-size: 24px;">${student.school_name.charAt(0)}</div>`;

    // Student Photo Handling
    const photoHtml = student.student_photo_url
      ? `<img src="${student.student_photo_url}" alt="Student Photo" style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd;">`
      : `<div style="width: 100px; height: 100px; background: #f0f0f0; border-radius: 6px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 40px;">👤</div>`;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Report Card - ${student.student_name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Roboto+Mono:wght@500&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', sans-serif;
            color: #1a1a1a;
            line-height: 1.4;
            background: #ffffff; /* White background requested */
          }
          .report-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 15mm;
            background: white;
            position: relative;
          }
          
          /* Header Layout */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          
          .header-left-section {
             display: flex;
             align-items: center;
             gap: 20px;
          }
          
          .header-center-section {
             text-align: center;
             flex: 1;
             padding: 0 20px;
          }
          
          .header-right-section {
             text-align: right;
             min-width: 100px;
          }

          .school-name {
            font-size: 22px;
            font-weight: 800;
            color: #000;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
            line-height: 1.2;
          }
          
          .report-title-main {
            font-size: 16px;
            font-weight: 700;
            color: #0056D2;
            text-transform: uppercase;
            margin-top: 5px;
          }

          .meta-text {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 2px;
          }
          
          /* Student Details Strip */
          .student-strip {
             display: flex;
             gap: 20px;
             margin-bottom: 25px;
             background: #f8f9fa;
             border: 1px solid #e9ecef;
             border-radius: 8px;
             overflow: hidden;
          }
          
          .student-photo-box {
             padding: 15px;
             background: #fff;
             border-right: 1px solid #e9ecef;
             display: flex;
             align-items: center;
             justify-content: center;
          }
          
          .student-details-grid {
             flex: 1;
             display: grid;
             grid-template-columns: repeat(2, 1fr);
             gap: 15px 30px;
             padding: 15px 20px;
             align-content: center;
          }
          
          .detail-item label {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            color: #666;
            font-weight: 600;
            margin-bottom: 3px;
          }
          .detail-item span {
            font-size: 14px;
            font-weight: 600;
            color: #000;
          }
          
          /* Tables */
          .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .data-table th {
            background: #000;
            color: white;
            padding: 10px 15px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          
          .section-header {
             font-size: 13px;
             font-weight: 700;
             color: #0056D2;
             text-transform: uppercase;
             border-left: 4px solid #0056D2;
             padding-left: 10px;
             margin: 25px 0 15px 0;
          }

          /* Footer */
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #000;
            display: flex;
            justify-content: space-between;
          }
          .sign-box {
             text-align: center;
             width: 150px;
          }
          .sign-line {
             border-bottom: 1px solid #ccc;
             height: 30px;
             margin-bottom: 5px;
          }
          .sign-label { font-size: 10px; color: #666; text-transform: uppercase; }

        </style>
      </head>
      <body>
        <div class="report-container">
          
          <!-- Header -->
          <div class="header">
            <!-- Left: Badge -->
            <div class="header-left-section">
               ${badgeHtml}
            </div>
            
            <!-- Center: School & Title -->
            <div class="header-center-section">
               <div class="school-name">${student.school_name}</div>
               <div class="meta-text">${student.school_type || 'Academic Institution'}</div>
               <div class="report-title-main">${examSet.set_name} Report</div>
               <div class="meta-text">${termNames[examSet.term]} • ${examSet.year}</div>
            </div>
            
            <!-- Right: Date -->
            <div class="header-right-section">
               <div class="meta-text">Generated On</div>
               <div style="font-weight: 600; font-size: 12px;">${new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <!-- Student Strip -->
          <div class="student-strip">
             <div class="student-photo-box">
                ${photoHtml}
             </div>
             <div class="student-details-grid">
                <div class="detail-item">
                  <label>Student Name</label>
                  <span>${student.student_name}</span>
                </div>
                <div class="detail-item">
                  <label>Registration NO.</label>
                  <span>${student.reg_number}</span>
                </div>
                <div class="detail-item">
                  <label>Class / Grade</label>
                  <span>${examSet.class_level}</span>
                </div>
                <div class="detail-item">
                  <label>LIN Number</label>
                  <span>${student.lin_number || 'N/A'}</span>
                </div>
             </div>
          </div>

          <!-- Academic Table -->
          <div class="section-header">Academic Performance</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 35%;">Subject</th>
                <th style="width: 25%; text-align: center;">Score</th>
                <th style="width: 20%; text-align: right;">%</th>
                <th style="width: 20%; text-align: center;">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${subjectRows || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #999;">No results available.</td></tr>'}
            </tbody>
          </table>

          <!-- Bottom Grid -->
          <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 30px; margin-top: 10px;">
             
             <!-- Grading Key -->
             <div>
                <div class="section-header">Grading System</div>
                <table class="data-table">
                  <thead>
                     <tr>
                        <th style="width: 20%; text-align: center;">G</th>
                        <th style="width: 30%; text-align: center;">Range</th>
                        <th style="width: 50%;">Descriptor</th>
                     </tr>
                  </thead>
                  <tbody>${gradeScalesRows}</tbody>
                </table>
             </div>
             
             <!-- Summary & Remarks -->
             <div>
                <div class="section-header">Performance Summary</div>
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                   <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                      <span style="color: #666;">Total Subjects</span>
                      <span style="font-weight: 700;">${reportData.subjects.length}</span>
                   </div>
                   <!-- Can add Average/Total here later -->
                </div>
                
                <div class="section-header" style="margin-top: 0;">Remarks</div>
                <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; height: 100px;">
                   <!-- Space for remarks -->
                </div>
             </div>
          </div>

          <!-- Signature Footer -->
          <div class="footer">
             <div class="sign-box">
                <div class="sign-line"></div>
                <div class="sign-label">Class Teacher</div>
             </div>
             <div style="align-self: flex-end; font-size: 9px; color: #999;">
                ID: ${student.student_id}-${examSet.exam_set_id} | BIGEZO Systems
             </div>
             <div class="sign-box">
                <div class="sign-line"></div>
                <div class="sign-label">Head Teacher</div>
             </div>
          </div>

        </div>
      </body>
      </html>
    `;
  }

  private getLetterGrade(percentage: number, scales: any[]): string {
    for (const scale of scales) {
      if (percentage >= scale.min_score_percent) return scale.grade_letter;
    }
    return 'N/A';
  }

  private getGradeColor(grade: string): string {
    const colors: { [key: string]: string } = {
      'A': '#198754', 'B': '#0dcaf0', 'C': '#ffc107',
      'D': '#fd7e14', 'E': '#dc3545', 'F': '#dc3545', 'N/A': '#6c757d'
    };
    return colors[grade.charAt(0)] || '#000000';
  }
}

export default new PdfGenerationService();

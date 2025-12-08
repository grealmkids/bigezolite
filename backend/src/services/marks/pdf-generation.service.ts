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
    const currentYear = examSet.year || new Date().getFullYear();
    const termDisplay = termNames[examSet.term] || 'Term 1';

    // Build subject rows
    const subjectRows = reportData.subjects
      .map((subject: any, index: number) => {
        const isMissing = isNaN(subject.percentage) || subject.percentage === null || subject.percentage === undefined;

        let percentageDisplay = '<span style="color: #b91c1c; font-weight: bold;">Missing</span>'; // Dark Red for missing
        let marksDisplay = '<span style="color: #b91c1c;">Missing</span>';
        let letterGrade = 'N/A';
        let descriptor = '-';
        let gradeColor = '#666';

        if (!isMissing) {
          const roundedPercentage = Math.round(subject.percentage);
          percentageDisplay = roundedPercentage + '%';
          marksDisplay = `${Math.round(subject.total_marks_obtained)} / ${Math.round(subject.total_max_marks)}`;
          letterGrade = this.getLetterGrade(roundedPercentage, reportData.grading_scales);
          descriptor = this.getGradeDescriptor(roundedPercentage, reportData.grading_scales);
          gradeColor = this.getGradeColor(letterGrade);
        }

        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        return `
          <tr style="background-color: ${rowBg};">
            <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: 500; font-size: 13px;">
              ${subject.subject_name || subject.subject_id}
            </td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 13px;">
              ${marksDisplay}
            </td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; text-align: right; font-family: 'Roboto Mono', monospace; font-size: 13px;">
              ${percentageDisplay}
            </td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: bold; color: ${gradeColor}; font-size: 13px;">
              ${letterGrade}
            </td>
             <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-size: 12px; color: #555;">
              ${descriptor}
            </td>
          </tr>
        `;
      })
      .join('');

    // Build inline grading key (Footer area)
    const gradingKeyHtml = reportData.grading_scales && reportData.grading_scales.length > 0
      ? reportData.grading_scales
        .sort((a: any, b: any) => b.min_score_percent - a.min_score_percent)
        .map((scale: any) => {
          return `<span style="display: inline-block; margin-right: 15px; white-space: nowrap;">
                <strong style="color: ${this.getGradeColor(scale.grade_letter)}">${scale.grade_letter}</strong> 
                <span style="color: #666; font-size: 10px;">(${Math.round(scale.min_score_percent)}% - 100%)</span>
             </span>`;
        })
        .join('')
      : '<span style="font-size: 10px; color: #999;">Grading system not configured.</span>';

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
            background: #ffffff;
            -webkit-print-color-adjust: exact;
          }
          .report-container {
            width: 210mm;
            /* Allow height to grow naturally for pagination, Puppeteer handles page cuts */
            margin: 0 auto;
            padding: 15mm;
            background: white;
            position: relative;
          }
          
          /* Page Break Rules */
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          .section-header { page-break-after: avoid; break-after: avoid; }
          .student-strip { page-break-inside: avoid; break-inside: avoid; }
          .footer { page-break-inside: avoid; break-inside: avoid; }
          
          /* Header Layout */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
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
             min-width: 120px;
          }

          .school-name {
            font-size: 24px;
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
            color: #0056D2; /* Brand Blue */
            text-transform: uppercase;
            margin-top: 5px;
          }

          .meta-text {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 2px;
          }
          
          /* Term & Year Styling */
          .term-label {
             font-size: 12px;
             font-weight: 600;
             color: #666; /* Visible Grey */
             text-transform: uppercase;
             display: block;
             margin-bottom: 2px;
          }
          .year-label {
             font-size: 20px;
             font-weight: 800;
             color: #000; /* Black */
             display: block;
             line-height: 1;
          }
          
          /* Student Details Strip */
          .student-strip {
             display: flex;
             gap: 20px;
             margin-bottom: 30px;
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
            margin-bottom: 4px;
          }
          .detail-item span {
            font-size: 15px;
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
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #000;
          }
          
          .section-header {
             font-size: 14px;
             font-weight: 700;
             color: #0056D2;
             text-transform: uppercase;
             border-left: 4px solid #0056D2;
             padding-left: 10px;
             margin: 30px 0 15px 0;
          }
          
          .remarks-box {
             border: 1px solid #ddd;
             border-radius: 6px;
             padding: 15px;
             height: 80px;
             margin-top: 10px;
          }

          /* Footer (Signatures) */
          .footer {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 2px solid #000;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .sign-box {
             text-align: center;
             width: 180px;
          }
          .sign-line {
             border-bottom: 1px solid #ccc;
             height: 40px;
             margin-bottom: 8px;
          }
          .sign-label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: 600; }
          
          /* Grading Key (Now at bottom) */
          .grading-key-section {
             margin-top: 20px;
             padding-top: 10px;
             border-top: 1px dashed #eee;
             font-size: 11px; 
             line-height: 1.6;
             break-inside: avoid;
             page-break-inside: avoid;
             display: flex;
             flex-direction: column;
          }

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
            </div>
            
            <!-- Right: Term & Year -->
            <div class="header-right-section">
               <span class="term-label">${termDisplay}</span>
               <span class="year-label">${currentYear}</span>
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
                  <label>Class Level</label>
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
                <th style="width: 30%;">Subject</th>
                <th style="width: 15%; text-align: center;">Score</th>
                <th style="width: 15%; text-align: right;">%</th>
                <th style="width: 15%; text-align: center;">Grade</th>
                <th style="width: 25%;">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              ${subjectRows || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">No results available.</td></tr>'}
            </tbody>
          </table>

          <!-- Summary Section -->
          <div style="margin-top: 25px; page-break-inside: avoid; break-inside: avoid;">
             <div class="section-header" style="margin-top: 0;">Class Teacher's Remarks</div>
             <div class="remarks-box"></div>
             
             <div class="section-header">Head Teacher's Remarks</div>
             <div class="remarks-box"></div>
          </div>
          
          <!-- Signature Footer (Moved Up) -->
          <div class="footer">
             <div class="sign-box">
                <div class="sign-line"></div>
                <div class="sign-label">Class Teacher Signature</div>
             </div>
             
             <div style="font-size: 9px; color: #aaa; text-align: center;">
                Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
             </div>

             <div class="sign-box">
                <div class="sign-line"></div>
                <div class="sign-label">Head Teacher Signature</div>
             </div>
          </div>

          <!-- Grading Scale Key (Moved Down) -->
          <div class="grading-key-section">
             <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 3px;">Grading Key</div>
             <div>${gradingKeyHtml}</div>
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

  private getGradeDescriptor(percentage: number, scales: any[]): string {
    for (const scale of scales) {
      if (percentage >= scale.min_score_percent) return scale.descriptor;
    }
    return '-';
  }

  private getGradeColor(grade: string): string {
    // International/Intuitive Color Codes
    // A/D1/D2 = Green (Excellent)
    // B/C/C3/C4/C5/C6 = Black (Average/Good)
    // P7/P8/D/E = Orange/Red (Warning)
    // F/F9 = Red (Fail)

    // Normalize input to first char or standard set if possible, 
    // but Grading scales can be anything (A, B+, 1, 2, etc).
    // Simple heuristic:
    const g = grade.toUpperCase().trim();

    // Check specific known grades
    if (['A', 'D1', 'D2'].some(x => g.startsWith(x))) return '#198754'; // Success Green
    if (['B', 'C', 'C3', 'C4', 'C5', 'C6'].some(x => g.startsWith(x))) return '#000000'; // Black
    if (['P7', 'P8', 'D'].some(x => g.startsWith(x))) return '#fd7e14'; // Orange
    if (['F', 'F9', 'E'].some(x => g.startsWith(x))) return '#dc3545'; // Danger Red

    // Fallback based on typical letter meaning
    if (g.startsWith('A')) return '#198754';
    if (g.startsWith('F') || g.startsWith('E')) return '#dc3545';

    return '#000000'; // Default Black
  }
}

export default new PdfGenerationService();

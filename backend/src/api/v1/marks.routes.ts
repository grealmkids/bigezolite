import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  SubjectService,
  ExamSetService,
  MarksEntryService,
  ReportService,
  ConfigService,
  PdfGenerationService
} from '../../services/marks';

const router = Router();

router.use(authenticateToken);

router.post('/subjects', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const subject = await SubjectService.createSubject(req.body);
    res.status(201).json(subject);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/subjects', async (req: Request, res: Response) => {
  try {
    const { school_id, school_level } = req.query;

    if (!school_id || !school_level) {
      return res.status(400).json({ message: 'school_id and school_level are required' });
    }

    const subjects = await SubjectService.getSubjectsBySchoolAndLevel({
      school_id: Number(school_id),
      school_level: String(school_level)
    });

    res.json(subjects);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/subjects/:subjectId', async (req: Request, res: Response) => {
  try {
    const subject = await SubjectService.getSubjectById(Number(req.params.subjectId));
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    res.json(subject);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/subjects/:subjectId', async (req: Request, res: Response) => {
  try {
    const subject = await SubjectService.updateSubject(Number(req.params.subjectId), req.body);
    res.json(subject);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/subjects/:subjectId', async (req: Request, res: Response) => {
  try {
    await SubjectService.deleteSubject(Number(req.params.subjectId));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/exam-sets', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const examSet = await ExamSetService.createExamSet(req.body, userId);
    res.status(201).json(examSet);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/exam-sets', async (req: Request, res: Response) => {
  try {
    const { school_id, term, year, class_level } = req.query;

    if (!school_id) {
      return res.status(400).json({ message: 'school_id is required' });
    }

    const filters = {
      term: term ? Number(term) : undefined,
      year: year ? Number(year) : undefined,
      class_level: class_level ? String(class_level) : undefined
    };

    const examSets = await ExamSetService.getExamSetsBySchool(Number(school_id), filters);
    res.json(examSets);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/exam-sets/:examSetId', async (req: Request, res: Response) => {
  try {
    const examSet = await ExamSetService.getExamSetById(Number(req.params.examSetId));
    if (!examSet) return res.status(404).json({ message: 'Exam set not found' });
    res.json(examSet);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/exam-sets/:examSetId/elements', async (req: Request, res: Response) => {
  try {
    const elements = await ExamSetService.getAssessmentElementsByExamSet(Number(req.params.examSetId));
    res.json(elements);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/exam-sets/:examSetId', async (req: Request, res: Response) => {
  try {
    await ExamSetService.deleteExamSet(Number(req.params.examSetId));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Assessment Elements CRUD Routes
router.post('/assessment-elements', async (req: Request, res: Response) => {
  try {
    const element = await ExamSetService.createAssessmentElement(req.body);
    res.status(201).json(element);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/assessment-elements/:elementId', async (req: Request, res: Response) => {
  try {
    const element = await ExamSetService.getAssessmentElementById(Number(req.params.elementId));
    if (!element) return res.status(404).json({ message: 'Assessment element not found' });
    res.json(element);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/assessment-elements/:elementId', async (req: Request, res: Response) => {
  try {
    const element = await ExamSetService.updateAssessmentElement({
      ...req.body,
      element_id: Number(req.params.elementId)
    });
    res.json(element);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/assessment-elements/:elementId', async (req: Request, res: Response) => {
  try {
    await ExamSetService.deleteAssessmentElement(Number(req.params.elementId));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/marks/bulk-upload', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { exam_set_id, school_id, entries } = req.body;

    if (!exam_set_id || !school_id || !entries) {
      console.warn('[BulkUpload] Missing required fields:', { exam_set_id, school_id, entriesCount: entries?.length });
      return res.status(400).json({ message: 'exam_set_id, school_id, and entries are required' });
    }

    console.log(`[BulkUpload] Request received. ExamSet: ${exam_set_id}, School: ${school_id}, Entries: ${entries.length}`);

    const result = await MarksEntryService.bulkUploadMarks(exam_set_id, school_id, entries, userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/marks/exam-entry/:examEntryId', async (req: Request, res: Response) => {
  try {
    const marks = await MarksEntryService.getMarksByExamEntry(Number(req.params.examEntryId));
    res.json(marks);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/marks/student/:studentId/exam-set/:examSetId', async (req: Request, res: Response) => {
  try {
    const marks = await MarksEntryService.getMarksByStudent(
      Number(req.params.studentId),
      Number(req.params.examSetId)
    );
    res.json(marks);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/marks/:entryId', async (req: Request, res: Response) => {
  try {
    await MarksEntryService.deleteMarksEntry(Number(req.params.entryId));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/exam-sets/:examSetId/results', async (req: Request, res: Response) => {
  try {
    console.log(`[API] Fetching results for examSet: ${req.params.examSetId}`);
    const results = await MarksEntryService.getExamSetResults(Number(req.params.examSetId));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/reports/generate', async (req: Request, res: Response) => {
  try {
    const report = await ReportService.generateReport(req.body);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/reports/summary', async (req: Request, res: Response) => {
  try {
    const summary = await ReportService.saveReportSummary(req.body);
    res.status(201).json(summary);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/reports/holistic-feedback', async (req: Request, res: Response) => {
  try {
    const feedback = await ReportService.saveHolisticFeedback(req.body);
    res.status(201).json(feedback);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/reports/summary/:studentId', async (req: Request, res: Response) => {
  try {
    const { term, year } = req.query;

    if (!term || !year) {
      return res.status(400).json({ message: 'term and year are required' });
    }

    const summary = await ReportService.getReportSummary(
      Number(req.params.studentId),
      Number(term),
      Number(year)
    );
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get student report PDF
router.get('/reports/:examSetId/student/:studentId/pdf', async (req: Request, res: Response) => {
  try {
    const studentId = Number(req.params.studentId);
    const examSetId = Number(req.params.examSetId);
    const userId = (req as any).user?.userId;
    const schoolId = (req as any).user?.schoolId;

    console.log('[PDF Report] Request received', {
      studentId,
      examSetId,
      userId,
      schoolId,
      timestamp: new Date().toISOString()
    });

    // Validate inputs
    if (!studentId || !examSetId) {
      console.log('[PDF Report] Invalid parameters', { studentId, examSetId });
      return res.status(400).json({
        message: 'studentId and examSetId are required',
        received: { studentId, examSetId }
      });
    }

    if (!schoolId) {
      console.log('[PDF Report] Missing schoolId from auth token');
      return res.status(401).json({ message: 'Unauthorized - school not found' });
    }

    console.log('[PDF Report] Generating report for student', { studentId, examSetId, schoolId });

    // Fetch exam set to get term and year
    const examSetQuery = `
      SELECT exam_set_id, term, year, set_name
      FROM config_exam_sets
      WHERE exam_set_id = $1 AND school_id = $2
    `;
    const examSetResult = await (require('../../database/database').pool).query(examSetQuery, [examSetId, schoolId]);

    if (examSetResult.rows.length === 0) {
      console.log('[PDF Report] Exam set not found', { examSetId, schoolId });
      return res.status(404).json({
        message: 'Exam set not found',
        details: { examSetId, schoolId }
      });
    }

    const examSet = examSetResult.rows[0];
    console.log('[PDF Report] Exam set found', { examSetId, term: examSet.term, year: examSet.year });

    // Verify student exists and belongs to this school
    const studentQuery = `
      SELECT student_id, full_name, reg_number, class_name
      FROM students
      WHERE student_id = $1 AND school_id = $2
    `;
    const studentResult = await (require('../../database/database').pool).query(studentQuery, [studentId, schoolId]);

    if (studentResult.rows.length === 0) {
      console.log('[PDF Report] Student not found', { studentId, schoolId });
      return res.status(404).json({
        message: 'Student not found',
        details: { studentId, schoolId }
      });
    }

    const student = studentResult.rows[0];
    console.log('[PDF Report] Student found', { studentId, name: student.full_name });

    // Check if student has any marks for this exam set
    const marksCheckQuery = `
      SELECT COUNT(*) as mark_count
      FROM results_exam_entries ree
      JOIN results_entry re ON re.exam_entry_id = ree.exam_entry_id
      WHERE ree.student_id = $1 AND ree.exam_set_id = $2
    `;
    const marksCheckResult = await (require('../../database/database').pool).query(marksCheckQuery, [studentId, examSetId]);
    const markCount = parseInt(marksCheckResult.rows[0].mark_count);

    console.log('[PDF Report] Student marks check', { studentId, examSetId, markCount });

    if (markCount === 0) {
      console.log('[PDF Report] No marks found for student', {
        studentId,
        examSetId,
        term: examSet.term,
        year: examSet.year
      });
      return res.status(404).json({
        message: 'No marks found for this student in the selected exam set',
        details: {
          studentId,
          examSetId,
          examSetName: examSet.set_name,
          term: examSet.term,
          year: examSet.year,
          marksCount: markCount
        }
      });
    }

    console.log('[PDF Report] Calling PDF generation service', { studentId, examSetId, schoolId });

    // Generate PDF using PdfGenerationService
    const pdfService = new PdfGenerationService();
    await pdfService.generateStudentReportPdf(studentId, examSetId, schoolId, res);

  } catch (error: any) {
    console.error('[PDF Report] Error generating PDF report:', {
      error: error.message,
      stack: error.stack,
      studentId: req.params.studentId,
      examSetId: req.params.examSetId,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      message: 'Failed to generate PDF report',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/config/grading-scales', async (req: Request, res: Response) => {
  try {
    const scale = await ConfigService.createGradingScale(req.body);
    res.status(201).json(scale);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/config/grading-scales/bulk', async (req: Request, res: Response) => {
  try {
    const { school_id, scales } = req.body;

    if (!school_id || !scales) {
      return res.status(400).json({ message: 'school_id and scales are required' });
    }

    const result = await ConfigService.bulkCreateGradingScales(school_id, scales);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/config/grading-scales/:schoolId', async (req: Request, res: Response) => {
  try {
    const scales = await ConfigService.getGradingScalesBySchool(Number(req.params.schoolId));
    res.json(scales);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/config/grading-scales/:scaleId', async (req: Request, res: Response) => {
  try {
    await ConfigService.deleteGradingScale(Number(req.params.scaleId));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/config/school-settings', async (req: Request, res: Response) => {
  try {
    const setting = await ConfigService.createOrUpdateSchoolSetting(req.body);
    res.status(201).json(setting);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/config/school-settings/:schoolId', async (req: Request, res: Response) => {
  try {
    const setting = await ConfigService.getSchoolSetting(Number(req.params.schoolId));
    if (!setting) return res.status(404).json({ message: 'School setting not found' });
    res.json(setting);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/config/holistic-metrics', async (req: Request, res: Response) => {
  try {
    const metric = await ConfigService.createHolisticMetric(req.body);
    res.status(201).json(metric);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/config/holistic-metrics/:schoolId', async (req: Request, res: Response) => {
  try {
    const metrics = await ConfigService.getHolisticMetricsBySchool(Number(req.params.schoolId));
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/config/holistic-metrics/:metricId', async (req: Request, res: Response) => {
  try {
    await ConfigService.deleteHolisticMetric(Number(req.params.metricId));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

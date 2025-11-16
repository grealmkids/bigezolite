import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  SubjectService,
  ExamSetService,
  MarksEntryService,
  ReportService,
  ConfigService
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

router.post('/marks/bulk-upload', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { exam_set_id, school_id, entries } = req.body;

    if (!exam_set_id || !school_id || !entries) {
      return res.status(400).json({ message: 'exam_set_id, school_id, and entries are required' });
    }

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

import { Router } from 'express';
import * as studentController from '../../services/students/student.controller';
import * as feesController from '../../services/fees/fees.controller'; // Import fees controller
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// All student routes are protected
router.use(authenticateToken);

// POST /api/v1/students - Create a new student
router.post('/', studentController.createStudent);

// GET /api/v1/students - Get a list of students for the school (with optional search)
router.get('/', studentController.getStudents);

// GET /api/v1/students/:studentId - Get a single student's full details
router.get('/:studentId', studentController.getStudentById);

// PUT /api/v1/students/:studentId - Update a student's details
router.put('/:studentId', studentController.updateStudent);

// DELETE /api/v1/students/:studentId - Delete a student
router.delete('/:studentId', studentController.deleteStudent);

// POST /api/v1/students/:studentId/photo - Upload student photo
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });
router.post('/:studentId/photo', upload.single('file'), studentController.uploadPhoto);

// --- Nested Fee Routes ---

// POST /api/v1/students/:studentId/fees - Create a new fee record for a student
router.post('/:studentId/fees', feesController.createFeeRecord);

// GET /api/v1/students/:studentId/fees - Get all fee records for a student
router.get('/:studentId/fees', feesController.getFeeRecords);

// POST /api/v1/students/:studentId/terms - Upsert student term presence/status
router.post('/:studentId/terms', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const studentId = Number(req.params.studentId);
    const { year, term, presence, status_at_term, class_name_at_term } = req.body || {};
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!studentId || !year || !term) return res.status(400).json({ message: 'Missing year/term/studentId' });

    // verify ownership via student->school
    const authSql = `SELECT s.school_id FROM students s JOIN schools sch ON s.school_id = sch.school_id WHERE s.student_id = $1 AND sch.user_id = $2`;
    const { query } = await import('../../database/database');
    const auth = await query(authSql, [studentId, userId]);
    if (auth.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });
    const schoolId = auth.rows[0].school_id;

    const upsertSql = `
      INSERT INTO student_terms (school_id, student_id, year, term, class_name_at_term, status_at_term, presence)
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, TRUE))
      ON CONFLICT (student_id, year, term)
      DO UPDATE SET presence = COALESCE($7, TRUE), class_name_at_term = $5, status_at_term = $6
      RETURNING *
    `;
    const up = await query(upsertSql, [schoolId, studentId, year, term, class_name_at_term || null, status_at_term || null, presence !== undefined ? !!presence : true]);
    res.status(200).json(up.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// DELETE /api/v1/students/:studentId/fees/:feeRecordId - Delete a specific fee record
router.delete('/:studentId/fees/:feeRecordId', feesController.deleteFeeRecord);

export default router;

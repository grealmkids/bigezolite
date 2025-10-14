
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

// --- Nested Fee Routes ---

// POST /api/v1/students/:studentId/fees - Create a new fee record for a student
router.post('/:studentId/fees', feesController.createFeeRecord);

// GET /api/v1/students/:studentId/fees - Get all fee records for a student
router.get('/:studentId/fees', feesController.getFeeRecords);


// TODO: Add routes for getting a single student, updating, etc.

export default router;

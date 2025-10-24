
import { Router } from 'express';
import * as schoolController from '../../services/schools/school.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// All routes in this file are protected and require a valid token
router.use(authenticateToken);

// POST /api/v1/schools - Create a new school
router.post('/', schoolController.createSchool);

// GET /api/v1/schools/my-school - Get the school associated with the logged-in user
router.get('/my-school', schoolController.getMySchool);

// GET list of schools belonging to the user
router.get('/', schoolController.listMySchools);

// GET single school by id
router.get('/:id', schoolController.getSchoolById);

// PUT update school by id
router.put('/:id', schoolController.updateSchool);

// DELETE school by id
router.delete('/:id', schoolController.deleteSchool);

// POST /api/v1/schools/switch - Switch active school
router.post('/switch', schoolController.switchSchool);

export default router;

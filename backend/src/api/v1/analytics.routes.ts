import { Router } from 'express';
import * as analyticsController from '../../services/analytics/analytics.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// All analytics routes are protected
router.use(authenticateToken);

// GET /api/v1/analytics - Get analytics for the current school
router.get('/', analyticsController.getAnalytics);

export default router;

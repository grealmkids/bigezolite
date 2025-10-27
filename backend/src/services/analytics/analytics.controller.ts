import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as analyticsService from './analytics.service';

/**
 * GET /api/v1/analytics
 * Get analytics data for the current school
 */
export const getAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated.' });
        }

        // Accept schoolId from query parameter
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;

        if (!schoolId) {
            return res.status(400).json({ message: 'Missing schoolId parameter.' });
        }

        console.log('[getAnalytics] userId:', userId, 'schoolId:', schoolId);

    // Optional query params for year and term to filter fee records
    const year = req.query.year ? Number(req.query.year) : undefined;
    const term = req.query.term ? Number(req.query.term) : undefined;
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

    const analytics = await analyticsService.getSchoolAnalytics(schoolId, year, term, refresh);
        
        res.status(200).json(analytics);
    } catch (error) {
        console.error('[getAnalytics] Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { query } from '../database/database';

export const checkSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(403).json({ message: 'Forbidden: User is not associated with a school.' });
        }

        const schoolQuery = 'SELECT account_status FROM schools WHERE school_id = $1';
        const schoolResult = await query(schoolQuery, [schoolId]);

        if (schoolResult.rows.length === 0) {
            return res.status(404).json({ message: 'School not found.' });
        }

        const accountStatus = schoolResult.rows[0].account_status;

        if (accountStatus !== 'Active') {
            return res.status(403).json({ message: 'Forbidden: Your account is not active. Please subscribe to use this feature.' });
        }

        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

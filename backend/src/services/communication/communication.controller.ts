import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getSmsCredits, processBulkSms, processSingleSms } from './communication.service';

export const getSmsCreditBalance = async (req: AuthenticatedRequest, res: Response) => {
    try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
    const credits = await getSmsCredits(schoolId);
        res.json(credits);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching SMS credit balance' });
    }
};

export const sendBulkSms = async (req: AuthenticatedRequest, res: Response) => {
    try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
    const { recipientFilter, message } = req.body;
    await processBulkSms(schoolId, recipientFilter, message);
        res.status(200).json({ message: 'Bulk SMS processed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error processing bulk SMS' });
    }
};

export const sendSingleSms = async (req: AuthenticatedRequest, res: Response) => {
    try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
    const { studentId, message } = req.body;
    await processSingleSms(schoolId, studentId, message);
        res.status(200).json({ message: 'Single SMS processed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error processing single SMS' });
    }
};
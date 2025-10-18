import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getSmsCredits, processBulkSms, processSingleSms } from './communication.service';

export const getSmsCreditBalance = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const credits = await getSmsCredits(schoolId);
        return res.json(credits);
    } catch (error: any) {
        // Try to include provider/network details if available
        const providerMessage = error?.message || (error?.response && error.response.data) || null;
        return res.status(500).json({ message: 'Error fetching SMS credit balance', details: providerMessage });
    }
};

export const sendBulkSms = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const { recipientFilter, message } = req.body;
        await processBulkSms(schoolId, recipientFilter, message);
        return res.status(200).json({ message: 'Bulk SMS processed successfully' });
    } catch (error: any) {
        // Provide more informative failure to frontend when possible
        const providerMessage = error?.message || (error?.response && error.response.data) || null;
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: 'Error processing bulk SMS', details: providerMessage });
    }
};

export const sendSingleSms = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const { studentId, message } = req.body;
        await processSingleSms(schoolId, studentId, message);
        return res.status(200).json({ message: 'Single SMS processed successfully' });
    } catch (error: any) {
        // Provide more informative failure to frontend when possible
        const providerMessage = error?.message || (error?.response && error.response.data) || null;
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: 'Error processing single SMS', details: providerMessage });
    }
};
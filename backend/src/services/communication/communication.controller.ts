import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getSmsCredits, processBulkSms, processSingleSms, processFeesReminder, processBulkFeesReminders, previewBulkFeesRemindersData, previewBulkSmsData } from './communication.service';
import { getSmsCredentialsForSchool } from './smsCredentials.service';
import { checkBalance } from '../../utils/sms.util';
import { upsertSmsAccount, addSmsTransaction } from './smsAccount.service';
import { config } from '../../config';
import { upsertSmsCredentials } from './smsCredentials.service';

export const getSmsCreditBalance = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        // Require per-school credentials for balance check (no fallback to global env)
        const creds = await getSmsCredentialsForSchool(schoolId);
        if (!creds) {
            return res.status(403).json({ message: 'Subscribe or Contact Support' });
        }

        // Query provider for raw balance
        const rawBalance = await checkBalance(creds.username, creds.password);

        // Persist provider raw balance
        await upsertSmsAccount(schoolId, rawBalance);
        await addSmsTransaction(schoolId, 'check', rawBalance, { raw: rawBalance });

    // Compute display balance using configured COST_PER_SMS to allow reseller margin.
    // Formula: display = round(providerRaw * COST_PER_SMS / 35)
    const configuredCostPerSms = Number(config.costPerSms ?? (process.env.COST_PER_SMS ? Number(process.env.COST_PER_SMS) : 35));
    const displayBalance = Math.round((Number(rawBalance) || 0) * configuredCostPerSms / 35);

    return res.json({ providerBalance: rawBalance, balance: displayBalance, costPerSms: configuredCostPerSms });
    } catch (error: any) {
        // Try to include provider/network details if available
        const providerMessage = error?.message || (error?.response && error.response.data) || null;
        return res.status(500).json({ message: 'Error fetching SMS credit balance', details: providerMessage });
    }
};

export const previewBulkSms = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const { recipientFilter } = req.body;
        const preview = await previewBulkSmsData(schoolId, recipientFilter);
        return res.status(200).json(preview);
    } catch (error: any) {
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: error?.message || 'Error generating bulk SMS preview', details: error?.details });
    }
};

export const sendBulkSms = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const { recipientFilter, message } = req.body;
        console.debug('[sendBulkSms] recipientFilter:', recipientFilter, 'schoolId:', schoolId);
        const report = await processBulkSms(schoolId, recipientFilter, message);
        return res.status(200).json({ message: 'Bulk SMS processed successfully', ...report });
    } catch (error: any) {
        // Provide more informative failure to frontend when possible
        const providerMessage = error?.details || error?.message || (error?.response && error.response.data) || null;
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: error?.message || 'Error processing bulk SMS', details: providerMessage });
    }
};

export const sendSingleSms = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const { studentId, message } = req.body;
        await processSingleSms(schoolId, studentId, message);
        return res.status(200).json({ message: 'Single SMS processed successfully' });
    } catch (error: any) {
        // Provide more informative failure to frontend when possible
        const providerMessage = error?.details || error?.message || (error?.response && error.response.data) || null;
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: error?.message || 'Error processing single SMS', details: providerMessage });
    }
};

export const setSmsCredentials = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const { username, password, provider } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'username and password are required' });
        await upsertSmsCredentials(schoolId, username, password, provider || 'egosms');
        return res.status(200).json({ message: 'Credentials saved' });
    } catch (error: any) {
        const providerMessage = error?.message || (error?.response && error.response.data) || null;
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: 'Error saving credentials', details: providerMessage });
    }
};

// GET saved credentials for the authenticated user's school
export const getSmsCredentials = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const creds = await getSmsCredentialsForSchool(schoolId);
        if (!creds) return res.status(404).json({ message: 'No credentials found' });
        return res.json({ username: creds.username, password: creds.password, provider: (creds as any).provider || 'egosms' });
    } catch (error: any) {
        return res.status(500).json({ message: 'Error fetching credentials', details: error?.message || null });
    }
};

// Send fees reminder to individual student
export const sendFeesReminder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const studentId = parseInt(req.params.studentId);
        if (!studentId) return res.status(400).json({ message: 'Student ID is required' });
        await processFeesReminder(schoolId, studentId);
        return res.status(200).json({ message: 'Fees reminder sent successfully' });
    } catch (error: any) {
        const providerMessage = error?.details || error?.message || (error?.response && error.response.data) || null;
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: error?.message || 'Error sending fees reminder', details: providerMessage });
    }
};

// Preview bulk fees reminders before sending
export const previewBulkFeesReminders = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const { thresholdAmount, classFilter, statusFilter, customDeadline, year, term, feesStatus, messageType, messageTemplate } = req.body;
        if (thresholdAmount == null || thresholdAmount < 0) return res.status(400).json({ message: 'Valid threshold amount is required' });
        const preview = await previewBulkFeesRemindersData(schoolId, thresholdAmount, classFilter, statusFilter, customDeadline, year, term, feesStatus, messageType, messageTemplate);
        return res.status(200).json(preview);
    } catch (error: any) {
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: error?.message || 'Error generating preview', details: error?.details });
    }
};

// Send bulk fees reminders with filters
export const sendBulkFeesReminders = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
        const schoolId = schoolIdFromQuery || req.user?.schoolId;
        if (!schoolId) return res.status(401).json({ message: 'Unauthorized: missing school context' });
        const { thresholdAmount, classFilter, statusFilter, customDeadline, year, term, feesStatus, messageType, messageTemplate } = req.body;
        if (thresholdAmount == null || thresholdAmount < 0) return res.status(400).json({ message: 'Valid threshold amount is required' });
        const report: any = await processBulkFeesReminders(schoolId, thresholdAmount, classFilter, statusFilter, customDeadline, year, term, feesStatus, messageType, messageTemplate);
        return res.status(200).json({ message: 'Bulk fees reminders sent successfully', ...report });
    } catch (error: any) {
        const providerMessage = error?.details || error?.message || (error?.response && error.response.data) || null;
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({ message: error?.message || 'Error sending bulk fees reminders', details: providerMessage });
    }
};

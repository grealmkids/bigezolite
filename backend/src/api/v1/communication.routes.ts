
import { Router } from 'express';
import { sendBulkSms, sendSingleSms, getSmsCreditBalance, setSmsCredentials, getSmsCredentials, sendFeesReminder, sendBulkFeesReminders } from '../../services/communication/communication.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { checkSubscription } from '../../middleware/subscription.middleware';

const router = Router();

router.get('/credits', authMiddleware, checkSubscription, getSmsCreditBalance);
router.post('/bulk-sms', authMiddleware, checkSubscription, sendBulkSms);
router.post('/single-sms', authMiddleware, checkSubscription, sendSingleSms);
router.post('/fees-reminder/:studentId', authMiddleware, checkSubscription, sendFeesReminder);
router.post('/bulk-fees-reminders', authMiddleware, checkSubscription, sendBulkFeesReminders);
// Allow saving credentials without subscription middleware; user must be authenticated and associated with a school
router.post('/credentials', authMiddleware, setSmsCredentials);
router.get('/credentials', authMiddleware, getSmsCredentials);

export default router;

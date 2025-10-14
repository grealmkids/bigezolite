
import { Router } from 'express';
import { sendBulkSms, sendSingleSms, getSmsCreditBalance } from '../../services/communication/communication.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { checkSubscription } from '../../middleware/subscription.middleware';

const router = Router();

router.get('/credits', authMiddleware, checkSubscription, getSmsCreditBalance);
router.post('/bulk-sms', authMiddleware, checkSubscription, sendBulkSms);
router.post('/single-sms', authMiddleware, checkSubscription, sendSingleSms);

export default router;

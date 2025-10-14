
import { Router } from 'express';
import * as subscriptionController from '../../services/subscription/subscription.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.post('/initiate-payment', authMiddleware, subscriptionController.initiatePayment);
router.get('/payment-status/:orderTrackingId', authMiddleware, subscriptionController.getPaymentStatus);

export default router;

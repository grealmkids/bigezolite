
import { Router } from 'express';
import * as subscriptionController from '../../services/subscription/subscription.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.post('/initiate-payment', authMiddleware, subscriptionController.initiatePayment);
router.post('/order', authMiddleware, subscriptionController.order);
router.get('/payment-status/:orderTrackingId', authMiddleware, subscriptionController.getPaymentStatus);

export default router;

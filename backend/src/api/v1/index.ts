
import { Router } from 'express';
import userRoutes from './user.routes';
import schoolRoutes from './school.routes';
import studentRoutes from './student.routes';
import feesRoutes from './fees.routes';
import communicationRoutes from './communication.routes';
import subscriptionRoutes from './subscription.routes';
import authRoutes from './auth.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

router.use('/users', userRoutes);
router.use('/schools', schoolRoutes);
router.use('/students', studentRoutes);
router.use('/fees', feesRoutes);
router.use('/communications', communicationRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/auth', authRoutes);
router.use('/analytics', analyticsRoutes);

export default router;

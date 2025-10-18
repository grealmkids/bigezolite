
import { Router } from 'express';
import * as userController from '../../services/users/user.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', userController.register);
router.post('/login', userController.login);
// protected endpoint to fetch current user info
router.get('/me', authMiddleware, userController.me);

export default router;

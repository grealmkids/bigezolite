import { Router } from 'express';
import { googleAuth } from '../../services/auth/auth.controller';

const router = Router();

// POST /api/v1/auth/google
router.post('/google', googleAuth);

// Staff Auth
import * as staffAuthController from '../../services/auth/staff-auth.controller';
router.post('/staff/login', staffAuthController.login);
router.post('/staff/google', staffAuthController.googleLogin);
router.post('/staff/forgot-password', staffAuthController.forgotPassword);
router.post('/staff/reset-password', staffAuthController.resetPassword);

export default router;

// helpful no-op export so the language server reliably sees this module
export const __auth_routes_module_marker = true;

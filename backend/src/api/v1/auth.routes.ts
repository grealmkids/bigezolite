import { Router } from 'express';
import { googleAuth } from '../../services/auth/auth.controller';

const router = Router();

// POST /api/v1/auth/google
router.post('/google', googleAuth);

export default router;

// helpful no-op export so the language server reliably sees this module
export const __auth_routes_module_marker = true;

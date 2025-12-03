import { Router } from 'express';
import * as utilsController from '../../services/utils/utils.controller';

const router = Router();

// GET /api/v1/utils/proxy-image?url=...
router.get('/proxy-image', utilsController.proxyImage);

export default router;
